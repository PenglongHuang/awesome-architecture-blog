---
title: "T06 · SFT and distillation: learning to generalize or memorizing answers?"
description: "Examine what SFT, LoRA and distillation transfer, and use independent tasks to test demonstration coverage, teacher signals and capability retention."
series: "model-training"
order: 6
pubDate: 2026-11-14
kind: "tutorial"
tags: ["Model training decisions","SFT","Knowledge distillation","LoRA"]
locale: "en"
translationKey: "tutorial/t06-sft-distillation-transfer-boundary"
sourceHash: "64ca6b94c47fdb5312f3844797a635eb1b60e822e4653c1f2f1188876f958919"
---

## Memorizing answers without solving new problems

Let’s first look at an engineering site (teaching synthetic scene, numbers are schematic; but the phenomenon is not synthetic – the 2026 case in Sections 5 and 6 of this chapter will give its real version).

A team took over the newly offline Base Model from the pre-training main line (T02--T05) products, with a simple goal: to turn it into a capable assistant. The approach is also the one most familiar to the industry:

- The data set took six weeks to annotate **50,000 instruction–answer demonstrations**, perform SFT after manual quality inspection, and train for two epochs;
- Everything went well on demo day: the model followed instructions, answered to the point, spoke appropriately, declined harmful requests—the format, style, and structure were all right;
- Two weeks later, the business was connected to two new types of tasks (long document extraction, multiple rounds of clarification questions and answers), and the model began to "talk nonsense according to the format": the structure was beautiful, and the content was stable and wrong;
- Review evaluation: 82% pass on questions **from the demonstration distribution**, but only 41% on **new question types**;
- Stress response is a pile of data - the demonstration was expanded to 250,000 items (same batch of labeling specifications, same type of task form) and another round of training, the pass rate of the new question type was 41% → 44%.

| Evaluation measurement basis | 50,000 demonstrations | 250,000 demonstrations | what does change mean |
|---|---:|---:|---|
| Identical distribution question type (same type as the demonstration) | 82% | 88% | Still growing: the formats and mission modes can really be stacked up |
| New question types (outside distribution) | 41% | 44% | Hardly moving: these 200,000 cannot buy off-distribution capabilities |

The same model, the same training method, the two report cards are talking about two things. The first one is called **Training set fitting** ——The model learned "what this kind of question should look like"; the second picture is called **Capability transfer** ——The model applies the solutions in the demonstration to unseen tasks. Only the former can be purchased in bulk. This is not a failure of the annotation team, but rather a demonstration of the nature of the signal itself: **Demonstration tells the model "what it looks like correctly", but does not tell it "why it is right", let alone "how to come back after making a mistake".**

> Pretraining establishes basic capabilities. Making a model answer, reason, and perform tasks in a specified way requires choosing the right learning signal. Start with learning from demonstrations.

This chapter breaks down "learning from demonstration": what exactly does SFT teach (Section 1), how deep should you write the parameters (Section 2), moving demonstrations from other models is called distillation, what is moved (Section 3), why the distribution of data comes from is a watershed (Section 4), why multi-stage training causes the previous teaching to be lost (Section 5), and how to prove that it is all worth it (Section 6).

Demonstration learning can first be understood using the following relationship:

| spectral level row | Minimum training data | Requires online Rollout | Who defines "better"? | typical cost |
|---|---|---|---|---|
| **Demonstration** (SFT/Distillation, T06) | Prompt + sample answer | No; see the on-policy distillation exception in section 4 | person who writes demonstrations | Upper limit subject to demonstration quality and coverage |

The last three rows (preferences, verifiable rewards, and environmental rewards) are expanded from T07 to T09 respectively. The judgment sentence pattern that appears repeatedly in this chapter - "Can this be taught through demonstration?" - asks: whether the target ability falls within the typical cost of the first line.

The derivation route of this chapter:

```text
Section 1 The learning mechanism of SFT: What does loss count and what can be learned through demonstration?
    ↓
Section 2 Writing Depth: LoRA/PEFT and the Boundary of Full Parameter Fine-tuning
    ↓
Section 3: distillation—what transfers from teacher to student?
    ↓
Section 4 On-policy and Off-policy distillation: whose distribution the data comes from
    ↓
Section 5 Ability retention and forgetting: Hidden bills of multi-stage training (GLM-5 case)
    ↓
Section 6 Gain Attribution: Is Distillation and Post-Training Gain Worth It (GLM-5.3 / K3.1 Pro Case)
    ↓
Section 7 Engineering Products: SFT / Distillation Strategy
```

First, **demonstration data has two counting units**: examples, where one prompt–answer pair counts as one, and tokens, the total length of the demonstrated answers. At 800 tokens each, 50,000 examples contain about 40 million tokens. Inkling 2 Small’s H4 stage uses about 34B trajectory tokens, equivalent to more than 40 million 800-token examples purely as a scale illustration. Their data forms are completely different. Converting units prevents misleading comparisons between “50,000 examples” and “34B tokens.”

---

## 1. What SFT learns from demonstrations

### 1. What does the loss count: only train for each Token in the demonstration answer part

**SFT (Supervised Fine-Tuning)** continues training a base model on prompt–demonstration pairs. Mechanically, it still predicts the next token, but computes loss only for tokens in the **demonstrated response**:

```text
[Prompt part] Please organize the key terms of this contract into a table..
                 ↑ These Tokens do not count losses (the model does not need to learn "what users will say")
[Answer part] OK, the following is organized by clause number:| 1 | rent | …
                 ↑ Calculate the loss token by token: make the probability of each next step in the demonstration higher
                 ↑ Optimization goal = average of all Token losses in the demonstration answers
```

This is **Token-level Loss**: SFT has no task-level signal saying an answer is correct. It has stepwise signals saying a token is closer to the demonstration. Break down one demonstration (a teaching example):

```text
A demonstration: Prompt 200 Token + Answer 300 Token
During training: only each of the 300 positions of the answer generates a loss
       The question at each position is "I saw the same thing above, what should I do next?"
Final update direction = average gradient of parameters over 300 position losses
Meaning: Each "next step" in the demonstration votes equally to decide which direction the parameters should go——
     What the model learns is "the order and content of these 300 steps", not "whether this question is correct or not"
```

This perspective directly explains the opening scene - the model can accurately learn the pattern of "say 'yes' first, then give the form, and then finish it" because there are demonstrations for each step to imitate; but "how to accurately extract terms from a pile of contracts" if the base cannot, the demonstration only shows the results, not the process.

Now consider one detail of training: **Teacher Forcing** ——Every step of prediction in training is conditioned on "the correct description of the demonstration", and the model has never been trained in a situation where "it wrote the wrong previous step". It has not learned how to recover from errors because errors do not occur in the demonstration. This is not an SFT bug, but a boundary of the demonstration signal: **Demonstrations are a collection of successful cases, not a collection of error correction processes.**

### 2. Data volume and epochs: why “one more epoch” often moves you backward

The demonstration data is usually not large (relative to pre-training), so a practical temptation is to run it for a few more epochs. Here’s a hint of what will happen (the curve is a teaching hint, not any real experiment):

```text
Validation set loss
 │＼
 │  ＼                    ___———

 │     ＼＿          ———

 │         ＿＿＿—— ← End of epoch 1: Close to optimal

 │                  ＼＿＿＿
 │                          ＼＿＿＿＿ ← epoch 3+: training loss keeps falling,
 └───────────────────────────────→ Training epoch verification loss begins to rise
     The training loss decreases monotonically; the verification loss decreases first and then increases
```

**Falling training loss with rising validation loss** signals a shift from learning patterns to memorizing examples: the model remembers these 50,000 records rather than generalizing their solutions. Following T03’s data-ablation discipline, **prioritize additional data over additional epochs**. The validation distribution must differ from the demonstrations; otherwise this curve cannot expose the problem, as the opening same-distribution evaluation illustrates.

### 3. Four variables of the demonstration data

The same “50,000 examples” can produce entirely different results at different quality levels. The data methodology from T03—quality scoring, ablations, and comparisons under a fixed budget—applies here too. Add four SFT-specific variables:

| variable | what does it decide | Common pitfalls |
|---|---|---|
| quality | How clean is the thing to move parameters into for each Token? | A perfectly formatted but factually incorrect demonstration is a negative equity |
| Cover | Which task forms have appeared in the demonstration? | Without coverage, the model can only be supported by the generalization of the base |
| difficulty | Distance between demonstration solution and base capability | It is far more difficult than the demonstration on the base. Learning is about memorizing rather than solving the problem |
| Diversity | Variance of expressions and paths under the same task form | Demonstration of a single style narrows the model into a tone |

In the opening scene, 200,000 pieces of data cannot buy off-distribution capabilities. The problem lies in coverage and difficulty: the new data has the same shape and difficulty as the original data. What is expanded is the "area of known islands", not the "length of the coastline."

### 4. What SFT teaches: an honest list

Putting the two popular statements of "1,000 demonstrations can achieve alignment" and "SFT can only teach format" to the evidence, the list is as follows:

| SFT can stabilize the church | Dependencies | SFT is not often taught |
|---|---|---|
| Output format, style, structure | A few high-quality demonstrations are enough | Knowledge and skills that the base does not have at all |
| Task patterns (“this kind of problem is solved this way”) | Demonstration coverage in place | Migration of tasks outside the coverage |
| Behavioral Boundaries (Rejection, Clarification, Quotation) | There should be positive and negative examples in the demonstration | Judgment beyond demonstration quality |
| part of knowledge and skills | The base has seeds and demonstrates the path | Recover from errors, self-correct |

Two historical anchors anchor the two ends of this list.

**The low end: teaching a format can be inexpensive.** [LIMA](https://arxiv.org/abs/2305.11206) (Zhou et al., 2023, a historical anchor) fine-tuned a 65B base model with **1,000 curated demonstrations**. Human evaluations found it comparable to contemporary strong instruction models in a substantial share of conversations. The authors proposed superficial alignment: most knowledge and capability come from pretraining, while alignment mainly teaches preferred interaction forms. For an already strong base model, demonstration quality and selection can matter far more than quantity.

**The high end: demonstrations alone do not establish a capability ceiling.** InstructGPT’s original procedure (2022; [paper](https://arxiv.org/abs/2203.02155)) put SFT first, followed by a reward model and PPO. It did not assign the entire task of improving capability to the demonstration stage.

### 5. The narrative trend in 2026: SFT is the off-policy imitation stage

In 2026 practice, a clear but **unsettled** narrative positions **SFT as off-policy imitation that teaches formats and patterns, with most capability gains coming from RL**. Practitioner articles carrying it include “Why off-policy training isn’t enough: SFT, RL, and the limits of distillation” (2026-03-25) and “On-policy distillation, part 1: the 2026 open-model post-training” (2026-07-08). These are not peer-reviewed papers; their titles and dates come from this topic’s evidence library. The narrative also matches the [GLM-5 report’s](https://arxiv.org/abs/2602.15763) orchestration: SFT establishes a base, followed by three RL stages for capability.

But before writing it into discipline, three qualifications must be added:

- "SFT can only teach format" is an over-compression of the narrative - the left column of the above table is what SFT can teach, and the benefits depend on the data, model and training settings;
- "Capacity improvement mainly comes from RL" lacks a pure SFT comparison with the budget in most public reports, and is an empirical judgment rather than a controlled conclusion;
- This trend describes the practice of flagship and head-end open source models, and small models and vertical scenarios may not be isomorphic.

> **Limits of the claim:** A narrative can suggest where to start investigating, but it cannot replace your own controlled experiments. “SFT teaches formats; RL improves capabilities” is a useful prior, not a conclusion that lets you skip validation. Your model, data, and tasks need their own ablations to settle the question.

---

## 2. Depth of adaptation: LoRA, PEFT and full fine-tuning

### 1. Same batch of demonstrations, three writing methods

After deciding to use SFT, the first system choice is **update depth**: how many parameters will change. Three typical scopes follow:

```text
Full parameter fine-tuning (Full FT): W ← W + ΔW, all parameters are updated
Fine-tuning of the head layer/adaptation layer: only move the output layer or add a small module (the parameter amount is usually <1%)
LoRA (low-rank adaptation): W is frozen, and a low-rank bypass is added next to ΔW = B·A
                        Trainable parameters ≈ r × (d_in + d_out),
                        When r=8/16, it is usually less than 1% of the total parameters
```

**LoRA (Low-Rank Adaptation)** is a method that belongs to the same family as **PEFT (Parameter-Efficient Fine-Tuning)**. The intuition is that the weight change caused by fine-tuning itself is low-rank - it can express the direction of "this adaptation" without moving all the parameters. With fewer trainable parameters, the optimizer state is proportionally reduced. This is the source of its memory-saving mechanism.

### 2. A video deposit account that can be recalculated (teaching instructions)

Why is optimizer state a key variable? Take AdamW training as an example (the values ​​are teaching instructions, the mechanism is real; the complete four memory accounts are in T05):

```text
Assuming 7B Dense model, BF16 parameters + FP32 optimizer status

Full parameter fine-tuning:
  Parameter 7B × 2 bytes = 14 GB
  Gradient 7B × 2 bytes = 14 GB
  Optimizer state 7B × 8 bytes = 56 GB ← One move: memorize two copies of each trainable parameter
  (Momentum and Variance, 4 bytes each) FP32 status
  The total is only "parameters + gradient + status" ≈ 84 GB, not counting the activation value

LoRA (r=16, only the bypass is trainable, the trainable parameter is set to 0.5%):
  Parameters 7B × 2 bytes = 14 GB (frozen, can share the same base)
  Gradient + state: only based on 35M trainable parameters ≈ 0.35 GB
  The incremental part is two orders of magnitude smaller
```

**What this means:** full-parameter training versus LoRA determines whether each task needs a complete copy of training state, not merely a small speed difference. This enables the multi-tenant, swappable-adapter serving setup from section 2: one frozen base model stays in GPU memory while adapters of tens of MB switch per request.

```text
Serving configurations (illustrative):
Full parameter fine-tuning products: [Model A] [Model B] [Model C] Each has a complete weight and is deployed separately
LoRA Products: [Freezing Base] + {Adapter A | Adapter B | Adapter C}
               The base is resident, and the adapter is hot-swapped on request - the order of magnitude difference between GPU memory and operation and maintenance
```

### 3. Comparison of the two accounts

| accounts | LoRA / PEFT | Full parameter fine-tuning |
|---|---|---|
| Trainable parameters | Less than 1% of total parameters (typical configuration) | 100% |
| Optimizer state memory | Only overrides bypass parameters | Covers all parameters (see the illustrative ledger above) |
| Target domain learning upper limit | Constrained by low-rank incremental expressiveness | Highest limit |
| Disturbance to the base | The base freezes and the disturbance is limited to the bypass | All parameters may drift |
| risk of forgetting | lower | higher |
| Engineering form | Adapters are pluggable, hot-swappable, and multi-tenant | Each version is a checkpoint of complete weights |

The table’s “ceiling” row is easy to misread. [“LoRA Learns Less and Forgets Less”](https://arxiv.org/abs/2405.09673) (Biderman et al., 2024, preprint) compares code and mathematics training and finds that **LoRA learns less in the target domain but also forgets less of the source domain than full-parameter training**. These findings belong together. Citing only “LoRA is safer” or “full-parameter training is stronger” gives half the result. **Update depth chooses a point between learning new material and forgetting old capabilities, rather than merely between spending and saving money.**

### 4. How to choose: start from target capabilities and regression evaluation

| Judgment input | Prefer LoRA / PEFT | Tend to full parameters |
|---|---|---|
| The nature of the target capability | New format, new behavior, new tone – base knowledge is enough | Inject a lot of new knowledge/skills beyond the expressive range of low-rank increments |
| Base protection requirements | Multi-tenants share a base, plugging and unplugging adapters by task | Accept general ability rollback, and have regression evaluation to back it up |
| GPU memory budget | Want to back optimizer state only for bypass parameters | You can afford the optimizer states for full-parameter training (return to T05 to calculate the memory budget first) |
| iteration rhythm | Adapter versioning and second-level rollback | Each version has complete weight, and storage and distribution costs are high |

There is no rule to choose LoRA simply because a model is small. **Target capabilities and protected capabilities** determine update depth. A 7B model absorbing a new domain may justify full-parameter training; a 300B model needing a different response format may need only LoRA.

> **Architectural wisdom: **LoRA is not "full-parameter fine-tuning with a 20% budget discount", but another trade-off: using the learning upper limit of the target domain in exchange for the stability and engineering flexibility of the base. The correct question when reviewing "whether to use LoRA" is not "which one is cheaper", but "can the low-rank increment of what is to be written this time be accommodated? After writing in depth, which capabilities are not allowed to be used?"

---

## 3. What distillation transfers from teacher to student

### 1. Three types of transportation objects

Demonstrations do not have to be written by humans. **Distillation** transfers learning signals from one model (the Teacher) to another (the Student). There are three forms, depending on what is transferred:

| Type | Moving object | Data form | Prerequisites |
|---|---|---|---|
| Logit Distillation | Teacher’s probability distribution at each position (soft label) | Need to access Teacher’s logits when Student is trained | Usually the same word list or alignment is required, and the Teacher is always online |
| Response Distillation | Complete answer generated by Teacher | The answer text itself is equivalent to "Demonstration data comes from Teacher" | Just output text from Teacher, available offline |
| Reasoning Trace Distillation | Teacher’s complete reasoning track (including process) | Long thought chain/sequence of steps | Trajectory quality determines the upper limit, often equipped with correctness filtering |

Response and trace distillation use SFT’s training mechanism. The difference is **whose distribution supplies the demonstrations**: human experts or another model. Logit distillation transfers the Teacher’s probability distribution at each position, rather than only the selected token. Soft labels carry more information than one answer, but require more engineering support.

Why are soft labels valuable? Look at a teaching illustration (the numbers are made-up intuitive examples):

```text
At a certain location, the context is "The sum of the interior angles of a triangle is ____"
Hard tag (normal SFT/Response distillation): answer "180" → 1 word of information
Soft labels (Logit distillation):
  Teacher's distribution: "180" 0.82 | "One hundred and eighty" 0.09 | "360" 0.02 | …
Meaning: The soft label incidentally tells the Student
  - Which expressions are synonymous ("180" is close to "one hundred and eighty")
  - Errors also vary far and wide ("360" is not a random error, but a confusion of adjacent concepts)
  - Teacher's degree of certainty about this step (0.82, not 1.0)
Each position on a trajectory has such a distribution → the information density is much higher than that of plain text
Cost: Every step of Student training must obtain Teacher’s logits in real time
     (All vocabulary lists are stored offline and the storage capacity is expanded according to the size of the vocabulary × the number of Tokens)
```

Therefore, the engineering forms of the three are progressive: Response distillation only requires text (can be offline and can be stocked), Trace distillation requires long trajectories (offline but high filtering costs), and Logit distillation requires online access to Teacher’s internal output (the heaviest and most information-dense). Choosing objects to transport is essentially a matter of choice **How much infrastructure fee to pay for the amount of information per Token**。

### 2. Historical anchor: R1-Distill made trajectory distillation a standard practice

[DeepSeek-R1 paper](https://arxiv.org/abs/2501.12948) (2025, Origins of Methods/Historical Anchors)’s distillation experiments are an iconic node in this route. Thesis report: **Distilling the inference output generated by R1 to small models (using about 800,000 samples sampled by R1 to do SFT, and the students are Qwen/Llama Department 1.5B--70B Dense models), the effect is better than doing RL directly on these small models under the current configuration**. This set of comparisons (measurement basis: paper experimental settings) gave birth to the R1-Distill series of practices that are still used in the open source circle today: the small SFT model of Teacher's trajectory.

Why can "Teacher trajectory + SFT" beat "small model own RL"? Mechanical intuition: **RL for reasoning tasks relies on exploration** ——The small model samples by itself, so it is difficult to encounter the correct solution, the rewards are sparse, and the learning is slow; while the Teacher has solidified the "searched solution" in the trajectory, and distillation is equal to **Discount the search costs paid by Teacher to students in one lump sum**. This also exposes its cost structure: Teacher's inference compute to generate 800,000 trajectories is the price of this "discount".

The teaching value lies in the conclusion’s **limits**:

- The comparison object is "the current RL recipe + these small models" - the conclusion cannot be extrapolated to "distillation is always better than RL", let alone cross-scale and cross-task extrapolation;
- 800,000 trajectories means that the distillation bill includes Teacher’s inference cost (T02’s three ledgers are in effect here);
- The ability purchased by trajectory distillation is still limited to the student capacity. No matter how strong the teacher is, 1.5B cannot learn things that it cannot hold.

### 3. 2026 Case: H4 stage of Inkling 2 Small

For a current distillation example, [Inkling 2 Small’s official disclosure](https://thinkingmachines.ai/news/inkling-2-small) says H4 trains on **about 34B tokens of the highest-quality trajectories**, **primarily sampled from Kimi K3 and earlier in-house models**, then filtered for correctness and alignment.

This case first corrects an intuition: **Distillation doesn't have to be "big model → small model"**. Inkling 2 Small itself is a 594B total parameter/17B activated MoE, and the teacher is a Kimi K3 with 2.8T total parameters - as long as the learning signal comes from the distribution of another model, it is distillation. There are three active disciplines it displays:

- Teacher-generated trajectories must **pass correctness and alignment filters individually**. Teachers make mistakes; accepting everything transfers those mistakes too;
- Trajectories are **assets purchased with inference compute**. H3 and H4 together use about 354B trajectory tokens, according to official disclosures, so distillation budgets must include Teacher sampling;
- Distillation is just a section of this pipeline (H1/H2 pre-training → H3/H4 trajectory training → RL), and is not a silver bullet that replaces other stages.

### 4. Teacher selection list

| Check | question | Unqualified look |
|---|---|---|
| Ability matching | Teacher is independently evaluated to be stronger than Student base in target abilities | Just looking at Teacher's reputation, the target ability happens to be its weakness |
| error rate | Can build errors be caught by the filter pipeline? | Teacher error rate is higher than filter budget |
| Same measurement basis | Vocabulary/format/tool protocol compatible or mappable with Student | The track is full of private formats that Student cannot learn |
| License and Terms | Is the authorization for the output to be used as training data clear? | Use competing product API to output distillation, the terms are unclear |
| Stability | Will the Teacher version be interrupted by upgrades? | Teacher is replaced halfway through distillation, and the data before and after are not homogeneous |

### 5. Four failure modes

| failure mode | phenomenon | root cause |
|---|---|---|
| measurement basis recitation | Student has learned Teacher’s expression habits and structure, but not the solution | Demonstrations only have results, and the process is beyond the student’s understanding or demonstration coverage |
| Wrong migration | Where Teacher made a mistake, Student followed suit | There is no correctness filtering, or the filtering standards are misaligned with the target capabilities |
| Teacher deviation transfer | Teacher's style, tendencies, and formatting habits are learned as "knowledge" | Style and capability are mixed together in the soft labels or trajectories and cannot be separated |
| Capacity limit | It won’t increase even if you add data | Student parameter volume and structure cannot accommodate the target capability |

### 6. The comparison principle: distillation must beat direct training under the same budget

Determining whether distillation is worth it, benchmarks **No** "Student is better than it was" - that's almost certainly true because there's no comparison. Honest attribution requires at least two sets of comparisons:

```text
Control group A: direct training with the same budget
  Same compute/data budget, no need for Teacher,
  Continue training directly on the Student base (continue pre-training + SFT/RL)
  → Distillation wins, which proves that "Teacher's signal" itself is valuable

Control group B: inference cost comparison
  Distilled Student vs Directly Deployed Teacher
  → Student is only worth existing if it is cheaper in the "task range with sufficient abilities"
```

The conclusion of the R1 paper is weighty precisely because it makes a type A comparison (distillation vs. direct RL); the reason why the 50,000 demonstrations at the beginning are not convincing is because the 250,000 demonstrations did not even separately verify "whether the same distribution stack is useful". Control group B brings in the inference amortization ledger of T02: Whether it is cost-effective for the Teacher to generate 34B Token traces and spread it over the entire life cycle of the Student is a product decision, not a training decision.

Combine the judgments from section 3 to here into a decision tree:

```text
Can the ability to be migrated be reached by the base/student?
 ├─ Within reach → Format and pattern categories: direct SFT (human-written or synthetic demonstration)
 └─ Out of reach → Are other people’s models within reach?
      ├─ Out of Reach → Distilled Useless: Capability exceeds the upper limit of available signals (capacity/license/cost)
      └─ Within reach → What to use it for?
           ├─ As long as the result (answer) → Response distillation + correctness filtering
           ├─ Process (reasoning) → Trace distillation (note the upper limit of Student capacity)
           └─ To gradually align the distribution → Logit distillation / OPD (Section 4)
```

> **Judgment boundaries:** "Distillation is effective" is always a statement with a measurement basis: which Teacher, which Student, what task distribution, who is compared, and how the budget is fixed. "Distillation is better than RL" or "RL is better than distillation" without the measurement basis is to regard an experiment as a theorem.

---

## 4. On-policy and off-policy distillation: whose distribution?

### 1. The problem started when Student went astray for the first time

All distillation forms in section 3 share one property: the Student learns from the **Teacher’s output distribution**. This is **off-policy or offline distillation**, with a structural weakness related to, but more severe than, Teacher Forcing in section 1:

```text
Off-policy distilled data flow:
  Prompt → Teacher Generate Demonstration → Filter → Static Data Set → SFT Student
                                          ↓
                          Students learn "what a teacher would do"
                          But every step that Student takes after going online comes from its own distribution;
                          Once it forks with Teacher at the beginning, there is no demonstration to teach it back on track

On-policy distillation (OPD) data flow:
  Prompt → Student's own Rollout generates trajectory (online)
                ↓
          Teacher gives signals to Student’s trajectory segment by segment/Token by token
          (soft label, per-token loss or sequence-level preference)
                ↓
          Students are corrected on their "own distribution" - learn wherever you make mistakes
```

**On-policy** means **the current model generates its own training attempts**, not “open to the public.” Learning signals therefore address states the Student actually visits. In **OPD (On-policy Distillation)**, the Teacher evaluates what the next step should be on the Student’s own attempts, instead of supplying an independent standard answer.

A minimal comparison illustrates the difference (teaching example):

```text
Task: Multi-step calculation A → B → C
Typical student mistakes: Choosing the wrong path in the first step, and then following the wrong path

Off-policy distillation: Demonstration is always "the correct path A→B→C",
  Those states with wrong beginnings of Student do not exist in the training data → No one can correct the wrong states

OPD: Student goes out A→B'→C'' (its own true distribution),
  Teacher gives control signals at B' and C'', which are "positions where students will really go"
  → Correction occurs where students actually make mistakes
```

### 2. Benefits, costs, risks

| Dimensions | Description |
|---|---|
| Benefit: Fix distribution shift | Students are corrected on the distribution in which they make mistakes, rather than on the Teacher's perfect distribution |
| Benefit: Exposing true weaknesses | Student's systemic weaknesses will not appear at all in the off-policy data - it is not involved in data generation |
| Cost: Online Infrastructure | Continuous rollout of Student and resident grading by Teacher are required, and all online data pipeline and synchronization problems occur (system bill for T05/T09) |
| Risk: Teacher bias will still migrate | Changing the data source does not mean changing the ability source - Teacher is wrong, and Student is wrong in his own distribution |
| Risk: One level higher complexity | Sampling, filtering, signal feedback, and version synchronization: what is one batch script offline becomes an entire system online |

Offline SFT and off-policy distillation usually read prepared material. **OPD instead has the Student generate attempts during training and the Teacher provide feedback**, forming a generation–update loop. Demonstration signals can therefore be used online; signal type alone does not determine whether a sampling system is necessary.

### 3. When is it worth moving distillation online?

| Judgment input | Favors off-policy learning (offline distillation or SFT) | Tendency to on-policy (OPD) |
|---|---|---|
| Distribution distance between Student and Teacher | The task form is close, and Student can roughly reproduce it | Student is easy to go astray at the beginning and has many mistakes |
| cost of error | Offline evaluation can be saved | Error conditions need to be corrected explicitly (e.g. multi-step tasks) |
| infrastructure | Only batch training stack | Existing rollout pipeline and Teacher resident service (or willing to build) |
| budget | Teacher sampling one-time payment | Teacher’s continuous billing + rollout compute continues to occur |

### 4. The three levels of evidence are not allowed to impersonate each other

The most confusing thing in the OPD discussion is the three statements of different strengths and weaknesses:

| Hierarchy | Statement content | Evidence corresponding to this chapter |
|---|---|---|
| The method proposed in the paper | Mechanism, experimental settings, applicable boundaries | The mechanism and experiments of OPD come from research literature (methodological layer) |
| Specific practices in model reporting | How to use a certain model in your own pipeline and report the self-report effect | GLM-5 Report: Cross-stage on-policy distillation repair capability rollback in the final stage (Section 5 Teardown) |
| Industry popularity | How many teams are using it and whether it is a "central technology" | "OPD becomes the central technology for post-open source training in 2026" comes from the narrative of the 2026 practice article (the two cited in the first and fourth sections of this chapter). It is an observational judgment, not a conclusion |

Mixing the three layers produces reasoning such as “GLM-5 uses it, so it must be standard.” T01’s rule applies again: **reuse the reasoning rather than copy the answer**

> **Architectural wisdom: **The difference between off-policy and on-policy is essentially about who owns the "data distribution rights". The offline method gives the distribution to the point of data production (cheap, controllable, and will expire), and the online method gives the distribution to the current model (fresh, symptomatic, and requires a system). This trade-off line will run through T07 (preference data expiration), T08 (online rollout), T09 (Policy Lag) - set it up first at T06.

---

## 5. Retention and forgetting: the hidden cost of multi-stage training

### 1. The default outcome of sequential training is rollback

Post-training rarely consists of one stage. A typical sequence is SFT, capability-specific RL, and safety fine-tuning, each optimizing its own objective. The problem is that **there is only one parameter set**. Stage k moves it toward A’s optimum; stage k+1 moves it toward B’s optimum and may weaken A. In post-training, this is **Catastrophic Forgetting**, operationally described as **capability regression**.

It is not an accident, but the default outcome of multi-phase training. The only difference is: some teams discovered it using the capability matrix before release, and some did not.

### 2. Case study: GLM-5’s sequential RL and final distillation repair

[GLM-5 technical report](https://arxiv.org/abs/2602.15763) (2026-02, official disclosure) The post-training pipeline given is a complete specimen of this risk line. According to the original text of the report, it is organized as follows:

```text
GLM-5 post-training pipeline (official report measurement basis)
  SFT: Expand agent/coding data and introduce three thinking modes
    ↓
  Reasoning RL → Agentic RL → General RL
  (The report is called sequential RL: a sequential name for its own three stages, non-industry standard terminology)
    ↓
  Final paragraph: on-policy cross-stage distillation (cross-stage policy distillation)
    ↓
  Function: Repair the early stage ability regression caused by sequential RL
  (Officially clearly admits: multi-stage sequential RL will erode the skills of the previous stage, and the distillation stage is responsible for repairing it)
```

Three teaching points, each with measurement basis:

- **Fallback is officially recognized as existing**. This isn't outside speculation, it's the report's own statement: sequential RL stages erode skills established in previous stages. The flagship pipeline cannot escape oblivion, and the average team has no reason to assume they can.
- **Restoration is done with special money**. GLM-5 does not expect that "the more you train, the better it will be." Instead, it compiles a distillation section into the end of the pipeline and uses (according to the mechanism described in the report) cross-stage on-policy distillation to bring back the capabilities of the previous section. This means that in its budget table, **Forgotten hedges are explicit cost items**。
- **Reported benchmark anchors, with scope required:** SWE-bench Verified 77.8 and Terminal-Bench 2.0 56.2, reported as the highest open-source results at release. These are the report’s figures for TB 2.0, not comparable with TB 3.0 or 4.0; section 6 expands this distinction.

A hard rule: **This is a work report of GLM-5 on its own formula, not a proof of "sequential RL + terminal OPD" as a universal best practice. **What it proves is the structural fact that "multi-stage regression is a real risk and repair requires explicit engineering", not "you can get the same model by copying this sequence".

### 3. List of hedging methods

| Hedging means | practice | cost |
|---|---|---|
| Replay | Mix the data from the old stage into the new stage training | The data needs to be saved and the ratio needs to be adjusted to dilute the learning signal of new goals |
| mixed training | Multiple target data are trained in the same batch instead of serially in segments | Training scheduling is complicated, and multiple goals may interfere with each other |
| staged capability matrix | At the end of each stage, the full ability matrix is run. If the regression exceeds the threshold, promotion will be blocked | Evaluation itself requires compute and discipline (layer ⑧ release gates) |
| Cross-stage distillation repair | Use distillation in the final stage to bring back the capacity of the previous stage (GLM-5’s choice) | The full set of costs for one more stage: data, training, evaluation |

The four methods can coexist and are often combined. **Budget mitigation costs together with regression risk.** If forgetting requires a dedicated repair stage, its compute and data are inherent costs of the design, not incidental extras.

Take the replay as an example to experience "hedging is not free" (indicating the ratio, not any real formula):

```text
Training-data buckets for stage 3 (Agentic RL):
  ├─ New target data (agent trajectory) 70%
  ├─ replay: 1st SFT data 15% ← Ensure instruction compliance and format
  ├─ Replay: stage 2 Reasoning data 10% ← preserve the reasoning-chain format
  └─ Universal ability replay data 5% ← Ensure base generalization

Costs in both directions:
  Too little replay → after stage 3, capabilities from the first two stages regress and the matrix turns red
  Too much replay → the learning signal for the new objective is diluted, slowing progress in stage 3 itself
How to determine the ratio? There is no a priori answer - use the retreat amplitude of the capability matrix to reversely calibrate:
  The fallback exceeds the threshold → the replay share of the source is increased; there is no fallback for two consecutive rounds → it can be decreased
```

### 4. Ability Matrix: Forgotten release gates

Assess mitigation through the **capability matrix**, a table of capabilities against evaluation sets. T03’s attribution tool now serves as an acceptance gate:

```text
            Instruction following code mathematics long text extraction rejection boundary
After SFT 82 61 55 41 88
RL-After the code segment 80 74 54 40 86 ← The code increased, and the rest basically held
RL-After the general segment 71 58 60 39 84 ← General rose, the code retreated obviously!
After the final section is repaired 79 71 59 41 87 ← The repair section pulls back the rollback
(Teaching schematic figures, not any real model; release gates logic is real)
```

There is only one release gates rule: ** Promotion depends on the entire matrix, not the highest score in a single column. **Which column's regression is unacceptable should be written into paragraph 8 of the Training ADR (Verification and Promotion release gates) before training begins, rather than making up for it after the incident.

The matrix itself also has accounts: each grid is one (or multiple) evaluation runs. The more complete the matrix and the denser the rounds, the more considerable the evaluation compute will be. The pragmatic approach is to layer - **Core lines must be tested at each stage (target capabilities + known high regression risk items), and the entire matrix will be run before release**;This is the same thing in two stages as the layered evaluation of the T10.

> **Judgment boundaries:** "New capabilities are improved and old capabilities are degraded" is not a failure, it is the normal state of multi-stage training; the failure is to release the rollback without a matrix, no threshold, and no repair plan. GLM-5’s final distillation description: At flagship scale, forgetting hedging is already a first-class citizen of the assembly line, not an aftercare job.

---

## 6. Attribute gains and decide whether distillation is worthwhile

### 1. First arrange the control group

Section 5 asks "Is there any rollback?" and this section asks "Is the gain itself worth it?" The attribution framework follows the two comparisons in Section 3 and expands it into three questions:

```text
Question 1: Which signal does the gain come from?
  SFT? Distillation? RL? Data? — Fix the budget and ablate each stage, rather than reporting only the final score for the entire pipeline
Question 2: Relative to what?
  Direct training comparison with the same budget (control group A in Section 3) + inference cost comparison (control group B)
Question 3: Which account does the price go into?
  Teacher sampling fee, return repair fee, and evaluation fee—all are recorded in T02’s R&D ledger
```

The following two 2026 cases answer "How big can the post-training gain be" and "How to read the measurement basis of the gain" respectively.

### 2. Case study: GLM-5.3—the same base model, with post-training rewritten

The [GLM-5.3 announcement](https://z.ai/blog/glm-5.3) and [official model card](https://huggingface.co/zai-org/GLM-5.3) (2026-08-14) provide a useful comparison, using officially reported results on the same benchmark version:

| indicator | GLM-5.2 | GLM-5.3 | change |
|---|---:|---:|---|
| Base Model | 744B General Staff-A40B activation (official measurement basis) | The same base model, no retraining | The base remains unchanged |
| Terminal-Bench 3.0 | 4.6 | 28.3 | About 6× |
| DeepSWE v1.1 | 46.2 | 66.9 | ＋20.7 |
| Agents' Last Exam | 23.8 | 28.5 | ＋4.7 |

What this set of numbers means for post-training decisions:

- **The final training arrangement can be the main variable of ability. **The base did not cost a penny (compared to pre-training), and the capability gap all comes from the rewritten post-training pipeline. T01 uses this set of numbers to illustrate the magnitude of post-training, and the usage in this chapter goes one step further: it is also the upper limit evidence of the "demonstration + distillation + RL combo" - the same base, but different signal designs. The difference between 4.6 and 28.3 on Terminal-Bench 3.0 is the difference between signal and arrangement.
- **Do not extrapolate the 6× gain.** Agents’ Last Exam only moves from 23.8 to 28.5, roughly 20%. Gains differ by an order of magnitude across tasks. Post-training can have large effects; claiming every task has 6× headroom misreads the table. **Interpret ratios against their absolute starting scores**: 4.6 → 28.3, roughly 6×, and 46.2 → 66.9, a +20.7-point gain, may be two views of a similar improvement.
- **Returns and risks come from the same source. **In the official disclosure, the ExploitBench score doubled (network offensive and defensive capabilities, official measurement basis), which triggered dual-use security discussion - capability gain and security risk are the same coin, and the judgment standard is launched at T10.

### 3. Case dismantling: Kimi K3.1 Pro - three-month post-training iteration

[Kimi K3.1 Pro](https://huggingface.co/moonshotai/Kimi-K3.1-Pro) (Dark Side of the Moon, released on 2026-10-23) gives another measurement basis of post-training gain (the data are all measurement bases of quoted public materials):

- Native multi-modal agentic MoE with 2.8T total parameters - the same level as Kimi K3 three months ago (2026-07, official paper measurement basis 2.8T total parameters/104B activation/896 expert selection 16);
- Artificial Analysis' K3.1 Pro review article reports its AA Intelligence Index ranking of 4th and Terminal-Bench 4.0 score **65.7%** (Contains 86 CLI tasks);
- 2026-11-05 The weight will be opened as scheduled, and the material will be released about **5.6TB**; Agent Arena has the first open source weight (note: being the first in open source does not mean being the first in the entire field - the 2026-07 list is led by Claude Fable 5 (High), and Arena's own paper discloses that 83 open source models only account for 29.7% of the list data, and the representativeness of open source is controversial).

Both numbers must be "translated" live:

- **What 5.6TB means:** 5.6TB ÷ 2.8T total parameters is about 2 bytes per parameter, consistent with BF16 weights. This is the article’s inference; the official release defines the actual format. Consumer single-machine deployment remains impractical: **open weights do not imply local deployability**. T02 distinguishes open weights, transparent training ledgers, and self-hostability. K3’s training tokens and GPU-hours are undisclosed, so its ledger is not transparent.
- **A new generation every three months without changing total parameter scale** suggests the publicly described changes are mainly in post-training and data. But the cited materials do not disclose whether the base model is fully reused. Equal parameter scale is not proof of an identical base model; do not state that K3.1 Pro fully reuses K3’s base without an official disclosure. **Treat reuse as fact only when it is disclosed; otherwise it remains a hypothesis.**

### 4. A high-frequency turning point: the version measurement basis of Terminal-Bench

This chapter has quoted three Terminal-Bench scores, which belong to three versions **Not comparable across versions**：

| score | model | Baseline version | Legal comparison range |
|---|---|---|---|
| 56.2 | GLM-5 | Terminal-Bench 2.0 | Can only be compared with TB 2.0 score |
| 4.6 → 28.3 | GLM-5.2 → GLM-5.3 (same base) | Terminal-Bench 3.0 | In-version control works (that's why it's valuable) |
| 65.7% | Kimi K3.1 Pro | Terminal-Bench 4.0 (with 86 CLI tasks) | Can only be compared with TB 4.0 score |

Direct comparison across versions (for example, comparing 65.7% and 28.3 to "who is better") is the most common silent error in review quotes: the task sets have been changed, and the scores are not on the same scale. The baseline version number must accompany the score before being included in any report.

### 5. Attribution Checklist

| Check | substandard performance | qualifying standards |
|---|---|---|
| control group | Only better than "Student's past" or "Rehearsal within training distribution" | Direct training comparison with the same budget + inference cost comparison |
| Signal ablation | The entire assembly line only reports the final score | Segmented attribution: SFT/Distillation/RL respective contributions can be separated |
| regression check | Only look at target ability | All items in the capability matrix, with the fallback threshold stated in advance |
| independent review | Evaluation set that has the same origin as the training data | Off-distribution tasks, independent evaluation, multiple runs |
| Complete measurement basis | Naked fraction, naked parameter quantity | Benchmark version, parameter definition (total / active), training stage, and evaluator |

### 5.1 Return Sanwen to the opening scene

Use this table to revisit the opening team’s situation; the problematic row becomes clear:

| Three questions | Actual answers from the opening team | Judgment |
|---|---|---|
| Which signal does the gain come from? | Only one SFT stage, with no ablations; the 250,000-example run varied only data volume, without separating distributions | Partially qualified: the single variable has been changed correctly, but the distribution has not been split |
| Relative to what? | Only compare with yourself (50,000 → 250,000 versions); no budget comparison, no inference cost issues | Unqualified |
| Which account does the price go into? | Only the labeling cost is calculated; the false sense of security caused by mixed evaluation measurement bases (same distribution set) is not calculated | Unqualified |

If the team could do only one thing, **turn the 41% result on new question types into explicit capability targets and acceptance metrics** at layer ①. Then decide whether to expand coverage at layer ②, change update depth at layer ⑤, or introduce Teacher distillation as a different distribution source at layer ②. Arguments about methods often originate in unclear capability and data requirements.

### 6. Spectrum’s next level preview

Every method in this chapter shares a ceiling: **demonstrations transmit solutions someone already knows**. When several answers are reasonable, demonstrations alone do not define which is better. When correctness is objective but solutions need exploration, demonstrations transfer only solutions the Teacher has found. T07’s preferences address the former; T08’s verifiable rewards address the latter. Consider changing signal level when additional same-distribution data and controlled distillation stop helping while the target capability remains out of reach.

> **Architectural wisdom:** "Our model has become stronger" is a marketing statement; "Under the same base, the same benchmark version, and the same budget comparison, this set of signals has brought about this set of matrix changes, and the fallback is within the threshold" is an engineering statement. Every gain from post-training should be able to be recounted using this checklist.

---

## 7. Engineering artifact: SFT and Distillation Strategy

Convert the judgments from this chapter into a table that can be brought directly into the review. Each field has a corresponding "reject if unqualified" standard:

| Field | What to fill in | Return to standard (example) |
|---|---|---|
| Target capabilities and acceptance indicators | What capabilities should be migrated; what evaluation should be used to determine; which capabilities should not be rolled back | Untestable goals such as "better to use" |
| Demonstration source and distribution | Human annotation/Teacher generation/mixing; which task forms are covered; distance from online distribution | The source is unknown, or does not coincide with the target task form |
| Teacher selection and filtering | Who, what version, what are the strengths; correctness filtering criteria | Teacher ability has not been independently evaluated; tracks are not filtered |
| Student capacity | Base and parameter measurement basis; whether the capacity can accommodate the target capacity | The target capacity obviously exceeds the capacity and no budget comparison has been made |
| write depth | LoRA/PEFT/full parameters; basis (target nature + fallback list) | "You have enough budget, so take part in everything" is an unfounded choice |
| data strategy | on-policy/off-policy; online infrastructure requirements; Teacher sampling cost accounting | Select on-policy but no rollout system budget |
| Stage arrangement and forgetting hedging | Sequence of each stage; replay/mixing/repair section; capability matrix access threshold | Multi-stage serialization without any backoff detection |
| Controlled experiment | Direct-training comparison at the same budget; inference-cost comparison; ablation plan | Missing control group A or B |
| Acceptance of release gates | Full matrix promotion line; independent evaluation; exit conditions | View only the target list |

Apply the table to the opening scenario (illustrative): “general assistant” is not a testable target. Replace it with thresholds for instruction following, long-document extraction, and multi-turn clarification, with no more than a 3-point regression in general capability. The gap becomes visible: the 50,000 demonstrations do not cover long-document extraction. The 41% new-task score begins with **layer ② training material failing to match layer ① capability targets**. The table exposes that assumption before compute is spent.

This table corresponds to the nine-segment skeleton of Training ADR for T01: Field 1 corresponds to segment 1 (ability goals), fields 2--3 correspond to segment 2 (training materials), fields 4--7 correspond to segments 3--6 (signals, candidate solutions, and system impact), and fields 8--9 correspond to segment 8 (verification and promotion access). After learning T07--T09, it will grow into a complete Training ADR (the capstone of T11).

---

## 8. Six common reasoning errors

### Mistake 1: Treating SFT as a universal key to teaching ability

What SFT stably teaches is format, task mode and behavioral boundaries; the upper limit of ability is constrained by demonstration quality and coverage. In 2026, "SFT is an off-policy imitation stage, and capability improvement mainly comes from RL" is a practical trend worthy of reference, but it is an empirical narrative, not a theorem that can be skipped for verification - your scenario needs to be judged by your own comparison.

### Mistake 2: Mistaking "accurate retelling" as "capacity transfer"

82% inside the training distribution and 41% outside the distribution are two transcripts. To evaluate SFT/Distillation, only look at the same distribution evaluation, which is equivalent to only looking at the first one. Qualified transfer evidence must include out-of-distribution task and capability matrices and be defined before training begins.

### Mistake 3: Treating LoRA as a "cheap full reference"

The conjoined conclusion of "LoRA Learns Less and Forgets Less" is: LoRA learns less in the target domain and forgets less in the source domain. It is not a discounted version with full parameters, but another trade-off of "learning upper limit for base stability and engineering flexibility". The decision inputs are target capabilities and non-returnable lists, not price lists.

### Mistake 4: Distillation is only compared to the Student himself

"It is stronger after distillation than before distillation" is almost certainly true because there is a lack of control. Attribution must go through at least two doors: direct training comparison with the same budget (to prove that the Teacher signal itself is valuable) and inference cost comparison (to prove that Student is cheaper and more sufficient than directly deploying Teacher).

### Mistake 5: Teacher’s output is accepted as written

Teachers make mistakes, have stylistic deviations, and have soft labels and tracks mixed with abilities and shortcomings. Distillation without correctness filtering and alignment filtering is to move the Teacher's error distribution into the Student - the filtering process of Inkling 2 Small H4 is not optional.

### Mistake 6: Multi-stage training without regression evaluation

Multiple targets are optimized sequentially, and there is only one copy of the parameters. The ability regression is the default ending rather than an accident. GLM-5 officially acknowledges the existence of regression and specially arranges the final distillation repair. A multi-stage pipeline without a capability matrix and promotion threshold is equivalent to leaving the opportunity to discover regression after going online.

---

## 🎯 Quick check

```quiz
{
  "question": "The team used 50,000 demonstrations to do SFT, with 82% of the same distribution evaluation and 41% of the new question types. After the demonstration was expanded to 250,000 items (the same batch of specifications and the same type of tasks), the number of new question types only reached 44%. What is the most reasonable judgment?",
  "options": [
    "If the learning rate is set incorrectly, new question types can be solved by re-adjusting the parameters",
    "The model capacity is not enough. You should directly replace it with a larger base",
    "This batch of demonstrations mainly teaches the format and task mode. The abilities required by the new question types are not in the demonstration distribution - you cannot buy out-of-distribution abilities by stacking the same distribution data. You should rewrite the target abilities and data coverage first, and then consider changing the signal (preference/verifiable reward) or distillation"
  ],
  "answer": 2,
  "explanation": "Distinguish between training set fitting and capability transfer: the same distribution 82→88 indicates that the format and mode are still being learned, and the out-of-distribution 41→44 indicates that the coverage gap has not been filled. The typical cost of the demonstration signal is that the upper limit is subject to quality and coverage constraints; first repair the ② layer (material and target alignment), and then talk about the ⑤ layer (change the method)."
}
```

```quiz
{
  "question": "Which judgment is correct in the following selection scenario between LoRA and full-parameter fine-tuning?",
  "options": [
    "LoRA is a cheap version of full reference. If you have enough budget, always choose full reference",
    "The goal is to add a new reply format to the shared base, retain common capabilities, and support multi-tenant hot-plugging. LoRA is usually sufficient; only when a large amount of new domain knowledge needs to be injected and universal capability rollbacks are accepted (with regression evaluations in place), full participation is preferred",
    "LoRA and full reference learn exactly the same thing, but the training speed is different"
  ],
  "answer": 1,
  "explanation": "Systematic experiment of \"LoRA Learns Less and Forgets Less\" (2024, preprint): LoRA learns less than full parameters in the target domain and forgets less about the source domain. The decision input to write depth is the nature of the target capabilities and the non-reversible list, not the parameter quantities or prices."
}
```

```quiz
{
  "question": "The GLM-5 report places on-policy cross-stage distillation at the end of the sequential RL pipeline. According to the original report, what is the role of this paragraph?",
  "options": [
    "Repair regression in earlier capabilities caused by the sequential RL stages—the official report explicitly acknowledges that sequential multi-stage training can erode earlier skills, and assigns the distillation stage to repair them",
    "Compress the total number of model parameters to a smaller size and reduce deployment costs",
    "Replace all RL stages and use one distillation to complete post-training"
  ],
  "answer": 0,
  "explanation": "According to the GLM-5 report (arXiv:2602.15763): SFT → Reasoning RL → Agentic RL → General RL, followed by cross-stage on-policy distillation to repair regression in earlier capabilities. Two limits matter: “sequential RL” is this report’s name for its own three-stage sequence, not an industry-standard term; this is the model team’s reported recipe, not a universal best practice."
}
```

```quiz
{
  "question": "To demonstrate that \"the distilled 7B student model is worth retaining,\" which of the following sets of evidence is closest to this chapter's attribution criteria?",
  "options": [
    "The student model is stronger than its previous version of SFT, and has a high accuracy rate in retelling questions that Teacher has given",
    "Evaluation scores of student models continue to rise within the training distribution",
    "Comparison with 7B for direct training with the same budget, and comparison with the inference cost of directly deploying Teacher, and without regression in independent evaluation and capability matrix"
  ],
  "answer": 2,
  "explanation": "Neither \"own past\" nor \"in-distribution retelling\" constitute evidence of migration - the former lacks comparison, while the latter is a hotbed for measurement basis recitation. Attribution must go through at least two gates: direct training comparison and inference cost comparison with the same budget, and the sampling fee for the demonstration generated by the Teacher must be recorded in the general ledger (T02 three ledgers)."
}
```

```quiz
{
  "question": "Three numbers: 56.2 on Terminal-Bench 2.0 (GLM-5), 4.6→28.3 on Terminal-Bench 3.0 (GLM-5.2→GLM-5.3), 65.7% on Terminal-Bench 4.0 (Kimi K3.1 Pro). Which of the following usages is legal?",
  "options": [
    "All three numbers are Terminal-Bench, direct ratio: 65.7% is the largest, so K3.1 Pro is better than GLM-5.3 in terminal tasks",
    "The three scores belong to three benchmark versions and cannot be compared across versions; what can be legally quoted is the intra-version comparison (such as 4.6→28.3 on the same base on TB 3.0), and must be consistent with the version number, model version, and reviewer measurement basis",
    "The Terminal-Bench scores have nothing to do with the version. They are all the same set of tasks, so there is no problem in comparing the size"
  ],
  "answer": 1,
  "explanation": "The task sets of TB 2.0/3.0/4.0 are different (4.0 contains 86 CLI tasks), and the scores are not on the same scale. Cross-model comparison must first align with the baseline version; intra-version comparison (same base, same version) is the value of the GLM-5.3 case."
}
```

---

## Chapter summary

- First write down whether the format, behavior or problem-solving ability is to be transferred, and then decide on the source of demonstration and training goals.
- LoRA/PEFT and full parameter update are trade-offs between resources and adaptation range; distillation also requires distinguishing answers, distributions and process signals.
- Use unseen tasks to test the migration and keep running capabilities against the same budget. Being able to recite training answers is not enough to prove learning.

> **Question for the next chapter:** Demonstration tells the model "what should be done", but for many tasks there are multiple reasonable answers. The next chapter discusses how to define preferences and turn them into optimizable reward signals.

---

## Terminology reference

| Terminology | How can beginners understand first |
|---|---|
| SFT (supervised fine-tuning) | Use "Prompt + Demonstration Answer" to continue training the base and increase the probability of each step in the demonstration answer |
| Token level loss | The actual amount of SFT optimization: only calculate the loss for each Token in the demonstration answer part and then average it |
| Teacher Forcing | Each step in training is conditioned on the correctness of the demonstration; the model never practices recovering from its own mistakes |
| LoRA / PEFT | Freeze the original weights and only train the low-rank increments next to them; a type of efficient fine-tuning of parameters |
| Full parameter fine-tuning | All parameters are updated; the upper limit is high, the memory is expensive, and the disturbance to old capabilities is large |
| Distillation | Let students learn from teachers: move soft labels, move answers, or move reasoning tracks |
| Response/Trace Distillation | Teacher generates answers or complete reasoning trajectories, which are filtered and used as demonstration data for Student |
| On-policy Distillation (OPD) | Students learn on their own online generated trajectories, and Teacher provides correction signals |
| Ability regression / forgetting | The later stage of training will reduce the abilities learned in the previous stage; the default risk of multi-stage training |
| Replay | Mix old phase data into new phase training to hedge against forgetting |
| competency matrix | "Ability Items |
| measurement basis recitation | Student has learned Teacher’s expression habits but not the solutions; a typical failure mode of distillation |

---

## Related links

- This series: [T01 · Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [T03 · More data is not always better](/en/tutorial/t03-data-recipe-quality-synthesis/) · [T05 · Training system is not operation and maintenance](/en/tutorial/t05-training-system-distributed-topology/) · [T07 · Preference is not a label quantity](/en/tutorial/t07-preference-reward-calibration/)
- 2026 Main Case: [GLM-5 technical report](https://arxiv.org/abs/2602.15763) · [GLM-5.3 official release](https://z.ai/blog/glm-5.3) · [GLM-5.3 official model card](https://huggingface.co/zai-org/GLM-5.3) · [Kimi K3.1 Pro weights page](https://huggingface.co/moonshotai/Kimi-K3.1-Pro) · [Artificial Analysis: K3.1 Pro evaluation](https://artificialanalysis.ai/articles/kimi-k3-1-pro-launch-benchmarks) · [Inkling 2 Small training ledger](https://thinkingmachines.ai/news/inkling-2-small)
- Method Origin/History Anchor: [DeepSeek-R1 (R1-Distill comparison)](https://arxiv.org/abs/2501.12948) · [LIMA：Less Is More for Alignment](https://arxiv.org/abs/2305.11206) · [LoRA Learns Less and Forgets Less (preprint)](https://arxiv.org/abs/2405.09673) · [InstructGPT](https://arxiv.org/abs/2203.02155)
