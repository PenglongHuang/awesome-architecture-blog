---
title: "T05 · When the model will not fit or run fast: designing GPU systems"
description: "Derive distributed training topology from memory budgets, combine ZeRO, TP, PP, CP and EP, and account for precision, checkpointing and recovery in goodput."
series: "model-training"
order: 5
pubDate: 2026-11-13
kind: "tutorial"
tags: ["Model training decisions","Distributed training","GPU memory","Checkpoint"]
locale: "en"
translationKey: "tutorial/t05-training-system-distributed-topology"
sourceHash: "1fa1de4f7d7d0a656d151e49767c935e57218c0995e8f82abc43ed6e03b0228a"
---

## One model plan, three ways to fail

Start with a real model size as an anchor: [Inkling 2 Small](https://thinkingmachines.ai/news/inkling-2-small) (Thinking Machines, 2026-11-05 official training ledger page) is a MoE of 594B total parameters / 17B active parameters (measurement basis: official disclosure). Let’s put the simplest question on the table - this set of weights uses BF16 to store about 1.19TB (each parameter is 2 bytes), and the GPU memory of a single GPU is hundreds of GB. **Training hasn't started yet, but just "putting the model in" is already beyond the capabilities of any single card.**

So the team started working and then rolled over in three ways (the following three scenes are typical modes of teaching induction, not specific to any company):

- **Flip 1: Can’t be loaded (the graphics memory account is not calculated).** I copied the number of GPUs according to the paper, and the first step was OOM (overflow of memory). There are more than just weights living in the GPU memory: gradients, optimizer states, and activation values ​​must be present at every step of training - I will show you the calculations later. For a model with 594B total parameters, the sum of these three is several times the weight.
- **Failure 2: it runs too slowly (communication costs were omitted).** The model was finally cut and trained, but the MFU (compute utilization, defined in Chapter 2) was only a dozen percent—the GPU spent most of its time waiting for other GPUs. Doubling the parallelism does not mean halving the time: every additional parallel dimension creates an additional type of communication, and which network the communication sits on determines whether it is affordable or not.
- **Failure 3: it cannot recover (the full state was not saved).** In the third week of training, a node failed. After recovering from the checkpoint, the loss jumped directly from 1.9 to 2.4, and there was no going back - that checkpoint only saved the model weights, and "where the training is going" is far more than the weights.

It's worth taking a look first: every architectural decision in the previous chapter (T04) will have corresponding system problems in this chapter - this is the complete list of "the skeleton is decided, the system will repay the debt":

| T04 Decision | What does it become in this chapter? |
|---|---|
| Trillions of total parameters | The four graphics storage accounts explode and state sharding becomes necessary |
| Sparse MoE | EP dimension, expert routing All-to-All, load balancing |
| long context | Activation value explodes, recalculation and CP are on the table |
| Attention and layer structure selection | The size of a single layer determines the degree of TP necessary |

Three types of rollovers correspond to three accounts: memory account, communication account, and reliability account on the timeline. The derivation sequence of this chapter is determined by this, which is the methodology in the title—— **The ledger goes first (calculate whether the GPU memory can fit in it), then the combination (how to multiply the parallel dimensions), and the timeline decision (accuracy, optimizer and Goodput determine how fast the end-to-end is)**。

There is another question to clarify: Why is it said that "the training system is not operation and maintenance"? Operations and maintenance answer "how to keep the existing system running normally"; training system design is an architectural decision - how many parallel dimensions to use, what precision to use, and how often to save checkpoints. Each choice rewrites the resource bill and failure mode. If the direction is wrong, no matter how tight the monitoring is, it cannot be saved. What this chapter focuses on is that only if a technology changes the data shape, calculation graph, system topology, resource billing, or failure mode, is it an architectural issue to be discussed in this chapter.

The derivation route of this chapter:

```text
Section 1 One-step training machinery: five states, one-step flow
    ↓
Section 2 Four obvious deposit accounts: first answer "Can it be installed" (account books first)
    ↓
Section 3 Parallel Strategies: Derivation of Topology from Computational Graphs (Composition Follows)
    ↓
Section 4 Numerical Accuracy: Save half the bill, pass three layers of constraints first
    ↓
Section 5 Optimizer: AdamW’s account, Muon’s boundary and hyperparameter discipline
    ↓
Section 6 Training Reliability: Checkpoint State Machine, Loss Spike and Goodput (Timeline Judgment)
    ↓
Section 7 Case Teardown: DeepSeek V4’s Staged Hybrid Chip Stack
    ↓
Section 8 Framework as Project Carrier + Distributed Training Configuration
```

---

## 1. A training step: five kinds of state and one pipeline

There are many problems with the training system, and there is only one source: **What happened in one-step training?**. Only by taking one step apart can all subsequent discussions on GPU memory, parallelism, precision, and fault tolerance be put into perspective.

### 1. One step flow

```text
Get a Batch Token sequence
   ↓ ① Forward: Calculate layer by layer to obtain the prediction of the next Token at each position
   ↓ ② Loss: Compare the prediction with the real next Token, and get a scalar "how wrong it is"
   ↓ ③ Backward: Backwards along the calculation graph to calculate the gradient of each parameter (where to adjust to reduce the loss)
   ↓ ④ Optimizer Step: Update each parameter according to gradient and optimizer rules
   ↓ Discard this batch of activation values and enter the next Batch
```

This step of pipeline is complete on a single card; distributed training does not invent new steps, it just makes these four steps happen on many cards, and pays the full price for "where to put the state".

### 2. Five states of being present at the same time

| Status | what is | Who is reading/writing | What determines size |
|---|---|---|---|
| parameters | All models can learn numbers (MoE includes all experts) | Read forward, optimizer writes | Total parameters × precision bytes |
| Gradient | "Where should I adjust each parameter and how urgently should I adjust it?" | Write in reverse, read by optimizer | Same shape as parameter × precision |
| Optimizer status | Optimizer internal memory (momentum, etc., expanded on in Section 5) | Optimizer read and write | Number of parameters × number of status bytes |
| activation value | The intermediate results of each layer in the forward direction are used in the reverse direction | Write forward, read backward | Batch size × sequence length × number of layers |
| Temporary Buffer | Communication buffer, operator temporary space | Framework management | Parallel scheme and operator implementation |

An intuitive classification: the first two copies are "the model itself", the third copy is "the memory of the optimizer", and the last two copies are "the workbench of this step". **Training GPU memory = sum of five parts**, anything that "can't fit" means that one of them has exploded; all the methods later in this chapter are essentially answering where to put these five things.

### 3. Three means of exchange

When the status cannot be released, there are only three exchanges that can be made in the project:

| means | exchange method | cost |
|---|---|---|
| Recompute (activate checkpoints) | Only the boundaries of each layer are stored in the forward direction, and the intermediate results are recalculated in the reverse direction | One more (partial) forward calculation will significantly reduce the activated GPU memory |
| gradient accumulation | Divide the large batch into multiple micro-batches, accumulate gradients and update once | Mathematically equivalent to a large batch, but one step takes longer |
| Offload | Move the temporarily unused state to the host memory | Trade PCIe/NVLink bandwidth for GPU memory, time for space |

(Qualitative teaching summary; the three are often used in combination, and the costs are recorded in the utilization measurement basis in Section 6.)

### 4. An arithmetic to fix the starting point of this chapter

Using the approximate static-state budget of 16 bytes per parameter derived in section 2, under BF16 mixed precision and AdamW, begin with rough arithmetic. This teaching estimate assumes 80GB per GPU

```text
The number of parameters that can be directly trained by a single card ≈ 80GB ÷ 16 bytes/parameter ≈ 5B parameters
                                          (Not counting activation and Buffer)

Compare: Static state of a 7B model ≈ 7B × 16 bytes = 112GB > 80GB
     → Even 7B requires state fragmentation or uninstallation before it can be "installed"
Control: 594B static state of total parameters MoE ≈ 9.5TB
     → Requires full parallel set starting at 72 cards (expanded in sections 2 and 3)
```

This arithmetic is the starting point for this chapter: **Under the model size of 2026, "single card direct training" only covers the teaching scale; all real training starts from "the state cannot be let go"**. Distributed training is not optional, it is inevitable for the model form to grow directly.

> **Architectural wisdom:** All problems in the training system are "how to put the five states". The inability to load is a problem of state capacity, the inability to run quickly is a problem of state transportation, and the inability to restore is a problem of state snapshots. List all the states first, and then discuss the plan - skipping this step and copying the parallel configuration is equivalent to placing a bet without looking at the cards.

---

## 2. Four memory ledgers: will it fit?

### 1. The half-sentence left in Chapter 2 is fulfilled now

When calculating training FLOPs in Chapter 2, I said: The calculation amount is based on the active parameters, and the total parameters do not participate in the calculation - "It determines the GPU memory and loading, which is the topic of the T05 training system chapter." Cash out now: **All four books of the display account are calculated according to the total parameters**. For the 594B total parameters / 17B activated MoE, the difference between the two measurement bases is about 35 times - 17B for the compute account and 594B for the GPU memory account. This is the first tension of the MoE training system: in calculation it is like a 17B model, in terms of GPU memory it is a 594B model.

### 2. Calculate the four accounts one by one (taking 594B General Staff as an example)

| ledger | rough estimate | Teaching Estimation (594B General) |
|---|---|---:|
| Ledger 1: Parameters | BF16, 2 bytes × total parameters | ≈ 1.19 TB |
| Ledger 2: Gradient | BF16, 2 bytes × total parameters | ≈ 1.19 TB |
| Ledger Three: Master Weight + Optimizer Status | FP32 master weight 4 bytes + AdamW double momentum 8 bytes | ≈ 2.38 TB + 4.75 TB |
| **Static total (first three books)** | **About 16 bytes × total parameters** (BF16 mixed precision + AdamW measurement basis) | **≈ 9.5 TB** |
| Ledger 4: Activation and Buffer | It grows with batch size × sequence length × number of layers (the recalculation strategy directly rewrites this one) | Calculated separately, considerable |

measurement basis discipline: This is the teaching estimate of this article, not any official disclosure; it is assumed to be "BF16 mixed precision + AdamW", excluding activation, communication Buffer and framework overhead. If you change the optimizer, accuracy, and weight calculation strategy, the first three and fourth books will change - but the order of "list the measurement basis first and then report the number" cannot be changed.

**What does 9.5 TB mean?**: Even if the static state is perfectly evenly distributed across 72 GPUs (the number of cards in an NVL72 rack), each card will cost about 130GB - this is just the static part, and the activation value and communication buffer must be calculated separately. So no single means will solve the problem - there must be a combination, which is the subject of the next section.

### 3. How does accuracy rewrite this account?

"About 16 bytes/parameter" is not a constant, it is a function of the precision scheme. Arrange the static accounts of three typical solutions together (unit: byte/parameter, excluding activation and Buffer; teaching measurement basis):

| Accuracy scheme | parameters | Gradient | FP32 master weight | Optimizer status | static total |
|---|---:|---:|---:|---:|---:|
| Full FP32 | 4 | 4 | — (the weights themselves are the master weights) | 8 | 16 |
| BF16 Mix + AdamW | 2 | 2 | 4 | 8 | 16 |
| Weight/Gradient FP8 + FP32 state | 1 | 1 | 4 | 8 | 14 |

Read two counter-intuitive conclusions: First, **Assuming in the table, static state for both BF16 hybrid and full FP32 is 16 bytes/parameter** ——The space saved by BF16 parameters and gradients is offset by the additional FP32 master weight; mixed precision can still improve computational throughput and activation occupancy, and static GPU memory benefits cannot be inferred based on computational precision alone; secondly, **Reduce the weight gradient to FP8, saving only 2 bytes in static accounts** ——The bulk of FP8’s revenue lies in calculating throughput and activation (Section 4), not in the static account. These two items are the most common mistakes in "copying accuracy".

### 4. Why maintain FP32 master weights?

There are two copies of parameters in mixed precision training: the BF16 copy is responsible for high-speed forward/reverse calculations, and the FP32 master weight is responsible for cumulative updates. Intuitive explanation: The mantissa of BF16 only has 8 digits. When "adding large numbers to decimals", small updates will be directly rounded and discarded - the amount of single-step updates is often very small compared to the parameters themselves. After accumulating several steps, there may be no change in BF16. The FP32 master weight faithfully accumulates the small updates in each step, and then synchronizes a new BF16 copy for calculation. **Calculating quickly and remembering accurately are two different states** ——This is why in the Checkpoint five-piece set in Section 6, the optimizer status and master weight cannot be replaced by weight copies.

### 5. State fragmentation: ideas of ZeRO and FSDP

The solution to the first three static accounts is a clear idea: **Since it is a waste to have a copy of the status on all cards, then slice them and spread them on all cards, and temporarily aggregate whoever is used**. This is the core of ZeRO (method origin: Microsoft 2020 paper, sharding by parameters/gradients/optimizer status) and PyTorch FSDP (Fully Sharded Data Parallel, bringing this idea into the PyTorch ecosystem) - exchanging communication for GPU memory. Section 3 will put it back into the parallel family and combine it together.

### 6. It’s up to you to do it: a 7B Dense memory account

Practice with the smallest real volume (7B Dense, teaching estimate, excluding activation and framework overhead):

| ledger | measurement basis | Estimate |
|---|---|---:|
| parameters | BF16, 2 bytes × 7B | 14 GB |
| Gradient | BF16, 2 bytes × 7B | 14 GB |
| FP32 master weight | 4 bytes × 7B | 28 GB |
| Optimizer states (AdamW’s two moment estimates) | 8 bytes × 7B | 56 GB |
| **static total** | ~16 bytes/parameter | **Approx. 112 GB** |

The conclusion is immediately readable: assuming a single card has 80GB, this static account cannot be accommodated—— **"7B model single card training" is not valid under the measurement basis of mixed precision + AdamW**, either shard or offload state, or use multiple GPUs. This excludes activations: longer sequences and larger batches increase the fourth ledger, which recomputation and CP address. Scale also matters: 7B static state is 112GB, while a 594B-total-parameter MoE requires about 9.5TB, an 85× difference. Neither can train directly on one GPU, **The only difference is "how complex the combination is required"**。

> **Boundary:** State the precision, optimizer, activation and framework-overhead assumptions behind every GPU-memory estimate. “600B model” is insufficient: 600B × 2 bytes and 600B × 16 bytes differ by 8×. Omitting activations adds more error. Begin every training review by checking these measurement bases.

---

## 3. Derive the parallel topology from the compute graph

Parallelism is not five options that can be checked at will, but five dimensions that each answer "what to cut and what to pass". Let’s get to know them one by one first, and then see how to multiply them.

### 1. Five parallel dimensions

| Dimensions | What to cut | What to communicate | when to use |
|---|---|---|---|
| Data Parallel DP | Each card has a complete copy of the model, each with different data | Synchronize gradients once per optimizer step (AllReduce) | The simplest expansion when the model can fit a single card |
| State Sharding ZeRO / FSDP | Spread parameter/gradient/optimizer state slices on top of DP | Forward/reverse on-demand aggregation parameter sharding | When a single card cannot be installed in the static state |
| Tensor Parallel TP | Cut the single-layer weight matrix and calculate the combined force of multiple cards into one layer | Each layer must communicate forward/reversely, high-frequency small messages | A single layer is too large, and there is internal high-bandwidth interconnection between cards |
| Pipeline parallel PP | Cut the layers into consecutive stages, with each card responsible for one section | Stage boundary transmission activation, point-to-point | Scalable across machines, tolerating lower bandwidth |
| Sequential/contextual parallel CP | Cut a sequence and collaborate with multiple cards | Attention computation requires cross-card coordination | When long sequences activate explosions |
| Expert Parallel EP | Assign MoE experts to different cards | Each Token is routed to the expert’s card (All-to-All) | Essential Dimensions of MoE |

### 2. Combining formulas with a topological diagram

```text
Combination formula: Total number of GPUs = DP × TP × PP × CP × EP
(torchtitan calls this combination 5D parallelism, measurement basis: PyTorch official blog)

Illustration: a MoE training topology, 72 cards = DP2 × TP2 × PP2 × EP9 (numbers are teaching illustrations)

   Pipeline stage 0 (lower level) Pipeline stage 1 (upper level)
   ┌──────────────────────┐        ┌──────────────────────┐
   │ DP group 0: TP=2 matrix within slice │        │ DP group 0: TP=2          │
   │          EP=9 points expert    │ ─────→ │          EP=9 points expert    │
   │ DP Group 1: Same as above           │ Pass activation  │ DP Group 1: Same as above           │
   └──────────────────────┘        └──────────────────────┘
        │      ↑                          │      ↑
        │      └─ Expert routing All-to-All (continuous high frequency, stay in the NVLink domain within the machine)
        └─ Gradient synchronization AllReduce (once per optimizer step)

   Cross-machine (if there are multiple racks): PP activated point-to-point + DP gradient synchronization + cross-machine expert routing,
   Fully cross-machine network - the bandwidth is one order of magnitude lower than that inside the machine, and the traffic that can stay inside the machine will never be sent out
```

How to read this picture: **Each dimension introduces a kind of communication, and each communication has its own frequency, message size and tolerable delay; the essence of topology design is to price the communication classification** ——High-frequency small messages (All-to-All of TP and EP) are put into the in-machine NVLink domain, and low-frequency large synchronization (DP gradient, PP activation) can travel across the inter-machine network.

### 3. Communication classification pricing table

| communication mode | who is using | Frequency and message | Tolerable delay | Which network should it fall on? |
|---|---|---|---|---|
| AllReduce (gradient synchronization) | DP | Once per optimizer step, big news | in | Best within the aircraft, tolerable across aircraft |
| AllGather (shard aggregation) | ZeRO / FSDP、TP | Forward/reverse interlayer, high frequency | low | In-machine high bandwidth domain |
| All-to-All (expert routing) | EP | Each Token, each layer, continuous traffic | extremely low | NVLink domain inside the machine, try not to leave the rack |
| Point-to-point communication (activation transfer) | PP | Once per micro-batch | Middle to high | Can cross machines |

The usage of this table is reversed: **First look at "how much delay can be tolerated and which network can be afforded" for each type of communication, and then decide where to draw the boundary of the corresponding parallel dimension**. All-to-All goes out of the rack, and the throughput is immediately locked by the cross-machine bandwidth - this is the fundamental reason why the topology in 2026 is organized in units of racks.

### 4. Infer parallel combination from model form

Parallel combination is not copied from "other people's configuration", but derived from one's own model form. Derivation chain (decision-making derivation, the order cannot be messed up):

```text
Question 1: does static state fit on one GPU? See the four ledgers in section 2
         └ It can be installed → Use DP to eat the simple expansion first, and then ask further
         └ Does not fit -> enable state sharding with ZeRO/FSDP, then continue
Question 2: Can a single card be moved after a single layer of weight is cut?
         └ Single layer is too big → TP (note: TP communication high frequency, only placed in the machine)
Question 3: There are too many layers to fit on a single card/too many to fit?
         └ The layer cannot be placed → PP (point-to-point transmission is activated, and can be cross-machine)
Question 4: Is the sequence long enough to activate an explosion?
         └ Long → Recalculate + CP
Question 5: is it MoE?
         └ Yes → EP first: Experts group to decide the layout within the rack,
              Then let DP/TP/PP cooperate in the remaining dimensions
The closing DP eats up the remaining extensions; checks the five-dimensional product = the actual number of GPUs;
         Review which network each type of traffic falls on according to the "Communication Classification Pricing Table"
```

### 5. The communication bottleneck of MoE training is fundamentally different from that of Dense

The main communication of the Dense model is gradient synchronization once per step; MoE adds a layer of continuous traffic on top of this: **Each Token must be sent by the router to the card of the selected expert at each layer**, which results in All-to-All communication - all cards send data to all cards at the same time. It brings two problems that Dense does not have:

- **Traffic is constant and huge**: It grows linearly with Token throughput and cannot be diluted by the rhythm of "waiting for one step to synchronize once";
- **uneven load**: When experts are activated unevenly, the card where the hot expert is located becomes the bottleneck and other cards are idle. In engineering, mechanism constraints such as routing balance loss and expert capacity upper limit are used (qualitative; the specific mechanism varies with the model).

The 2026 flagship examples illustrate activation ratios: Kimi K3 has 2.8T total parameters, 104B active, and 16 of 896 experts selected per token, about 3.7% according to arXiv:2607.24653. GLM-5 has 744B / 40B, about 5.4% according to arXiv:2602.15763. More experts and lower activation ratios increase routing traffic and balancing difficulty.

There is a clear main line in the response direction of the engineering community: **Organize communications with EP as the center and rack as unit**。[NVIDIA Official Engineering Blog](https://developer.nvidia.com/blog/scaling-large-moe-models-with-wide-expert-parallelism-on-nvl72-rack-scale-systems) Demonstrated the deployment of very large MoE using wide expert parallelism (wide EP) plus DP on the GB200 / NVL72 rack-level system - leaving the All-to-All of expert routing within the on-machine high-bandwidth interconnection domain. research side, [Mixture-of-Parallelisms](https://arxiv.org/html/2607.01844v1) (2026-07, arXiv preprint) Systematically combine multiple parallelisms to compress MoE training memory; [torchtitan](https://pytorch.org/blog/torchtitan-update-new-sota-models-performance-at-scale-titanrl) Provides 5D parallel stacks (expanded in the Framework section below).

A qualification that must be written down: **There is no "standard parallel combination" that works for all models**. TP is suitable for in-machine, PP is suitable for cross-machine, EP is grouped by the number of experts, CP is determined by the sequence length whether to open or not - the combination is solved by "model form × hardware topology", not copied. The term "TP / PP / DP 3D parallelism" in textbooks in 2024 is no longer sufficient in the face of trillion-parameter MoE - the public engineering practices in 2026 generally point to: EP as the center and rack-level systems (NVL72) as the deployment unit.

### 6. Case disassembly: Inkling H1 - the rack is the deployment unit

[Inkling 2 Small’s](https://thinkingmachines.ai/news/inkling-2-small) H1 pretraining provides a concrete, reconcilable example, using officially disclosed figures:

| Input amount | numerical value | measurement basis |
|---|---|---|
| model | 594B total parameters / 17B active MoE | official disclosure |
| H1 Training Token | 8.4T | Official disclosure, H1 pre-training stage |
| Hardware | GB300 NVL72 rack | official disclosure |
| H1 duration | 68 hours | official disclosure |
| Accuracy | Native NVFP4 | Official disclosure (formula details to be disclosed later) |

There are three ways to read this account book from a topological perspective:

- **The deployment unit is a rack, not a card**. NVL72 seals the high-bandwidth interconnection of 72 cards into a rack domain, which corresponds to the principle of "expert routing All-to-All without leaving the rack" in the previous section - this is not a coincidence, it is a mutual choice of "hardware form serving parallel strategy" (or vice versa).
- **Only when all four quantities are disclosed can the evidence be drawn**. 17B activation × 8.4T Token gives 6ND about 8.6e23 FLOPs (estimated in Chapter 2). Divided by 68 hours, the effective throughput of the entire rack is about 3.5e18 FLOP/s (estimated in this article). If any quantity is less disclosed, the reconciliation will be broken.
- **68 hours itself is a lot of information**. The pre-training of 8.4T Token was completed in one rack in three days - the throughput density of the rack-level system is rewriting the default expectation of "pre-training takes several months" (the GPU-hours rows in the budget table in Chapter 2 can directly benefit).

Section 4 will read the ledger again from a precision perspective—same data, two perspectives on decision-making.

> **Architectural wisdom:**Every point of gain in parallelism must be purchased with communication. When designing a topology, don't ask "how many dimensions of parallelism can I create?" first ask "which lines should be used for each kind of communication, and whether it can be afforded." The number of GPUs is a solution to the model shape and hardware interconnection, not a hyperparameter in the paper.

---

## 4. Numerical precision: three constraints before claiming savings

### 1. Format Overview

| Format | Bytes per element | Status in 2026 (measurement basis indicated) |
|---|---:|---|
| FP32 | 4 | Reference accuracy; commonly used with master weight and optimizer status |
| BF16 | 2 | Universal training baseline (FP32’s exponent bits, shorter mantissa, large range, coarse accuracy) |
| FP16 | 2 | Loss scaling is required to manage overflow, and training scenarios are gradually replaced by BF16 |
| FP8 | 1 | One of the cutting-edge training standards for 2026 – but with the qualifications below |
| MXFP8 | 1 + block sharing index | Blackwell native Tensor Core support, 1×32 block granularity (Megatron-Core ecological recommendation, [arXiv:2603.07685](https://arxiv.org/html/2603.07685v1)，2026-03） |
| FP4 / NVFP4 | 0.5 | The training side is still at the forefront of research and early practice; the production implementation is currently on the inference/deployment side |

### 2. What is the measurement basis of "half saving" of FP8?

[FP8 Training Infrastructure Guide](https://introl.com/blog/fp8-training-infrastructure-next-generation-precision-guide) (Introl, 2026-02) The measurement basis given is: compared to BF16, it saves about half the calculation and memory; Meta has also migrated the FP8 process from Hopper to Blackwell. However, the establishment of the phrase "save half" requires three levels of constraints. If one level is missing, the bill or curve will overturn:

| constraint layer | What does it care about? | What will happen if it is missing? |
|---|---|---|
| Hardware support | Which generation of Tensor Core runs which format natively (Hopper starts from FP8; Blackwell adds FP4, and the FP4 throughput on B200 is 2 times that of FP8) | Hardware does not support → Use simulation precision to save GPU memory rather than calculation |
| Framework implementation | kernel, scaling (Scale) management, communication accuracy | Numerical overflow/underflow, scaling factor mismatch → unstable training |
| Model stability | Which tensors can reduce accuracy and which ones must maintain high accuracy | loss The curve diverges or the evaluation quietly drops points |

So the correct expression is: **FP8 training on Hopper/Blackwell grade hardware and proven pipelines is a mature approach in 2026, but "FP8 = half the savings" is not a universal equation** ——Writing this sentence as an unconditional industry consensus violates factual discipline.

### 3. Different tensors and different precisions

The real approach to mixed precision training is "dividing labor by tensor". The numerical window that the low-precision format can represent is much narrower than FP32. If you plug it directly into it, two things will happen:

```text
Overflow (overflow): the value is too large and exceeds the representable range → becomes inf, taking away parameters in one step
Underflow: The value is too small, lower than the minimum representable value → becomes 0, and the gradient is quietly lost

The purpose of scaling (Scale): multiply the tensor by a factor and move the entire value into the representable window
                    Move it back after calculation - only when the window is controlled can the accuracy be used
```

So a precision solution is a "tensor × format" allocation table, not a single switch. Typical division of labor (qualitative description of engineering practices, which vary by model and framework):

| Tensor | Common practice | Reason |
|---|---|---|
| Weight (forward matrix multiplication) | Can be reduced to BF16 / FP8 / lower | Weights are relatively robust to accuracy and have the greatest benefits |
| Gradient | low precision + scaling factor | Large dynamic range, most prone to overflow/underflow |
| Master weight and optimizer status | FP32 | Section 2, Section 4: Remember small updates accurately |
| Reduction and accumulation | FP32 | Low precision accumulation errors will accumulate |

This also explains why the accuracy solution must be verified as a whole: any error in any one frame may not be revealed until tens of thousands of steps - by then it can no longer be distinguished from changes in data and hyperparameters.

### 4. Cases and red lines: NVFP4

The current evidence status of FP4 training should be written clearly on two sides:

- **Training side**：[Inkling 2 Small](https://thinkingmachines.ai/news/inkling-2-small) reports its H1 pre-training phase at 8.4T tokens on GB300 NVL72 in 68 hours, using **Native NVFP4 training** ——This is the iconic practice of FP4 level training in the current public ledger. Two disciplines must be followed: First, the official stated clearly **The details of the NVFP4 formula will be officially disclosed later**, the outside world does not know which tensors have been reduced to 4 bits in what scaling strategy; secondly, FP4 training as a whole is still a cutting-edge practice and is not a default gear that can be copied.
- **deployment side**: Mature production applications of FP4 are currently in inference/deployment quantification (such as GLM-5.2-NVFP4 quantification version, measurement basis: NVIDIA side 2026-10 release).

Let’s do an audit and realize the value of “book transparency”: the four quantities of H1 (17B activation × 8.4T Token × GB300 NVL72 × 68 hours) are disclosed at the same time, and external accounts can be reconciled with each other - 6ND rough estimate is about 8.6e23 FLOPs (estimate in Chapter 2), divided by 68 hours, the equivalent effective throughput of the entire rack is about 3.5e18 FLOP/s (estimated measurement basis in this article). **Without simultaneous disclosure of accuracy, hardware, and duration, this trick cannot be accomplished** ——This is a direct reflection of the disclosure layering in the training system chapter.

### 5. release gates with changing accuracy

Each accuracy downgrade is a controlled experiment, not a configuration modification. The minimum access level must be passed in order:

1. **Control**: The same configuration only changes the accuracy, and the training loss curve should be aligned (small deviations are allowed, and systematic increases are not allowed);
2. **Review**: Run downstream capability evaluation to confirm there is no fallback (not just loss - the evaluation system in Chapter 10 is advanced here for the first time);
3. **long distance running**: Observe whether the scaling factor and gradient norm are stable, and short-range verification cannot detect chronic numerical drift;
4. **fallback condition**: Write "return to the previous level when a signal occurs" into the configuration instead of writing it into someone's memory.

If you lose any level, you will return to the previous level. This set of release gates will directly enter the "Numerical Accuracy" column of the engineering products in this chapter.

> **Judgment Boundary:** The "save half" in the accuracy table is the hardware measurement basis (bytes per element and peak throughput), not your bill measurement basis. Only when the three layers of hardware, framework, and model stability are established at the same time, half of the savings will appear on the bill; before that, it is just someone else's bill.

---

## 5. Optimizers: AdamW, the limits of Muon and hyperparameter discipline

### 1. AdamW: Why the optimizer state is a big player in GPU memory

AdamW maintains two "memories" for each parameter, an intuitive version of one-step update (not formula derivation, just look at what each line is doing):

```text
g = gradient calculated for this batch
m = smoothed version of g (first-order momentum) ← Remember "where you usually go": multi-step average of direction
v = smoothed version g² (second-order momentum) ← Remember "how big the jitter usually is": the scale of noise
p ← p - lr · m/√v  -  lr · wd · p
     ↑ Take one step according to "Direction ÷ Jitter Scale" ↑ Weight attenuation is applied separately (decoupled from the gradient)
```

Engineering costs to account for: **Two FP32 moment states at 4 bytes each total 8 bytes per parameter, four times the 2-byte BF16 parameter itself**. Section 2. The three of the four memory books are as thick as they are held up by them.

### 2. Muon: From individual cases to the mainstream route of research/engineering practice

The protagonist of the optimizer narrative in 2026 is Muon. Reading its chain of evidence in chronological order is a perfect example of "how a technology changes from a case to a route":

| time | event | measurement basis |
|---|---|---|
| 2025-07 | Kimi K2 uses MuonClip to stably train trillion-parameter MoE for the first time: MuonClip is used to solve the problem of attention logit explosion in pre-training, and is equipped with QK-Clip (scaling q/k weights at each step) | [arXiv:2507.20534](https://arxiv.org/abs/2507.20534), historical anchor/case origin |
| 2026-06 | PyTorch official blog "Using Muon Optimizer with DeepSpeed", Muon and DeepSpeed are integrated into the official ecosystem | [PyTorch official blog](https://pytorch.org/blog/using-muon-optimizer-with-deepspeed) |
| 2026-10 | torchtitan uses FlexShard to efficiently support distributed Muon shard training | [torchtitan official blog](https://pytorch.org/blog/torchtitan-update-new-sota-models-performance-at-scale-titanrl) |

Muon's design intuition: Orthogonalize the update of the 2D weight matrix (approximate it with Newton-Schulz iteration) to make the "energy" of each step update in different feature directions more uniform - large matrices are updated more neatly and converge faster. But it has three clear applicable boundaries:

- **Just 2D weights**: AdamW is still used for 1D parameters such as embedding, output head, and normalization layer - the mainstream approach is a hybrid strategy of "Muon (2D weight) + AdamW (1D parameter)" rather than overall replacement;
- **MuonClip does not lead in fine-tuning:** Hugging Face’s 2025-12 [optimizer comparison](https://huggingface.co/blog/KingNish/optimizer-part1) found better fine-tuning convergence with Muon or Muon+AdamW than MuonClip. QK-Clip is a **pretraining** stability measure, not a demonstrated fine-tuning gain;
- **narrative discipline**: Muon's status in 2026 is "from individual cases to the mainstream route of research/engineering practice", not "comprehensive replacement of AdamW". Before copying the optimizer, first copy its applicable matrix.

### 3. Super parameter discipline: each super parameter maintains a gate

| Super parameters | What does it keep? | Lost look |
|---|---|---|
| Learning rate and schedule (warmup + decay) | How big should you take each step and when should you slow down? | Too large → divergence and spike; too small → a waste of GPU-hours time |
| Batch size (including gradual enlargement) | Balancing Gradient Noise Scale and Throughput | Too small → noisy and unstable; too large → fewer steps with the same compute |
| gradient crop | The first gate of loss spike | A single bad batch takes away the parameters |
| weight decay | Parameters do not grow without bounds | Values slowly deteriorate and training becomes unstable in the later stages |

The learning rate schedule deserves a sketch - it also explains what warmup and decay are doing:

```text
learning rate
 │        /＼ ← warmup: small steps at the beginning, waiting for the optimizer statistics (m/v) to stabilize
 │       ／    ＼
 │      ／       ＼＿＿
 │     ／ ＿＿＿＿＿＿ ← Decay: Fine convergence in small steps in the later stage
 │    ／
 └───────────────────────────────→ Number of training steps
```

(Qualitative teaching induction; the specific value is a matter of extrapolation experiment, see the prediction ledger discipline in Chapter 2.)

> **Architectural wisdom:** The optimizer is not "selecting the strongest", but "dividing labor according to parameter shape + selecting options according to training phase". Muon tube 2D, AdamW tube 1D, QK-Clip only serve pre-training stability - the mainstream route in 2026 itself is a division of labor table, not a leaderboard leader.

---

## 6. Reliability: checkpoint state machines, loss spikes and goodput

### 1. Failure is a schedule, not an accident

As the training becomes larger and longer, hardware failures change from "accidental" to "scheduled": running thousands of GPUs for several weeks, node failures, network jitters, and data pipeline freezes will all occur with probability. First, file common faults according to "Detection Signal → Disposal" (teaching summary):

| Failure | heartbeat | Dispose |
|---|---|---|
| Node failure: GPU loss or process exit | Heartbeat loss, process exit code | Automatically remove nodes and restore to the most recent good point |
| Network abnormality | Communication timeout, collective communication stuck | Limited retry; if continuous failure occurs, the entire machine will roll back and recover |
| Data loading bottleneck | The proportion of data time such as GPU increases | Increase prefetching and caching; check storage bandwidth and number of workers |
| Slow node (straggler) | A certain card keeps falling behind and holding up synchronization | Locate the cause; isolate and restart if necessary, and run long distances without illness |

The reliability part of training system design answers a question—— **When a failure occurs, how much progress do you lose and how long does it take to recover?**. This is not an operational detail: a technical report on GLM-5 ( [arXiv:2602.15763](https://arxiv.org/html/2602.15763v1), 2026-02) received third-party commentary about its unusually extensive infrastructure discussion. Agentic-training failures pointed more to system bottlenecks than algorithms. Reliability is a primary determinant of whether a training system can deliver a model.

### 2. Checkpoint state machine: what needs to be saved to resume training

What Checkpoint saves depends on the recovery goal. To resume training continuously, model weights alone are not enough. **An available Checkpoint is a combination of five things. If one is missing, the restored training will not be the same as the original one:**

| components | what is | What will happen if it is missing? |
|---|---|---|
| ① Model parameters | All learnable weights (MoE includes all experts) | Model returns to old version |
| ② Optimizer status | AdamW/Muon’s internal memory for momentum etc. | Optimizer "amnesia", loss jumps after recovery, and training shocks |
| ③ Data cursor | Which shard, which sample, and which round the data is read from? | Repeat reading old data or skip unread data after recovery |
| ④ RNG status | Random number generator seeds and internal state | Dropout and data disruption cannot be reproduced, and experiments cannot be compared |
| ⑤ Scheduling status | Current step number, learning rate schedule position, gradient accumulation count | The learning rate and schedule are misaligned, and the super parameters continue to run at the wrong point |

State machine overview:

```text
          Save (triggered every N steps; asynchronous layering: GPU memory → host memory → object storage)
RUNNING ──────────────────────────────────────→ CHECKPOINTED (snapshot of step k)
   │                                               │
   │ Failure: Node failure/network abnormality/numerical abnormality               │ Restoration: five piece set overall loading
   ↓                                               ↓
FAILED ──────────→ RESTORING ────────────────────→ RUNNING (resume from step k)
                       │ Validation failed (hash mismatch / missing components)
                       ↓
                  Roll back to the previous good point (so keep at least two generations)
```

Two engineering disciplines:

- **Saving has a cost.** Under section 2’s estimates, a full checkpoint for a 594B-total-parameter model is about 9.5TB: items ① and ② of the five-part state, FP32 master weights, and optimizer states. Checkpoint frequency trades lost progress per failure against storage and write overhead. Large runs use **asynchronous tiered saving**: quickly copy a snapshot from GPU to host memory, then write it to persistent object storage in the background. Every minute spent synchronously waiting for disk burns GPU-hours across the cluster.
- **Recovery without practice means no recovery**. The recovery path (verification, rollback, five-piece set loading, and continuation from step k) should be practiced at ordinary times, rather than executed for the first time at the fault site. What the drill needs to verify is not "recoverability", but "recovered training is strictly consistent with that before the interruption" - the data cursor can be connected, the RNG can be reproduced, and the loss continues smoothly from the breakpoint.

### 3. Loss Spike classification and first reaction

| Type | curvy appearance | Common causes | first reaction |
|---|---|---|---|
| Self-healing after single-step spike | Jump high in one step, fall back in several steps | Individual bad data batches, instantaneous value jitter | Record the batch number and observe a few steps; don’t be in a hurry to restart |
| Diverge and never look back | Continue to rise | The learning rate is too high, the accuracy overflows, and the data distribution changes suddenly | Roll back the checkpoint immediately and check item by item |
| Stage boundary jump | Change data recipe/jump when changing stages | Recipe switching and super parameters not reset as scheduled | Within expectations; transition in small steps and check scheduling status |
| Jump after recovery | Restore and jump from checkpoint | State machine missing parts (cursor/RNG/momentum) | Stop; check the five-piece set, this is not a super parameter problem |

(Teaching induction, qualitative. The fourth category is the anatomy of the opening "Rollover Three".)

### 4. MFU, HFU, throughput and Goodput: four irreplaceable scales

In the budget table in Chapter 2, MFU is the assumption that must be set as an interval; this chapter turns it into an operating indicator to be monitored, and completes the other three scales:

| indicator | measurement basis | What to answer | Trap |
|---|---|---|---|
| MFU | Useful Calculations (6ND measurement basis) ÷ Hardware Peak | Is the hardware fed when running? | Recalculating will drive it down—but recalculating may just be a bargain |
| HFU | Actual execution calculation (including recalculation) ÷ peak value | Is the hardware spinning? | The same training MFU ≤ HFU, different measurement bases cannot be compared |
| Throughput | Token/s or sample/s | Pipeline flow rate | Different parallelism and precision schemes are not directly comparable |
| Goodput | Nominal throughput × effective time ratio | How fast does it progress after deducting failures, restarts, and recovery? | The only honest KPI for long-term training scheduling |

Each of the four scales is divided into one section: MFU manages single-step efficiency, HFU reveals the true cost of recalculation, and throughput manages pipelines **Goodput tube timeline**. Calculate goodput once (illustrative teaching numbers):

```text
Assumptions: nominal cluster throughput of 1,000 tokens/second; 3 failures per week
     Single failure: 5 minutes for detection + 30 minutes for restart queuing + 25 minutes for recovery = 1 hour
     In addition, because the save interval is too sparse, a single failure loses an average of 2 hours of progress → equivalent to 6 hours/week

Goodput = 1,000 × (168 - 3 - 6) / 168 ≈ 946 Token/second
        ≈ 94.6% of nominal throughput

Reading: For every 1% of Goodput loss, the delivery date directly slides by 1%
     ——Adjust the save frequency and speed up the recovery process, which is often much cheaper than adding a card
```

A cluster that has an MFU of 45% but fails three times a week, losing six hours each time, or a cluster that has an MFU of 38% but is rock solid, who will deliver the model first? ——Only Goodput can answer.

### 5. Write reliability back into the budget

There is a line in the table of the R&D ledger in Chapter 2 "Failure and restart: long training must be interrupted, and the progress before the recovery point is the sinking time" - this chapter adds engineering content to it. Three points where reliability decisions change the bill: **save frequency** Determine how many steps are lost in a single failure (storage and write overhead are its price); **recovery speed** When deciding how many cards will be burned for each failure (total time for detection, restart, and loading); **topological margin** Decide whether slow nodes and local failures can be isolated instead of bringing down the overall situation. On paper: The prediction ledger in Chapter 2 should add a line of "Goodput hypothesis vs actual" - Goodput hypothesis during budget, actual value after training, reasons for deviation (save too sparse? Recovery too slow? Too many slow nodes?). For the next schedule, this line is the prior.

> **Judgment boundary:** The progress KPI of long training is Goodput, not MFU. MFU measures "how full it is when running", and Goodput measures "how much progress has been made this month". The rate after deducting all failures, restarts, and rollbacks is the basis for scheduling, budgeting, and delivery commitments.

---

## 7. Case: the staged mixed-chip stack of DeepSeek V4

One of the most informative 2026 applications of the first six sections’ methodology is DeepSeek V4: it makes the joint design of model and hardware stack explicit. First, establish the facts individually, with the scope of each claim:

| facts | measurement basis |
|---|---|
| V4 has about 1.6T parameters (total parameter measurement basis), and pre-training data exceeds 32T Token | HF model card |
| V4 pre-training is mainly based on NVIDIA hardware, and some processes are adapted to Huawei Ascend | [MIT Technology Review](https://www.technologyreview.com/2026/04/24/1136422/why-deepseeks-v4-matters) (2026-04) Report |
| V4-Pro The Shenzhen consortium led by Huawei used at least 1,000 Ascend chips to complete full parameter post-training | SCMP 2026-06 report, paraphrase, original text should be reviewed before quoting |
| The third-party paper SLAI T-Rex performs end-to-end full parameter post-training on DeepSeek-V4 on Ascend NPU SuperPOD, reaching 34.22% MFU | [arXiv:2607.20145](https://arxiv.org/abs/2607.20145) |
| "V5 will be pre-trained on Huawei hardware" | Single source reporting, planned information, not written as fait accompli |

The narrative red line must be established first: this set of hardware stack must be written as **Mixing hardware in stages** ——The pre-training is mainly based on NVIDIA, and some processes are adapted to Ascend; the full-parameter post-training of V4-Pro is completed by Huawei using 1000+ pieces of Ascend. It is wrong to write "completely domestic training" or "completely go to NVIDIA"; conversely, it is also wrong to write "nothing to do with domestic hardware". There is also a warning about non-quotable numbers worth remembering: the "2.788M H800 GPU hours" of the online V4 comes from a third-party GitHub repository and is unofficially disclosed - the number of the training system should especially ask "who disclosed it".

This case has three lessons for training system design:

- **Cross-chip stack means all ledgers are recalculated**. The four graphics memory accounts are recalculated according to the GPU memory capacity of the new hardware; the communication topology is rearranged according to the new interconnection structure (NVIDIA's NVLink rack domain is replaced by the Ascend SuperPOD interconnection domain); the accuracy scheme is rechecked according to the numerical format supported by the new chip - no one account can be shifted.
- **Read the 34.22% MFU figure with its scope:** it is end-to-end, full-parameter **post-training** on an Ascend NPU SuperPOD, as reported in the paper. It is not directly comparable to pretraining MFU because the stage and workload differ. T06–T09 describe post-training memory and compute patterns.
- **Staged mixing itself is a training system decision**: First use the verified NVIDIA stack to run pre-training (guaranteed delivery), and at the same time complete the adaptation and amplification of post-training on Ascend (accumulate capacity) - this is a real application of "book first, timeline judgment".

### Review perspective: If someone proposes at the meeting, "We also introduce a dual-chip stack"

According to the framework of this chapter, the order of questioning should be: Question 1 **Cutting stages** ——Which training stage should be adapted first (small-scale verification first or full reference first); second question **baseline measurement basis** ——Whether there is a first-hand baseline for MFU/Goodput and accuracy verification of each of the two sets of stacks ("adapted" without a baseline cannot be entered into the decision-making process); three questions **isomorphism** ——Whether the checkpoint five-piece set and the data pipeline of the two stacks can be interconnected, and whether the fault recovery paths have been drilled separately; four questions **Exit conditions** ——Return to the single stack when any signal occurs. After all four questions and answers were answered, the proposal turned from a narrative into a plan.

> **Architectural wisdom:**Hardware heterogeneity is not a narrative from a standpoint, but an engineering account. Every time one more chip stack is introduced, the five solutions of memory, communication, accuracy, monitoring, and fault tolerance must be verified separately; V4 chooses "phased mixing" instead of one-size-fits-all switching, which is the approach of treating heterogeneity as risk management.

---

## 8. Map framework configuration to the topology

### 1. Everyone in their place: the official division of labor in the framework

The parallelism, accuracy, and fault tolerance decisions of this chapter are ultimately carried by the framework. Each framework is recorded according to its positioning in the official document (no mixed names):

| frame | Official positioning (according to respective documents) | Chapter Perspective: What to Remember It |
|---|---|---|
| torchtitan | PyTorch official large-scale training reference implementation; 0.4.0 (2026-10-28, aligned with PyTorch 2.15) unifies core training and TitanRL into a shared engine and improves large-scale MoE training | 5D Parallel and FlexShard's "standard coordinate system"; read it first to learn configuration ( [Release record](https://github.com/pytorch/torchtitan/releases)） |
| Megatron-Core | NVIDIA's training component library supports trillion-level MoE (Hopper / Ada / Blackwell), built-in GPT / LLaMA / DeepSeek / Qwen and other preset configurations | Production-grade components; note that the repository is called Megatron-LM and the component library is called Megatron-Core. Mixing them together is a common clerical error ( [repository](https://github.com/NVIDIA/Megatron-LM)） |
| DeepSpeed | Microsoft Training Optimization Library (where ZeRO originated) | Representative of state sharding; 2026-06 PyTorch blog demonstrates Muon integration with DeepSpeed |
| veRL | RL training framework, officially provides Agentic RL Training document route | Post-training engine; details T09 Expand ( [Documentation](https://verl.readthedocs.io/)） |
| slime | THUDM's RL training framework (on which Relax is developed) | Post-training engine; details T09 Expand ( [repository](https://github.com/THUDM/slime)） |
| vLLM | High-throughput inference engine | Standing on the Rollout sampling side; the cross-engine data flow (Policy Lag, Rollout throughput) between the training engine and the training engine is the main topic of T09 |

The framework is the engineering carrier, not the architectural decision itself—— **"Which framework to choose" never replaces the three-level decision-making of "how many dimensions to parallelize, what precision to use, and how to tolerate faults"**;The framework just configures the decisions you have already made. It is enough to ask three questions when selecting a model: One question **Parallel coverage**, is it mature enough to support all of your five-dimensional combinations (especially EP and CP, the two dimensions that have become critical in the MoE era); second question **Accuracy level**, does the format you want to use (including scaling management) have a verified implementation? Three questions **Reliability**, whether its checkpoint is a five-piece set, and whether the recovery path can be drilled. Beyond the three questions is the ecology and team familiarity. The framework details of the training side of RL (how veRL / slime / vLLM form an asynchronous topology) give way to Chapter 9, leaving only the coordinates in this chapter.

### 2. How to map a minimum configuration to a topology

Put the derivation in this chapter into a framework-independent pseudo-configuration and see where each field falls:

```text
# Distributed Training Configuration (skeleton diagram, fields have nothing to do with the specific framework)
model: 594B total parameters / 17B activated MoE # measurement basis: Officially disclosed size (Inkling 2 Small)
hardware: GB300 NVL72 rack ×1 (72 cards) # measurement basis: the same rack form as the official account book
memory_budget: # ← Section 2: Ledger first
  params_bf16: ≈1.19 TB # Teaching estimate
  grads_bf16:       ≈1.19 TB
  master_fp32:      ≈2.38 TB
  optimizer_fp32: ≈4.75 TB # AdamW two momentum, 8 bytes/parameter
  activations: Calculate separately (recalculate on, open CP for long sequences)
parallel: TP=2 PP=2 CP=1 EP=9 DP=2 # ← Section 3: Combination followed; product = 72 cards
precision: BF16 weight/gradient + FP32 master weight and optimizer (teaching conservative file)
                # Actual project: FP8 needs to pass three layers of constraints and verification release gates (Section 4)
optimizer: AdamW - or Muon(2D)+AdamW(1D) hybrid (section 5)
checkpoint: asynchronous tiered save every 1000 steps; retain 3 recent generations plus 1 daily generation. See the five-part checkpoint design in section 6
monitor: MFU / Goodput / loss / gradient norm / memory water level
recovery: fault detection → roll back to the latest good point → five-piece recovery; recovery drills once a quarter
```

Reading comparison: the memory budget answers "can it be installed?"; the parallel quintuple answers "how to multiply 72 cards and which network each type of communication falls on"; the precision and optimizer lines are the conclusions of the controlled experiment, not the default values; the checkpoint and recovery lines are the insurance on the timeline. **Each line is a starting point for the previous section - this is what "derivable" means for training system design.**

---

## 9. Engineering artifact: Distributed Training Configuration

The official version of the pseudo-configuration above is the project product delivered in this chapter. The skeleton of the form is as follows (each field requires a measurement basis):

| plate | What to fill in | Examples and measurement basis Requirements |
|---|---|---|
| Model form | Total parameters / active parameters / number of layers / number of experts / top-k | 594B/17B…(Official disclosure or design value, indicate) |
| Hardware | GPU model/single card memory/in-machine interconnection/cross-machine network/rack form | GB300 NVL72…(hardware generations determine the accuracy level) |
| GPU memory budget | Item-by-item estimation of the four books + assumptions | Teaching estimation measurement basis: accuracy assumption, optimizer assumption, whether to include activation |
| parallel dimension | TP / PP / CP / EP / DP Values and products of each dimension | Product = total number of GPUs; mark which network each type of communication falls on |
| Communication topology | What traffic does the intra-machine domain and the cross-machine domain carry? | Expert routing All-to-All must fall in the high-bandwidth domain |
| Numerical accuracy | Each tensor format/scaling strategy/verification access and fallback conditions | Downshifting must be accompanied by comparative experimental results |
| optimizer | Type / Parameter Shape Division / Learning Rate Schedule / Cropping / Weight Decay | Muon is limited to 2D; fine-tuning has other conclusions |
| Checkpoint | Five-piece checklist/Retention frequency and tiering/Retention algebra/Drill cycle | Single serving volume estimation and storage account |
| Monitoring indicators | MFU / HFU / Goodput / loss / gradient norm / memory water level | Writing measurement basis for each indicator |
| Recovery | Detection → Rollback → Recovery Process and Responsibilities | Roll back the most recent better criteria |

Three rules of use: **Each number identifies an identity** (Official disclosure / third-party estimate / estimate in this article / hypothetical scenario, choose one from four, the same discipline as the budget table in Chapter 2); **The output must contain the failure mode** (Which type of failure is most likely to occur, how much a single loss is, and how long it will take to recover); **Interface with Training ADR** ——This configuration directly fills in paragraphs 5 (Decisions: Parallelism, Accuracy and Reliability Solutions) and 6 (System Impact) of the introduction ADR skeleton.

> **Judgment Boundary:** The value of Distributed Training Configuration is not in the "correct configuration" - there is no correct configuration for the training system - but in the measurement basis of each field and the traceability of each decision: how the parallel combination was solved, whether the accuracy level passed the release gates, and when the drill was resumed. Only configurations that can be recalculated and faulted by colleagues are worthy of the investment of several thousand calories and several weeks of running.

---

## 10. Six common reasoning errors

### Mistake 1: Copying the number of GPUs in the paper and not copying its segmentation constraints

The number of GPUs is the product of "model form × hardware × interconnection", not a hyperparameter. The same model solves completely different parallel combinations on an NVLink rack and a regular Ethernet cluster. **corrective action**: When you see any GPU number, first ask what its five-dimensional parallelism is and which network each type of communication takes.

### Mistake 2: Treating MoE as Dense

MoE's continuous All-to-All expert routing traffic and load balancing issues are completely unable to be covered by Dense's "gradient synchronization once per step" model; ignoring the EP topology, communication must become a bottleneck. **corrective action**: MoE topology design starts from EP and works backwards (experts group to decide the layout within the rack) instead of starting from DP.

### Mistake 3: "Get FP8 and save half"

One of the three layers of constraints (hardware generation, framework and scaling implementation, and model stability) is missing. "Saving half" will stop at the hardware level and cannot be included in the bill; FP4 training is a cutting-edge practice - the details of Inkling's NVFP4 formula have not been officially disclosed, so copying is out of the question. **corrective action**: Each time the accuracy is downgraded, a control experiment and fallback conditions are provided and written into the configuration.

### Mistake 4: Checkpoint only saves model weights

The weights are just one of the five pieces. Without optimizer momentum, data cursor, RNG or scheduling state, what is recovered is a training of "amnesia, repetition, and irreproducibility", and loss jumps are only the earliest symptoms. **corrective action**: Five-piece checklist for configuration; recovery paths are drilled quarterly.

### Mistake 5: Taking MFU as the only KPI and not looking at Goodput

MFU measures "how full it is when running", and the progress swallowed up by failures, restarts, and rollbacks is completely invisible. Long training schedules, budgets, and delivery commitments must be in Goodput terms. **corrective action**: MFU and Goodput are displayed side by side on the monitoring panel; when reporting training progress, "effective progress progress this month" is reported.

### Mistake 6: Treating frameworks as architectural decisions

"We use torchtitan / Megatron" cannot answer how many dimensions of parallelism, what precision, and how to tolerate faults - the framework is the carrier, and the decision is in the configuration. In turn, mixing Megatron-LM (repository) and Megatron-Core (component library), and mixing RL framework and training framework are signals: the discussion has not yet reached the decision-making level. **corrective action**: When reviewing, first look at the Distributed Training Configuration, and then see what framework is used to implement it.

---

## 🎯 Quick check

```quiz
{
  "question": "The team increased the number of GPUs from 512 to 1024 without halving the training time. Which of the following explanations is closest to the essence?",
  "options": [
    "Too many GPUs lead to heat generation and frequency reduction, which is a heat dissipation problem",
    "After the degree of parallelism is increased, the proportion of communication overhead such as gradient synchronization and expert routing increases, and load unevenness and fault recovery are superimposed. The end-to-end time no longer decreases linearly with the number of cards - it depends on the Goodput measurement basis",
    "The amount of data is not enough. The GPU is waiting for data in the air. As long as the data is added, it can be linearized"
  ],
  "answer": 1,
  "explanation": "Each parallel dimension introduces a kind of communication, and which network the communication takes determines the cost; as the scale increases, faults and recovery also take time. The number of cards is the product of parallel dimension combinations, not independent knobs."
}
```

```quiz
{
  "question": "After a training failure, the team recovers from a checkpoint containing only model weights. What are you most likely to see?",
  "options": [
    "Loss jumps or is not reproducible: optimizer momentum, data cursor, RNG and scheduling status are lost, and the training status is inconsistent",
    "Completely seamless, weights are the entire state of training",
    "Only the GPU memory usage increases, and the training itself is not affected"
  ],
  "answer": 0,
  "explanation": "Checkpoint is a five-piece state machine: parameters, optimizer state, data cursor, RNG, and scheduling state. Saving only the weights is equivalent to taking only 1/5 of the snapshot - this is exactly the anatomy of \"Rollover Three\" at the beginning of this chapter."
}
```

```quiz
{
  "question": "Why does MoE training create communication bottlenecks that are fundamentally different from Dense?",
  "options": [
    "MoE has many parameters, so the gradient synchronization amount of each step increases according to the total parameters. Dense also has the same problem",
    "MoE does not require tensor parallelism and naturally requires less communication",
    "Each Token must be routed to the expert's card at each layer, forming a continuous high-frequency All-to-All, which also requires expert load balancing - this layer of traffic Dense does not have"
  ],
  "answer": 2,
  "explanation": "The main communication of Dense is the gradient synchronization once per optimizer step; MoE superimposes on this the routing traffic that increases linearly with the token throughput. So the topology in 2026 is organized around EPs and racks."
}
```

```quiz
{
  "question": "The team's hardware is Blackwell. When I saw Inkling using native NVFP4 for training, I wanted to copy it directly. What is the correct judgment?",
  "options": [
    "You can copy it if you have the same hardware. Inkling has verified it",
    "NVFP4 training is still a cutting-edge practice, and the details of Inkling’s formula have not yet been officially disclosed; the safe path is to first conduct a small-scale verification in the FP8/MXFP8 gear and set up the fallback release gates for loss and evaluation, and then decide whether to advance FP4",
    "The accuracy only affects the speed and not the result. Just choose the lowest gear"
  ],
  "answer": 1,
  "explanation": "\"Saving half\" requires three layers of constraints: hardware, framework, and model stability; the undisclosed recipe means that the outside world doesn't even know \"which tensors have been reduced to 4 bits\", and there is no way to start copying. Changes in accuracy must be subject to controlled experiments."
}
```

```quiz
{
  "question": "The cluster MFU is 45%, but it fails three times a week and loses six hours of progress each time. To evaluate \"when will training be completed\", which indicators and actions should be used?",
  "options": [
    "Use Goodput to evaluate: calculate the effective progress rate after deducting fault detection, restart, recovery, and rollback; at the same time, review the checkpoint strategy to minimize the progress loss of a single failure",
    "Continue to use MFU to evaluate, 45% is already good, and faults are a matter of operation and maintenance",
    "Just double the GPU and trade parallelism for time"
  ],
  "answer": 0,
  "explanation": "MFU measures \"how full it is when running\", and Goodput measures \"how much progress it has made this month\". The scheduling and delivery commitments of long-term training are subject to Goodput; increasing the save frequency and speeding up recovery are often cheaper than adding cards."
}
```

---

## Chapter summary

- First list parameters, gradients, master weights, optimizer and activation occupancy, and then decide on sharding, parallelism, offloading and recomputation.
- Both parallel and precision solutions trade costs: saving graphics memory may increase communication, and increasing peak throughput may also increase numerical risks.
- Also look at the MFU, throughput and effective output, and verify that the checkpoint can be restored. The configuration table should record resource assumptions and actual measurement results.

> **Next chapter’s question:** Pretraining establishes basic capabilities. Making a model answer, reason, and perform tasks in a specified way requires choosing the right learning signal. Start with learning from demonstrations.

---

## Terminology reference

| Terminology | How can beginners understand first |
|---|---|
| Four accounts of GPU memory | Parameters, gradients, optimizer status, activation (including temporary buffer) - four types of things that live in the GPU memory at the same time during training |
| Data Parallelism (DP) | Each card has a complete model, each eats different data, and synchronizes the gradient once at each step |
| Tensor Parallel (TP) | Cut the single-layer weight matrix and calculate the combined force of multiple cards into one layer; communicate high-frequency small messages, suitable for in-machine |
| Pipeline Parallelism (PP) | Divide the layers into consecutive stages, with each card responsible for one section; only activation is passed between stages |
| Context/Sequential Parallelism (CP) | Cut a long sequence into multi-card collaboration to deal with the activation explosion of the long sequence |
| Expert parallelism (EP) | Distribute MoE experts across GPUs; token routing generates continuous All-to-All traffic |
| ZeRO / FSDP | The idea and implementation of spreading parameters, gradients, and optimizer state slices to all cards, exchanging communication for GPU memory |
| Recompute (activate checkpoints) | Only the boundaries are stored in the forward direction, and the intermediate results are recalculated in the reverse direction, and the calculation is used to activate the GPU memory |
| gradient accumulation | Small batches are accumulated multiple times and updated again, which is equivalent to a large batch without exploding the GPU memory |
| Mixed Precision and Scale (Scale) | Different tensors use different precisions and rely on scaling factors to prevent overflow/underflow |
| MFU / HFU / Goodput | Useful calculations ÷ peak value, actual execution calculations ÷ peak value, effective progress rate after faults - three different scales |
| Checkpoint state machine | Weight + optimizer status + data cursor + RNG + scheduling status five-piece set, and its saving/verification/rollback/recovery process |

---

## Related links

- This series: [T01 · Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [T02 · Scaling is not about copying proportions: three general ledgers](/en/tutorial/t02-scaling-budget-three-ledgers/) · [T04 · Joint decision-making of model skeletons](/en/tutorial/t04-model-architecture-joint-decisions/) ·Next stop [T06 · Demonstration learning and ability transfer boundaries](/en/tutorial/t06-sft-distillation-transfer-boundary/)
- Training ledger and cases: [Inkling 2 Small official training ledger](https://thinkingmachines.ai/news/inkling-2-small) · [GLM-5 technical report](https://arxiv.org/html/2602.15763v1) · [MIT Technology Review · Why DeepSeek's V4 Matters](https://www.technologyreview.com/2026/04/24/1136422/why-deepseeks-v4-matters) · [SLAI T-Rex: Ascend SuperPOD full post-training](https://arxiv.org/abs/2607.20145)
- Parallelism and frameworks: [NVIDIA · Wide Expert Parallelism on NVL72](https://developer.nvidia.com/blog/scaling-large-moe-models-with-wide-expert-parallelism-on-nvl72-rack-scale-systems) · [Mixture-of-Parallelisms（arXiv:2607.01844）](https://arxiv.org/html/2607.01844v1) · [torchtitan 0.4 and TitanRL updates](https://pytorch.org/blog/torchtitan-update-new-sota-models-performance-at-scale-titanrl) · [PyTorch · Using Muon Optimizer with DeepSpeed](https://pytorch.org/blog/using-muon-optimizer-with-deepspeed)
