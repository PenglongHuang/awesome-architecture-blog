---
title: "T04 · Dense, MoE and long context: choosing a model architecture"
description: "Compare capacity, GPU memory, communication, inference latency and multimodality in a joint decision table, with an Architecture ADR template."
series: "model-training"
order: 4
pubDate: 2026-11-12
kind: "tutorial"
tags: ["Model training decisions","Model architecture","MoE","Long context"]
locale: "en"
translationKey: "tutorial/t04-model-architecture-joint-decisions"
sourceHash: "437ff6148b0945d1dd33842705c516eb19ce7b9ad73b3204cbeefabcdea5dc1e"
---

## One task, three incompatible quotations

The data recipe determines what the model is to learn; next, the structure determines how this information is represented, computed, and deployed.

Let's say your team wants to deliver a **Chinese Enterprise Agent**: Reading contracts and financial reports (the input often reaches hundreds of thousands of Tokens), viewing charts and system screenshots (multi-modal input), high-concurrency online services within the enterprise, and privatized deployment is a bonus. You receive three skeleton quotes:

| quote | Skeleton plan | selling point | digital measurement basis |
|---|---|---|---|
| A "Flagship same style" | 2.8T total / 104B active parameters, MoE with 16 of 896 experts selected per token; advertised 1M context; native multimodality; open weights with MXFP4 quantization | "Each Token only activates 3.7%, reasoning is the cheapest" | Kimi K3 technical report disclosure value ( [arXiv:2607.24653](https://arxiv.org/abs/2607.24653)，2026-07） |
| B "Provincial Reasoning" | 744B total parameters / 40B active MoE; DSA+MLA attention; pre-training 28.5T Token | "Sparse attention greatly reduces long-context calculations" | GLM-5 Technical Report Disclosure Value ( [arXiv:2602.15763](https://arxiv.org/abs/2602.15763)） |
| C "Cheap and controllable" | 30B Dense + Visual Connector + 128K Window + Retrieval (RAG) | "You don't need 1M at all, and the total cost of ownership is the lowest." | Teaching synthesis scene, numbers are for illustration |

The scene of the review meeting probably looked like this: A’s program manager pointed at **activation ratio** Say reasoning is cheap; B’s program manager points **attention discount** argues that long context is cost-effective; option C’s manager points to **total price** Say that you have been kidnapped by parameters.

There is only one reason for the quarrel: **The accounts reported by the three parties are not the same at all.** A is reporting a ratio in the capacity account, B is reporting a discount in the window account, and C is reporting the total of the three ledgers. The three ledgers of capacity, context, and modality rewrite each other - the active parameters determine the amount of calculation per Token, the total parameters determine the loading of GPU memory, the attention structure determines the economy of long contexts, and the modal route determines the window budget and data recipe (the output of the previous chapter is rewritten here). If you decide on any one book alone, you will overturn it on the other two books.

```text
The three ledgers at the review meeting were misplaced:
    A reports a proportion in the capacity account (activated 3.7%)
    B reported a discount in the window account (1M attention saving is about 2.9 times, the same as GLM-5.2 third-party disassembly measurement basis)
    C Report the total of the three ledgers (total cost of ownership)
        ↓
    All three numbers are correct, but not in the same ledger - cannot be directly compared
        ↓
    The task of this chapter: unify weights and measures for any skeleton plan,
    Then determine whether it holds true under your set of constraints
```

Option A’s selling point also mixes definitions: 3.7% is a **proportion**, whereas 104B is an **absolute count**, still 2.6 times option B’s 40B active parameters per token. The official API prices cited in T02 illustrate the difference: per million input/output tokens, GLM-5 is $1.0/$3.2 and Kimi K3 is $3/$15. **Compare absolute active parameters for inference costs; the activation fraction only describes savings relative to that model’s own total capacity.**

The derivation route of this chapter is also the order in which the three accounts are unfolded:

```text
Section 1 Unified weights and measures: How to read the three accounts (review of parameter measurement basis)
    ↓
Section 2 Capacity Account: Dense and MoE are two cost structures, not big or small
    ↓
Section 3 Window Account: Compression, sparseness, and linearity are three paths, not one step at a time
    ↓
Section 4 Modal Account: Native and Connector, and “Is it really looking at the picture?”
    ↓
Section 5 The three accounts rewrite each other: the architecture is a dependency graph, not a technical list
    ↓
Section 6 Architecture ADR: Write skeleton decisions into repeatable documents
```

---

## 1. Read the capacity, context and modality ledgers consistently

### 1. First bring the parameter measurement basis of T02

T02 has established a rule: the parameters of the MoE model must be accounted for in dual measurement bases. This chapter turns this into the first piece of metrics for architectural decisions:

| measurement basis | What to answer | Which account corresponds to |
|---|---|---|
| Total parameters | How much does the model contain? | Loading GPU memory, weight volume, deployment threshold |
| Active parameters | How many parameters are actually changed for each Token? | Calculation amount per Token, inference cost direction |
| attention structure | How each Token looks back at history | Long context calculation and KV Cache memory |
| modal structure | How to turn non-text input into Token | Data recipe, window budget, training phase |

The architectural decision is to solve simultaneously among these four rows, rather than finding the maximum value in a certain row.

### 2. The "accounting unit" of each of the three accounts

```text
Capacity account: total parameters → memory and weight volume
         active parameters → Calculated per Token (≈ direction of inference unit price)
    ↓
Window account: attention structure → long context calculation curve and KV Cache volume
         Advertised context → effective context (discounted) → concurrency (competing for the same GPU memory)
    ↓
Modal account: native/connector → data recipe (the output of T03 is rewritten)
         Visual Token Budget → Squeeze Window Account
    ↓
Only after going through all three accounts can one say "I have seen this architectural plan."
```

### 3. Reread the opening quotation using three accounts

| ledger | Quotation A (same model as K3) | Quote B, using the GLM-5 configuration | Quote C: 30B Dense, synthetic teaching example |
|---|---|---|---|
| Capacity: Load | 2.8T total parameters, the heaviest; the open weight volume is about 5.6TB according to third-party reports | 744B General ginseng, heavier | 30B total parameter = 30B activation, lightest |
| Capacity: calculated per Token | 104B activation, the most expensive among the three | 40B activation | 30B activation, the cheapest |
| window | Nominal 1M; KDA/AttnRes hybrid linear routing | DSA+MLA; 1M economical improvement after adding IndexShare to GLM-5.2 of the same series | 128K; long documents are sliced by retrieval |
| modal | Native multimodality (as described in the official report) | The report is mainly based on text capabilities, and the multi-modal route needs to be confirmed separately (subject to the corresponding official document) | Connector route, you have to verify by yourself "whether the picture is really used" |
| Deployment threshold | TB-level weight, consumer-grade hardware is difficult to deploy locally (according to third-party reports) | medium | Minimum, can be run on a single machine after quantification (indicative) |

Pay attention to this table **No winner picked** ——It only puts the premise of each offer on the same table. A's "activation is cheap" is offset by 104B absolute value and 5.6TB weight; B's "attention savings" will not be known until the next section; C's "cheapness" needs to be exchanged for "128K + retrieval can support the contract question and answer". Rulings belong to the dependency graph in Section 5 and the ADR in Section 6, and not to any single metric.

### 4. Before starting: three category errors in architecture discussions

T01 separates model architecture (this chapter), training methods (T06–T09) and training systems (T05). Three common review mistakes fall exactly on these boundaries:

| Misplaced statement | what does it confuse | Correct way to ask |
|---|---|---|
| "If I switch to MoE, will the training be more convergent?" | Model architecture × training method: MoE changes which parameters are used for each Token, and does not directly change "what signals update parameters according to" | "MoE has changed the computational graph and communication. Can my training system (T05) and optimization configuration keep up?" |
| “Does adopting DSA make the training system simple?” | Architecture × System: Sparse attention focuses on long-context calculations, but adds the indexer component and pushes the bottleneck to KV Cache and kernel | "Which item should the savings in attention be transferred to the system layer? Who will pay?" |
| "Isn't multimodality just about data?" | Cross-layer: The modal route changes not only the data recipe (T03), but also the skeleton (encoder, connector), window budget and training stage | "Native or connector? Is rewriting pre-training or post-training? What is the acceptance evidence?" |

The framework is a **modifier**: architecture changes the data recipe, training system, inference bill, and acceptance criteria. Each changed item has its own main chapter. This chapter maps those relationships; the corresponding chapters supply the details.

> **Architectural wisdom:** When there is no quarrel in the architecture review, it is usually not because of the lack of numbers, but because each party only has one account. First, spread out the three ledgers of capacity, window, and modality, and let each number indicate its measurement basis. Only then can "A or B" have a chance to become "A under which constraint, and B under which constraint?"

---

## 2. Dense and MoE represent different cost structures

### 1. Establish your intuition first: general practice vs. triage hospital

**Dense model** Like a general practice clinic: every time a Token comes in, all parameters must be read - as many parameters as there are, there are as many calculations for each Token. Parameters are strictly bound to calculations, and the best calculation is: total parameters = active parameters.

An **MoE (Mixture of Experts) model** resembles a triage hospital: a **Router** sends each token to a small set of relevant **Experts**, while the other experts do not participate in that computation. **Top-K routing** determines how many experts are selected.

[Kimi K3 Technical Report](https://arxiv.org/abs/2607.24653) The disclosed configuration is the maximum scale currently in service: **2.8T total parameters, 104B active parameters, 16 activations per Token among 896 experts** ——Each Token has 16 expert consultations, and the activation ratio is 104 ÷ 2800 ≈ 3.7% (measurement basis: official report disclosure value).

The MoE's bet is: **Capacity (what is known) and per-Token calculation (how much is used) are decoupled**. The total parameters can be piled up to 2.8T to buy knowledge capacity, and each Token only costs 104B of calculation. This is the structural reason for T02 Chinchilla boundary two (the denominator of MoE cannot be directly used in the Dense ratio).

### 2. Active MoE configuration range in 2026: a table to read the trend

Put together the MoEs in active service in 2026 with official measurement basis in the evidence base (the activation ratio is self-calculated by "Activation ÷ General Staff", rounded):

| model | Total parameters | Active parameters | activation ratio | measurement basis source |
|---|---:|---:|---:|---|
| Kimi K3（2026-07） | 2.8T | 104B | ≈3.7% | [Official technical report](https://arxiv.org/abs/2607.24653) |
| Qwen3.8-Max（2026-08） | 2.4T | About 95B | ≈4.0% | [Official blog](https://qwen.ai/blog?id=qwen3.8);Max level opens weight for the first time |
| Mistral Large 4（2026-10） | 1.05T | 52B | ≈5.0% | [Official open source announcement](https://mistral.ai/news/mistral-large-4-oss);The official repository name is 1T-A52B (the 49B measurement basis circulated by the media is inaccurate) |
| GLM-5（2026-02） | 744B | 40B | ≈5.4% | [Official technical report](https://arxiv.org/abs/2602.15763) |
| Ling-3.2-flash | 560B | 25B | ≈4.5% | The anchor point of the task book shall be subject to the corresponding official document |
| ERNIE-5.5-Flash-Base | 280B | 14B | ≈5.0% | The anchor point of the task book shall be subject to the corresponding official document |
| Inkling 2 Small（2026-11） | 594B | 17B | ≈2.9% | [Official page](https://thinkingmachines.ai/news/inkling-2-small) |
| Reference: DeepSeek-V3 (2024-12) | 671B | 37B | ≈5.5% | historical anchor |
| Reference: GLM-4.5 (2024) | 355B | 32B | ≈9.0% | Historical anchor point; GLM-5 reports expansion from 355B/32B, 23T Token to 744B/approximately 40B, 28.5T Token |

Two trends can be read directly from the table:

- **The total parameters have entered the 0.7T–2.8T level**: The representatives in 2024 are 355B–671B, and the open source flagships in 2026 have generally reached a new level;
- **Activate specific pressure to approximately 3%–6% range**: GLM-4.5 is still at 9% in 2024, and will generally be cut in half in 2026—— **The capacity has increased, but the calculation amount per Token has barely increased**. This is the economic reason why MoE will become the default flagship form in 2026: it holds down the most expensive item (cost per Token) in T02 "Inferential Amortization Account".

**what does it mean**: Also aiming at a capability target, the approach in 2026 is not to "train Dense to 2T", but to "pile the total parameters to 2.8T to buy capacity, activate to 4% to buy reasoning" - the two accounts are kept separately, and each buys its own.

### 3. Activation ratio is low ≠ Cost is reduced proportionally: three transferred accounts

Does activating only 3.7% also reduce costs to 3.7%? No. MoE saves per-token **compute**, while adding or increasing three other costs:

| transferred account | mechanism | Active scale |
|---|---|---|
| GPU memory and weight account | Inference serving must hold **all** experts in GPU memory or a routable memory pool, whether a particular token uses them or not | The open weight volume of K3.1 Pro (same base as K3) is about 5.6TB according to third-party reports ( [Reporting measurement basis](https://www.ithome.com/1/022/490.htm), 2026-11); local deployment on consumer hardware is difficult |
| Load balancing account | Requests are unevenly distributed → hot experts queue up (long tail delay), cold experts occupy the GPU memory and do not contribute; additional balancing goals must be added during training to prevent routing collapse | Qualitative mechanism; specific balancing strategies shall be subject to each official report |
| Communication account | Experts are distributed on multiple cards and multiple machines, and the Token must be "sent" to the card where the expert is located, resulting in all-to-all communication | Production practices in 2026 are wide expert parallelism across NVL72 rack-scale systems ( [NVIDIA Official Blog](https://developer.nvidia.com/blog/scaling-large-moe-models-with-wide-expert-parallelism-on-nvl72-rack-scale-systems) measurement basis); the mechanism is expanded at T05 |

In one sentence: **MoE is not "the same model at a 3.7% discount", but "exchanges the graphics account and communication account for calculation."** Whether the exchange is worthwhile depends on your deployment form - high-concurrency cloud APIs are usually worthwhile (the cost per Token occurs every month), while stand-alone privatized deployment may be a loss (the 5.6TB load threshold directly discourages you).

### 4. How to determine routing parameters: expert granularity, Top-K and stability

"Using MoE" is just the beginning, configuration is the decision: **How many experts, how many to choose for each Token, and how granular it is**. These three things feed into each other:

| design variables | one end | other end | What to exchange |
|---|---|---|---|
| Number of experts/granularity | A few large experts, such as the 8 experts in the Mixtral-era historical example | Many but small (896 in K3, fine-grained) | Fine-grained combination is more flexible and capacity utilization is high, but routing and communication are more fragmented and the system is more complex |
| Top-K | Small K (such as 2) | Big King (like K3 of 16) | The larger K is, the more calculations per Token are and the closer it is to the stability of Dense. The smaller K is, the more economical it is but the knowledge coverage is narrow |
| Routing stability | — | — | Routing jitter in the early stages of training will cause the division of labor among experts to be shuffled repeatedly, requiring balanced target constraints (qualitative mechanism, specific methods shall be subject to each official report) |

**Research supports examining expert granularity.** The [fine-grained MoE scaling study](https://arxiv.org/abs/2402.07871) (2024), cited in T02, reports a declining optimal token-to-active-parameter ratio with scale: roughly 44:1 at 6.4B active parameters and 8:1 at 64T total/1T active parameters within its experimental range. It also favors finer experts at larger compute budgets. The hundreds-of-experts, low-activation-fraction configurations seen in 2026 flagships, such as K3’s 16 of 896 experts, are consistent with that direction. This combines research and observation; no vendor statement establishes that it chose its configuration according to this law.

**what does it mean**: The routing configuration is not to copy a set of numbers from the paper, but to turn the three knobs of "capacity utilization (granularity), cost per Token (K), and system complexity (communication and balance)" together. Once the configuration is fixed, changing it is almost equivalent to retraining - this is the reason why it must enter ADR.

### 5. Dense is not dead: when does simple structure win?

It is indeed rare to see Dense on the 2026 flagship list, but "Dense has been eliminated" is a misunderstanding. **Dense is still commonly used in small and medium-scale and fine-tuning scenarios** - This is taxonomic discipline, not nostalgia.

Dense wins in three places:

- **System is simple**: No routing, no expert parallelism, no load balancing goals, both the training stack and the inference stack are light. For small and medium-sized teams, "stable performance" is more valuable than "optimal unit compute";
- **nudge friendly**: Dense models have the most mature LoRA and full fine-tuning ecosystem, with relatively predictable behavior. T06 examines adaptation depth in fine-tuning
- **Deployment is light**: total and active parameters are equal, so weight size directly reflects model size and the quantized deployment path is clear. The T02 edge example, LFM2.5-350M trained on 28T tokens at roughly 80,000:1, illustrates a Dense model under a hard size limit: parameter count is fixed and the remaining budget buys tokens.

Then use a teaching comparison to quantify "where to win" (configured as a teaching indication, the method copies the three-account perspective of T02; comparison with the same family can also look back at T02's plan B/C decision):

| Configuration (teaching illustration) | 30B Dense | 100B Dense | 60B-A6B Small MoE |
|---|---:|---:|---:|
| Calculation per Token (activation measurement basis) | 30B | 100B | 6B, the third gear is the most economical |
| Load GPU memory (total parameters measurement basis) | 30B, the lightest | 100B | 60B, and requires multiple card placement experts |
| Fine-tuning the ecology | Mature, predictable behavior | mature | Routing and expert fine-tuning have extra work |
| System complexity | lowest | low | Routing + Expert Parallel + Load Balancing |
| Applicable domain | End-to-end / privatization / fine-tuning the main force | Low request one-time training | High concurrency cloud service |

Reading: The per-Token cost advantage of small MoE is real (6B vs. 30B), but you have to pay for it communication account, balancing account and system complexity—— **Whether the exchange is cost-effective is determined by the deployment form, not by the structural advancement.**

Historical anchor: Llama 3 405B (2024) is often regarded as the final work of the "Dense Flagship Era"; since then, the open source flagship camp has shifted to MoE as a whole. Ending does not mean disappearing - just as Mixtral 8x7B is the historical anchor of "the earliest open source MoE", Dense and MoE are two cost structures, each with its own applicable domain.

> **Judgment boundaries:** The correct question to ask "Choose MoE or Dense" is not "who is more advanced", but "Are I willing to pay for display and communication accounts in my deployment mode?" High-concurrency cloud services, large request volume, and good cluster interconnection - MoE exchange is usually cost-effective; stand-alone deployment, small and medium-sized, mainly fine-tuning, limited team system experience - Dense is often the more honest answer.

---

## 3. Compression, sparse access and linear attention are alternatives

### 1. Establish intuition first: Why does the cost explode as the context becomes longer?

At each autoregressive generation step, attention compares the new token’s query with **all previous tokens**. To avoid recomputation, serving systems cache each historical token’s keys and values at every layer: the **KV Cache**.

```text
When generating the Nth Token:
    Query of new Token
        ↓ Layer by layer
    Pay attention to the K/V of all historical Tokens in the KV Cache
        ↓
    The calculation amount of naive attention increases with the square of the context length (on the order of O(L²))
    The size of KV Cache grows linearly with the context length (O(L) magnitude)

Two stages of reasoning:
    Prefill: Process input in parallel at one time - computationally intensive, long input
    Decode: Generate token by token - intensive memory access, eating KV Cache
```

When the three cost curves are stacked together, the long-context account becomes clear:

- **Account calculation**: Attention calculation increases with the square of length (naive measurement basis) - Prefill becomes slower;
- **GPU-memory ledger:** KV cache grows linearly with length and competes with **concurrent requests** for the same memory pool;
- **Delayed account**: The history needs to be scanned for each generated Token - Decoding becomes slower.

The attention structure innovations in 2026 will all be performed on these three curves. But there are three types of surgery, which are often lumped into one.

### 2. KV-cache arithmetic: three claims on the same GPU memory

Why do long contexts crowd out concurrency? Calculating the allocation of the GPU memory pool will make it clear. Let’s first give the measurement basis: KV Cache volume per Token ≈ **2 (K and V) × Number of layers × Number of KV heads × Dimensions per head × Bytes per parameter**. Consider a purely illustrative configuration: 30B Dense, 60 layers, GQA with 8 KV heads, 128 dimensions per head, and FP16 at 2 bytes. This is not a real model configuration

```text
KV per Token ≈ 2 × 60 × 8 × 128 × 2 bytes ≈ 240 KB (teaching instructions)

One concurrent sequence at 128K context ≈ 240KB × 131,072 ≈ 30GB
Single channel concurrency @ 1M context ≈ 240KB × 1,048,576 ≈ 240 GB ← One channel cannot fit on a single card

Three-party split of GPU memory pool (same card):
    Weight (total parameter measurement basis, all experts are resident)
  + KV Cache × Number of concurrent paths (increases bilinearly with window and concurrency)
  + Activation and runtime overhead
    =GPU memory supply
```

Three conclusions fall directly from arithmetic:

- **Windows and concurrency are a seesaw**: The GPU memory pool is fixed, the window is raised from 128K to 1M (×8), each KV Cache is also ×8, and the concurrency budget is ÷8 - this is the mechanism layer answer to "concurrency may decrease after the long context capability is improved";
- **The family of compressed KV (MQA/GQA/MLA) buys back concurrency**: If the structure suppresses the KV of each Token to 1/8, the concurrency under the same graphics memory is ×8 (ratio representation) - they compress the graphics memory curve, not the calculation curve;
- **The sparse family (DSA class) focuses on access and calculation**: KV is still the same KV, but only top-k Token entries are accessed at each step. Decode memory access and Prefill calculations are capped at k - so after GLM-5.2 saves calculations, the bottleneck shifts to "Can the KV Cache still be loaded?" (third-party estimates are 830–950GB per level).

This explains multi-GPU long-context serving. Third-party estimates put GLM-5.2 with FP8 weights and FP8 KV cache at approximately 830–950GB. A single GPU cannot support that budget; in the teaching example, even one 1M-token sequence does not fit. **For every number, ask whether it is bytes per token, memory per sequence or supply across the whole pool. These differ by orders of magnitude.**

### 3. Taxonomy discipline: three families are not allowed to be written as upgrade routes

This table is easy to misclassify. The distinctions follow 2026 taxonomy discussions and current model configurations ( [A guide to Raschka attention variants](https://magazine.sebastianraschka.com/p/visual-attention-variants)）：

| family | Mechanism in one sentence | represent | Which curve does it press? |
|---|---|---|---|
| **Dense attention for compressing KV** | Still watching **All** Historical Tokens, but reduce the K/V stored in each Token | MQA / GQA (multi-query/grouped query, shared KV header); MLA (low-rank compression, introduced and developed by the DeepSeek series - V3 is the historical anchor) | GPU memory curve: KV Cache becomes smaller; **The calculation is still on the order of squares** |
| **Sparse attention (choose first, look later)** | First select the top-k relevant tokens for each query, and focus only on them | DSA (DeepSeek Sparse Attention, V3.2 will be released for production in 2025-12); IndexShare of GLM-5.2 | Both calculation and memory access are capped at k; k is fixed, and the length will not explode no matter how high it is |
| **Linear/sub-quadratic attention** | Rewrite "see all history" into a recursive update of fixed-size state | KDA (Kimi Delta Attention, a delta-rule variant); MixLinear in LongCat-Flash; gpt-oss’s half-dense design is a hybrid branch | The calculation is nearly linear and the state is constant; the price is the trade-off between forgetting and recall caused by the fixed state |

**taxonomic red line**: DSA is sparse attention, MLA is compressed dense attention, **Neither is linear (sub-quadratic) attention**; The hybrid linear attention example that will truly enter the trillion-level open source weight in 2026 is Kimi K3’s KDA (delta-rule class) and AttnRes. Writing "Standard Attention → MLA → DSA → Linear Attention" as an upgrade route is equivalent to drawing three different roads as steps - this is the number one misjudgment designated in this chapter.

The correct way to draw the three roads is to make parallel choices:

```text
The same problem: the context becomes longer and attention is too expensive
    ├── Route 1: Keep a smaller KV deposit (MLA/GQA) – still read them all, but it’s easier to read
    ├── Route 2: Only look at the relevant k items (DSA/IndexShare) - select first and then look
    └── Route 3: No history, save status (KDA/MixLinear) - nearly linear, but may be forgotten
Production practice in 2026 commonly combines MLA compression with sparse top-k selection,
                  Linear/Hybrid is a differentiated branch; it is still undecided who can become the default
```

### 4. Case dismantling: the production chain of sparse attention

Each link in this chain has an official measurement basis and is suitable for reading in its entirety.

**The first ring: DeepSeek V3.2 first release DSA (2025-12).** The mechanism of DSA can be summarized as "Lightning Indexer + top-k selection": an indexer first selects the most relevant small number of Tokens for each query, and only pays attention to them (for mechanism explanation, see [DSA Topics](https://www.emergentmind.com/topics/deepseek-sparse-attention-dsa)). Key details: DSA vs. MLA **Overlay** Instead of replacing - MLA manages "how small the K/V storage of each Token is", and DSA manages "which Tokens to look at this time". One compressed storage and one tailoring access do not replace each other. This combination is a lesson in taxonomy in itself.

**Second step: GLM-5 adopts DSA + MLA (2026-02).** [GLM-5 technical report](https://arxiv.org/abs/2602.15763) Disclosure of its attention using DSA+MLA combination (measurement basis: Official Report). Structural decisions within the same family continue and deepen across model generations, indicating that sparse routes are production-proven.

**Third step: GLM-5.2 introduces IndexShare (2026-06).** [Official blog](https://z.ai/blog/glm-5.2) This disclosed design allows **An indexer serves a group of layers and shares Token selection across layers** — a group of layers shares the selected-token list instead of selecting independently in every layer. According to a third-party analysis ( [Disassembly article](https://sebastianraschka.com/blog/2026/glm-5-2-indexshare.html)): Each query only performs complete attention on about 2048 Tokens in the top, and the attention calculation amount is reduced by about 2.9 times when using 1M Token context (this multiple and the top-k value are the third-party disassembly measurement basis, and the official original text shall prevail before quoting).

The third component’s teaching point is **bottleneck migration**. After attention compute falls, GLM-5.2’s serving bottlenecks shift toward KV-cache capacity, long-context kernels, and CPU overhead: **attention savings do not automatically become system savings**. This illustrates architecture changing the training system; T05 covers system-level responses.

**A different path: Kimi K3 (2026-07).** K3 uses **KDA, a delta-rule form of linear attention, and AttnRes (Attention Residuals)** rather than DSA. Some layers use fixed-state recurrent updates—updating memory by a delta when new information arrives—alongside full attention. It is a hybrid linear example among trillion-parameter open weights. Pure linear layers still face forgetting; hybrid designs such as NSA, laNSA, and NHA remain largely research directions. Hybrid attention is therefore the cautious present choice; whether linear attention becomes the default is unsettled.

> **Architectural wisdom:** Both routes (sparse selection and mixed linear) are solving "arithmetic problems with long context", but the operation positions are different: one cuts "how much to see", and the other rewrites "how to remember". When reviewing attention plans, the first question is always "Which cost curve does it press and where does the cost shift?" - not "How much newer is it than the previous structure?"

### 5. Current implementation status of 1M context: Nominal ≠ Effective ≠ Cheap

In 2026, 1M-token context windows are available for production use, according to official documentation and a [window-size compilation](https://codingscape.com/blog/llms-with-largest-context-windows):

| model | nominal context | Remarks |
|---|---:|---|
| Gemini 2.5 Pro | 2M | Summary page measurement basis, subject to official documents |
| Claude Opus 4.6 | 1M | The reporting measurement basis of the aggregation page must be verified with the Anthropic official page before quoting |
| Kimi K3 | 1M | Official reporting measurement basis |
| DeepSeek | 1M | Output upper limit: 384K (summary page size) |
| GLM-5.2 | For long-range missions | Official blog measurement basis, equipped with IndexShare |

However, "Produced and Available" requires three measurement bases that must be written:

- **Nominal ≠ Valid**. Windows are input and output **Share**: a model advertised at 1M with a 128K output limit has roughly 870K available input tokens: 1M − 128K ≈ 870K. Larger output reservations reduce input space. Many practitioners consider nominal 1M misleading for most tasks; effective context is further limited by retrieval and multi-hop performance. T03 adds a fertility adjustment: the same 100,000 Chinese characters can yield token counts differing by more than 2× across vocabularies.
- **Long context ≠ cheap**. According to third-party estimates, GLM-5.2 uses FP8 weight + FP8 KV Cache for long context services, requiring approximately 830–950GB of GPU memory ( [third party estimates](https://www.mindstudio.ai/blog/glm-5-2-architecture-index-share-sparse-attention))—it cannot fit on one GPU and requires multiple GPUs to run.
- **Window armaments are cooling**. The industry judgment in 2026-01 is that the growth of window numbers will slow down, and the focus will shift to expansion and context management (Compaction/retrieval memory) during inference - replacing "larger windows" with "better windows", and the context management of long-term tasks will be launched in T09.

### 6. Long context vs retrieval: It’s not an either/or

The question “Does a 1M-token window remove the need for RAG?” continues the debate between options C and A. There are four decision variables:

| variable | Prefer long context | Retrieval-oriented (RAG) |
|---|---|---|
| Single material quantity | Hundreds of thousands of Token levels, must be holographic cross-referenced (contract comparison) | Massive corpus, only a few fragments required each time |
| access mode | Review the same batch of materials over and over again | One query, click and go |
| Delay and cost estimates | It is acceptable if Prefill becomes slower and KV Cache becomes larger | First token delay sensitive, per-token billing sensitive |
| correctness measurement basis | "The model has read the full text" can be audited | "The search did not miss anything" requires additional proof |

The two are often used in combination with Compaction in Agent's long-range tasks (compact before the context is full). This is the decision-making site of T09. This chapter only establishes one discipline: **The window size is an architectural decision, and whether to search or not is a system decision. The two together determine "what the model can actually see."** ——The latter went back to rewrite the data and evaluation measurement basis.

### 7. How to measure effective context: the hierarchy of three types of evidence

"Effective context" is not calculated, it is measured. The evaluation evidence is divided into three layers, each layer is closer to the real load (methodological framework, no specific benchmark scores are quoted):

| Hierarchy | What to measure | Limitations |
|---|---|---|
| Single point search type (needle in haystack type) | Bury a fact deep in a long document and ask the model if it can find it | Necessary but not sufficient: find a needle ≠ understand the entire document |
| Multi-hop/cross-reference class | The answer requires stringing together two or three facts scattered throughout the document (contract terms are quoted from each other, financial reports are cross-referenced) | Closer to documentation tasks, but still artificially constructed |
| Long-distance tasks | Performance under real multi-turn workloads (toolchains and state retention) | Mixed with context management strategies (Compaction), be careful with attribution |

Two disciplines: **The report window capability must have task type and evaluation settings** (Which layer, what length, what location distribution), cross-model comparison is meaningful; **Pin-testing all pairs is not equal to cross-referencing all pairs** ——Using the first-level perfect score as proof of "effective context = nominal context" is a common starting point for shrinking product promises.

> **Judgment boundary:** The nominal context is the manufacturer's measurement basis, the effective context is the product measurement basis, and the deployment cost is the ledger measurement basis. Before promising to the business side "can read one million words", three standards must be reviewed - window sharing rules, vocabulary fertility, output upper limit, and GPU memory budget. Any one of them will shrink the promise.

---

## 4. Native multimodality, connectors and evidence of visual understanding

### 1. Two routes: joint training from scratch, or joining later

There are only two main routes to skeleton decision-making for multi-modal capabilities:

| route | practice | Advantages | cost |
|---|---|---|---|
| **Native multimodality** | Image/video/audio and text Token are intertwined and trained from pre-training | Vision and language are in the same representation space, with good early alignment and unified architecture | The data recipe, training phase, and evaluation all need to be redone for multi-modality (the recipe of T03 has been rewritten) |
| **Connector/Adapter** | Freeze or lightly fine-tune visual encoder + projection layer to "translate" visual features to existing text models | Get on the bus quickly, can reuse mature text base, and the increment is small | The upper limit of alignment is constrained by the connector; the burden of proof of "whether the image is really used" is heavier |

Historical anchor points: Flamingo (2022) and LLaVA (2023) are the origins of the connector route; subsequent evolution has made the connector deeper while moving the modality forward into pre-training. **active anchor point**: Kimi K3 official report says native multi-modal; Mistral Large 4 is also native multi-modal ( [Official announcement](https://mistral.ai/news/mistral-large-4-oss) measurement basis) - The default posture of the flagship layer is shifting from "hanging connectors" to "native pre-training", but the connector route is still the mainstream approach in stock bases and lightweight scenarios (application domain judgment, not elimination theory).

### 2. Visual Token Budget: How does the modal account occupy the window account?

The image entering the model is not "one picture and one input", but is first cut into **Visual Token**: A picture usually corresponds to hundreds to thousands of visual tokens (magnitude indication, please refer to each model document); the video is then multiplied by the number of frames. So the modal account directly rewrites the window account:

```text
Context budget, for example 1M tokens
    ├── Document input: hundreds of thousands of Tokens (contract/financial report)
    ├── Visual input: hundreds to thousands of Tokens per picture × number of pictures
    ├── Output reservation: the larger the upper limit, the smaller the available input (see Section 3 for measurement basis)
    └── Multi-turn agents: accumulating trajectory history; see T09
        ↓
The window of "Multimodal Long Document Agent" is an order of magnitude more expensive than the window of "Chatbot"
```

It also rewrites the training side: the data recipe of the original route must have enough interwoven corpus of images and texts (referring to the matching method of T03), and the training phase must include an additional phase of alignment between the encoder and the text backbone. Modal decision-making is never as cheap as "adding an input port".

### 3. The training stage of the modal account: the two routes do not rewrite the same place

The route selection falls into the training pipeline, and there are two different transformation positions:

```text
Native multimodality:
  Pre-training of intertwined images and text corpus (early combination of visual encoder and text backbone)
      → Modal alignment/command stage (image and text behavior finalization)
      → Multi-modal post-training (demonstration, preference, RL and text in the same link, T06–T09)

Connector/Adapter:
  Freeze or tweak visual encoder
      → Projection layer training (aligning visual features to text embedding space)
      → Command fine-tuning (mostly lightweight updates to the text backbone)
```

Two direct corollaries:

- **What the original route rewrites is "pre-training itself"**: The data recipe must have enough corpus intertwined with graphics and text (how to match it, referring back to the capability matrix method of T03), and the visual side must be included in the pre-training compute account; this is why native multi-modal modes usually appear on the flagships of "training from scratch" (K3, Mistral Large 4), but rarely appear on the incremental transformation of the stock base;
- **The connector route is rewritten as "post-training"**: Pre-training does not move, increments are concentrated in the projection layer and fine-tuning, cheap and fast, but the upper limit of alignment is constrained by the connector, and the evidence obligation is heavier (see the next section).

Video and audio have the same reason: video is usually entered into the window by "frame × visual token per frame" (the budget is multiplied by another order of magnitude), and audio is encoded by frame or segment. Active anchor: K3.1 Pro official measurement basis is text + image + video input, 1M context ( [Official blog](https://www.kimi.ai/blog/kimi-k3-1-pro))——Multi-modal input form is already the default configuration of the flagship, but "input support" and "evidence use" are still two different things. The acceptance rules are as follows.

Amortizing the costs of the two routes into a list, the full picture of the modal account emerges:

| cost side | Native multimodality | connector route |
|---|---|---|
| data side | Matching and quality assessment of intertwined image and text corpus (referring to the method of T03) | Image and text pair/command data, small amount but requires alignment quality |
| Training side | Pre-training compute is included in the visual side; more modal alignment stages are included | Projection layers and lightweight fine-tuning with small increments |
| Inference side | The visual token enters the window and the encoder delay is included in the first token | Same as left, but smaller encoders are often available |
| Acceptance side | Three-piece set of evidentiary obligations (see below) | Heavier burden of proof: Alignment cap bound by connectors |

### 4. Obligation of evidence: whether the model actually uses image evidence

The increase in scores on the multimodal list does not constitute proof that "the model is looking at the picture" - text priors (the answer clues are already included in the question stem) and image evidence (the correct answer can only be obtained by looking at the picture) are indistinguishable in the total score. When accepting multi-modal capabilities, there are at least three evidentiary obligations:

- **Disturbance test**: Key numbers in the occlusion image / Swap the two images / Replace with an irrelevant image, the answer should change accordingly. No change, indicating that the model is not looking at the picture;
- **Compare the same title with or without pictures**: The difference in accuracy between the two versions of the same question, with and without pictures, is the rough measure of “image evidence contribution”;
- **Baseline version and evaluation measurement basis**: multimodal benchmarks change quickly. Align benchmark versions and sampling settings before comparing models; T10 covers evaluation governance.

> **Judgment boundaries:** "Support image input" is the interface measurement basis, "Use image evidence" is the capability measurement basis, and "Both have evaluation evidence" is the acceptance measurement basis. The last column of the modal account is always reserved for evidence - multi-modal solutions without perturbation testing are processed as "text model + decorative image port".

---

## 5. Architecture is a dependency graph, not a technology checklist

### 1. Draw the three accounts into one picture

The first four sections calculated three accounts respectively, and this section connects them - this is the essence of "joint decision-making":

```text
Capacity Account (total parameters/Activation)
    ├─ Rewritten → Loading and deployment (weighted volume, quantification threshold)
    ├─ Rewrite → Communication (expert parallel all-to-all, T05 expansion)
    └─ Rewrite → Window account (expert weight and KV Cache compete for the same GPU memory)
Context-window ledger (attention / context)
    ├─ Rewritten → Concurrency and latency (KV Cache × number of concurrent paths = GPU memory pool)
    ├─ Rewrite → Modal account (visual token occupies window budget)
    └─ Changes -> context strategy: long windows, retrieval or compaction; see T09
Modality ledger (native / connector-based)
    ├─ Rewritten → Data recipe and training phase (the output of T03 is rewritten)
    ├─ Changes → context-window ledger (visual-token expansion)
    └─ Rewritten → Training system (encoder throughput, image-text interleaved data pipeline, T05)
        ↓
Hardware and deployment constraints (interconnection, rack, GPU memory supply) reversely lock the above choices
        ↓
Architecture ADR: Archive this dependency graph along with reasons for trade-offs
```

### 2. Three current examples of “mutual rewriting”

**Example 1: MoE saves calculations, but increases the window account.** MoE reduces the calculation per Token to 4–6%, but all experts must reside in GPU memory - and KV Cache also requires GPU memory. Expert weight and KV Cache trade off on the same card: the larger the total parameter, the less GPU memory is left for concurrency or long context. The 5.6TB weight of K3.1 Pro (according to third-party reports) is the most straightforward scale: the expansion of the capacity account directly compresses the window account and concurrency space.

**Example 2: sparse attention reduces compute but shifts the bottleneck.** After GLM-5.2’s IndexShare reduces attention compute at 1M context by roughly 2.9×, according to a third-party analysis, bottlenecks move to KV-cache capacity, long-context kernels, and CPU overhead. Architectural gains **move the problem to the system layer**, which is why T05 must verify these figures in the actual training and serving system.

**Example 3: The modal route rewrites the data recipe just decided in the previous chapter.** The moment you select native multi-modal mode, the pre-training recipe of T03 is rewritten: the intertwined image and text corpus becomes a new matching variable, and its source, quality assessment and decontamination must be redone according to the T03 method; when you select the connector, the rewritten position is moved to the post-training instruction data. The modal account is the most "cross-border" of the three accounts - it often touches products just delivered by other chapters.

### 3. Hardware supply dependency graph: measurement basis of hybrid chip stack

In addition to the three accounts, there is also a counter force: the heavier the ** skeleton, the more dependent it is on specific interconnection and rack forms, and hardware supply in turn restricts architectural choices. **The most complete public case in 2026 is DeepSeek's "phased hybrid hardware" route, which lists the evidence one by one (each standard):

| facts | measurement basis |
|---|---|
| DeepSeek V4 has approximately 1.6T parameters and pre-training data exceeding 32T Token | HF model card measurement basis |
| V4 pre-training is mainly still on NVIDIA, and only part of the process is adapted to Huawei Ascend | [MIT Technology Review](https://www.technologyreview.com/2026/04/24/1136422/why-deepseeks-v4-matters) Reporting measurement basis |
| A Huawei-led consortium completed full-parameter post-training of V4-Pro using at least 1000 Ascend chips | SCMP reporting measurement basis, please review the original text before quoting |
| Third-party work SLAI T-Rex performed end-to-end full parameter post-training on DeepSeek-V4 on Ascend NPU SuperPOD, reaching 34.22% MFU | [arXiv:2607.20145](https://arxiv.org/abs/2607.20145) |

Three rules for reading meters:

- **Writing "Completely localized training" or "Completely going to NVIDIA" will overturn the situation** ——The evidence supports only "phased mixing": different supply strategies are used for pre-training and post-training;
- **"V5 will be pre-trained on Huawei hardware" is a single source report**, this chapter does not adopt it; single-source next-generation plans will not be used as the basis for decision-making by default;
- **Teaching significance lies in the dependency graph**: trillion-parameter architecture requires rack-scale systems. NVIDIA describes wide expert parallelism across NVL72. Rack and interconnect availability therefore constrain architectural feasibility, setting up T05.

### 4. Back to the opening: Joint verdict of three offers

The table in Section 1 can now be upgraded to a verdict version (a verdict = exposing the premise, not picking a winner):

| quote | The premise for its establishment | What it didn't tell you |
|---|---|---|
| A (2.8T-A104B, 1M, native multi-modal) | You need flagship-level capability and have a deployment cluster that can accommodate TB-scale model weights | The calculation of each Token is the most expensive among the three (104B); the loading and privatization threshold of 5.6TB weight |
| B（744B-A40B，DSA+MLA） | Long documents are your main load, and the multi-modal route can be negotiated separately | The focus is on the calculation segment, while KV Cache and system-side overhead are still there (bottleneck shift) |
| C (30B Dense + connector + retrieval, teaching instructions) | Material access is "query-based", the retrieval recall rate can prove it, and multi-modal requirements are shallow | Can 128K+ searches support "holographic cross-referencing" tasks? The connector's evidentiary obligations must be filled by oneself |

After reading three lines, the real decision variables emerge: **The material form of the task (holographic reading vs query hit), deployment form (cloud cluster vs privatized stand-alone), multi-modal depth (real picture vs decorative interface)**. These variables come from layer 1, capability goals, and layer 7, system constraints, of the eight-layer framework. Architecture searches for a feasible region between them, rather than the newest structural name.

### 5. Review and reading of dependency diagram: four steps

Turn the dependency graph into an operable process at the review meeting. Any skeleton proposal must go through these four steps:

```text
Step 1: Read the input first: task status/deployment status/hardware supply
         —— Reading the structure without reading the constraints is the starting point of all misalignments
    ↓
Step 2 Read three more account readings: Capacity/Window/Mode
         ——The measurement basis of each number (official disclosure/third-party disassembly/teaching instructions)
    ↓
Step 3: Follow the arrow to find the rewrite: Whose account does this plan rewrite?
         ——MoE changes GPU memory and communication; sparse attention changes KV and kernel;
            Modal change data recipe and window budget
    ↓
Step 4 Finally, find the bottleneck and transfer it: Where do the benefits go and to which layer does the cost transfer?
         — into the system layer (T05), data layer (T03) or evaluation layer (T10),
            There must be someone to catch you everywhere
```

After completing the four steps, a proposal of "let's use such-and-such a structure" becomes a set of testable statements: what constraints it assumes, which accounts it rewrites, who bears the cost, and what experiments are used to verify it. If any step cannot be answered, the proposal will not be ready for a decision - these records can help the team check whether the plan is feasible before formal training.

> **Architectural wisdom:** People who copy the flagship skeleton get the solution to other people's constraints. K3's 16 out of 896 and GLM-5.2's IndexShare are all solved under the set of constraints of "trillion capacity + long-distance tasks + own cluster"; if your constraints are different, the same solution will be wrong. Reuse reasoning (dependency graph + reasons for trade-offs), do not copy answers (structural configuration).

---

## 6. Record the structural decision in an Architecture ADR

### 1. Why architectural decisions especially require ADR

Model architecture decisions have a drawback that other decisions don’t have: **It is set before training starts and can be verified after training ends**. The vocabulary list, number of experts, attention structure, contextual targets, and the cost of changing midway are all "close to retraining." Therefore, the documentation of architectural decisions has the highest value - it records not "what was chosen", but "under what constraints it was, what was given up, and how it was planned to be verified."

Following the nine-segment Training ADR skeleton introduced in the introduction (the complete template is in T11), the structure version is filled in as follows:

```markdown
# Architecture ADR: Model Skeleton Decision

1. Ability goals and task form - what is the main load (holographic reading/query hit/agent multiple rounds),
   Multi-modal depth requirements, which capabilities are not allowed to be rolled back
2. Deployment constraints—cloud high concurrency/low latency/privatization/device side; GPU memory and interconnection supply; quantitative route
3. Capacity ledger: total parameters, active parameters, expert count and Top-K; which costs correspond to each basis?
4. Window account - attention family selection (compression/sparse/linear), nominal and effective context,
   KV Cache budget, concurrency target
5. Modal account - native or connector, visual token budget, data recipe changes (referring to T03),
   Acceptance method of evidentiary obligation
6. Candidate plans and reasons for abandonment - each candidate writes down its readings on the three accounts
7. System impact - communication (expert parallelism), memory segmentation, bottleneck transfer prediction (preview T05)
8. Verification plan - small-scale proxy experiment, fixed budget comparison, effective context evaluation,
   Multimodal perturbation testing; prediction grading (validated/partially validated/pure extrapolation, referring back to T02)
9. Exit condition - what signal occurs to restart skeleton decision-making (for example: the effective context is lower than the nominal X% for a long time)
```

### 2. A quick decision chart

The derivation of this chapter is compressed into one page (the tendency is directional guidance, and the final calculation will be based on the recalculation of the three accounts):

| your constraints | Capacity tendency | window tendency | modal tendency |
|---|---|---|---|
| Cloud high-concurrency API, large request volume | MoE, activation ratio 4–6% range, absolute activation value suppressed | Sparse/compression combination, window commitment by effective diameter | Native (if multimodality is a core competency) |
| Privatized stand-alone / small and medium-sized | Dense, or small MoE (subject to official documentation) | 128K–256K + search assistance | Connectors, with evidence obligations |
| Agent long-range tasks | Activation is medium, total parameters can be large | Long context + compaction; see T09 | Visual Token budget pre-calculation |
| Terminal/Device | Small Dense + Extreme Overtraining (T02) | Short window, search external | Usually not done or very lightly |
| Mainly fine-tuning/domain adaptation | Dense takes priority (fine-tuning ecological maturity) | Inherit base | Connector increment smallest |

### 3. Engineering Product: Model Architecture ADR Checklist

**Input items (standard measurement basis for each item):**

| Input | Example value | measurement basis source |
|---|---|---|
| Task form | Chinese enterprise intelligence: holographic contract reading + chart understanding | What-if scenario |
| candidate skeleton | 2.8T-A104B / 744B-A40B / 30B Dense | K3 and GLM-5 official report + teaching instructions |
| attention candidate | DSA+MLA (+IndexShare homologous)/KDA mixed linear | Official Blog and Reports |
| contextual goals | Nominal 1M / effective about 870K (when the output upper limit is 128K) | Summary page measurement basis |
| modal route | Native vs Connector | Section 4 of this chapter |
| deployment constraints | Optional privatization, high concurrency online | What-if scenario |

**Output items (item-by-item reviewable):**

| Output items | content |
|---|---|
| Capacity account reading | Dual-measurement basis parameters, activation ratio, weight volume, loading threshold |
| Window account reading | Attention Family, Nominal/Effective Context, KV Cache and Concurrency Budget |
| Modal account readings | Route, visual token budget, data recipe changes, acceptance method |
| dependency graph | The mutual rewriting relationship between the three accounts + prediction of bottleneck transfer |
| Verification plan | Experimental and evidence ranking for each key hypothesis |
| Exit conditions | Trigger signal for restarting skeleton decision-making |

### 4. A completed example (excerpt)

Take the opening scene and fill in the first few paragraphs (the example is the demonstration in this article, the numerical measurement basis refers back to the main text of this chapter; the real ADR should be replaced by the actual measurement of your own project):

```markdown
#Architecture ADR: Chinese Enterprise Agent · Model Skeleton Decision-making (example excerpt)

3. Capacity account
   744B-A40B MoE was selected (activation ratio ≈5.4%, official reported measurement basis).
   Reason: High concurrency online service, the cost per Token adopts the activation measurement basis (40B is better than the absolute value of 104B,
   The official API price $1.0/$3.2 versus $3/$15 is directional evidence);
   Abandon the 2.8T solution: The load threshold (third-party reports are on the order of 5.6TB) conflicts with the privatization option.

4. Window account
   Attention: DSA+MLA family (production chain V3.2→GLM-5, official measurement basis).
   Context: External commitment of "effective input of about 870K" (nominal 1M − output reserved 128K),
   Vocabulary fertility discount is measured separately; the concurrent budget is reviewed according to the KV Cache calculation in Section 3.

5. Modal account
   Route: Connector (the diagram is understood as a shallow multi-modal requirement, and the obligation of evidence can be accepted by yourself);
   Acceptance: Disturbance test + comparison of the same question with and without pictures. Only when both standards are met will it be counted towards the ability goal.

8. Verification Plan (Evidence Grading)
   Verified: DSA+MLA combination (adopted by many manufacturers, A1 measurement basis);
   Partial verification: 870K valid contexts (measurement basis estimation + long document evaluation to be done);
   Pure extrapolation: None.

9. Exit conditions
   The effective retrieval capability in the long document evaluation continues to be less than 60% of the nominal, or the concurrent cost
   Over budget for two consecutive quarters → Restart skeleton review (prioritize review of window account and modal depth).
```

The rules of this ADR are the same as the budget table of T02: **Each number is marked with an identity (official disclosure/third-party dismantling/teaching instructions), each choice indicates what is given up, and each prediction leaves a backfill position. **The reviewer must be able to use it to recalculate and find out the mistakes - the ADR that cannot be found is not written perfectly, but it is not written honestly enough.

> **Architectural wisdom:** The most expensive failure mode of architectural decisions is not choosing the wrong structure, but "choosing it and no one remembers why." A year later, when the model capability regresses and you have to determine whether it is a data problem or a skeleton problem, the only thing that can save you is the ADR that clearly stated the premise and exit conditions.

---

## 7. Six common reasoning errors

### Mistake 1: Treating the activation ratio as a cost discount

"Activation is only 3.7%, so the cost is low" confuses proportion with absolute value. The calculation amount of each Token corresponds to the active parameters **absolute value** (104B is still 2.6 times that of 40B). The activation ratio only shows how economical it is relative to its total capacity. The installed graphics memory determined by the total parameters is not even a penny - the open weight volume of K3.1 Pro (same base as K3) is about 5.6TB (third-party report measurement basis). **corrective action**: The MoE cost must be reported in three parts - total parameters, activation, and activation ratio, one of which is indispensable.

### Mistake 2: Write MLA/DSA/Linear Attention as an upgrade path

MLA compresses dense attention: it still attends to everything but stores less. DSA selects sparsely before attending. Linear attention such as KDA and MixLinear uses fixed-state recurrence, with near-linear behavior and possible forgetting. These are three distinct approaches, and production systems **combine** DSA with MLA. **Review action:** identify the family and the cost curve it reduces before comparing advantages.

### Mistake 3: Treating the nominal context as a valid context commitment

The window is shared for input and output: 1M is equipped with a 128K output upper limit, and the available input is about 870K; the vocabulary word fertility is further discounted; the effective search and multi-hop capabilities need to be evaluated and proven. Industry judgment (2026-01) The growth of window numbers has slowed down. **corrective action**: It only promises "effective context = nominal - output reservation - fertility discount" to the business side, with evaluation criteria attached.

### Mistake 4: Declaring Dense obsolete

Dense is rare on the 2026 flagship list, but Dense is still the common answer in scenarios where small and medium-scale, fine-tuning is the main focus, system simplicity is given priority, and the device-side form is used (the device-side case of T02 is Dense). **corrective action**: Write "Dense vs MoE" as a function of the deployment form (whether you are willing to pay the memory account and communication account), not in the order of times.

### Mistake 5: Multimodality only accepts the interface, not the evidence

"Supporting image input" does not mean "using image evidence". Without perturbation testing and comparing the same question with and without pictures, the ranking improvement may all come from text priors. **corrective action**: Three-piece set for multi-modal acceptance - disturbance response, comparison with and without pictures, and benchmark version measurement basis.

### Mistake 6: Copy the flagship skeleton but not the flagship constraints

K3’s 16 out of 896 and GLM-5.2’s IndexShare are both solutions under the constraints of “trillion capacity + long-distance tasks + large clusters”. Copying the configuration but not the constraints is equivalent to filling in other people's answers on your own test paper. **corrective action**: Before reusing, go through the dependency graph in Section 5 of this chapter to confirm that the task form, deployment form and hardware supply are isomorphic; then check the measurement basis of each number (open weight ≠ training transparent ≠ self-deployable).

---

## 🎯 Quick check

```quiz
{
  "question": "The MoE model only activates 3.7% of the parameters per Token. Why can't it be inferred that its memory usage is only 3.7%?",
  "options": [
    "Because the activation ratio is the training measurement basis, all experts will be activated during inference",
    "Because the GPU memory takes the total parameter measurement basis: the inference service must load all experts into the GPU memory (or routable GPU memory pool), regardless of whether each Token is used or not; the activation ratio only describes the calculation amount of each Token, not the loading amount",
    "Because the GPU memory is mainly determined by the optimizer status and has nothing to do with the amount of parameters"
  ],
  "answer": 1,
  "explanation": "The total parameters correspond to the load (the open weight of 2.8T total parameters is about 5.6TB according to third-party reports), and the active parameters are calculated corresponding to each Token. MoE is calculated by exchanging the graphics account and communication account, not an overall discount."
}
```

```quiz
{
  "question": "Regarding the classification of attention structures, which of the following statements is correct?",
  "options": [
    "DSA is sparse attention (top-k is selected first and then looked at), MLA is compressed dense attention (still looks at all, saves smaller), neither of them belongs to linear attention; the real hybrid linear example is Kimi K3's KDA (delta-rule class), etc.",
    "MLA, DSA, and linear attention are three generations of upgrades on the same technical route. The newer ones have lower complexity",
    "DSA replaced MLA, so GLM-5 only uses DSA"
  ],
  "answer": 0,
  "explanation": "The three paths press different cost curves: MLA presses KV storage, DSA cuts the access range, and linear attention is rewritten as fixed-state recursion. In production, DSA and MLA are used in a superimposed manner (DeepSeek V3.2 is launched first, and GLM-5 follows up), and there is no substitution relationship."
}
```

```quiz
{
  "question": "After a certain service upgraded the context from 128K to 1M, the number of concurrent channels on a single machine dropped significantly. What is the most likely architectural layer cause?",
  "options": [
    "The context length has nothing to do with concurrency. It should be because the code is broken",
    "The decrease in concurrency is due to the increase in attention parameters, which takes up the compute used for concurrency",
    "KV Cache grows linearly with the context length, and also grows linearly with the number of concurrent channels. The two share the same GPU memory pool: as the window becomes larger, the KV Cache requested by each channel becomes larger, squeezing out the concurrency budget"
  ],
  "answer": 2,
  "explanation": "KV Cache GPU memory ≈ grows bilinearly with length and concurrency. The account of long context not only counts attention calculation (squared curve), but also counts KV Cache's squeeze on concurrency - this is why after GLM-5.2 saves attention calculation, the bottleneck shifts to KV Cache capacity."
}
```

```quiz
{
  "question": "The nominal context of a model is 1M Token, and the upper limit of single output is 128K. The product manager wants to promise to 'read 950,000 Token documents at one time'. Is this promise tenable?",
  "options": [
    "Yes: 950,000 is below 1,000,000",
    "Not true: the window is shared between input and output, 1M − 128K output reserved ≈ 870K available input, 950,000 has exceeded the limit; the effective context must be discounted according to the vocabulary fertility and actual retrieval capabilities",
    "Established, the output upper limit and input window are billed separately"
  ],
  "answer": 1,
  "explanation": "Nominal ≠ Valid: The output reservation is deducted first (about 870K remaining), and the fertility is then discounted (the number of tokens cut out from different vocabulary lists with the same number of words is more than doubled). Finally, long document evaluation is used to prove that the model can really maintain retrieval and multi-hop across millions of tokens. Commitments should only be based on valid measurement basis."
}
```

```quiz
{
  "question": "In which of the following situations would it be more reasonable to choose the Dense model over MoE?",
  "options": [
    "Small and medium-sized, focusing on fine-tuning, pursuing simplicity in training and deployment systems, and being unwilling to pay the graphics memory and communication overhead of expert parallelism in the deployment form",
    "In any case MoE is more advanced, Dense is just a relic of history",
    "Only use Dense if the team cannot afford a GPU"
  ],
  "answer": 0,
  "explanation": "Dense is not dead: total parameters = activation, simple accounts, mature fine-tuning ecology, and light loading. The activation benefits of MoE are obtained in exchange for the graphics account (all experts are resident) and the communication account (all-to-all) - the deployment form and the team's system budget determine whether this exchange is worthwhile."
}
```

---

## Chapter summary

- Dense and MoE correspond to different computing, storage and communication costs; the total parameters and active parameters must be accounted for when comparing.
- Context length should be looked at together with effective utilization, KV Cache, concurrency and latency; multi-modality should prove that the task does depend on the corresponding modality.
- Write the three accounts into a dependency graph, and then use the workload to verify the candidate solutions. When reusing a base, start by selecting an existing structure that can be deployed.

> **Question for the next chapter:** After the architecture plan is determined, you must answer: How to split the model onto the GPU so that computing, communication, GPU memory, and fault recovery can all work?

---

## Terminology reference

| Terminology | How can beginners understand first |
|---|---|
| Total parameters / active parameters | How many things are installed / how much each Token is actually moved; the former corresponds to the GPU memory and weight volume, and the latter corresponds to the calculation amount of each Token |
| MoE (Mixing Expert) | Triage hospital: The router sends each Token to a few relevant experts, and the remaining experts do not participate in this calculation |
| Top-K routing | Rules for selecting K experts for each Token; for example, K3’s 896 experts select 16 for each Token |
| load balancing | A mechanism that allows experts to have almost as many tasks; imbalance will result in hot experts queuing up and cold experts occupying GPU memory |
| KV Cache | The historical Token key value cached during inference prevents the model from recalculating the history at each step; it grows linearly with context and concurrency |
| Prefill / Decode | Two stages of reasoning: one-time parallel processing of input (compute intensive) / token generation one by one (memory access intensive) |
| MQA / GQA | Multi-query/grouped query attention: multiple query heads share KV to reduce cache size (dense family) |
| MLA | Low-rank compressed dense attention: still looking at all Tokens, but the KV stored in each Token is smaller (Origin of DeepSeek series) |
| Sparse attention, such as DSA | First select the top-k relevant tokens for each query and then focus on it, "select first and then look"; use it superimposed with MLA |
| Linear/Hybrid Linear Attention | Use fixed-size state recursion instead of "looking at the entire history", which calculates nearly linearly but has a forgetting trade-off (KDA of K3 is an active instance) |
| Native multimodal/connectors | The image and text are jointly pre-trained from scratch/the visual encoder is linked to the existing text model; each of the two routes has its own account |
| Nominal context vs effective context | Manufacturer’s window number/the measurement basis that can actually be used for input after deducting the output reservation and fertility discount |

---

## Related links

- This series: [T01 · Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [T02 · Scaling is not about copying proportions: three general ledgers](/en/tutorial/t02-scaling-budget-three-ledgers/) · [T03 · More data is not always better](/en/tutorial/t03-data-recipe-quality-synthesis/) · [T05 · Training system: from one-step training to distributed topology](/en/tutorial/t05-training-system-distributed-topology/)
- Architecture disclosure: [Kimi K3 Technical Report](https://arxiv.org/abs/2607.24653) · [GLM-5 technical report](https://arxiv.org/abs/2602.15763) · [GLM-5.2 official blog (IndexShare)](https://z.ai/blog/glm-5.2) · [Mistral Large 4 Open Source Announcement](https://mistral.ai/news/mistral-large-4-oss)
- Taxonomy and Mechanism: [Visual guide to attention variants (Raschka Magazine)](https://magazine.sebastianraschka.com/p/visual-attention-variants) · [GLM-5.2 IndexShare third-party teardown](https://sebastianraschka.com/blog/2026/glm-5-2-indexshare.html)
- Configuration interval and ecology: [Summary of long context windows (the measurement basis is subject to official documents)](https://codingscape.com/blog/llms-with-largest-context-windows) · [DeepSeek V4 hybrid chip stack (MIT Technology Review)](https://www.technologyreview.com/2026/04/24/1136422/why-deepseeks-v4-matters)
