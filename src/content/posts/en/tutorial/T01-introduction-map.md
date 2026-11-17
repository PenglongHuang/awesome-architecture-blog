---
title: "T01 · Understanding model training: from pre-training to post-training"
description: "Use contract extraction to distinguish demonstrations, preference optimization and reinforcement learning, and connect learning signals to model architecture and training systems."
series: "model-training"
order: 1
pubDate: 2026-11-09
updatedDate: 2026-11-10
kind: "tutorial"
tags: ["Model training decisions","Training decisions","Model training"]
locale: "en"
translationKey: "tutorial/t01-introduction-map"
sourceHash: "964054da26f5a98e573962c1c15c3d303c6c6ec2eea7099d92c0a2369ae83d01"
---

A model may understand a contract yet still fail to extract payment dates, amounts and obligations in the required format. It may omit fields, copy a date incorrectly, or invent a value that the original document does not contain.

“Train it some more” is an easy response, but does not specify what should change. Does the model need more contract knowledge, a new output format, or better handling of uncertainty? Different goals require different data, methods and evaluation.

This chapter establishes those distinctions. Later chapters examine budgets, data, model architecture and particular training methods.

## 1. Where a model's existing capabilities come from

Before seeing our extraction task, the model can already read Chinese, recognize dates and amounts, and produce coherent explanations. Much of that capability comes from pre-training.

A common pre-training objective is next-token prediction. A token is a unit the model reads and writes: a Chinese character, a word or part of a word. Given preceding text, the model predicts subsequent tokens and updates its parameters based on the difference between its predictions and the training text.

For example, given “This contract shall, from the date both parties sign and stamp it, become”, the next word might be “effective”. The model assigns probabilities to possible continuations. Repeating this over large collections of text develops linguistic structure, knowledge associations and some problem-solving patterns. Actual training involves much more data, compute and optimization complexity, but this is a useful starting point.

The result is usually called a **base model**. Its capabilities do not necessarily translate into reliable instruction following or the desired behavior. Continuing contract-like text and accurately extracting fields from this particular contract are different tasks.

Post-training adapts the model for instruction following, tool use, preferences and safety requirements. SFT, preference optimization and reinforcement learning may all appear here. “Fine-tuning” generally means continuing to train existing parameters; the objective and update method still need to be specified.

```text
Large-scale data -> Pre-training -> Base model -> Post-training
                -> Candidate model -> Evaluation and deployment
```

With open-weight models, work often begins partway through this sequence. Insufficient resources for pre-training from scratch do not prevent improving an existing model. First measure what it can already do and where the actual gaps lie.

## 2. Different ways to teach the same task

Return to the simplified contract-extraction task: read the original text, fill a fixed set of fields and leave absent information empty.

We can initially avoid training. Put field definitions, formatting requirements and a few examples into the prompt, and supply the complete source document. If this meets the requirement, adding training solely for this task is unnecessary. Investigate only the remaining gap after checking prompts, information supply and existing capabilities.

### Show the correct behavior

For unstable formatting or incorrect handling of missing fields, prepare demonstrations of “contract excerpt -> correct extraction” and use **supervised fine-tuning, SFT**.

The model learns to generate the demonstrated target tokens given the input. How examples handle missing fields and cite source passages shapes the behavior learned. Training only on complete, tidy contracts may leave failures on missing pages, ambiguity or disorganized input.

Demonstrations from another model can support one form of distillation. Other forms use teacher probability distributions and related signals; T06 discusses the mechanisms. Regardless of whether examples come from people or models, test transfer to unseen contracts.

### Compare the trade-offs between answers

When the task expands to explaining risk, two answers may cite the correct clauses while differing in their treatment of uncertainty. A single reference string is insufficient, but one answer may still be preferable.

Preference data records the same input, two candidate answers and which is preferred. DPO can optimize the policy directly from these pairs. Another approach trains a reward model and uses its scores in subsequent optimization.

Agree on the comparison criteria first. If annotators prefer length or confident wording, training may reinforce those features without improving factual accuracy.

### Let the model try and learn from outcomes

For reliably checkable fields such as dates and amounts, have the current model generate outputs and let a program verify them to produce rewards. Reinforcement learning from such verifiable rewards is commonly called **RLVR**.

The verifier itself needs careful design. Dates have multiple formats, amounts may include or exclude tax, and attachments may amend the main contract. A simplistic comparison can reject correct answers or accept errors. Rising rewards justify a claim of improvement only when the verifier is reliable and independent evaluation improves too.

RLVR describes the source of reward, not the parameter-update method. PPO and GRPO affect advantage estimation, auxiliary value models and sampling organization; T08 examines their mechanisms and assumptions.

These methods may be combined or used independently. Choose based on the actual capability gap and available feedback. Field extraction does not inherently require preference optimization, and a single-turn task need not become a multi-turn agent merely to support training.

## 3. What else must be in place after choosing a method?

Suppose we begin with SFT. Concrete questions follow: where do demonstrations come from, are the contracts licensed for use, are train and test sets near-duplicates, will the model fit the available GPUs, and how long will an experiment take?

Online reinforcement learning adds repeated generation, verification and feedback to the trainer. A model attempt is commonly called a **rollout**, and the model being trained is the **policy**. Sampling consumes inference resources; verification may call tools or run tests. These are part of the real cost.

Distinguish three related objects:

- **Model architecture:** how the forward computation works, including Dense or MoE structure, attention and context length.
- **Training method:** which signals and objectives update parameters, such as SFT, DPO, PPO or GRPO.
- **Training system:** how data, models and compute are organized for parallelism, sampling, saving and recovery.

These constrain each other. A larger model changes memory and communication requirements. Online sampling adds components and scheduling work. Final paper scores alone cannot establish suitability for your resources and task.

Later chapters use eight dimensions to inspect a plan:

| Dimension | Contract-extraction example |
|---|---|
| Capability target | Which fields need better accuracy, and which existing capabilities must remain |
| Training material | Where contracts, demonstrations, preference pairs or generated attempts come from |
| Learning signal | Demonstrated targets, human preferences or programmatic verification |
| Credit assignment | How the quality of an entire answer or one step influences updates |
| Optimization | The objective and parameter-update method |
| Models and auxiliary components | Whether a reference, reward or value model is needed in addition to the policy |
| System topology | Resource allocation and synchronization between sampling and training |
| Promotion evidence | Independent results needed to advance a candidate to the next stage |

Some chapters call this the “eight-layer coordinate system.” It is a discussion outline whose dimensions interact, not a mandatory execution sequence.

## 4. What establishes a genuine training improvement?

If the trained model improves on demonstration contracts but still fails on new templates, question whether it has memorized familiar wording. If extraction improves while general instruction following degrades, account for that cost.

Prepare independent evaluations and comparison rules before experiments. Check extracted values, missing-information handling and citations separately, and check for test leakage into training. In multi-stage training, retain checkpoints and regression results at each stage so improvements and regressions can be attributed.

These records also guide further investment. If SFT already meets the requirements, reinforcement learning may be unnecessary. If reward scores rise without independent-test improvements, revisit the task, data and verifier.

The series uses a **Training ADR**, an architecture decision record for training. It preserves assumptions and trade-offs that are otherwise easy to lose. Here is a short outline; T11 works through a complete contract-assistant example.

```markdown
1. Capability target: desired improvement, measurement and capabilities to preserve
2. Workload and material: input shape, sources and usage restrictions
3. Learning signal and credit assignment: feedback source and its use in updates
4. Candidates and assumptions: options and the conditions each requires
5. Decision: current choice and reasons
6. System effects: changes to data, components, resources and operation
7. Costs and failure modes: expenditure, risks and ways the plan can fail
8. Validation and promotion gates: comparisons, independent evaluation and acceptance
9. Exit conditions: when to stop, change approach or roll back
```

## 5. How to read the rest of the series

With the relationship between pre-training and post-training in view, choose chapters around your questions. In order, T02–T05 cover budget, material, model and system; T06–T09 examine learning signals; T10–T11 cover evaluation, release and longer-term investment. Readers adapting an existing model may start with T06 and revisit the necessary foundations.

| Chapter | Main topic |
|---|---|
| [T02 · Training budget](/en/tutorial/t02-scaling-budget-three-ledgers/) | Put training, inference and R&D expenditure into one budget |
| [T03 · Data engineering](/en/tutorial/t03-data-recipe-quality-synthesis/) | Data mixtures, quality, synthesis and targeted training |
| [T04 · Model architecture](/en/tutorial/t04-model-architecture-joint-decisions/) | Capacity, context and modality trade-offs |
| [T05 · Training systems](/en/tutorial/t05-training-system-distributed-topology/) | Memory, parallelism, precision and fault recovery |
| [T06 · SFT and distillation](/en/tutorial/t06-sft-distillation-transfer-boundary/) | Learning from demonstrations and testing transfer |
| [T07 · Preference optimization](/en/tutorial/t07-preference-reward-calibration/) | Preferences, reward models, DPO and over-optimization |
| [T08 · Verifiable rewards](/en/tutorial/t08-rlvr-prerequisites-attribution-health/) | Verifiers, PPO/GRPO and evaluating gains |
| [T09 · Agentic RL](/en/tutorial/t09-agentic-rl-environment-credit-async/) | Tool environments, long-horizon trajectories and asynchronous training |
| [T10 · Safety and evaluation](/en/tutorial/t10-safety-spec-evaluation-gate/) | Safety specifications, independent evaluation and release criteria |
| [T11 · Training strategy](/en/tutorial/t11-orchestration-lifecycle-strategy/) | Stage selection, orchestration and a complete ADR |

This introduction explains the broad purposes of different training approaches. Later derivations use basic knowledge of Transformers, gradient descent, GPU memory and throughput, but assume no particular training framework. Consult the terminology references when needed.

Next, the budget: how model size and training-token counts translate into compute, GPU-hours and cost.

## Quick check

```quiz
{
  "question": "A team asks whether RLHF or PPO is better. What should it do first?",
  "options": [
    "Compare the latest leaderboards directly",
    "Correct the categories: RLHF describes workflows using human feedback, while PPO is one possible policy-update method within such a workflow; both can coexist",
    "Assume PPO costs less because its name is shorter"
  ],
  "answer": 1,
  "explanation": "The concepts answer different questions. InstructGPT is a classic RLHF workflow using PPO. Before choosing A or B, check whether they occupy the same decision layer."
}
```

```quiz
{
  "question": "A team wants a model to fix issues through dozens of steps in a real repository. Which chapter is the primary decision setting?",
  "options": [
    "T04, model architecture, because this is fundamentally a structural question",
    "T02, budgeting, because only money matters",
    "T09, Agentic RL, because the core concerns are environments, long-horizon trajectories and credit assignment"
  ],
  "answer": 2,
  "explanation": "Learning signals from long-horizon interaction, environment engineering and asynchronous training topology are T09's focus. Model architecture and budget are adjacent constraints."
}
```

```quiz
{
  "question": "Are verifier scoring and critic estimation of future outcomes at the same decision layer?",
  "options": [
    "No: the former concerns feedback sources and implementation, while the latter concerns credit assignment and value estimation",
    "Yes: both are scoring machines",
    "Yes: both are optimization methods"
  ],
  "answer": 0,
  "explanation": "A verifier supplies a reward for the observed result. A critic estimates expected future value from the current state. Both may participate in one training run but serve different purposes; T08 explains the mechanisms."
}
```

```quiz
{
  "question": "A review discusses (a) memory and communication after adopting MoE, (b) DPO versus PPO updates, and (c) separating rollout and training clusters. How do the three architecture categories apply?",
  "options": [
    "(a) training method, (b) model architecture, (c) training method",
    "(a) model architecture, (b) training method, (c) training-system architecture",
    "All three are training-system architecture because they occur on a cluster"
  ],
  "answer": 1,
  "explanation": "Model architecture changes computation, such as MoE routing and experts. Training methods change the signals and objectives driving updates. Training-system architecture organizes the components that run the method. These correspond to T04, T06–T09 and T05 respectively."
}
```

---

## Related links

- [Architecture decision records and evolution](/en/tutorial/adr-and-evolution/)
- [InstructGPT: training language models with human feedback](https://arxiv.org/abs/2203.02155)
- [DPO: direct preference optimization](https://arxiv.org/abs/2305.18290)
- [DeepSeekMath: the origin of GRPO](https://arxiv.org/abs/2402.03300)
- [The PPO paper](https://arxiv.org/abs/1707.06347)
