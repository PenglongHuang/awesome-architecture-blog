---
title: "T11 · Before planning training stages, ask whether the investment is worthwhile"
description: "Diagnose capability gaps, choose between no training, adaptation and pre-training from scratch, and work through a complete contract-assistant Training ADR."
series: "model-training"
order: 11
pubDate: 2026-11-19
kind: "tutorial"
tags: ["Model training decisions","Training strategy","Model lifecycle","Training ADR"]
locale: "en"
translationKey: "tutorial/t11-orchestration-lifecycle-strategy"
sourceHash: "953fe097a29c566a030a93c04d0770b97fae5bca61bcd37777b39e7fc564b8ac"
---

## The same base model, a sixfold difference

On 2026-08-14, z.ai released [GLM-5.3](https://z.ai/blog/glm-5.3)（[Official model card](https://huggingface.co/zai-org/GLM-5.3)). The official model card said two things that made the judging room quiet:

- It uses **the same base model** as GLM-5.2, an MoE officially described as 744B total/40B active parameters, **without retraining the base**. Some secondary sources say 743B; use the official definition;
- On Terminal-Bench 3.0, GLM-5.2 is 4.6 and GLM-5.3 is 28.3 (measurement basis: official model card reported values, same benchmark version).

28.3 ÷ 4.6 ≈ 6.2。**what does it mean**: The two models are the same model in the sense of pre-training - the same parameter skeleton, the same pre-training data history - just because the post-training pipeline is rewritten, the terminal agent benchmark is stretched by about six times. This is not a conventional replacement narrative of "new models are better than old models", but direct evidence that "training orchestration itself has become a first-class productivity".

The same official release reports DeepSWE v1.1 rising from 46.2 to 66.9 and Agents’ Last Exam from 23.8 to 28.5, covering software-engineering and long-horizon agents respectively. ExploitBench also doubles, indicating increased cyber capabilities and prompting official and community dual-use discussions. [T10: Safety and evaluation](/en/tutorial/t10-safety-spec-evaluation-gate/) examines this risk alongside capability gains.

First establish the first discipline of this chapter (F17, used repeatedly later):

> **Judgment boundaries:** "The same base, TB3.0 from 4.6 to 28.3" can only prove **Post-training choreography may bring about magnitude changes**, it cannot be inferred that "all tasks will be equally improved." It is a single benchmark family (terminal Agentic tasks) and official self-reported measurement basis; the same post-training also increases the security risk surface (ExploitBench doubles). When quoting such figures, it is necessary to carry the qualifications of the baseline version, the evaluation method and the "incomplete task extrapolation".

If the same base can be stretched six times by just changing the training, then the intuition of "training strategy = choosing the strongest algorithm" will go bankrupt. The real problem becomes three types of orchestration problems:

- **Route question:** should this capability gap be solved by training at all?
- **Orchestration issues**: If training is required, in what order should the stages be combined? Who will fix the regression caused by the sequence?
- **Evolution question:** should the next model reuse a base, continue training, or start from scratch—and where should limited compute go?

A **strategy question** spans all three chapters: how do training, inference, rollout, and R&D ledgers become one investment decision?

In this chapter, these four types of problems are collectively referred to as **end-to-end system decision**: the overall system requires jointly adjusting four controls: triage (whether to train and to what depth), orchestration (how to combine stages), evolution (how to replace the base model), and compute (where to spend). In contrast, **Pipeline template**, just plug in the stage diagram published by others and expect it to work - not a single one of the four knobs has been adjusted. The "no" in the chapter title denies this kind of power-on multiplexing.

The derivation route of this chapter is also the closing sequence of the entire topic:

```text
Section 1 Training route triage: Decision tree starting from "should training or not"
    ↓
Section 2 Stage Orchestration: The pipeline is the result, not the template (GLM-5 sequential RL)
    ↓
Section 3 Reuse, continue training or train from scratch (GLM-5.3 / K3.1 Pro / Inkling)
    ↓
Section 4 Model Family and Open Strategy (Open Source Camp Shuffle; Open ≠ Transparent ≠ Deployable)
    ↓
Section 5: compute strategy (FLOPs → GPU-hours → cost; hidden multipliers; training–inference allocation)
    ↓
Session 6 Capstone: Complete nine-segment Training ADR and a mini-game
```

This chapter refers heavily to the previous chapters: Three Budget Accounts ( [T02](/en/tutorial/t02-scaling-budget-three-ledgers/)), data recipes and mid-training ( [T03](/en/tutorial/t03-data-recipe-quality-synthesis/)), Checkpoint state machine (T05), Demonstration and distillation (T06), Preference (T07), RLVR premise (T08), Agentic RL cost ( [T09](/en/tutorial/t09-agentic-rl-environment-credit-async/)), release release gates ( [T10](/en/tutorial/t10-safety-spec-evaluation-gate/)). They come together here.

---

## 1. Training-route triage begins with whether to train

### 1. The most expensive mistakes happen at the triage desk

The most expensive error is often **choosing the wrong intervention level**. Training may reproduce a capability that RAG could supply, or a LoRA adapter may be applied where a new base is necessary, reaching a capability ceiling six months later and stranding the earlier investment.

There is only one sentence in the logic of triage: **First determine the nature of the "gap" and then choose the route**. The gaps in the model have several completely different causes - lack of knowledge, lack of behavior, lack of taste, lack of success rate, lack of long-term mobility - each type of cause corresponds to a different drug, and the drug has different side effects:

```text
Gap diagnosis (do it first, the evaluation budget is spent, not the training budget)
    ├─ Lack of knowledge/facts ──────── Retrieval can be supplemented → No training: Prompt / RAG / Tool call
    ├─ Missing behavior, formats, or wording ── demonstrations can teach it → LoRA / SFT (T06)
    ├─ Missing domain vocabulary and background knowledge ── feed a corpus → continued pretraining / mid-training (T03)
    ├─ The answers are all correct but "unstable" ─── Preferences can be sorted → Preference optimization (T07)
    ├─ Tasks can be verified but not proficient ─ Rewards can be calculated → RLVR (T08)
    ├─ To move continuously in the environment ── Trajectories are available → Agentic RL (T09)
    └─ None of the above can meet the need ── only then consider training from scratch (the full T02–T05 sequence)
```

### 2. Seven-level route comparison table

| route | fit gap | Prerequisites (retreat if not met) | main cost | Main Chapter |
|---|---|---|---|---|
| No training: prompting / RAG / tool use | There is a gap between knowledge and facts, and the model capability is sufficient | There is a search library or tool API; gaps can be "finded" and filled in | Retrieval and operation and maintenance engineering; no training ledger | T04 (boundary between long context and RAG) |
| Lightweight adaptation: LoRA / PEFT | Behavior, format, domain language | The base already has the ability seed | The writing depth is limited and the upper limit is constrained by the base | T06 |
| Full parameter SFT/distillation | Task patterns can be expressed by demonstration | There are high-quality demonstrations; the model capacity is sufficient | Data Engineering + Forgetting Management | T06 |
| Continue pre-training/mid-training | Lack of domain knowledge and vocabulary | Data compatible with Tokenizer; comes with replay | General capability rollback has the greatest risk | T03 |
| Preference optimization | Output "Both are correct but not good" | Preferences can be defined and marked | Scorer bias and over-optimization | T07 |
| RLVR | The task can be verified and the success rate needs to be improved | The validator is reliable + the base is capable of seeding | Sampling account and anti-reward exploitation monitoring | T08 |
| Agentic RL | long range environmental mission | Four-piece environment set and asynchronous topology are available | Environmental Account + Policy Lag Management | T09 |
| Train from scratch | All of the above cannot reach the lower limit of ability | Five thresholds of data, compute, team, compliance and differentiation | Full set of costs for pre-training mainline | T02--T05 |

The seven levels rank **intervention depth and cost**, not technical sophistication. Higher levels can increase costs and reduce reversibility by orders of magnitude: a bad LoRA run can be reversed by deleting an adapter, while a wrong from-scratch direction can consume a quarter of cluster time.

> **Judgment boundary: **Triage is not a one-time admission check, but a re-examination before release gates at each stage - if the ability target changes, the base is replaced, and the budget is cut, the decision tree must be re-walked.
>
> The conclusion of the last round of triage is only worth the evidence it is at the time; teams that treat it as a permanent classification will find themselves in the third stage using the map of the first stage to follow a new path.

### 3. Five thresholds for training from scratch

The reason why the bottom end of the triage tree is drawn the most carefully is because "training from scratch" requires passing through five gates at the same time:

| threshold | questions to answer |
|---|---|
| data | Is there a unique or processable corpus of sufficient size that can be governed (permissions, privacy, pollution control)? |
| Compute | Can the three ledgers be recalculated and the organization can afford the R&D multiplier (Section 5)? |
| team | Are the four sets of engineering capabilities of data, training system, post-training, and evaluation complete? |
| Compliance | Can you meet safety, copyright, privacy, and target-market regulatory requirements (T10)? |
| Differentiation | Are the existing open weights + the upper six levels of this triage framework really unable to achieve the goal? |

The reality in 2026 is: Open weighting has turned "mid-range capabilities" into free public goods (Section 4). For teams that cannot pass the five-level threshold, the correct battlefield is in the middle of the six-level ladder, not at the bottom. On the other hand, [Inkling 2 Small](https://thinkingmachines.ai/news/inkling-2-small) Projects like this show what training from scratch can buy when the prerequisites are met: a base model tailored to your deployment setup and data pipeline (594B total / 17B active MoE, Apache 2.0; as of 2026-11-05, weights were awaiting external safety testing before release).

### 4. Choosing not to train: the boundary between RAG and training

The top of the triage tree is most likely to be skipped at the review meeting - "We have to make training decisions, and what a plan without training." But it is precisely the level that should be calculated first, because it has completely different comparison dimensions with the training route:

| Dimensions | RAG/tool call | Training (courses for all levels) |
|---|---|---|
| Knowledge update | The index database is updated immediately, and document changes are immediately visible | Every update requires retraining, and there is a half-life of knowledge expiration |
| Cost per request | Retrieval overhead + long context reasoning | The model "remembers" knowledge, the request is shorter, but the training ledger is front-loaded |
| Citations and audits | Naturally given sources, traceable to documents | Knowledge is integrated into parameters, and the source depends on additional mechanisms |
| behavior shaping | Little help with formats, style, or task patterns | This is the training venue |
| Private data governance | The data remains in the retrieval database, and the permission model is clear | Data enters the weight, making deletion and compliance difficult |

Three typical cases (teaching summary):

- **Knowledge changes every week** → The misunderstanding that training is expensive: any knowledge “trained in” is expired;
- **The answer must be given** → Due to the structural advantages of RAG, training requires a reference mechanism;
- **Output format and task mode are unstable** → RAG has almost no solution, this is SFT’s home turf.

Begin triage by asking whether the gap concerns **what the model knows** or **how it acts**. Try retrieval for the former and training for the latter. Both may coexist: a contract assistant may need clause retrieval and stable extraction formats. Address each layer and track its budget separately.

> **Architectural wisdom:** The output of triage is not "one route", but "one route + two rejected routes + rejection reasons". The reasons for rejection are written down on paper. When the capability requirements change three months later, you will know which alternative to activate - this is the prototype of paragraph 8 of the ADR in this chapter's Capstone.

---

## 2. Stage orchestration is an outcome, not a template

### 1. A stage diagram and its correct pronunciation

Place the stages from the whole topic on one diagram:

```text
Pre-training (T02-T05)
    ↓ Delivery: Base Model + Checkpoint + Capability Baseline (Interface Convention in the Introduction)
mid-training (T03): Oriented data encoding at the end of pre-training (optional)
    ↓
SFT/Distillation (T06): format, behavior, task mode
    ↓
Preference Optimization (T07): Defining "Better"
    ↓
RLVR (T08): Verifiable mission hardening
    ↓
Agentic RL (T09): Long-range tasks in the environment
    ↓
Security and Evaluation release gates (T10): Promotion/Return/Rollback
    ↑__________Cross-stage repair: replay, hybrid training, on-policy distillation__________↑
```

This diagram shows **one possible sequence, not a mandatory pipeline for every model**. Each arrow is a handoff check: a deficient checkpoint and capability baseline cannot be repaired simply by naming the next method. Stages may be skipped or run in parallel, with independently trained capability branches later merged. Sequential training also incurs costs, as the following case illustrates.

### 2. Main case: GLM-5’s sequential RL full recipe

[GLM-5 technical report](https://arxiv.org/abs/2602.15763) (2026-02, arXiv preprint of the official technical report; 744B total parameters/40B activation, pre-training 28.5T Token, MIT open weight) disclosed its complete post-training arrangement - "sequential RL (sequential RL)" is GLM's name for its own three-stage sequence, not an industry standard term:

| Stage | Content (official report measurement basis) | orchestration risk |
|---|---|---|
| SFT | Expand agent/coding data; introduce three thinking modes | Establish a behavioral base for subsequent RL |
| Reasoning RL | Strengthened reasoning ability | Subsequent stages will erode the results of this stage |
| Agentic RL | Real issue-PR pair, Docker terminal, web knowledge graph environment | Same as above |
| General RL | Universal ability convergence | Continue to squeeze the front-end skills |
| On-policy cross-stage distillation (OPD) | Fix early ability regression caused by sequential RL | The official clearly acknowledged the existence of the rollback, and the distillation section is responsible for repairing it |

The most valuable row of this table is the last row: **The official admitted that multi-stage sequential RL will erode the skills in the early stages, and a dedicated distillation stage is needed to bring back the early abilities**. "Train A first, then B, then C" is not a free serial list - every time you enter a stage, you are betting on the previous stage.

Draw this shape using a set of pedagogical schematic numbers (purely schematic, not fractions of any real model):

| Capability dimension | After SFT | After Reasoning RL | After Agentic RL | General RL＋after distillation |
|---|---:|---:|---:|---:|
| Inference benchmark | 71 | 82 | 74 | 81 |
| Agentic benchmark | 32 | 35 | 58 | 57 |
| General instructions | 68 | 70 | 63 | 69 |

Shapes are more important than numbers: **The champion of each column will be eroded in the next column**, the repair of the final section brings the front section back partially, but not necessarily back to the peak. This is the meaning of "the pipeline is the result" - the four stages of GLM-5 + a repair section are the solutions derived from its task combination, data reserve and compute window, not a template that can be copied in its entirety.

### 3. Comparative case: Inkling’s “data stage” arrangement

The same year 2026, [Inkling 2 Small](https://thinkingmachines.ai/news/inkling-2-small) What is disclosed is another arrangement - the main axis of its arrangement is not "signal", but "data quality gradient" (the measurement basis is official disclosure, 2026-11-05 page):

| Stage | content | key figures |
|---|---|---|
| H1 pre-training | Regular large-scale mixing | 8.4T Token; GB300 NVL72 rack 68 hours; native NVFP4 |
| H2 | New data of higher quality not seen before | 3.8T Token; context expanded to 512K |
| H3 | Reasoning + Agent trajectory | About 320B Token; context expanded to 1M |
| H4 | Highest quality trajectories (mainly sampled from Kimi K3 and our own early models, filtered by correctness and alignment) | About 34B Token |
| RL | Single Combined RL Run | 1,075 steps, over 17M rollouts, 9 days; sampler : trainer = 5 : 3 |

Putting the two cases side by side, one can read the three general laws of arrangement:

- **More than one orchestration axis**. GLM-5 cuts stages along "signal type" (demonstration → three types of RL), and Inkling cuts stages along "data quality and context length" (H1→H4 and then RL). The cutting method is determined by the shape of the data in your hand, not by the thesis table of contents;
- **Stage Boundary = Data Boundary**. The entry conditions for each stage are "the next data has been prepared and verified" - the 320B trajectory of H3 and the 34B selected trajectory of H4 are generated at a cost (about 354B Token's trajectory data itself is obtained in exchange for compute);
- **The further you go, the more expensive it is per Token**. From 8.4T to 34B, the number of Tokens dropped sharply and the quality threshold rose sharply - the latter part of the arrangement is about "density" rather than "quantity", which is completely consistent with the data stratification conclusion of T03.

By the way, pay attention to a detail of H4: its trajectory is mainly sampled from Kimi K3—— **Cross-vendor distillation is open, and the orchestration can directly consume other companies’ open weights as Teacher**. This is the direct bonus given to the arranger by the "Open Camp" in Section 4.

### 4. Use the competency matrix to determine the next stage

The **capability matrix** should drive orchestration, introduced in T03 and incorporated into T10’s evidence set. After each stage, evaluate target capabilities, non-target capabilities, and safety, then ask three questions:

```text
① How far behind is the target ability? To which category on the triage tree does the gap fall? (Determine what signal to use in the next stage)
② Which non-target abilities fall back beyond the threshold? (Deciding whether to replay/distill repair first before moving forward)
③ The marginal benefit of continuing training vs. the switching cost of changing plans? (Decide "add another stage" or "call it a day and release")
```

The three tools that support repair are all from the first ten chapters: **replay data** (Mix the samples from the previous stage into this stage, T03), **mixed training** (Multi-stage data are trained in the same batch), **Cross-stage distillation** (Use early Checkpoint as Teacher to sample new data, or directly on-policy distillation, T06). They are the "interest" of programming - the debt of ability owed by sequential training, which is used to repay it.

### 5. Organized material management: data, checkpoint and ruler

The stage diagram only draws arrows and does not draw the material flowing under the arrows. Three material objects determine whether the arrangement can really run:

- **Data reuse pool**: The data in each stage is registered in the repository (source, license, cleaning rules, ratio - T03 quality scorecard), and the replay samples are taken from the pool in the next stage. For a team without a repository, replay can only involve "probably mixing a little bit of old data", and the intensity of repair is uncontrollable;
- **Checkpoint pedigree**: The starting point and end point of each stage are snapshotted into the pedigree tree (Checkpoint state machine of T05: parameters + optimizer status + data cursor + RNG), and each branch of post-training starts from a clear node on the pedigree. Rollback is not "going back to the past", it is "switching to another node on the lineage";
- **frozen ruler**: The gold label set and the regression set are frozen before the entire arrangement begins, and all stages are measured against the same ruler - if the ruler is changed midway, the ability matrix will be interrupted, and it is impossible to say "how much has been regressed".

```text
Base ckpt-0 ── SFT ── ckpt-1 ── RLVR ── ckpt-2 (release candidate)
                │                   │
                └── Branch B (another entry point) └── ckpt-2′ (rollback backup: SFT endpoint + repair mixture)

Data pool: v1 demonstration set ─┬─→ SFT main
                   └─→ The RLVR stage is played back at 15% (the ratio is an experimental variable, not a constant)
Ruler: Gold Label Set v1 (frozen)──Unified evaluation of all stages──Release release gates reference
```

The three material objects together answer a question: **When something goes wrong with the arrangement, can you return to a known state? **The answer is "can", if and only if the pedigree, data version, and evaluation ruler are all present. This is also the material basis for ADR Paragraph 9 (Rollback and Exit Conditions) in Capstone - a rollback clause without material management is just a wish.

> **Architectural wisdom:** The training pipeline disclosed by others is his solution, not your problem. Before reusing, go through the causal chain of "task form → data form → method hypothesis → system topology" (error 4 of T01): GLM-5 requires three RL stages because its capability target is the full spectrum of agentic engineering; if your goal is only one corner of it, copying the full recipe is paying for unused stages - and it also comes with the repair cost of sequential rollback.

---

## 3. Reuse, continue training or pre-train from scratch

### 1. The three intersections of the next version of the model

Every iteration of the model family stands at the same three-way intersection: **Reuse the base and only move it after training**、**Continue pre-training on the old base**、**Training a new base from scratch**. Public cases in 2026 illuminate all three paths:

| Case | base decision | What has been changed | Results (official measurement basis) |
|---|---|---|---|
| GLM-5.3（2026-08） | Reuse GLM-5.2 base without retraining | Rewrite the entire post-training pipeline | TB3.0 4.6→28.3; DeepSWE v1.1 46.2→66.9; Agents' Last Exam 23.8→28.5; ExploitBench doubled |
| Kimi K3.1 Pro (released on 2026-10-23) | Reuse the K3 base model (2.8T total / 104B active parameters) | The official blog stated that it will do large-scale joint RL on hundreds of tasks and train the compute after a large increase in funding | Agent Arena ranks first in open source weight; TB4.0 65.7% (including 86 CLI tasks); AA Intelligence Index ranks 4th |
| Inkling 2 Small（2026-11-05） | Full pipeline advancement of own base | H1 pre-training 8.4T → H2 new data 3.8T (512K context) → H3 about 320B inference and Agent trajectories → H4 about 34B highest quality trajectories → single-shot joint RL | H1 only 68 hours (GB300 NVL72, native NVFP4); RL Run 9 days, over 17M Rollout |

(K3.1 Pro score measurement basis: summary of official blog and Artificial Analysis, 2026-11; TB4.0 and TB3.0 are different versions, and the scores are not comparable to each other.)

Two cases (GLM-5.3, K3.1 Pro) of "the same base for pure post-training refresh flagship" mutually confirm the same thing: **The potential capacity pool of contemporary bases is far from being drained by the pre-training endpoint**. Post-training is a cheaper iteration lever - without moving the pre-training bill, a new generation can be produced in a month or two. But there are restrictions on the direction of the lever:

> **Judgment Boundary: **What the final training amplifies is the ability seeds that are already in the base, and cannot be created out of nothing. Premise two of T08 repeats itself on a larger scale here: six times the GLM-5.3 occurs on terminal-type tasks, precisely because that base has enough seeds on such tasks. Before reusing the base, first perform a "seed physical examination" on the base according to the triage logic in Section 1 - if the pass@k of the target ability on the base is all zero, the post-training lever cannot be pried no matter how long it is.

### 2. Accounts and insurance of three roads

| Dimensions | Reuse base + post training | Continue pre-training/branching | Train from scratch |
|---|---|---|---|
| Pre-training ledger | not happen | Part (new Token is calculated as 6ND) | Full amount + R&D multiplier |
| Iteration cycle | thoughtful month | month to season | season to year |
| upper limit of ability | Constrained by base seed | Knowledge can be expanded, but the structure cannot be changed | All customized |
| Compatibility burden | smallest | Tokenizer/data distribution must be verified | None (self-built) |
| Rollback cost | Low (return to old post-training Checkpoint) | Medium (may contaminate the base) | High (entire main line) |
| Suitable for whom | The base is up to standard and assembled | Big gap in domain knowledge | Passed all five thresholds |

### 3. Compatibility checklist: six gates before continued training

Select "Continue training on the existing base" (whether it is your own or open-weighted), and go through it before starting work:

| Check | What to check | The consequences of failing to pass | Main Chapter |
|---|---|---|---|
| Checkpoint integrity | Are the parameters + optimizer status + data cursor + RNG complete? | Training cannot be resumed at the breakpoint and the progress will be invalidated | T05 |
| Tokenizer compatible | Vocabulary, compression rate, and whether special tokens are continued | New corpus word segmentation distortion, embedding misplacement | T03 |
| Data distribution compatible | How much does the new corpus deviate from the base training distribution? | catastrophic forgetting | T03／T06 |
| Architecture compatible | Are attention/expert structures and parallel segmentation still applicable? | System solution redone | T04／T05 |
| Licensing and Governance | The scope of retraining and commercial use allowed by the base license | Legal and compliance risks | T10 |
| ability baseline | The seed level of the base on the target task | There is no way to explore the trajectory of success in the RL stage | T08 |

The last line is often missed, but it is an invisible premise common to all three paths. The version management of the model family therefore has a clear form: each branch (next section) holds its own Checkpoint lineage, capability baseline snapshot and regression test set - the release strategy is not "which score has the highest score", but "which branch has passed the T10 evidence group".

### 4. When must the base be changed: Five base changing signals

Reusing the base is cheap, but the cheapness is its biggest trap - the team will continue to invest in additional training after the base is no longer used. If any of the following signals appear, the "base change" should be brought up for review instead of adding a post-training stage:

| signal | criterion | Why can’t post-training save me? |
|---|---|---|
| Missing seeds | The pass@k of the target ability is all zero on the base (T08 premise 2) | RL cannot explore the trajectory of success, and SFT can only teach format but not ability |
| structural gap | Base has no target modality, context, or output length magnitude | Attributes determined by pre-training can only be fine-tuned and cannot be created after post-training |
| training ledger imbalance | The faster the post-training iteration is, the uglier the inference amortization ledger will be (the deployment pattern has changed) | The active parameters and volume of the base are pre-trained and fixed |
| Licensing/Supply Risk | Changes in license terms, removal of weights, and limited hardware supply | Legal and supply chain issues are outside the scope of gradient descent |
| iteration ceiling | Two consecutive rounds of pure post-training refresh, and the target baseline increase continues to narrow | Direct observation of base capacity pool bottoming out |

The fifth signal is worth expanding on: GLM-5.2→GLM-5.3 six times is the gain from "the first round of rewriting on the same base after training"; it cannot be derived from "the second round of rewriting is still six times". The returns of reusing routes are naturally diminishing - each refresh consumes the same pre-trained seed pool. Treating "six times first round" as the normal expectation for reuse routes is a variation of Mistake 2 in this chapter.

> **Judgment boundary:** Replacing the base is a strategic-level decision (quarterly scale, pre-training level budget), and training after reuse is a tactical-level decision (weekly and monthly scale, post-training level budget). The two should not vote in the same review meeting - dragging the tactical review into a strategic debate, or using tactical budgets to make strategic decisions, are classic symptoms of disordered planning.

---

## 4. Model families and openness: where the base comes from

### 1. Model branch: a tree product grown from a base

Contemporary model teams derive families of branches from a base model, distinguishing **deployment form and task domain**, rather than merely release recency:

| branch | Positioning | Public anchors for 2026 (example) |
|---|---|---|
| Base | Pre-train raw deliverables for downstream retraining | GLM-5 (MIT-licensed weights; 28.5T training tokens disclosed) |
| Instruct/General | Command follow and universal dialogue | The default form of each flagship |
| Reasoning | Reasoning enhancement, multi-level thinking mode | Three thinking modes introduced by GLM-5 in the SFT stage |
| Coding／Software Engineering | Code and repository-level tasks | GLM-5's agent/coding data extension; DeepSWE series of evaluation objects |
| Agent | Long range tools and environmental missions | GLM-5.2 / 5.3; Kimi K3.1 Pro (focused on long-horizon agentic work) |
| Small／Flash | Client side and small deployment | LFM2.5-350M (28T tokens, approximately 80,000:1 token-to-parameter ratio, size <500MB) |

Branches are products of **compute strategy**, not just marketing categories. Device models follow deployment constraints from T02; agent branches reflect the sampling and environment costs from T09. Every branch in your product family should explain its deployment constraints. A branch without that answer is unlikely to survive a generation.

### 2. The changing open-model landscape: a 2026-11 snapshot

Where the base comes from depends on what the open camp gives you. And this map was redrawn in 2026:

| camp | Key moves in 2026 | measurement basis |
|---|---|---|
| Meta MSL | 2026-06-02 Release of new flagship **No open weight, Llama open source line will no longer be updated**; Muse series released on 2026-08-05; As of 2026-09, there is no release or official announcement of Llama 5; there are also reports that some products switch to using Google/OpenAI models | Public reporting and Wiki entry measurement basis |
| Qwen | [Qwen3.8-Max](https://qwen.ai/blog?id=qwen3.8)（2026-08）**For the first time, the weights of Max-level models are opened**: 2.4T total / about 95B active parameters; the previous-generation Qwen3.5 flagship (2026-02) was a 397B MoE—within one generation, the open-model flagship moved from the 0.4T class to the 2.4T class | Official blog |
| Kimi | K3 (2026-07) opens weights (MXFP4 quantization); K3.1 Pro (2026-11) opens weights after reusing the base + combined RL | Official blog and technical reports |
| Mistral | [Large 4](https://mistral.ai/news/mistral-large-4-oss) (2026-10-29) 1.05T total / 52B active parameters, modified MIT license, **The official technical report is released along with the weights** | Official release |
| Z.ai | GLM-5 (2026-02) MIT weight, 28.5T Token and sequential RL recipe disclosure | technical report |

**what does it mean**: The old common sense "Llama = the default reference for open source flagships" has expired - Llama only remains as the historical anchor point for the starting point of the open source weight ecosystem; the open source frontier has been changed to consist of Qwen3.8-Max, Kimi K3/K3.1 Pro, Mistral Large 4, and GLM-5, and the flagship open source parameter level has moved from 1T level to 2--3T level. At the same time, the resurgence of closed source is true (Meta side), and the increase in open source is also true (Qwen puts the Max level into the open camp) - these two things are true at the same time, so any unilateral narrative of "open source is dead" or "open source has won" cannot pass this table.

This table also needs to be read with snapshot rules: it is organized according to the time point of 2026-11, and the generations of camps and flagships change on a monthly basis (for example, Qwen4 has not been officially released as of 2026-11, and the rumored parameters are not included in the text). Any reference to the "current camp" statement must include a verification date - this is a repeat of the T02 "time dimension" discipline at the strategic level.

### 3. Open three-layer distinction: weight, ledger, and deployment

The word "open source" will carry at least three independent propositions in 2026. Mixing them together will directly lead to wrong base selection:

| proposition | What is asked | Counterexamples from 2026 (evidence) |
|---|---|---|
| weight open | Can I get the parameter file and commercial license? | The Inkling ledger is fully open, and the weights are as of 2026-11-05, to be released after external security testing |
| Training transparency | Can its training ledger and recipes be recalculated? | K3 weight is open, but the number of training tokens, GPU-hours time, and data composition are not disclosed (third-party analysis confirms this gap) |
| Self-deployable | Can ordinary hardware run it? | The open weight of K3.1 Pro is about 5.6TB (reported measurement basis), which is difficult to bear on consumer-grade hardware |

The third row illustrates F18’s discipline. [Kimi K3.1 Pro’s](https://huggingface.co/moonshotai/Kimi-K3.1-Pro) weight files are about 5.6TB, released on 2026-11-05 according to iThome. **This exceeds ordinary consumer storage and GPU-memory capacity.** But the conclusion has two directions: **open weights do not imply deployment on ordinary hardware**, and **file size alone does not prove deployment impossible**. Quantization, framework support, and rented clusters alter the threshold. Deployment remains a separate engineering problem.

Similarly, the second row determines "who to refer to for learning budget decisions": when GLM-5 discloses Token without a card (externally evaluable FLOPs, when the card cannot be estimated), Inkling's three ledgers can be audited (the disclosure hierarchical table in Section 5 of T02), and K3 only has a structure but no ledgers. Use deployment to find open weights, use methods to find open ledgers, and use conclusions to be restrained.

> **Architectural wisdom:** The base selection review should only ask three questions, corresponding to three levels: whether the license is given (weight), whether the ledger can teach you (transparency), and whether the deployment threshold can be passed (engineering). Candidates with all three answers "yes" do not exist - there are no three good students with perfect scores at the same time in 2026. Choosing the base is to find the intersection of three incomplete circles.

### 4. Your open strategic position: consumer, participant or supplier

After the redrawing of the open camp, each training team actually has to choose a "station" - what is your relationship with the open ecosystem. The actions and risks of the three positions are completely different:

| Position | Typical actions | main benefits | Main risks |
|---|---|---|---|
| consumer | Use open weights as the base model (“reuse” at the three-way fork in section 3) | Skip the pre-training ledger; iterative leverage is all in post-training | Changes in base supply and licensing (Subscription Signal No. 4); sharing the same base with everyone, differentiation depends on data and orchestration |
| participants | Like Inkling, consume other companies’ weights and become a Teacher (H4 is sampled from K3), or feed back data and evaluation to the upstream | Do orchestration based on the capability pool of the open ecosystem | Teacher’s deviations and permission boundaries will flow into its own pipeline (Risk List of Chapter T06 Distillation) |
| supplier | Open weight + technical report like Mistral Large 4, exchange ecology for influence | Ecological niche, word of mouth, downstream feedback | Formulas are reused by competing products; security and reputation costs caused by misuse of weights (T10 dual-use issue) |

Positioning is not a lifelong identity that can be chosen from one of three choices, but is often a parallel choice of the same company on different product lines. But **Each product line must indicate its own position** ——The hidden cost of "maintaining an open ecosystem" should not appear in consumers' budgets, and suppliers should not pretend to be pure consumers in their decision-making.

Read it again in conjunction with the camp table in Section 2: Meta’s closed-source shift and Qwen’s open Max-level shift are essentially two companies making opposite bets from the supplier’s standpoint. And your bets don’t have to be the same as any of them – the choice of position is only subject to your own ability goals, budget and risk boundaries. This is another repetition of the introduction of layer 1 before layer 7.

---

## 5. Compute strategy: the whole-system cost ledger

### 1. Conversion chain: T02 chain plus three lines of post-training

T02 established a three-level conversion of "FLOPs → GPU-hours → Fees". From the perspective of the end-to-end system, the chain extends downward for three more lines:

```text
Training objectives (ability + deployment form)
    ↓ 6ND rough estimate (T02, MoE uses activation measurement basis)
FLOPs (recalculable layers)
    ↓ ÷ (GPU number × single card peak × MFU)
GPU-hours time (depends on system assumptions, T05)
    ↓ × Unit price per card
Cost (leave a range)
    ↓ × hidden multiplier
R&D ledger (eventually Run is only a minority)
    ↓ + Rollout sampling + Environmental throughput + Evaluation release gates (resident item, T09/T10)
Overall machine compute strategy
```

### 2. Hidden multiplier: the account behind the final run

[Analysis of Epoch AI](https://epochai.substack.com/p/final-training-runs-account-for-a) (2026-03) estimated the R&D compute structure of OpenAI, Z.ai, and MiniMax: **In the end, training Run only accounts for a minority of the total expenditure on R&D compute** ——OpenAI is about 9.6% (corresponding to an annual R&D compute expenditure of about $5B for a final run of about $0.5B), and the other is about 22.6%; the final run’s compute has increased by about 2.4 times per year since 2016 (95% CI 2.0--3.1).

**what does it mean**: Calculating the "cost of training a model" only based on the final run will systematically underestimate it by about an order of magnitude (1 ÷ 9.6% ≈ 10 times). The undervalued part is all in the hidden multiplier:

| hidden multiplier | what does it eat | Expand chapter |
|---|---|---|
| Failure and restart | When restoring a sunken card before the point | T05（Goodput） |
| Ablations and hyperparameter sweeps | Controlled verification of "usefulness" of each component | T03／T08 |
| data pipeline | compute for cleaning, synthesis, verification, and replay | T03 |
| Rollout sampling | Generative side of RL, resident training bill | T09 |
| Environmental throughput | Environment startup, reset, verification, isolation | T09 |
| Evaluation and Red Teaming | Evidence group for each candidate checkpoint | T10 |

Two measurement basis disciplines must follow this number (T02 has been established, and the end-to-end system is reiterated here):

- The 9.6%/22.6% figures are **compute spending estimates**, not actual FLOPs shares. Spending combines procurement prices and arrangements from different years;
- It is an estimate for a specific company, **Not an industry constant**. The correct usage of the multiplier is "4--10 times interval prior + quarterly calibration based on the team's forecast account", which is not an exact coefficient.

Macroscale ( [Epoch AI Trends](https://epoch.ai/trends), snapshot dated 2026-02-05): frontier language-model training compute has grown by roughly 5× per year since 2020 (90% CI: 4–6×), while frontier training costs have grown by about 3.5× per year. **what does it mean**: Any compute plan that "refers to a certain model" must include a verification date and is expected to expire within one year - the ratio copied last year has changed this year.

### 3. Training–inference allocation: rollouts are an ongoing bill, not a training afterthought

The most easily misclassified item in the overall ledger is **Rollout/inference side compute**. It’s not a “deployment issue” at the end of training – in contemporary post-training, it’s a permanent part of the training bill:

- [Inkling 2 Small’s](https://thinkingmachines.ai/news/inkling-2-small) disclosed joint RL run allocates sampler : trainer = 5 : 3: **sampling compute exceeds training compute**. It spans 9 days, 1,075 steps, and over 17M rollouts, with token counts of p50 = 43K and p99 = 1.5M. T09 discusses the resulting topology and caching requirements;
- The prefix cache hit rate of the same run is 93%+. Note: **Engineering decisions directly rewrite bills** ——Without this layer of caching, the sampling account of 17M Rollout may be completely another order of magnitude;
- The environmental throughput (startup, reset, verification) of the Agentic RL task is superimposed on the sampling and is the second permanent account ("cost per effective trajectory" of T09).

Looking one layer further: the sampler bill on the training side and the inference bill on the deployment side are converging - T02's T² (Train-to-Test) Scaling ( [arXiv:2604.01411](https://arxiv.org/abs/2604.01411), preprint submitted on 2026-04) proves that once inference sampling is included in the end-to-end budget, the optimal training ratio will significantly shift into the over-training interval. **Training and promotion are not two budget accounts, they are two accounts of the same account** ——This is the biggest difference between the overall perspective and the perspective of a single chapter.

This confluence also adds a footnote to the "seat change signal" in Section 3: the active parameters of the base are written on both the training ledger and the inference ledger. If you change either side, you must look at the other side.

### 4. Acquisition method: rent, cloud, cooperation, self-built, hybrid

| way | suitable for | main cost |
|---|---|---|
| Cloud rental | Start-up verification, short-cycle projects | The highest unit price; long-term use bill inflation |
| cooperative training | Domain team with partners and data | The cost of negotiating recipe and data boundaries |
| Purchase a self-built cluster | Stable long-term load, data does not leave the domain | Capital expenditure + operation and maintenance team + supply constraints |
| Hybrid hardware stack | Realistic solution when single supply is limited | Cross-stack system adaptation and tuning costs |

Supply constraints are not hypothetical. DeepSeek V4 (approximately 1.6T parameters, pre-training data exceeds 32T Token, HF model card measurement basis) is reported to be "pre-training is mainly still on NVIDIA, and part of the process is adapted to Huawei Ascend" (MIT Technology Review measurement basis). It is also reported that its V4-Pro consortium led by Huawei used at least 1,000 Ascend chips to complete full parameter post-training (SCMP Reporting measurement basis, details to be officially verified) - even so, it can only be written as "mixed hardware in stages", not "complete localization". **what does it mean**: In the compute strategy, "supply availability" itself is a variable, and the acquisition method table must be reviewed every six months, rather than being determined once for life.

### 5. end-to-end system budget table: expand the T02 calculator into a end-to-end system version

T02’s Training Budget Calculator covers the three pretraining ledgers. The end-to-end version adds three output rows—rollouts, environments, and evaluation—and includes post-training orchestration among its inputs. Work through a teaching example (the same assumptions as Team X in section 6: reuse a base model, then SFT and RLVR; all numbers are hypothetical):

**Input items (standard measurement basis for each item):**

| Input | Hypothetical value | measurement basis |
|---|---|---|
| Base | Reuse open weights, no pre-training ledger | Triage conclusion (section 1) |
| SFT data | 8B Token Demonstration | teaching hypothesis |
| RLVR tasks | 50,000 tasks × average 8 Rollouts | Teaching hypothesis; group route |
| Average rollout length | 6K Token (assumed at p50, estimated at p99 according to T09 measurement basis) | teaching hypothesis |
| environmental form | Lightweight (long-term tasks without sandbox, short-term extraction type) | Triage conclusion |
| Review | Checkpoint full set of evidence per candidate × 20 candidates | T10 template |

**Output items (recalculable item by item):**

| Output items | Calculation formula | Hypothetical value | Corresponding anchor point |
|---|---|---|---|
| SFT training ledger | 6 × active parameters × 8B Token | slightly | 6ND（T02） |
| RLVR training ledger | Model-side computation of training steps × batches | slightly | — |
| Rollout sampling account | 400,000 × 6K Token × Single Token sampling cost | **The same magnitude as the training ledger or larger** | Inkling sampler : trainer = 5 : 3 |
| environmental account | Short-distance tasks, priced by item | Small items | Can become a major cost for long-horizon tasks (T09) |
| Evaluation account | 20 candidates × evidence group cost | Often missed entirely | T10 |
| R&D multiplier | Total of the above × 4 times prior | Range 4--10 | Epoch expenditure estimate measurement basis |

The table aims to **expose cost structure**, not promise exact prediction. With a reused base and RLVR, sampling can match or exceed training costs, as Inkling’s 5:3 example shows. Evaluation costs should not be zero, and replace the assumed R&D multiplier with measurements after the first review. If Team X’s initial rollout row is below training, the likeliest explanation is an omitted cost rather than an unusual task.

> **Judgment boundary:** The output of the compute strategy is not "how many cards", but a budget table with intervals: FLOPs can be recalculated, GPU-hours depends on assumptions, costs remain in intervals, multipliers are based on a priori, Rollout and environment are listed separately, and the acquisition method has a review date. Any compute proposal that only gives a single number will not pass the double calculation test set by T02.

---

## 6. Capstone: a complete Training ADR and a small worked example

The introduction gives a nine-point outline for decision-making records. Here is its overall development: the budget and model architecture are newly opened in Section 2/4, and the skeleton candidate solutions, system impact, verification release gates, and exit conditions are respectively merged into Sections 8/5/7/9 - the engineering products delivered in each of the previous nine decision-making chapters (T02--T10) happen to belong to each section.

### 1. Nine-section template

```markdown
# Training ADR: <project>: <decision title>
Status: Draft/Accepted/Rolled Back Date: Review Period:

1. Target capabilities and acceptance indicators
   What to improve (testable indicators + baseline version); which capabilities are not allowed to be rolled back; deployment form and constraints
2. Budget (three ledgers)
   training ledger/inference amortization ledger/R&D ledger; each number is marked with identity (official disclosure/estimate/assumption) and measurement basis
3. Data recipe and governance
   Source, permit, proportion, cleaning rules, pollution control; capability matrix connects data and evaluation
4. Model architecture
   Dense / MoE, context, and modalities; work backward from deployment needs (summary of T04’s Architecture ADR)
5. Training system
   Parallelism, Precision, Checkpoint, Fault Tolerance; New Components and GPU Role (Configuration Summary for T05)
6. Post-training arrangement
   Triage conclusion (including rejected routes); stage sequence and signals for each stage; fallback protection (replay/distillation)
7. Evaluation and security release gates
   Evidence set (target gains / no non-target regression / no reward exploitation / controlled ablations); safety evaluation and contamination control (T10)
8. Risks and alternatives
   Assumptions and failure modes of each candidate; where complexity is transferred
9. Rollback and exit conditions
   What signals occur to switch plans or rollbacks; review indicators and forecast ledger backfill plans
```

### 2. Combine the full range of contract assistant decisions into one ADR

The following continues the contract assistant project at the end of each chapter, and adds a set of scenario assumptions that can be recalculated. Team, Baseline Score, Resources and Timeline **All are teaching assumptions**, is used to demonstrate recording and comparison decisions, not a commitment to training effects. Whether the post-training phase is started still depends on whether there are gaps worth solving after the acceptance of the previous phase.

**scene**: The fictional team X is to be a corporate contract review assistant. Three capability goals: clause extraction (field level, answer verifiable), risk clause Q&A (original text sources required), and multiple rounds of clarification dialogues. Load: 5,000 legal users, an average of 200,000 requests per day, with an average input of 12K/output of 2K Tokens per request. **No rollback allowed**: General instruction following, safe refusal behavior. Budget: One-year window, equivalent to 300,000 GPU hours (including R&D multiplier reservation) + existing 64-card cluster.

**Step 1: triage using section 1’s decision tree.** Spend evaluation budget on diagnosis first. Open weights plus RAG already meet question-answering needs, where citation retrieval is a natural fit, and multi-turn clarification passes. Clause extraction alone has unstable formats and field consistency: illustrative F1 is 0.62 against a 0.90 target, and prompting reaches only 0.71. Diagnosis: **a behavior gap on a verifiable task**, suitable for training.

**Step 2: Level selection**. The gap lies at two levels: "LoRA/SFT → RLVR": first use SFT to establish the extraction format and task mode (T06), and then enter RLVR (T08) for verifiable goals such as field consistency. No mid-training (the domain vocabulary is sufficient after baseline inspection), no preference optimization ("better" has been objectively defined by field comparison), no agentic RL (the task is short-range and can be completed in a single round), and no training from scratch (the five thresholds of data, compute, and differentiation cannot be passed). The base selection is based on the three-tier screening in Section 4 (teaching assumptions: a mid-range open weight MoE, the license allows commercial retraining, and the deployment account is affordable in a 64-card cluster).

**Step Three: Orchestration and release gates (Section 2)**. Candidate stage order: SFT (start with LoRA to validate data quality, then assess whether a small full-parameter experiment is necessary). If independent evaluation still shows a target gap and the verifier passes its audit, proceed to RLVR (field-level comparison as the verifier; a group-based approach is viable because the same contract can cheaply yield multiple comparable extractions). Run the capability matrix at every stage and use replay data to prevent regression. Reuse T08’s RLVR health monitoring: entropy, length exploitation, and an independent test set.

**Step 4: Write ADR (excerpt of key paragraphs)**：

```markdown
1. Target: Extract F1 ≥ 0.90 (self-built 2,000 contract gold standard set, v1); universal benchmark fallback ≤ 2 percentage points;
   Security evaluation is not degraded (T10 release gates template is used)
2. Budget: About 40,000 GPU-hours for training ledger (SFT+RLVR, estimated); about 60,000 GPU-hours for Rollout sampling
   (assume sampler : trainer = 3 : 2, to be replaced with measurements from the first week); use a 4× prior for the R&D multiplier
8. Risks and alternatives:
   - Option A (RAG only): assumes “prompting can close the format gap”—falsified by measurement (0.62 → 0.71), rejected
   - Option B (reuse base + SFT → RLVR): Assume that "the base has extracted seeds + the verifier is reliable" - the baseline verification is established, selected
   - Plan C (train the 7B domain model from scratch): Assume that "200B Token domain corpus is sufficient" - the budget and team threshold are not enough, so it is rejected
9. Rollback: RLVR has length reward exploitation or the independent set does not increase → rollback to SFT checkpoint; extract F1 for two consecutive rounds
   No improvement → Stop filling and review the triage conclusion (the gap may actually be a retrieval problem)
```

**Alternative comparison** is the ADR’s core. All three routes state their assumptions explicitly. If new evidence falsifies one assumption, the decision can migrate in an orderly way instead of restarting from nothing.

**Step 5: Timeline and release gates (Execution View of Teaching Hypothesis)**：

```text
Week 1--2 Baseline and Gap Diagnosis: RAG+ prompts the project to be full, and freezes the gold standard set and regression set (T03/T10)
Weeks 3-6: LoRA quickly verifies the quality of the demonstration data; if the data does not pass the standard, the data will be repaired on the spot and will not enter the full reference
Week 7--10 Full parameter SFT (small scale) + capability matrix acceptance; if general fallback > 2pp, replay and retrain
Weeks 11--16 RLVR: group route, field comparison validator; health monitoring copied from T08
Weeks 17–18: run the complete T10 evidence set—target, non-target, safety, and ablations; release only after passing the gates
Throughout, the forecast ledger is backfilled week by week: actual vs. forecast for each cost and metric
```

| Release gates | Threshold (teaching assumption) | substandard action |
|---|---|---|
| Extract F1 (Gold Label Set v1) | ≥ 0.90 | Review triage when gap > 5pp (probably lack of seeds, not lack of training) |
| Common baseline fallback | ≤ 2 percentage points | Play back the mixed training once; if it still exceeds the release range, it will be downgraded |
| Security review | Not inferior to the base | Block publication directly (one-vote veto item in T10) |
| RLVR Health | Entropy No collapse, independent sets are promoted in the same direction | Fall back to the SFT checkpoint to troubleshoot reward speculability |
| budget | Accumulated GPU-hours ≤ stage budget × 1.2 | Trigger exit condition review in paragraph 9 |

There is an easily overlooked arrangement detail hidden in the timeline: **The gold label set and the regression set are frozen in weeks 1-2**. Every stage of post-training must be measured against the same ruler - if the ruler is changed midway, the 18-week ability matrix will be out of sequence, and there will be no room for regression.

> **Architectural wisdom:** The value of ADR is most obvious at three moments - when the project is established (paragraph 8 forces you to list alternatives), during review (paragraph 7 forces you to show the evidence set), and during review (the rollback signal in paragraph 9 is the starting point for the next decision). The painful part of writing is exactly where it blocks accidents.

### 3. Section, chapter, layer: triple coordinates of ADR

| ADR segment | The main products come from | Eight-level coordinate system |
|---|---|---|
| 1 target | T02 (target testability)/T11 (triage) | ① |
| 2 budget | T02 three ledgers/T11 compute Strategy | ⑦ |
| 3 data | T03 Formula and Quality Scorecard | ② |
| 4 Architecture | T04 Architecture ADR | ①⑥ |
| 5 systems | T05 distributed training configuration | ⑥⑦ |
| 6 Post-training arrangement | T06--T09 respective training plans/environmental specifications | ③④⑤ |
| 7 Evaluation and Safety | T10 Safety & Evaluation Gate | ⑧ |
| 8 Risks and alternatives | Failure modes for all chapters | full layer |
| 9 Rollback and Exit | T10 release gates + forecast ledger | ⑧ |

If the nine sections are filled up, the eighth floor will be accessible. This is the acceptance standard for "end-to-end system".

---

## 7. Seven common reasoning errors

None of these seven errors is a new invention - they are the convergence of the respective failure modes in the previous ten chapters at the entire machine level: the triage error comes from the "copy answer" of T01, the measurement basis error comes from the accounting discipline of T02, the three-layer confusion comes from the old habit of the open ecosystem, and the Rollout omission comes from the cost structure of T09. The entire machine decision-making process compresses ten on-site failure modes into the same review, and the chance of making mistakes is also magnified tenfold.

### Mistake 1: Copying other people’s stage pipelines as a template

GLM-5's "SFT → Three RL → OPD Repair" is the solution obtained by its task combination and compute window, and the official admits that the order will erode the previous skills. Copying the full recipe is equivalent to paying for the stages that are not used, and also comes with repair costs. **corrective action**: Use the capability matrix to determine the next stage, and write the handover acceptance at each stage.

### Mistake 2: Reading "same base six times" as "post-training universal"

TB3.0 from 4.6 to 28.3 is a magnitude change in a single benchmark family and official measurement basis, which cannot be extrapolated to all tasks; the same post-training also brought about a doubled security change in ExploitBench. **corrective action**: cite benchmark versions and qualifications; examine capability and risk together (T10).

### Mistake 3: Open weights = transparent training = self-deployable three-layer confusion

K3's weight is open but the ledger is not opened; Inkling's ledger is fully open but the weight is yet to be released; K3.1 Pro's weight is open but the volume of about 5.6TB exceeds the capacity of ordinary hardware. The three propositions are independent of each other. **corrective action**: When selecting the base, please tick three layers respectively.

### Mistake 4: Only the training ledger is calculated, and the rollout and environment expenses are recorded "later"

The disclosure of sampler : trainer = 5 : 3 indicates that the sampling side is larger than the training side; the agent environment throughput is the second permanent account. Putting Rollout down to the "deployment stage", RLVR's budget was wrong from the first day. **corrective action**: keep training and inference in one ledger, listing rollouts and environments separately in section 2 of the ADR.

### Mistake 5: Using 9.6% as the exact coefficient

It is an estimate of compute spending at specific laboratories, not a FLOPs share or an industry constant. “10 million GPU-hours ÷ 9.6% = total R&D budget” gives false precision. **corrective action**: The multiplier takes the 4--10 times range prior, and is calibrated quarterly using the forecast ledger.

### Mistake 6: Triage skipping

This RAG is based on RL (the searchable knowledge gaps are treated as behavioral gaps for training, and data updates cannot catch up with document changes); the de novo evaluation is based on LoRA (it hits the base ceiling after six months). **corrective action**: First spend the evaluation budget on gap diagnosis, and then spend the training budget.

### Mistake 7: Dare to start work without ADR paragraphs 8 and 9

A decision-making record without alternatives and exit conditions is essentially a "post-incident ratification document." If the team goes bankrupt, they can only start over. **corrective action**: When establishing the project, paragraph 8 must list at least two rejected routes and the reasons for rejection; the rollback signal in paragraph 9 is written into the training monitoring alarm.

---

## 🎯 Quick check

```quiz
{
  "question": "The team's task is to question and answer the company's internal documents: the documents are updated every week, and the answers are required to cite the source of the original text. The answer error rate of the ready-made open weight model after access to the retrieval is acceptable. What's the most reasonable route?",
  "options": [
    "Start LoRA fine-tuning immediately and \"train\" document knowledge into the model to avoid the trouble of retrieval system operation and maintenance",
    "Train a small model in a field from scratch, the data is completely controllable, and it saves the most money in the long run",
    "Prioritize Prompt/RAG/Tool calling route: Knowledge gaps are filled by retrieval, document updates are done through the index database; training is left to \"behavior gaps that cannot be resolved by retrieval\""
  ],
  "answer": 2,
  "explanation": "The first step in triage is gap diagnosis: when there is a knowledge/fact gap and the model capability is sufficient, training is expensive. The weekly update of the document means that any \"trained\" knowledge will expire. Training budget should be reserved for behaviors, preferences, and verifiable tasks that cannot be filled by retrieval."
}
```

```quiz
{
  "question": "Regarding \"GLM-5.3 and GLM-5.2 have the same base model, Terminal-Bench 3.0 is from 4.6 to 28.3\", which of the following readings is correct?",
  "options": [
    "measurement bases and limitations must be brought: This is the official model card report value and about six times the change of the same benchmark version (28.3÷4.6≈6.2), proving that post-training arrangement may bring about magnitude changes; but it is only a terminal agentic benchmark, and it cannot be inferred that all tasks are equally improved, and the same post-training is accompanied by a doubling of the security change of ExploitBench",
    "28.3 is about six times that of 4.6, which means that any task can be improved by about six times after training with this set",
    "The score shows that the base of GLM-5.2 is defective, and post-training only made up for the debt of the base"
  ],
  "answer": 0,
  "explanation": "The official self-reported value of a single benchmark family can only prove that \"the post-training arrangement is high leverage\" and cannot be extrapolated to the entire task; capability gains and safety risks (dual-use discussion, see T10) must be read together. Terminal-Bench is not comparable across versions (2.0/3.0/4.0)."
}
```

```quiz
{
  "question": "The team downloaded the complete weights of an open weight model (approximately 5.6TB, 2.8T total parameter MoE). Which of the following conclusions is true?",
  "options": [
    "The weights are open, which means that its training data and compute ledger are also open, and the recipe can be copied directly",
    "Open weight, transparent training, and self-deployment are three independent propositions: the training token and card are not disclosed with the weight; the volume of about 5.6TB means that consumer-grade hardware is difficult to carry, but the deployability also depends on the quantized version, inference framework and cluster solution, and cannot be derived in one step only from the file size",
    "It is open but cannot run, indicating that the manufacturer is falsely promoting it and this model is not considered open source"
  ],
  "answer": 1,
  "explanation": "\"Open weights ≠ transparent training ≠ self-deployable.\" The weight of K3.1 Pro is about 5.6TB (reported measurement basis), which shows that deployment is an independent engineering issue; it is also impossible to conclude that \"absolutely not deployable\" based on the file size. The three layers must be evaluated separately before base selection can be made."
}
```

```quiz
{
  "question": "In the sequential RL formula of GLM-5, why is there an on-policy cross-stage distillation added at the end of the pipeline?",
  "options": [
    "Distillation is cheaper than RL, and using it instead of the last RL stage saves computational effort",
    "The official clearly admits that multi-stage sequential RL will erode the skills of the early stage (the later stages will crowd out the abilities trained earlier), and the on-policy distillation of the final stage is responsible for bringing back the early abilities - the stage arrangement must pay for the \"regression caused by the sequence\"",
    "Because the SFT data is not enough, distillation can only be used to supplement the data amount"
  ],
  "answer": 1,
  "explanation": "This is the core price of orchestration: the sequence is not a free list. Each stage you enter is betting on the previous stage. Replay, hybrid training, and cross-stage distillation are three debt repayment tools. Copying the assembly line instead of copying the repair section is equivalent to only copying half of the bill."
}
```

```quiz
{
  "question": "At a review, someone proposes: “The final run needs 10 million GPU-hours. Working backward from Epoch’s 9.6% share, the total R&D budget is 10 million ÷ 9.6% ≈ 104 million GPU-hours, precise to the last GPU-hour.” What is wrong with this?",
  "options": [
    "No problem, 9.6% is the peer-reviewed industry constant",
    "The problem is just the number of decimal places - it should be rounded to the nearest ten thousand",
    "9.6% is the \"compute expenditure estimate\" of a specific laboratory, not the actual proportion of FLOPs, nor an industry constant; the multiplier should only be used as an interval prior of 4-10 times, and calibrated quarterly using the team's forecast ledger. Pseudo-accuracy to the single digit is misuse"
  ],
  "answer": 2,
  "explanation": "measurement basis discipline (established in T02 and reiterated in this chapter): 9.6%/22.6% is a compute spending estimate, which mixes the purchase prices of different years; and only covers the estimated several companies. The direction (eventually Run is only a minority) is reliable, and the proportion cannot be copied."
}
```

---

## Chapter summary

- Diagnose the information, behavior, ability and system gaps first, keep the "no training" candidate, and then decide on the stage and base.
- Independent acceptance at each stage: subsequent training needs to demonstrate marginal benefits while recording capacity forgetting, sampling, environmental and repair costs.
- A complete ADR should include alternatives, budget, evidence and exit conditions. If there is no new evidence to support it, it will not automatically move to the next stage.

---

## Closing: put the eight decision dimensions into an ADR

After finishing Chapter 11, aligning the eight-level coordinate system of the introduction with the nine-segment ADR of this chapter is all there is to this special topic:

```text
① Capability target ──── ADR Paragraph 1 (Testability of T02 + Triage in this chapter)
② Training materials ──── ADR Section 3 (T03 recipe and quality scorecard)
③ Learning signal ──── ADR segment 6 (T07 preference / T08 verifiable reward)
④ Credit allocation ──── ADR segment 6 (T08 group baseline / T09 Critic and process signal)
⑤ Optimization method ──── ADR paragraph 6 (respective selection of T06--T09, concluded in the triage and arrangement of this chapter)
⑥ Models and components ── ADR Section 4/5 (T04 architecture + T05 system components and GPU role)
⑦ System topology ──── ADR Section 5 (T05 parallelism and fault tolerance + T09 asynchronous topology)
⑧ Promotion evidence ──── ADR paragraph 7/9 (T10 release gates + forecast ledger and rollback)
Budget, risk, rollback (paragraphs 2/8/9) span all eight layers - they are the cyclical system of the entire machine
```

The templates of each chapter can be imported into complete records according to the following correspondence:

| chapter | Engineering products | Position in ADR |
|---|---|---|
| T02 | Training Budget Calculator | Paragraph 2 (this chapter is expanded into a full version) |
| T03 | Data Recipe ＋ Data Quality Scorecard | Paragraph 3 |
| T04 | Model Architecture ADR | Paragraph 4 |
| T05 | Distributed Training Configuration | Paragraph 5 |
| T06 | SFT／Distillation Strategy | Paragraph 6 |
| T07 | Reward Model Design ＆ Calibration Report | Paragraph 6 |
| T08 | RLVR Training Plan | Paragraph 6 |
| T09 | Agent Environment Specification | Paragraph 5/6 |
| T10 | Safety ＆ Evaluation Gate | Paragraph 7 |
| T11 | End-to-End Training ADR (overall system) | Full text |

Then, how to use this topic from today on:

1. **Check back with an empty Training ADR. **When encountering any training proposal, first fill in the first paragraph (Is the goal testable? What is not allowed to be rolled back?). Whichever paragraph is stuck, go back to the corresponding chapter: budget is stuck in T02, data is stuck in T03, system is stuck in T05, signal is stuck in T06--T09, and release gates is stuck in T10.
2. **Write measurement basis and identity for each number. **General staff or activation, training token or rollout token, which benchmark version, official disclosure or estimate or hypothesis - one of the four choices is marked next to the number. The starting point of every overturn judgment in this special topic is an unspecified number.
3. **Reuse reasoning, do not copy answers. **GLM-5’s recipe, Inkling’s ledger, GLM-5.3’s six times, Epoch’s multiplier—all are solutions under the constraints of others. Before copying into your ADR, re-walk the causal chain to confirm that the constraints are isomorphic.
4. **Use the forecast ledger to turn each deviation into a priori. **Budgets will be wrong, extrapolation will be wrong, and triage will be wrong; make them wrong and attributable, and the next decision will be based on this error.

There is no finish line to training decisions—each released model is a fork in the road to the next base. But as long as the eight-layer coordinate system is still there and the nine-segment ADR is still being updated, what you face is not a fog, but a series of engineering problems that can be solved one by one.

Going back to the contract assistant in the introduction: from discovering extraction errors, to selecting data and training methods, to confirming whether it can be released, every step has assumptions that need to be verified. Keep these evidences so that the next person who takes over can understand the current plan and continue to modify it when constraints change.

---

## Terminology reference

| Terminology | How can beginners understand first |
|---|---|
| Training route triage | Diagnose the nature of the ability gap first, and then decide on the level selection process of no training/fine-tuning/strengthening/re-training |
| Sequential RL | GLM-5's name for its multi-stage post-training of "SFT→Reasoning→Agentic→General"; the official admits that the order will erode the skills of the previous stage |
| On-policy Distillation (OPD) | Distillation guided by stronger Teacher live sampling with current policy; GLM-5 fallback with its ability to fix sequential RL |
| Base reuse | The new generation model does not retrain the base model, but only retrains it on the old base (the route of GLM-5.3, K3.1 Pro) |
| model family | Branch families derived from the same base based on deployment form and task domain: Base/Instruct/Reasoning/Coding/Agent/Small |
| open weight | Can obtain parameter files and licenses; does not promise that the training formula will be disclosed, nor does it promise that ordinary hardware can run |
| Training Transparency/Open Ledger | Able to recalculate other people’s training tokens, GPU-hours and recipes - this is the layer you need to learn budget decision-making |
| Training and pushing ratio | The distribution relationship between training and inference (including RL sampling) compute; Rollout is a permanent part of the training bill |
| sampler : trainer | The compute ratio between the sampling side and the training side in RL training (Inkling disclosed 5:3, the sampling side is larger) |
| hidden multiplier | Failures, ablations, data pipelines, evaluation, and other work behind the final run make the R&D bill several times larger than the final run itself |
| Expenditure estimate | Figures such as Epoch’s 9.6% are estimates of “compute expenditures”, not actual FLOPs proportions, nor industry constants |
| Training ADR | Nine-stage training decision-making record: goals/budget/data/structure/system/post-training arrangement/evaluation and safety/risks and alternatives/rollback |

---

## Related links

- Entrance within the topic: [T01 · Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [T02 · Scaling is not about copying proportions: three general ledgers](/en/tutorial/t02-scaling-budget-three-ledgers/) · [T09 · Agentic RL: Environment, credit allocation and asynchronous topology](/en/tutorial/t09-agentic-rl-environment-credit-async/) · [T10 · Security specifications, full life cycle evaluation and release release gates](/en/tutorial/t10-safety-spec-evaluation-gate/)
- Cases and data: [GLM-5.3 official release](https://z.ai/blog/glm-5.3) · [GLM-5 technical report](https://arxiv.org/abs/2602.15763) · [Kimi K3.1 Pro Official Blog](https://www.kimi.ai/blog/kimi-k3-1-pro) · [Qwen3.8-Max release page](https://qwen.ai/blog?id=qwen3.8) · [Mistral Large 4 Open Weight Announcement](https://mistral.ai/news/mistral-large-4-oss) · [Inkling 2 Small training ledger](https://thinkingmachines.ai/news/inkling-2-small) · [Epoch AI: The final training run only accounts for a minority of R&D compute](https://epochai.substack.com/p/final-training-runs-account-for-a) · [Epoch AI Trends](https://epoch.ai/trends)
