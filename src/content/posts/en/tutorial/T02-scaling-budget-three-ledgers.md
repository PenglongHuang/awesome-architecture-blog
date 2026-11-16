---
title: "T02 · What does model training cost? Keep three ledgers"
description: "Estimate GPU-hours and model scale using training, inference amortization and R&D ledgers, and understand when the Chinchilla ratio applies."
series: "model-training"
order: 2
pubDate: 2026-11-10
updatedDate: 2026-11-10
kind: "tutorial"
tags: ["Model training decisions","Training budgets","Scaling Law","GPU cost"]
locale: "en"
translationKey: "tutorial/t02-scaling-budget-three-ledgers"
sourceHash: "4c21ad92c366913222fd9cfa19d79ae2cb1dbf59d1c53f99a8b6ba20603a05ef"
---

## One model, two ratios far from “20:1”

[GLM-5 technical report](https://arxiv.org/abs/2602.15763) discloses frequently cited reference figures: an MoE with 744B total and 40B active parameters, pretrained on 28.5T tokens (the report’s disclosed pretraining token count; weights released under MIT).

Dividing training tokens by parameter count and comparing the result with Chinchilla’s roughly 20:1 ratio yields two answers nearly twentyfold apart from the same token count:

| Denominator definition | Calculation | Token: parameter | Distance from approximately 20:1 |
|---|---|---:|---|
| Total parameters 744B | 28.5T ÷ 744B | About 38:1 | Approximately 2× |
| active parameters 40B | 28.5T ÷ 40B | About 712:1 | about 35 times |

Before deciding which ratio exceeds the guideline, ask: **What is the denominator?**

- **Total parameters** describe how much capacity the model contains, corresponding to GPU-memory requirements and weight size;
- **Active parameters** describe how many parameters participate per token, corresponding to per-token compute.

An MoE model activates only a small subset of experts for each token, so the two measurement bases naturally differ by an order of magnitude. The 38:1 ratio using total parameters and the 712:1 ratio using active parameters describe two aspects of the same model; neither is a typo.

The second question is more important: **What exactly is Chinchilla’s 20:1 optimizing for?** It minimizes end-of-training loss for a single training-compute allocation. It does not include lifetime serving volume, failed R&D experiments, or architecture-specific differences between dense and MoE models. In a business that keeps serving requests and experimenting, departing from 20:1 can therefore be a rational decision.

This chapter turns that observation into a practical calculation method.

The chapter follows the three ledgers in this order:

```text
Section 1: a concrete choice and its hidden costs
    ↓
Section 2: what Chinchilla optimizes and its three limits
    ↓
Section 3: training ledger—6ND → GPU-hours → cost
    ↓
Section 4: inference amortization—how request volume changes the optimal ratio
    ↓
Section 5: R&D ledger—the multiplier behind the final run
    ↓
Section 6: work backward from deployment requirements to model scale
    ↓
Section 7: validate scaling choices with small experiments
    ↓
Section 8: combine the three ledgers in a Training Budget Calculator
```

---

## 1. One budget, different choices of model size

### 1. Start with a choice you may actually face

Suppose your team wants to deliver an enterprise code assistant (the following is a synthetic scenario for teaching purposes, the numbers are made up, and the derivation method is real):

- Target capabilities: repository-level code completion and technical Q&A;
- Load: peak concurrency of 200, average monthly requests of 100 million;
- Latency: p95 time to first token <1 second;
- Service period: 18 months;
- Budget: one fixed training allocation, sufficient for only one candidate.

| Option | Model form | Training tokens (illustrative) | Ratio (tokens : parameters) | Rough estimate of training compute | Supporters’ intuition |
|---|---|---:|---:|---:|---|
| A | MoE: 700B total / 40B active parameters | 28T | 40:1 (total parameters) | About 6.7e24 FLOPs | Match the scale of leading open models in one step |
| B | 100B Dense | 2T | 20 : 1 | About 1.2e24 FLOPs | Near Chinchilla’s compute-optimal training ratio |
| C | 30B Dense | 6.7T | About 220:1 | About 1.2e24 FLOPs | Heavily overtrain a smaller model for cheaper inference |

B and C have nearly identical estimated training compute: both use 6ND, with no total-versus-active distinction for dense models. One budget supports two allocations, forming this chapter’s key controlled comparison. Set A aside until its complete costs are revealed at the end.

Pause and make an intuitive choice, then continue reading.

### 2. Each candidate reveals only part of the ledger

These intuitive arguments account only for training. Two other costs are missing:

- **Inference amortization ledger**: B and C have similar training costs, but per-token inference compute differs by more than 3×: 100B versus 30B. At 100 million monthly requests over 18 months, the difference recurs and accumulates every month.
- **R&D ledger**: 28T, 2T, and 6.7T count tokens in the final training run. Earlier data and architecture experiments, failed restarts, and post-training also consume GPU time.

The training ledger alone cannot answer which option is better. Compare at least three ledgers together:

| ledger | When spending occurs | Cost drivers | Typical omissions |
|---|---|---|---|
| Training ledger | One-time | Parameter scale × training tokens × hardware efficiency | Reporting FLOPs while omitting GPU-hours |
| Inference amortization ledger | Recurring monthly | Requests × tokens per request × cost per token | Substituting offline rankings for unit costs |
| R&D ledger | Per experiment | Final run × experiment multiplier | Treating the final run as the entire project |

```text
Target capability + deployment form + service volume
        ↓
┌─────────────────────────────────────┐
│ training ledger (one-time)                          │
│ inference amortization ledger (monthly)                        │   Three ledgers together
│ R&D ledger (hidden behind the final run)              │
└─────────────────────────────────────┘
        ↓
Decision output: total parameters/active parameters, training token, sampling budget
        ↓
Validation loop: small-scale extrapolation → forecast ledger → investigate deviations
```

> **Architectural insight:** scaling disputes often persist because the parties use different ledgers: one considers the training endpoint, another the serving lifecycle. Put all three ledgers on the same table before comparing decisions.

Now examine each ledger.

---

## 2. Scaling laws and the limits of Chinchilla

### 1. Establish intuition first: What compute buys is the decline of "loss", and the decline itself is decreasing

Training usually aims to reduce the model’s next-token **loss**: a measure of how wrong its predictions are. Empirically, loss falls smoothly as compute, parameters, and data increase, but with **diminishing returns** (often modeled by a power law): each doubling buys a smaller reduction in loss than the previous doubling.

```text
Loss
 │＼
 │  ＼
 │    ＼_
 │        ＼__
 │            ＼＿＿___
 │                    ＿＿＿＿＿＿＿＿ ← Flattening, but not going to zero anytime soon
 └─────────────────────────────────────→ Training compute
      The next 10× increase in compute buys a smaller loss reduction
```

This sketch explains the entire tension of Scaling's decision-making: returns are diminishing but continuous, so "is it worth doubling the compute?" is always a real question; at the same time, parameters and data can be exchanged for losses, so "doubling the compute to buy parameters or data?" is also a real question.

### 2. The unit of account for compute: 6ND rough estimate

To compare "what to buy", you must first be able to keep accounts. Training compute is consumed roughly according to this relationship (a rough estimate commonly used in engineering, called the 6ND rule):

```text
Training calculation amount C ≈ 6 × N × D

N: The number of parameters that each Token participates in the calculation (Dense is the total parameters; MoE uses the activation parameter measurement basis)
D: Number of training tokens
Intuition: forward ≈ 2 + backward ≈ 4, about 6 operations per parameter–token combination
```

To make the model better, either add parameters (N becomes larger) or add data (D becomes larger). When the compute is fixed, the two trade off: if the parameters double, the Tokens must be halved under the same budget.

### 3. Chinchilla answers this question for one training run only

[Chinchilla paper](https://arxiv.org/abs/2203.15556) (Hoffmann et al., 2022) can be summarized as a set of "iso-compute experiments" (isoFLOP): fixing the total training compute, only changing the distribution ratio of N and D, and seeing which combination has the lowest training end-point loss. Figures used for teaching purposes (not any real experiment):

| experiment | Parameter count N (illustrative) | Tokens D = budget ÷ 6N (illustrative) | End-of-training loss (illustrative) |
|---|---:|---:|---:|
| 1 | 1B | 30T | 2.30 |
| 2 | 3B | 10T | 2.18 |
| 3 | 9B | 3.3T | 2.25 |

For the same amount of compute, the middle ratio has the lowest loss. Chinchilla conducted such experiments on a range of compute scales and concluded that for the Dense model, the optimal ratio of compute is about 20 Tokens for each parameter (the common summary measurement basis is about 20:1), rather than the "prioritized heaping of parameters" favored by earlier fittings.

This conclusion is extremely useful, but it has three boundaries that are often overlooked.

### 4. Boundary 1: It optimizes the "training endpoint" but does not optimize the "deployment life cycle"

Chinchilla's objective function only has the loss at the training end point and no service cost. Training compute is spent only once, and inference compute is spent every month. Once the inference amortization is taken into account, "smaller parameters under the same loss" becomes valuable - if the parameters are smaller, every request and every Token will be cheaper. This was the first push behind that 712:1 opening GLM-5 (expanded in Section 4 of this chapter).

### 5. Boundary two: a Dense-model denominator cannot be applied directly to MoE

The experimental object of Chinchilla is the Dense model: the parameter quantity has only one measurement basis. The MoE comes in two calibres, and research shows that the optimal mix itself varies with architecture. [Scaling law of fine-grained MoE](https://arxiv.org/abs/2402.07871) (2024) points toward the following: **Optimal Token: The activation parameter ratio will decrease as the scale increases** ——Within the experimental range, 6.4B activation is about 44:1, and 64T total parameter/1T activation drops to about 8:1; at the same time, higher expert granularity is better under large compute.

The token-to-parameter ratio is therefore the **result** of jointly choosing an objective, architecture, and constraints, rather than a universal constant. GLM-5 reports both 38:1 using total parameters and 712:1 using active parameters, illustrating how large MoE ratios should be reported in 2026. A ratio without its denominator definition is incomplete.

### 6. Boundary 3: Data is not infinitely supplied

Chinchilla implies "you can have as much data as you want". In reality, the supply of high-quality data is limited. [Analysis of Epoch AI in 2024-06](https://epoch.ai/publications/will-we-run-out-of-data-limits-of-llm-scaling-based-on-human-generated-data) estimates publicly available human text at roughly 300T tokens and extrapolates that it could be fully used between 2026 and 2032 under the scaling trends then observed. This is an extrapolation, not a definite date. As additional data becomes more expensive, repeated training on existing data and smaller models become more attractive. The next chapter examines the data wall; here, remember it as the third force moving the optimal ratio away from 20:1.

### 7. Overtraining: Moving from expediency to routine

The three forces combined gave birth to a proper noun: **Overtraining** ——Knowing that it deviates from the optimal ratio of training compute, it still uses a token number far exceeding 20:1 to train a smaller model, sacrificing some training efficiency in exchange for lower inference costs and smaller deployment volume.

It’s no longer a fringe practice in 2026. end-side model [LFM2.5-350M](https://www.liquid.ai/blog/lfm2-5-350m-no-size-left-behind) (Liquid AI, 2026-03) Expanded pre-training from 10T to 28T Token, Token: parameter ≈ 80,000:1 (exceeding the 60,000:1 set by Qwen3-0.6B in 2025-04), model volume <500MB, 32K context; the same 230M version also trained 19T Token. For the end-side form, "staying away from Chinchilla" is not a mistake, but a necessity for constraint solving.

> **Judgment boundary: **20:1 is the optimal solution under the three assumptions of "only one-time training compute + Dense + unlimited data supply". Before copying the ratio, ask three things: Have my accounts been calculated and deployed? Is the denominator the total parameter or the activation? Do I have enough data budget to push the ratio there?

---

## 3. The training ledger: compute for one run

### 1. First layer: Use 6ND to estimate FLOPs

The first step in the training ledger is to convert candidate designs into compute. Work through the calculation using public numbers (estimates made for this article, not official disclosures):

| model | measurement basis | 6ND estimate |
|---|---|---:|
| GLM-5 | 6 × 40B activated × 28.5T | About 6.8e24 FLOPs |
| Inkling 2 Small H1 pre-training | 6 × 17B activated × 8.4T | About 8.6e23 FLOPs |
| LFM2.5-350M | 6 × 0.35B × 28T | About 5.9e22 FLOPs |

The three numbers are even different in magnitude - this is the first level of answer required by the "training ledger". Note that MoE always uses the activation parameter measurement basis to calculate the calculation amount; the total parameters are not involved in the calculation here (it determines the GPU memory and loading, which is the topic of the T05 training system chapter).

**What does 6ND mean?**: There is a linear relationship between training compute, parameters, and tokens. Doubling the parameters or doubling the Token will double the bill; doubling both will quadruple the bill. There is no size discount.

### 2. Convert FLOPs into GPU-hours

FLOPs are physical quantities and bills are engineering quantities. There are two conversions in between:

```text
Training FLOPs
    ÷ (Number of GPUs × Peak compute of a single card × MFU)
    ↓
Training duration
    × Number of GPUs
    ↓
GPU-hours = the basic unit of training system billing
    × The unit price of your card
    ↓
cost
```

**MFU (Model FLOPs Utilization, compute utilization)** can be understood as: the actual training compute ÷ the theoretical peak compute of the hardware. It measures how well the training system "feeds" the hardware - communication waits, data feeds, recalculations, and synchronization overhead all drive it down. MFU is usually significantly lower than 100% (the specific value strongly depends on the model form and parallel scheme, and should be left as an interval assumption when making budgets, rather than taking a single number).

**GPU-hours** is "one GPU running for one hour". It is the currency of the training system: no matter what type of card is used and what accuracy is used, the budget table must eventually fall on the GPU-hours to compare prices.

Use a set of schematic assumptions to run through the conversion chain (the numbers are teaching representations, not any real clusters):

```text
Known: training calculation amount C = 1.2e24 FLOPs (rough estimate of solution B / C)
Assumption: effective throughput per GPU = 1e15 FLOP/s = peak throughput × MFU. This is a teaching assumption
      Number of GPUs = 1,000, assuming throughput scales linearly with card count
      Cluster effective throughput = 1,000 × 1e15 = 1e18 FLOP/s

Training duration = 1.2e24 ÷ 1e18 = 1.2e6 seconds ≈ 333 hours ≈ 13.9 days
    ↓
Total GPU-hours = 1,000 × (1.2e6 ÷ 3,600) ≈ 333,333 GPU-hours
(Calculated using unrounded duration; the number of GPUs is already included in the cluster throughput and cannot be divided again)
    ↓
Fee ≈ 333,333 × your single card price
```

The focus of this example is not the number itself, but the sensitivity: if the effective throughput is halved, the number of days and GPU-hours will be doubled; if the MFU drops from 45% to 30%, the bill will increase by 50%. **The biggest uncertainty in your training ledger is often not the 6ND, but how honest you are with your MFU.**

### 3. The third level: There is a series of multipliers between the estimated value and the actual bill

From the 6ND to the actual bill, you also go through these expenses (each of which can make the bill significantly higher than the paper estimate):

| overhead | what does it eat |
|---|---|
| utilization loss | Communication, synchronization, and data loading keep MFU below peak |
| Recalculation and accuracy strategies | Replacing GPU memory with recalculation and low-precision trial and error will change the effective throughput |
| Failure and restart | Long training must be interrupted, and the progress before the recovery point is a sinking time |
| Experimental overhead | Include ablations, hyperparameter sweeps and abandoned runs in the R&D ledger |
| data pipeline | The compute required to process, clean, and replay training data is often completely missed |

So the honest way to write the training ledger is: **FLOPs can be recalculated, the GPU-hours depends on system assumptions, and the cost must leave a range.**

### 4. Recalculable example: Inkling 2 Small’s H1 ledger

[Inkling 2 Small](https://thinkingmachines.ai/news/inkling-2-small) (Thinking Machines, released on 2026-11-05, 594B total parameters / 17B active MoE) is one of the most complete training ledgers currently publicly disclosed. Just look at the H1 pre-training stage (the measurement bases are all officially disclosed):

| Input | numerical value | measurement basis |
|---|---|---|
| Active parameters | 17B | Official disclosure, MoE activation measurement basis |
| H1 Training Token | 8.4T | Official disclosure, H1 pre-training stage |
| Hardware | GB300 NVL72 rack | official disclosure |
| H1 duration | 68 hours | official disclosure |
| Accuracy | Native NVFP4 training | Official disclosure (official details of the formula will be disclosed later) |

Using 6ND to roughly estimate the computational complexity of H1 is about 8.6e23 FLOPs (estimated in this article). The value of this disclosure is that the four quantities (Token × Parameter × Hardware × Duration) are disclosed at the same time. For the first time, the outside world can check them with each other - instead of only getting an isolated "We trained X T Token".

Compare GLM-5: The 28.5T Token and dual-parameter measurement basis are disclosed, but the GPU-hours and hardware account are not disclosed - the FLOPs layer (about 6.8e24) can be estimated externally, stopping before the GPU-hours is lowered. This is not a criticism: disclosure is an option, not an obligation. But it directly determines to which level the "person who copied the proportion" can be recalculated.

> **Architectural wisdom:** Each number in the training ledger has three identities - official disclosure, third-party estimate, and own recalculation. When writing in the budget form, you must indicate which one it is. Mixing three measurement bases in the same form is the most common failure point in budget reviews.

---

## 4. The inference ledger: training-optimal is not deployment-optimal

### 1. Training is spent once, reasoning is spent every day

Each generated inference token takes roughly 2N compute (a coarse estimate that ignores prefill and cache differences), while training takes about 6N per token but happens once. An order-of-magnitude estimate follows (illustrative derivation):

```text
Total training power ≈ 6 × N × D (one time)
Cumulative compute of inference ≈ 2 × N × Q (Q = cumulative number of Tokens generated during the service life cycle)

The critical point where the two are equal: Q ≈ 3D
That is, once cumulative served tokens exceed approximately 3× the training tokens,
The cumulative compute overhead of the inference side exceeds that of the training side
```

For a model trained on D = 10T tokens, the break-even point is approximately 30T served tokens. A service generating 10B tokens per day crosses it in about 8 years; one generating 100B per day, in the direction of large-scale agent workloads, crosses it in about 10 months. **The larger the request volume and the longer the service cycle, the more "training optimization" will give way to "deployment optimization".**

### 2. Account per request: three undervalued variables

| variable | Why is it often underestimated? |
|---|---|
| Request volume and cumulative Token | Training is a one-time cost; inference is rate × time, compounding as the business grows |
| Sampling times | A reasoning model generates a complete chain of thought for each answer; repeated sampling and voting multiply that cost again |
| Multiple rounds of Agent interaction | There are dozens of rounds of tool calls for a task, and the number of tokens per request is several orders of magnitude larger than chat |

The third article has real scale: In the RL training disclosed by Inkling 2 Small, the number of Tokens in a single Rollout is p50 = 43K, p99 = 1.5M, and the duration is p50 8 minutes and p99 4 hours (measurement basis: RL Rollout statistics). This is the sampling load on the training side, but when the same batch of models goes online to serve Agent tasks, the Token form requested by the user side is isomorphic to it—— **Deployment shape determines how heavy "per request" is**。

The economy of inference is also directly reflected in the price (measurement basis: official API public price, per million Tokens, input/output):

| model | input | output |
|---|---:|---:|
| GLM-5 | $1.0 | $3.2 |
| Kimi K3 | $3 | $15 |

Large MoE models released in 2026 can differ by 3–5× in per-token prices. Some of that difference is traceable to active parameters and deployment costs. Inference is an independent first-class variable, not merely a tail attached to training.

### 3. Back to the opening scene B and C: the same training budget, two inference books

In the scenario in Section 1 of this chapter, the training compute of plan B (100B @ 2T, 20:1) and plan C (30B @ 6.7T, about 220:1) is roughly the same (about 1.2e24 FLOPs each). By Chinchilla's standards, C is "wrong" - it's grossly overtrained. But put the inference ledger in (suggestive derivation, the load is based on the scenario value: 100 million requests per month × 5K Token per request = 5e11 Token / month):

| Cost item (illustrative rough estimate) | Option B (100B) | Option C (30B) |
|---|---:|---:|
| Training compute (6ND, once) | About 1.2e24 FLOPs | About 1.2e24 FLOPs |
| Inference calculation per Token (about 2N) | 2e11 | 6e10 |
| Monthly inference compute (5e11 Token) | About 1e23 FLOPs | About 3e22 FLOPs |
| Accumulated compute for 18 months of reasoning | **About 1.8e24 FLOPs** | About 5.4e23 FLOPs |

Three things are true at the same time:

- **B's 18-month inference cumulative compute (about 1.8e24) exceeds its own entire training run (about 1.2e24)** ——The intuition that "training is the biggest factor" fails under high request volume;
- C's inference ledger is only one third of B's, and this gap **generated every month**；
- The cost is that the training ratio of C deviates from the optimal compute - it trades "inefficiency in the training phase" for "efficiency in the deployment phase".

Which one is more cost-effective? The answer depends on the request volume and service cycle - this is exactly the systematic solution direction given by T² in the next section after including sampling.

### 4. T² Scaling: Count the sampling during testing into the budget and solve it again

**Test-Time Scaling** It means taking more samples and thinking more during reasoning in exchange for accuracy. The problem is: sampling is also compute. If the budget covers both training and inference sampling, how will the optimal (N, D, number of samples k) combination change?

[T²（Train-to-Test）Scaling](https://arxiv.org/abs/2604.01411) (a preprint submitted by Roberts et al. in 2026-04) jointly optimizes model size, training tokens and inference samples, modeled with pass@k, under a fixed end-to-end compute budget. Across 8 downstream tasks, it finds that **Once the inference cost is taken into account, the optimal pre-training ratio significantly moves into the over-training range**, far beyond the scope covered by conventional Scaling experiments; the author also actually pre-trained the heavily overtrained model according to the T² predicted interval, verifying that it is stronger, and the conclusion still holds true after post-training.

Its pedagogical vitality here lies in method rather than numbers: **First write down the boundaries of the budget (with or without reasoning), and then solve for the optimal ratio**. As budget boundaries change, the answers change—which explains why different teams working on the same paper make opposite sizing decisions.

### 5. Architecture also enters the ledger: reasoning-aware scaling

An earlier step would be to incorporate the architecture itself into the same type of co-optimization as Chinchilla. [Scaling Inference-Efficient Language Models](https://arxiv.org/abs/2501.18107) (ICML 2025) trained 63 models (80M–1B parameters / 1.6B–30B Tokens) and found **Model inference latencies with the same number of parameters can differ by 3.5 times**, the modified Scaling law takes architecture (wide and shallow structures dominant) as the third axis in addition to parameters and tokens, and the resulting Morph-1B improves the reasoning delay by 1.8 times while maintaining the same accuracy (measurement basis: experimental results reported in the paper).

In a word: the inference ledger is not just "how big a model × how many tokens", the architecture and sampling strategy are rewriting the exchange rate of this account.

> **Judgment boundary:** The optimal offline benchmark is "the optimal single sampling accuracy", and the optimal business is "the optimal task completion rate per unit cost". The two goals almost overlap when the request volume is low, and gradually diverge after the request volume increases. When reviewing the scale plan, you must first declare which one you are optimizing.

---

## 5. The R&D ledger: the final run is not the whole cost

### 1. The run you see is just the exposed part of the iceberg

Before reaching the step of "744B parameters × 28.5T Token", the same batch of compute has been spent on:

| R&D spending | typical content |
|---|---|
| Data experiment | Proportion scanning, cleaning line verification, quality assessment |
| Structural and hyperparameter testing | Architecture candidate comparison, learning rate and batch size search |
| Ablation experiments | Controlled verification of "usefulness" of each component |
| Failed and Abandoned Runs | Loss divergent, interrupted, abandoned branches |
| post training | SFT, preference, RL rollout and training (itself a big compute user) |
| Review | Benchmarks, manual evaluation, regression testing |

### 2. Epoch AI estimation: In the end, Run only accounts for a minority of R&D compute

[Analysis of Epoch AI](https://epochai.substack.com/p/final-training-runs-account-for-a) (2026-03) estimated the R&D compute structure of OpenAI, Z.ai, and MiniMax: **In the end, training Run only accounts for a minority of the total expenditure on R&D compute** ——OpenAI is about 9.6% (corresponding to an annual R&D compute expenditure of about $5B for a final run of about $0.5B), and the other is about 22.6%; the final run’s compute has increased by about 2.4 times per year since 2016 (95% CI 2.0–3.1).

Convert using this definition: **If the "cost of training a model" only counts the final run, it will be systematically underestimated by about an order of magnitude** (1 ÷ 9.6% ≈ 10×; 1 ÷ 22.6% ≈ 4.4×).

Two disciplines must be followed:

- The 9.6% / 22.6% figures are **compute spending estimates**, not shares of actual FLOPs: spending combines procurement prices and arrangements from different years;
- It is an estimate from three laboratories, not an industry constant, and cannot be generalized to "all companies times ten."

The correct usage of multipliers in the budget table is the interval and direction, not the exact coefficient:

| Usage | Example (illustrative) | Evaluation |
|---|---|---|
| Wrong usage | "The final run will cost 10,000 calories, so the R&D budget = 10,000 × 10 = 100,000 calories, accurate to one digit" | Pseudo-exact; the multiplier itself is a conversion of the expenditure estimate |
| Correct usage | "R&D reserve = 4-10 times range of the final run; our experimental discipline is better, taking 4-6 times, and backfilling the calibration quarterly according to the forecast account" | Treat the multiplier as a prior that will be modified by experience |

There's another detail that's often missed: the multiplier is not a constant. If the team is mature, data pipeline reuse is good, and there are few failed runs, the multiplier will go down; if the architecture, Tokenizer, and new capability lines are changed, the multiplier will go up. It's a function of team engineering discipline.

### 3. Case dismantling: What does Inkling 2 Small’s complete ledger look like?

The "whole picture" of R&D ledger is scarce. Because of the scarcity, Inkling 2 Small's phased disclosure is worth reading the entire table (the measurement basis is official disclosure, 2026-11-05 page):

| Stage | content | key figures |
|---|---|---|
| model | 594B total parameters / 17B active MoE | — |
| H1 pre-training | 8.4T Token | GB300 NVL72 rack, 68 hours, native NVFP4 |
| H2 | 3.8T of new, higher quality data never seen before | 512K contexts |
| H3 | About 320B Token reasoning + Agent trajectory | 1M context |
| H4 | About 34B Token highest quality track | Mainly sampled from Kimi K3 and its own early models, filtered by correctness and alignment |
| RL | Single Combined RL Run | 1,075 steps, over 17M Rollout, 9 days; sampler : trainer = 5 : 3; prefix cache hit 93%+ |

This table rewrites at least three intuitions:

- **There is a big account after training**: RL Run ran for 9 days, and the compute ratio of sampling and training (sampler:trainer = 5:3) means that the inference side overhead is larger than the training side - the "non-training" part of the R&D ledger may be considerable;
- **The trajectory data itself costs money to generate**: The trajectory of H3 + H4 totaling about 354B Token is not downloaded, but obtained in exchange for compute;
- **Engineering decisions directly rewrite the ledger**: Prefix cache hit 93%+ determines the actual cost of those 17M rollouts - the same algorithm decision, coupled with different caching strategies, results in different bills.

A necessary qualification: The official page also states that the weight needs to be released after external security testing (as of 2026-11-05). **Ledger transparency and weight availability are two different things**, this case supports "what does the R&D ledger look like" and does not promise that "the weights can be downloaded and deployed now".

### 4. Disclosure stratification: How much of the ratio you copy is disclosed by others

Putting the three high-profile models together in 2026, a clear disclosure spectrum can be seen:

| model | weight | Parameter measurement basis | Training Token | GPU-hours/Hardware | To which level can external recalculation be reached? |
|---|---|---|---|---|---|
| Kimi K3 | open weight | 2.8T General Staff, 896 Experts Select 16 (Official) | not disclosed | not disclosed | Cannot be recalculated |
| GLM-5 | MIT Open | 744B/40B Disclosure | 28.5T Disclosure | GPU-hours not disclosed | Enough to estimate FLOPs, but not GPU-hours |
| Inkling 2 Small | Apache 2.0 (weight to be released after security testing) | 594B/17B Disclosure | staged disclosure | Hardware + Duration Disclosure | three ledgers can be checked |

The official blog of Kimi K3 claims that "the overall scaling efficiency is approximately 2.5 times higher than that of Kimi K2" ( [Official blog](https://www.kimi.ai/blog/kimi-k3), 2026-07-16; manufacturer's claim) - In the case where the training token and card are not disclosed, this multiple cannot be independently recalculated externally. **Open weight does not equal open ledger**: The weight allows you to deploy, and the ledger allows you to learn its budget decisions.

### 5. Time dimension: The ratio will depreciate over time

[Epoch AI Trends](https://epoch.ai/trends) (Updated on 2026-02-05) data adds a timeline to the R&D ledger: cutting-edge language model training compute has increased approximately 5 times per year since 2020 (90% CI 4–6 times, doubling period approximately 5.2 months), and cutting-edge training costs approximately 3.5 times per year (doubling approximately 7 months).

This means that the ratio and cost structure copied last year have changed in this year’s accounts. Any "model-led" budget decision must have a review date and the expectation that it will expire within a year.

> **Architectural wisdom:** What you can copy are other people's results, but what you can't copy are other people's constraints - you can't see their failed runs, data experiments, and sampling accounts. The existence of the R&D ledger itself is the economic proof of "don't copy the ratio".

---

## 6. Work backward from the deployment model

### 1. Five deployment forms, five different reasoning books

| Deployment form | hard constraints | Immediate Implications for Scale Decisions |
|---|---|---|
| Cloud High Concurrency API | Throughput and single Token cost | Amortization account dominates; smaller activations + more tokens (overtraining) tend to dominate |
| Low latency online service | First Token Delay | Parameters and architecture are back-calculated by delay budget (home of inference-aware Scaling) |
| Terminal/Device | Volume, memory, offline operation | The upper limit of model volume directly locks the parameter scale; the ratio can reach tens of thousands: 1 |
| local privatization | Customer Hardware and Licenses | Total parameters = memory size; quantification friendliness becomes a first-class variable |
| Agent long-range multiple rounds | The amount of tokens per request explodes | Context and sampling cost dominate; cost per request is more critical than parameter volume |

Edge deployment makes the direction of reasoning especially clear. The 80,000:1 ratio of LFM2.5-350M comes from the hard requirement to fit below 500MB and run offline, rather than an elegant scaling-curve optimum. The size limit fixes the parameter budget; the remaining budget goes into tokens.

### 2. A minimal backward calculation example: how to lock the parameters in the upper volume limit

Weight volume ≈ number of parameters × number of bytes per parameter (coarse diameter, excluding embedded sharing, caching and runtime overhead):

| Accuracy | Each parameter is approx | 1B weight volume of parameters | Parameters that can be accommodated by the 500MB upper limit |
|---|---:|---:|---:|
| FP16 | 2 bytes | ≈ 2GB | ≈ 250M |
| 4-bit | 0.5 bytes | ≈ 0.5GB | ≈ 1B |

For LFM2.5-350M to fit below 500MB, parameter count must be in the hundreds of millions. Reaching useful capability at that size requires a token-to-parameter ratio in the tens of thousands: 28T ÷ 350M ≈ 80,000:1. **The deployment pattern first gives the inequality, and Scaling makes the decision to find the optimal point in it.**

### 3. Work backward from business goals to the training ratio

```text
Business goals: request volume, delay, acceptable unit price, service cycle
    ↓
Average Token per request (input + output × number of samples)
    ↓
Life cycle cumulative reasoning Token → inference amortization ledger
    ↓
Single Token cost upper limit → Parameter scale upper limit × Quantitative plan × Architectural orientation
    ↓
After the parameter scale is determined → Training Token ratio (to what extent is over-training)
    ↓
Backfill three ledgers: training ledger / inference amortization ledger / R&D ledger
    ↓
Compare total lifecycle cost between candidates, rather than parameter counts
```

Notice the direction of this chain: **It's not "choose a big model and see if it can be deployed", but "deployment constraints speak first, and the scale is solved."**. This is also the reason why layer 1 (capability goals and task form) precedes layer 7 (systems and resources) in the eight-layer coordinate system of the introduction - the direction is reversed, and each layer will make decisions for you that you have not approved.

> **Judgment boundary:** Open weighting, transparent training, and self-deployment are three independent propositions. Inkling's ledger is fully open but the weight is yet to be released; K3's weight is open but the ledger is not yet open. Before deciding who to refer to, first confirm which layer you want to borrow from: borrowing from deployment (requiring weight), borrowing method (requiring ledger), or borrowing conclusion (requiring restraint).

---

## 7. Experiments to validate a scaling decision

### 1. Standard practice for small-scale extrapolation

No one can choose a target size using a target-scale experiment—the cost prohibits it. The standard approach is to extrapolate:

```text
Run a set of isoFLOP experiments with small compute (fixed budget, scan N:D allocation)
    ↓
Fit the power law relationship of "compute → optimal parameters / optimal Token"
    ↓
Extrapolate to the target compute to obtain candidates (N, D)
    ↓
Actual training based on predictions, backfilling the prediction ledger
```

The reliability of extrapolation is strongly related to distance: within the fitting interval is an extrapolation, and outside the fitting interval is a bet. The demarcation between the two must be written into the decision record.

### 2. A positive example and its limits: Q Labs on data-constrained scaling

[Data Constrained Scaling Study at Q Labs/NYU/Princeton](https://arxiv.org/abs/2610.37842) (2026-10-27) demonstrates disciplined extrapolation. Its experimental settings separate recommendations into levels:

| Hierarchy | content | Status |
|---|---|---|
| Verified | On FineWeb 100M Token, transfer learning rate/weight attenuation + introduction of ensemble as the third expansion axis reduces the verification loss by 0.15+ nats (perplexity is about -14%) compared with the existing prescription | Paper experimental results |
| partial verification | Prescription still valid on 12 times greater compute | Paper experimental results |
| pure extrapolation | With 5T training tokens and 1e29 FLOPs fixed, its compute-optimal parameter count is approximately 7000× the Chinchilla recommendation, with aggregate ensemble parameters of about 1.75Q | Fitting extrapolation based on ≤400M parameter experiments, the paper itself has been marked |

Maintaining the sense of language at these three levels when reading research conclusions is a necessary translation from "paper" to "budget". The same is true for the author of the T² paper: not only did he fit the curve, he also actually pre-trained the over-trained model according to the prediction interval to verify—— **Predictions must be verified with real money**, this is a key step that distinguishes Scaling decision-making from academic fitting.

### 3. Control variables and confidence intervals

- **control variables**: The total budget is fixed when comparing (N, D) combinations; (N, D) is fixed when comparing architectures; the "improvement" obtained by moving two variables at the same time cannot be attributed.
- **Repeat run**: The random variance of small experiments will contaminate the power law fitting, and multiple seeds are needed to confirm near the key inflection point.
- **confidence interval**: The extrapolated value must have an interval (such as Epoch's 90% CI for growth rate), and single-point predictions are pseudo-accurate.

### 4. When must extrapolation be run again?

Scaling curves are not fitted once and are valid for life. Three types of changes can render old prescriptions ineffective:

| change | Why waver extrapolation |
|---|---|
| Change architecture or expert granularity | Boundary 2 in Section 2 of this chapter: The optimal ratio fitted on Dense does not automatically migrate to MoE; the particle size changes and the curve itself deforms |
| Change data distribution | The ratio is optimal based on "this corpus"; the data formula has been greatly changed and the curve has been redrawn (expanded in the next chapter) |
| Change accuracy or hardware | Precision and interconnection have changed the "effectiveness of each FLOP", and the equivalent compute and billing have also changed |

Principle: The extrapolation prescription should include a validity period - any changes in architecture, data, and accuracy should be made, and the inflection point should be retested on a small scale before continuing the extrapolation.

### 5. Project implementation point: forecast ledger

This is the minimum realization of the introduction of layer 8 (promotion evidence) in budget decision-making. Each size decision is recorded in four columns:

| decision making | Forecast | actual | Cause of deviation |
|---|---|---|---|
| Intermediate loss @ 50% progress | 2.41 | 2.44 | The data mixture was adjusted once in week 3 |
| End-to-end GPU-hours | 120K hours | 158K hours | Two cluster failures restarted, and the MFU was lower than assumed |

(An illustrative workflow.) A ledger’s value is not perfect prediction—extrapolation will be wrong—but **turning each deviation into a prior for the next budget**. Without a ledger, teams repeat the same estimation errors and rediscover the same surprises every year.

> **Judgment boundary:** Extrapolation grading (verified/partially verified/pure extrapolation) is not academic mystique, but a risk disclosure. Each number in the budget table from the paper should be marked with which level it belongs.

---

## 8. Bring the three ledgers together

### 1. Merge views

```text
Budget B (compute or USD)
    ├─ training ledger: 6 × active parameters × Training Token → FLOPs → GPU-hours → One-time investment
    ├─ inference amortization ledger: Request volume × Token per request × Unit price × Number of service months → Periodic investment
    └─ R&D ledger: final Run × test multiplier (about 4–10 times, anchored by expenditure estimate measurement basis) → hidden investment
        ↓
Constraint filtering: deployment shape/latency/data availability/team experiment discipline
        ↓
Decision output: total parameters and active parameters, training token, sampling budget, quantification and hardware solutions
        ↓
Verification closed loop: isoFLOP extrapolation → forecast ledger → review and update multiplier
```

### 2. Scale and budget decision table

Compress the derivation of this chapter into a quick reference table (the tendency is a directional guide, and the final calculation will be based on the recalculation of the three ledgers):

| Deployment form | Request volume | budget posture | scale tendency |
|---|---|---|---|
| Cloud High Concurrency API | Big | The training budget is relatively sufficient | Smaller activation + more Tokens (amortization led) |
| Cloud low traffic service | small | One-time | Can be close to Chinchilla ratio (low amortization pressure) |
| Low latency online | Medium – Large | Delay hard constraints | Parameters and architecture are deduced from delay budget |
| Terminal/Device | — | hard cap on size | Minimal model + extreme overtraining |
| local privatization | in | Customer hardware is limited | Small to medium-sized, quant-friendly structure |
| Agent long range | Token per request is huge | — | Context and sampling cost dominate, followed by parameters |

### 3. Back to the opening: General Ledger Judgment of the Three Plans

Now you can answer one of the three choices in Section 1. Put together the rough estimates of the three ledgers (schematic derivation, continued scenario load: month 5e11 Token, 18 months):

| Option | training ledger (once) | Inference calculation per Token (about 2N) | Accumulated compute for 18 months of reasoning | R&D ledger risk | Adapted deployment story |
|---|---:|---:|---:|---|---|
| A: 700B total parameters / 40B active MoE | About 6.7e24 | 8e10 | About 7.2e23 | High: MoE routing and training systems generally have a heavier test burden (qualitative judgment) | The volume of requests is large, the strongest capabilities are required, and the training budget is sufficient |
| B：100B Dense @ 20:1 | About 1.2e24 | 2e11 | **About 1.8e24** | Medium: The ratio is close to the textbook reference | Low request volume, tight one-time training budget |
| C：30B Dense @ 220:1 | About 1.2e24 | 6e10 | About 5.4e23 | Medium and low: The ratio deviates from the optimal and requires experimental verification to make up for it | High request volume, latency sensitivity, and capacity requirements can be compensated by over-training and sampling |

Three conclusions are worthy of inclusion in the decision record:

- **B’s inference ledger (about 1.8e24) exceeds its training ledger (about 1.2e24), and it is also the most expensive inference among the three solutions** ——The optimal training ratio is one of the worst choices for deployment under this load;
- **The cost per Token of A and C is lower than that of B**: A uses the MoE structure of "total parameters buy capacity, activation buys cheap reasoning", and C uses extreme overtraining. The 2026 case cited in this chapter shows exactly these two forms of "far away from 20:1" - large MoE (GLM-5, Kimi K3, Inkling 2 Small) and end-to-end over-training (LFM2.5 series) - while in the high request volume case cited in this chapter, the mid-range Dense close to 20:1 did not appear;
- **The verdict is not "C wins"**: C’s cost per token is in the same range as A’s, and its training ledger is only about one-fifth of A’s. However, its capacity ceiling risk (repository-level code tasks) and first token delay advantage need to be verified by experiments in Section 7 of this chapter; A’s capacity ceiling is the highest, but its training ledger and R&D multiplier are also the heaviest. **The three ledgers give "the bill for each plan", not the "single correct answer" - the answer has to pass two gates: capability goals and experimental verification.**

### 4. Engineering product: Training Budget Calculator (training budget table)

**Input items (standard measurement basis for each item):**

| Input | Example value | measurement basis source |
|---|---|---|
| Target task | Enterprise Code Assistant | What-if scenario |
| Candidate model | 744B total parameters / 40B active MoE | GLM-5 public disclosure standards |
| Training Token D | 28.5T | GLM-5 disclosure (pre-training phase) |
| Hardware and Accuracy Assumptions | GB300 NVL72 / NVFP4 | Borrowing the Inkling H1 measurement basis for illustration |
| MFU hypothesis | Leave an interval (e.g. 35%–55%) | Undisclosed, interval must be set |
| Request volume | 100 million times/month | hypothesis |
| Average input/output token | 3K / 2K | Assumption: non-reasoning mode, with 1 sample per request |
| service cycle | 18 months | hypothesis |
| R&D multiplier | 4–10 times | Converted from Epoch two ratios (expenditure estimate measurement basis) |

**Output items (recalculable item by item):**

| Output items | Calculation formula | Example value |
|---|---|---|
| Training FLOPs, rough estimate | 6 × 40e9 × 28.5e12 | ≈ 6.8e24 FLOPs (estimated by this article, activation measurement basis) |
| training ledger can be recalculated layer | Disclosure when no card is available | Disclosure stops at FLOPs; compare the disclosure levels in section 5 |
| Monthly Reasoning Token | 1e8 × (3K + 2K) | 5e11 / month |
| Monthly inference purchase cost, using API pricing | 3e11×$1.0/1e6 + 2e11×$3.2/1e6 | ≈ $300,000 + $640,000 ≈ $940,000 / month |
| 18 months amortization | × 18 | ≈ $17 million, at official API purchase prices |
| R&D reserved | Final Run × 4–10 | Fill in according to team experiment discipline |
| sensitivity | Request volume or output length ±2 times | The inference ledger is doubled → the conclusion may be flipped to a smaller model |
| Recommended | The smallest total of the three ledgers | Example demonstration, not real advice |

Three disciplines of this table:

- **Each number identifies an identity**:Official disclosure/third-party estimate/estimate in this article/hypothetical scenario, choose one from four;
- **Write down the inference ledger clearly**: The above example is based on the measurement basis of "purchasing according to the official API price"; self-built inference is another account (hardware + utilization + operation and maintenance), the order of magnitude may be much different but the structure is the same;
- **The output must contain sensitivity**: The stability of a budget decision depends on "which doubling of the input flips the conclusion." That's where you really want to reduce uncertainty.

> **Architectural wisdom:** The budget table is not to make predictions accurate - extrapolation will always be wrong - but to make errors attributable, reviewable and iterable. A budget that can be recalculated and corrected by colleagues is worth much more than an accurate but opaque intuition.

---

## 9. Six common reasoning errors

### Mistake 1: Treating 20:1 as a universal formula across models

Chinchilla’s 20:1 is the conclusion based on the triple assumptions of Dense + one-time training + unlimited data supply. MoE needs to change the denominator (the total parameter/activation difference is one order of magnitude), deployment needs to change the objective function, and data constraints need to change constraints. GLM-5's 38:1 and 712:1 are "far away from 20:1" at the same time, but there is no contradiction - the ratio is the solution result, not the input parameter.

### Mistake 2: Only calculate the training ledger, not the inference amortization ledger

Training is a one-time expense, inference is rate × time. After the cumulative service token exceeds the training token by about 3 times (rough diameter), the inference compute exceeds the training. The training money saved under high request volume will be eaten up by the inference bill in a few months.

### Mistake 3: Taking the cost of the final run as the entire R&D cost

Epoch's estimates of the three companies show that in the end Run accounts for only a minority of R&D compute expenditures (9.6%–22.6%, expenditure estimate measurement basis), and counting it alone is equivalent to systematically underestimating the budget by about an order of magnitude. Data experiments, failed runs, and post-training rollouts are all on your card.

### Mistake 4: Copying parameter quantities and ratios, not constraints

When K3 does not disclose the token and card, even the "copied" objects are incomplete; when GLM-5 discloses the token but does not have the card; Inkling has a full ledger but you do not have its data pipeline and team. The ratio is the solution of "objective function × architecture × constraints". If the constraints are different, the same solution will be wrong.

### Mistake 5: Treating the best offline list as the best business

The benchmark score for a single sampling does not include delay, unit price, and sampling budget. The whole starting point of T² and inference-aware scaling is: once the budget boundary changes (taking into account inference), the optimal allocation will shift significantly. During the review, first state which goal you are optimizing for.

### Mistake 6: Treating open weights as transparent training and self-deployable

Three independent propositions. Open weight allows you to deploy (depending on volume, quantification and license); transparent ledgers allow you to learn and make decisions; whether you can self-deploy depends on hardware and engineering. Inkling's ledger is fully open but the weights are yet to be released, K3's weights are open but the ledger is not open - both remind you not to package three things into one sentence of "open source".

---

## 🎯 Quick check

```quiz
{
  "question": "Why can’t the total parameters and active parameters of the MoE model be mixed to calculate the Token/parameter ratio?",
  "options": [
    "They can be mixed. Anyway, they are all parameter quantities, and their magnitudes are almost the same",
    "The two measurement bases answer different questions: the total parameters correspond to capacity and GPU memory, and the active parameters correspond to the calculation amount of each Token; dividing the same number of Tokens by two denominators will result in a ratio that differs by one order of magnitude",
    "active parameters are just promotional numbers. Actual training and deployment are only determined by the total parameters"
  ],
  "answer": 1,
  "explanation": "GLM-5 is calculated as approximately 38:1 based on 744B total parameters, and approximately 712:1 based on 40B activation. They are two sides of the same fact. The amount of calculation and inference cost are based on activation, and the GPU memory and weight volume are based on total parameters."
}
```

```quiz
{
  "question": "Rough estimate using the 6ND rule: activation parameter 17B, training Token 8.4T (Inkling 2 Small H1 measurement basis), what is the approximate training calculation amount?",
  "options": [
    "About 8.6e23 FLOPs",
    "About 8.6e21 FLOPs",
    "About 8.6e25 FLOPs"
  ],
  "answer": 0,
  "explanation": "6 × 17e9 × 8.4e12 ≈ 8.6e23 FLOPs. Note that this is a rough estimate of the activation parameter diameter, and MoE does not use the total parameters to calculate the calculation amount; the official has not directly disclosed FLOPs, and this is an external estimate."
}
```

```quiz
{
  "question": "After the request volume increases tenfold, should the priority be given to increasing the model size, increasing inference sampling, or resolving the training ratio?",
  "options": [
    "Prioritize increasing the size of the model and request more explanations. The business is good and the model must be stronger",
    "Recalculate the inference amortization ledger first: the accumulated inference tokens exceed the training tokens by about 3 times, and then the inference compute exceeds the training. Over-training solutions with smaller activations and more training tokens under high request volume tend to save the general ledger",
    "Prioritize increasing the number of inference samples. The more samples, the higher the accuracy, and the cost can be ignored"
  ],
  "answer": 1,
  "explanation": "The request volume is amplified by the inference ledger generated on a monthly basis. The conclusions of T² scaling are in the same direction: after accounting for inference and sampling costs, the optimal pre-training ratio significantly moves into the over-training range. Of course, the final calculation will be based on the recalculation of the three ledgers."
}
```

```quiz
{
  "question": "Why does the final training run cost not represent the R&D cost of the entire model?",
  "options": [
    "Because the salary of R&D personnel is not included in the cost of compute",
    "Because in the end the hardware used by Run is cheaper and does not reflect the true price",
    "R&D compute includes data experiments, architecture and hyperparameter trials, ablations, failed runs, post-training and evaluation. Epoch estimates that final runs account for only 9.6%–22.6% of R&D compute expenditure at the three organizations, using its expenditure-estimate basis. Counting only the final run can understate the total by roughly an order of magnitude"
  ],
  "answer": 2,
  "explanation": "Note: 9.6% is an estimate of compute expenditure, not the actual proportion of FLOPs; and it is an estimate of three laboratories and cannot be generalized to a fixed ratio for all companies."
}
```

```quiz
{
  "question": "The team can download the weights of an open source model and successfully deploy it locally. Can it be inferred from this that its training ratio is optimal and its ledger is transparent?",
  "options": [
    "Yes, the training details of the open source model are public",
    "No: open weighting, transparent training ledger, and self-deployment are three independent propositions. For example, there are models whose weights are open but the tokens and cards are not disclosed during training. There are also models where the ledger is fully disclosed but the weights are to be released after security testing",
    "Yes, as long as the parameters are written in the model card, the number of training tokens can be derived"
  ],
  "answer": 1,
  "explanation": "K3 (the weight is open, the ledger is not disclosed) and Inkling 2 Small (the ledger is complete, the weight is to be released as of 2026-11-05) constitute two counterexample directions. Deployability only proves that the weights can be obtained, but does not prove that the budget decision can be learned."
}
```

---

## Chapter summary

- The training ledger answers how much it costs to run once; the inference ledger answers how much it costs during the service period; the R&D ledger answers how much money should be left for trial and error, sampling and evaluation.
- 6ND only provides rough calculation entry. active parameters, single-card throughput, number of GPUs, and MFU must be specified before switching from FLOPs to cards.
- Model size and token ratio depend on goals and deployment constraints. The public ratio can be used as a reference and cannot replace your own budget and small-scale verification.

> **Question for the next chapter:** After the budget is determined, the next step is not to directly select the model structure, but to judge: Which data should the limited data budget be invested in in order to obtain the target capabilities?

---

## Terminology reference

| Terminology | How can beginners understand first |
|---|---|
| Chinchilla Best | The conclusion given by the 2022 paper: When only counting the compute of one-time training, the optimal compute of the Dense model Token: parameter ratio is about 20:1; it is the optimization of the training end point, not the deployment optimization |
| isoFLOP experiment | Fix the training compute, only change the distribution ratio of parameters and tokens, and compare which group of end points has the lowest loss to find the optimal ratio |
| Overtraining | Knowing that it deviates from the optimal training compute, it still uses far more tokens to train a smaller model, sacrificing training efficiency for cheaper inference and smaller size |
| Reasoning Aware Scaling | Put the inference cost (latency, architecture, sampling) and training cost into the same optimization goal to determine the model size |
| Test-Time Scaling / T² | More sampling and more thinking during inference are exchanged for accuracy; T² refers to the joint optimization of the training budget and the sampling budget during testing |
| 6ND rough estimate | Total training compute ≈ 6 × Parameters involved in the calculation of each Token × Rough engineering estimation rules for the number of training Tokens |
| MFU | Actual training compute ÷ hardware theoretical peak, measuring the degree to which the training system feeds the hardware |
| GPU-hours (GPU-hours) | One GPU runs for one hour; compute requirements converted into basic units of resources and bills |
| Amortization account | The accounting method that puts one-time investment (training) and periodic investment (inference) into the same service cycle comparison |
| R&D compute ratio | The proportion of final training Run in all R&D compute expenditures; note that this is the expenditure estimate, not the proportion of FLOPs |
| Total parameters / active parameters | MoE has two parameter measurement bases: the total parameters correspond to capacity and GPU memory, and the active parameters correspond to the actual calculation amount of each Token |
| Ledger disclosure layering | Differences in the degree of layer-by-layer disclosure of weights, parameter measurement bases, training tokens, and card times; open weight does not equal open ledger |

---

## Related links

- This repository methodology: [Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [13 · Mechanics of scale](/en/tutorial/mechanics-of-scale/) · [08 · Architecture decision recording and evolution](/en/tutorial/adr-and-evolution/)
- Method source: [Chinchilla：Training Compute-Optimal LLMs](https://arxiv.org/abs/2203.15556) · [Scaling law of fine-grained MoE](https://arxiv.org/abs/2402.07871) · [Scaling Inference-Efficient Language Models](https://arxiv.org/abs/2501.18107)
- Cases and data: [GLM-5 technical report](https://arxiv.org/abs/2602.15763) · [T²（Train-to-Test）Scaling](https://arxiv.org/abs/2604.01411) · [Inkling 2 Small training ledger](https://thinkingmachines.ai/news/inkling-2-small) · [Epoch AI: The final training run accounts for a minority of R&D compute](https://epochai.substack.com/p/final-training-runs-account-for-a) · [LFM2.5-350M release notes](https://www.liquid.ai/blog/lfm2-5-350m-no-size-left-behind)
