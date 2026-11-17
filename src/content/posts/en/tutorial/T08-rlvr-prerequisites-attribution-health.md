---
title: "T08 · Does a reference answer justify RLVR?"
description: "Use verifier quality, successful feedback, pass@k, maj@k and training-health curves to assess RLVR investment and distinguish PPO and GRPO assumptions."
series: "model-training"
order: 8
pubDate: 2026-11-16
kind: "tutorial"
tags: ["Model training decisions","RLVR","GRPO","Reinforcement learning"]
locale: "en"
translationKey: "tutorial/t08-rlvr-prerequisites-attribution-health"
sourceHash: "af28bf2ba021ff6a2f4faea3ac6c41e95571a76ec9377573aaed3b28a8aee391"
---

## One reference-answer prescription, three different outcomes

Let’s first look at an arithmetic example for easy checking: give the model `17 × 23`, let it try four times——

| try | model answer | Program check results |
|---|---|---:|
| A | 17 × 23 = 391 | 1 point |
| B | 17 × 23 = 381 | 0 points |
| C | 20 × 23 - 3 × 23 = 391 | 1 point |
| D | 17 × 23 = 401 | 0 points |

In this example, we want training to increase the probability of generating correct answers. This chapter starts with the next step - enlarging this table ten thousand times: tens of thousands of questions, dozens of parallel samples for each question, and continuous training for several days. After amplification, the prescription "there is a standard answer" will produce three completely different endings in the hands of three teams (the following is a synthetic scenario for teaching, the plot model comes from real cases reported publicly, and the numbers are for illustration):

- **Team A, math calculation problem**: The validator performs accurate numerical comparisons, and the answers are unambiguous. Training rewards have steadily increased, independent evaluations have increased simultaneously, and spot-check samples are indeed getting it right more often. This is a textbook script.
- **Team B, code question**: unit tests serve as the verifier, but cover only part of the task. Two weeks later, the training reward is nearly perfect. Human spot checks reveal that the model has learned output patterns tailored to the existing tests without solving the task itself. Rewards improved; capability did not.
- **Team C, Competition Level Mathematics**: the base model almost never solves these questions; all 16 samples per question score 0. There is no within-group contrast, the training curve stays flat, and the sampling bills keep arriving. After two weeks of compute, the main result is confirmation that “this set of questions cannot yet provide a useful training signal.”

The same prescription - "use standard answers as rewards" - three endings. The difference is not in "whether there is a standard answer", but in three things that are not written in the prescription: **Are rewards really reliable?** (Problem of Team B), **Whether the base is made correctly?** (Problem of Team C), **Whether the score that training improves is actually the score you need** (Another problem of Team B is also the main thread in the second half of this chapter).

The eight-layer framework makes the three teams’ failure points clear. Team B fails at layer ③ (learning signals: what the verifier measures no longer matches the task objective). Team C fails at the interface between layers ② and ③ (the training material yields no samples with a useful signal). Whether the improving score is actually the score you need belongs to layer ⑧ (evidence for promotion). One framework locates three failures. That sets this chapter’s route: repair the signal first (sections 2 and 3), then the readings (section 4), and finally the process and evidence (sections 6 and 7).

The derivation route of this chapter:

```text
Section 1 Basic training closed loop of RLVR (online loop and its bills)
    ↓
Section 2 Premise 1: Whether the reward is verifiable (correct rules ≠ complete reward)
    ↓
Section 3 Premise 2: Whether the base can provide success feedback (start-up check of sparse rewards)
    ↓
Section 4 What did RLVR buy: pass@k, maj@k and an undecided debate
    ↓
Section 5 Algorithm and objective function: Where does the baseline come from (PPO and GRPO)
    ↓
Section 6 Training and Health Panel: Joint Reading of Four Curves
    ↓
Section 7 Experimental Attribution and Stopping Conditions
    ↓
Section 8 Engineering Products: RLVR Training Plan
```

According to the number of the introduction, the position of this chapter in the eight-layer coordinate system:

```text
① Capability goals ── Which verifiable indicators should be improved and which capabilities should not be rolled back (a common prerequisite for the three teams)
② Training materials ── Section 3: Task difficulty and seeds (whether samples with signals can be collected from the materials)
③ Learning signal ── Section 2: Verifier and reward (how the program defines "right or wrong")
④ Signal granularity ── Section 5: Baseline and Advantage (should the credit fall on the entire answer or step by step)
⑤ Optimization method ── Section 5: PPO and GRPO (how to update parameters stably)
⑥ Auxiliary components ── Section 5: Critic, Reference, Verifier (whether a second model is required)
⑦ System topology — section 1: the online-loop bill (the complete asynchronous topology is in chapter 9)
⑧ Promotion evidence──Section 4, 6, 7: dual indicators, health panel, control and stopping conditions
```

In one sentence: layers ③, ④, and ⑤ are this chapter’s focus. Layers ①, ②, ⑦, and ⑧ appear only where they directly affect the learning signal; their own chapters cover them in full.

---

## 1. The RLVR loop: from a probability to an update

**RLVR (Reinforcement Learning from Verifiable Rewards)** starts with a simple idea: let the model attempt tasks, use a program to judge each attempt, and convert the results into parameter updates. The minimal loop below uses GRPO as an example; sampling groups for the same question and comparing within groups are features of this optimizer, not the definition of RLVR. With Critic-based PPO, verifiable rewards can also support value-baseline updates for individual trajectories:

```text
Task pool (Prompt, filtered by difficulty and ratio)
    ↓
┌─ Online loop: data generation and model update form a closed loop ───────────────────────────┐
│                                                              │
│  Sampling: The current model generates G Rollouts for the same question                     │
│        (The opening A/B/C/D is a group of G = 4)                        │
│    ↓                                                         │
│  Verification: Verifier determines whether it is right or wrong one by one → Reward (usually 1/0 or discrete points)      │
│    ↓                                                         │
│  Attribution: Convert "Who in this group is better than who" into Advantage                      │
│        (Positive: strengthen in the future; negative: suppress in the future)                             │
│    ↓                                                         │
│  Update: Adjust the probability of Policy by Advantage and return to sampling                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
    ↓ Sideline: every few steps, measure the target indicators and regression indicators on the independent evaluation set
```

The current model is the Policy; a complete attempt is a Rollout; its score is the Reward. Advantage measures performance relative to a baseline, and the Reference Policy constrains drift. The new component is the **Verifier**, the program judging attempts. It differs from the previous chapter’s Reward Model:

| Dimensions | Verifier | Reward Model (T07) |
|---|---|---|
| Scoring basis | Rules, standard answers, unit tests, environment status - program execution | A scoring model learned from human preference data |
| Fraction meaning | True or False (usually 0/1 or discrete) | Relative preference for "which is better" (continuous scalar) |
| Recurrence conditions | Fixed rules, inputs, environments, and random seeds; testing or external environments may still be uncertain | Fixed weights, input, preprocessing and deterministic reasoning configuration, repeatable scoring; generative review also requires controlled sampling |
| Main failure modes | Rule loopholes exploited (Section 2 of this chapter) | Scorer bias and overoptimization (T07, section 6) |
| suitable task | Tasks with objective right and wrong | Open-ended, multiple-reasonable-answer tasks |
| Decision-making position | Feedback sources + system implementation | Feedback sources + system implementation |

Repeatability and correctness are two dimensions: the same input is scored the same every time, which does not mean that the score reliably reflects the quality of the task. The statistical error, out-of-distribution deviation or drift after changing versions of RM does not mean that each score is random under a fixed configuration.

A quick self-examination: If you want to score by "feeling right", that's the Reward Model's place (back to T07); if you can use a program to recalculate, it's this chapter's turn.

Each link in the closed loop has its own typical failure mode. Let’s list them first, and then check them in the following sections:

| closed loop link | typical failure | This chapter belongs to |
|---|---|---|
| task pool | Difficulty mismatch: all right or all wrong, no signal in the group | Section 3 |
| sampling | The groups are incomparable, the temperature is inappropriate, and the length is out of control | Section 3, 6 |
| Verify | Loopholes in rules were exploited and misjudgments were poisoned | Section 2 |
| attribution | Baseline misalignment (critic bias or within-group variance is zero) | Section 5 |
| update | Excessive drift and deterioration of language skills | Section 5 (KL) and section 6 |
| Evaluation side line | Use the training pool as a test collection and measurement basis drift | Section 7 |

### "Online" is the cost source of this cycle

**Online refers to the cycle of data generation and model update** ——During training, the current model must continuously generate new attempts, and these attempts immediately become training data; **Offline route** (Demonstration, preference pair) The data is already prepared before starting work, and is only read repeatedly during training (the complete definition of the word on-policy and the accompanying Policy Lag mechanism is in Chapter 9). Online loops bring three overheads that offline routes don’t have:

| overhead | what does it mean |
|---|---|
| Sampling compute | The current model must be used for inference before each update step; an inference ledger grows in the training ledger |
| Data "expired" | The version of the generated data lags behind the version being trained (full mechanism Policy Lag in Chapter 9) |
| cycle fault surface | Any link of the sampling cluster, validator, and trainer is stuck, and the entire pipeline is shut down |

The account of sampling compute is worth experiencing on a real scale: [Inkling 2 Small](https://thinkingmachines.ai/news/inkling-2-small) The officially disclosed RL phase ran for 9 days and exceeded 17M Rollouts. The compute ratio of sampling and training is sampler:trainer = 5:3 - sampling is more expensive than training itself (T02 has opened this account). **RLVR is not "changing the loss function", but connecting the inference cluster into the training loop.**

### A bill of training steps: running the loop out by orders of magnitude

Then use a set of teaching figures to implement the "online loop" (all are illustrative values, the derivation method is real): Assume that each training step takes 512 prompts from the task pool, the group size G = 8, and each Rollout generates 1K Token on average——

```text
Sampling volume per step = 512 × 8 = 4,096 Rollout ≈ 4M generated Token
Amount of verification per step = 4,096 judgments (unit test types also need to run tests, which is more expensive)
If training takes 1,000 steps ≈ 4B, the sampling account of Token will be generated
    ↓ Note: This generation occurs on the training side, but is priced at the inference price
    ↓ This is where sampler : trainer = 5 : 3 comes from
```

Three direct inferences: every time the group size G doubles, the sampling account doubles; every time the average task response length doubles, the sampling account doubles again (the "response length" curve in Section 6 is therefore also a cost curve); a validator with high verification costs (real running test, real startup environment) will turn the verification itself into a second sampling account. Chapter 9 expands this set of loops into a complete asynchronous topology. Just remember: **The "return to sampling" arrow in the closed-loop diagram costs money every time it turns.**

> **Architectural wisdom:** Verifiable rewards describe the source of rewards and do not specify the optimizer. The same Verifier can be connected to GRPO's intra-group comparison, or to Critic-based PPO's single-track learning - treating "RLVR" as selecting an optimizer is the reappearance of the layering of "feedback source ≠ optimizer" in the introduction in this chapter. How to choose an optimizer will be expanded separately in Section 5.

---

## 2. Is the reward verifiable? Correct rules are not complete rewards

The three words "verifiable" are the easiest to read: it is thought that if the task has a standard answer, the reward will automatically be reliable. In fact the validator is an engineering object with its own quality dimensions and failure modes.

### 1. Validator families and their respective weaknesses

| validator type | Judgment method | Typical tasks | Main failure modes |
|---|---|---|---|
| Math answer comparison | Numerical or symbolic equivalence determination | calculations, math problems | Just compare the answer without checking the process, both "blind" and enumerated answers can score points |
| Unit testing | Run the test to see if it passes or not | Code generation and repair | Incomplete test coverage; the model overfits the test set and even manages to bypass or rewrite the tests |
| Compilation and static checking | Can it be compiled and linted? | Code, structured generation | Compiles ≠ correct; only syntax has been checked |
| structural constraints | schema, regularity, field verification | Formatted output, tool call | The model is filled with all possible values and passes the verification |
| environment final state | The status score of environmental arrival | Agent Mission (Chapter 9 Home) | States may be "manufactured" by side effects and difficult to attribute to steps |

### 2. Four dimensions of evaluating a validator

Break “can it judge correctly?” into four measurable questions:

| Dimensions | Questions asked | How to test |
|---|---|---|
| Coverage | What proportion of tasks can be judged by it? | Task pool sampling statistics "verifiable proportion" |
| False positive rate | How many are false positives (false positives) and false negatives (true false positives)? | Manually label a batch of samples and compare the output of the verifier |
| Verification cost | How much compute and time does each judgment take? | If the unit tests are really run and the environment is really started, it will eat up the budget |
| Resistant to reward exploitation | How much credibility is left after being under sustained attack for days? | Adversarial auditing: Find someone (or model) to exploit its loopholes |

The fourth question is often skipped and is the most dangerous. A verifier faces **an increasingly capable optimizer explicitly rewarded for exploiting it**, rather than random users. Training maximizes the verifier’s score; the overlap between that score and genuine task completion determines whether optimization improves the intended capability.

### 3. Correct rules but incomplete rewards: three minimal examples

- **answer enum**: The validator only checks "whether the answer contains the correct answer string", and the model learns to list a dozen candidate values ​​in one answer - hits are scored.
- **Only check the results but not the process**: The task requires the reasoning process to add answers, and the verifier only looks at the answers; the model saves all the compute to guess the answers, and the longer the reasoning chain, the worse it gets.
- **Test for overfitting**: The unit test only covers part of the behavior. The model accurately fits the checkpoints of these tests, and all the behaviors are wrong.

What these examples have in common is that the program is not wrongly written, it faithfully implements the rules; what is wrong is that what the rules measure no longer coincides with the task goal. **This is the intuitive definition of reward hacking - the model finds loopholes in the reward rules to get points instead of completing the task. Formal definitions, systematic classification, and detection channels are developed in Chapter 10; this chapter first treats it as a design pressure: the verifier is the attack surface of RLVR, and it should be treated with a security review attitude.

### 4. The cost of misjudgment: False positives and false negatives will distort the learning signal

Both types of misjudgments may change the update direction, and the specific cost depends on the baseline, task distribution and misjudgment pattern:

| Type of misjudgment | what happened | Impact on training |
|---|---|---|
| False positive (wrong is correct) | An incorrect trajectory receives a reward of 1 | Positive advantages may be obtained and wrong behaviors may be reinforced |
| False negative (right or wrong) | A correct trajectory gets 0 points | It is possible to gain a negative advantage and correct behavior is actively inhibited; it may also cause the entire group to lose reward differences |

Therefore, precision and recall should be measured simultaneously, and the trade-off should be determined based on task risk; in particular, it is necessary to check whether misjudgments are concentrated in a certain language, solution, or answer format to avoid systematically suppressing correct behavior.

The verification results should be differentiated **Passed, failed, unable to determine**. Timeout, environmental failure or insufficient rule coverage should be marked as unable to determine and enter retry or manual review; when recovery is impossible, it should be excluded according to the pre-agreed rules and cannot be recorded as 0 by default. After GRPO excludes samples, it is necessary to re-confirm the group size, comparability and reward variance, re-acquire or discard the entire group if necessary, and record the effective sample proportion. Expanding the task pool can supplement the sample size, but it cannot eliminate systematic misjudgments.

### 5. One page table of repair methods

| speculative side | Commonly used practices |
|---|---|
| answer enum | Tighten format constraints (only recognize the first answer), process consistency check |
| Only check results | Introduce process or format constraints; mix manual sampling |
| Overfitting test | Hidden test set, task variant generation (same origin as the anti-pollution evaluation in Chapter 10) |
| Validator’s own flaws | Verifier versioning, misjudgment rate monitoring, and confrontation audit before going online |

### 6. Engineering forms of validators: combination, cascading and versioning

| form | practice | Applicable conditions |
|---|---|---|
| Dual channel combination | Numerical comparison + unit test respectively determine, take intersection or weighting | Insufficient coverage with a single validator |
| Cascade | Run cheap checks first (format, length), then run expensive ones (real run tests, starting environment) | Verification costs are high, so first screen out obviously invalid answers |
| Versioning | Validator code and rules are managed along with the task pool version | Recurrence and rollback |

The last point is worth emphasizing: the validator is part of the training code, **Changing the validator is equivalent to changing the training target**. Its version must be recorded with the checkpoint and task pool version - otherwise after the training is completed, no one can answer "Which version of the rules was this checkpoint trained by?", and review and rollback will be impossible.

> **Judgment Boundary:** Whether a validator is trustworthy does not depend on how elegant it is in the design document. It depends on how much the measurement results overlap with the actual task completion under the condition of "being attacked by an opponent that continues to become smarter for several days." Until there are answers to the three questions of coverage, misjudgment rate, and resistance to reward exploitation, "the task has a standard answer" does not constitute a reason to launch RLVR.

---

## 3. Can the base model generate successful feedback?

The second engineering check is: Does the base provide sufficient feedback for success given the current mission and sampling budget? Here we discuss scenarios with sparse endgame 0/1 rewards. Looking back at the attribution step of the closed loop: whether using intra-group comparison or value baseline (Section 5), the learning signal comes from **difference** ——This one is better than that one, this time is better than expected. If the base never gets it right on the current task:

- In GRPO with group-centered advantages, if every task reward in a group is 0 → every task-reward advantage is zero → that group supplies no task-reward policy gradient. Other loss terms, such as KL, can still produce gradients;
- Critic-based PPO does not require differences within the group, and the failure trajectory may also obtain a non-zero advantage due to value estimation; however, there is still a lack of effective success feedback on tasks that only have a final 0/1 reward and cannot be successfully obtained for a long time.

**Ability Seed** This is what it means: the base can occasionally, even infrequently, produce correct trajectories within a reasonable sampling budget. For the sparse end-game reward scenario here, an operable starting condition is to be able to successfully collect it first, and then try to increase its probability; this is not the final word on whether all RL can produce new abilities.

### 1. An arithmetic question: How low is the probability that there is a signal in the group?

Assume that the single accuracy rate of the base on a certain task is p, and the group size is G = 16 (teaching illustration, independent sampling assumption):

| Single accuracy rate p | The probability that at least one item in the group is correct is 1 − (1 − p)^16 | Reading |
|---:|---:|---|
| 5% | ≈ 56% | Most groups have signals and are in healthy ranges |
| 1% | ≈ 15% | Six of the seven groups are white |
| 0.5% | ≈ 7.7% | The vast majority of sampling is spent on all-zero groups |

In GRPO with binary rewards and centralized advantage within the group, **Whether there is right or wrong in the group is the condition for the task reward advantage to be non-zero**. The strict mixed group probability is 1 − (1 − p)^G − p^G; the table above ignores the extremely small all-pair probability at low pass rates. When p is too low, most of the compute is spent on the group with zero task reward advantage; occasional success does not guarantee sufficient overall signal. Task difficulty, group size, sampling temperature, and task ratio are all adjusted around "putting the base into the signal range".

### 2. Do you need to practice the base first, or do hard training?

The following judgment tree is for GRPO that only uses binary end-game task rewards and intra-group centralization advantages:

```text
What are the results of the multi-sampling test of the base on this batch of tasks (see Section 4 for formal indicators)?
    ├─ All correct (too easy)──→ Increase the difficulty and change the task pool, otherwise there will be no learning signal
    ├─ There is right and there is wrong (marginal interval)──→ RLVR’s home field: increasing the sampling probability of “getting it right”
    └─ Total error (no seed)──→ Back to T06: First SFT / distillation to establish behavior and format,
                          Or lower the difficulty or change tasks. Don’t expect RL to make something out of nothing
```

"Demonstrate first, then strengthen" is the norm visible in the 2026 public formula: GLM-5's post-training is to first use SFT to expand agent and coding data, introduce multiple thinking modes, and then enter the RL stage in sequence ( [Official technical report](https://arxiv.org/abs/2602.15763) definition). Some community discussions also recast SFT as a vehicle for aligning formats and patterns. This is a narrative-level summary, not a description of every recipe; only each team’s ablations can establish what its SFT stage actually contributes (expanded in T06).

### 3. Difficulty stratification is a lever for sampling budget

Rather than letting the all-zero team burn money, it would be better to stratify tasks by base pass rate: under-acquire those that are too easy, defer those that are all-too-hard, and focus the budget on "marginal tasks"—those for which the model is sometimes right and sometimes wrong. This is not a trick, but a direct consequence of the arithmetic in the previous section: for the GRPO task reward advantage here, only the mixed group provides a non-zero signal.

### 4. measurement basis of seed detection: temperature, prompts and difficulty calibration

"Whether the base can be done right occasionally" is not an inherent attribute of the model, but the joint result of the model × sampling settings × prompt form. The diameter must be locked when measuring seeds:

- **temperature**: The distribution of low-temperature sampling is sharper, and "occasionally correct" may not be measured; there are many high-temperature explorations but the noise is high. Seed testing should use temperatures consistent with training;
- **Prompt form**: For the same question, the accuracy rate under zero-sample and few-sample prompts may be very different. The detection measurement basis should be consistent with the task template during training;
- **Difficulty calibration requires regular reruns**: Training itself can change pass rates - last week's "marginal tasks" may be all right this week. Difficulty stratification is not a one-time label, but a bucket that is dynamically maintained as training progresses.

To wrap up in one sentence: The answer of seed detection is not "can the model work?", but "will there be variance within the group under this batch of tasks and this sampling setting" - it directly determines which difficulty bucket the questions in the task pool should enter.

### 5. Where do seeds come from? Three ways to supply them

Detecting "no seeds" is not the end point, but the starting point of three routes:

| route | practice | cost |
|---|---|---|
| task decomposition | Divide the big questions that are all wrong into small questions with signals, and gradually increase the difficulty as the training progresses | The workload of the task is large, and the disassembly method itself introduces design deviations |
| Demonstration of sowing | Use SFT/distillation to first teach the base "what does this question look like and how to get it right once" | See T06: Demonstration quality determines the upper limit of seeding |
| Replace the base | Acknowledge that the current base does not have this seed | The most expensive, but the most honest |

A word of caution: The choice of the replanting route itself is a decision of "task form → data form", and it belongs to the same causal chain as the algorithm selection in Section 5 - first determine the seed source, then determine the optimization route, and the sequence will be reworked repeatedly.

> **Judgment Boundary:** For the sparse binary final rewards here, first confirm whether successful feedback can be obtained within a reasonable sampling budget. When success is not observed, priority is given to SFT, distillation, base replacement, task decomposition or difficulty reduction; limited sampling with all errors cannot prove that the success probability is zero, nor can it be concluded that RL can never expand the capability boundary.

---

## 4. What RLVR buys: pass@k, maj@k and an unsettled debate

Once prerequisites are met and training runs, a third question emerges, central to 2025–2026 RLVR debates: has the model **become more capable**, or merely **become more consistent at producing solutions it already knew**? Two metrics clarify the question.

### 1. Define the indicators first: same model, three questions

- **pass@k**: sample k independent answers to the same question and count success if at least one is correct. It asks, “Can the model solve this with enough attempts?”—an upper-bound view of its capability frontier.
- **maj@k（majority vote@k）**: after k samples, take a majority vote over the answers and count success only if the selected answer is correct. It asks whether one call plus inexpensive voting can produce correct answers reliably—a deployment perspective.
- **Best-of-N**: Generate N items and then select one for output by the selector (Verifier or Reward Model). pass@k can be seen as the upper limit when the picker is perfect.

For the same model, three questions can give completely different numbers. An intuitive sense of magnitude (teaching hint, assuming each sampling is independent and the single accuracy rate is 0.6): the accuracy rate of maj@5 is about 0.68 - the majority vote raises the level of 60 points to 68 points. Note that real inference is highly correlated with multiple sampling of the model, and the actual improvement is usually lower than the estimate of the independent hypothesis; this example only illustrates one thing: **The aggregation strategy itself is a degree of freedom in accuracy.**

### 2. Two explanations, one set of observations

A common observation pattern after RLVR is that the single success rate increases significantly with maj@k, while the pass@k for large k is almost the same. There are two competing explanations for this set of observations:

| explain | content | If true, it means |
|---|---|---|
| Sampling distribution sharpening | RLVR sharpens the output probability of the model's existing capabilities: good practices appear more often; but the "set of problems that can be solved" does not become larger | What RLVR buys is reliability and sampling efficiency, not new capabilities |
| Expansion of capability boundaries | The model really solved the problems that could not be solved before training (pass@k will also increase in certain budgets and certain tasks) | RLVR may lead to generalization beyond the base’s capabilities |

### 3. The current status of the dispute: Both sides have presented evidence together, and there is no conclusion yet

- **Evidence for sharpening:** a [2025-10 preprint survey](https://arxiv.org/html/2510.04028v1) collects reports of flat pass@k but improved maj@k after RLVR, favoring distribution sharpening without a wider capability frontier. An [ACL 2026 paper](https://aclanthology.org/2026.acl-long.2102.pdf) extends this investigation to vision–language models and likewise finds no frontier expansion.
- **Evidence for methodological criticism**: The negative side points out that the measurement of pass@k itself is unstable - the pass@k curve may cross-invert with the size of k (pass@k inversion), and the comparison under small k may be systematically misleading; settings such as the evaluation sampling temperature will also significantly change the conclusion.

The two groups are not homogeneous in terms of indicator measurement basis, tasks, and model scope, and neither has convinced the other yet. This topic states according to factual rules: **This debate is still inconclusive.**

### 4. Engineering posture: treat debates as research problems, and treat indicator selection as engineering decisions

The debate hangs in the balance, but training decisions cannot wait. There are four operable postures:

1. **Both indicators are measured**, and write down the sampling number k, temperature, data set version and evaluation method - the pass@k number without measurement basis cannot be compared with others;
2. **Select main indicators according to deployment measurement basis**: Mainly single call online, look at the single accuracy rate and maj@small k; for products with a sampling budget, pass@k is the money;
3. **"Capability boundaries are expanded" when assumed, improper default benefits** - To claim expansion, a controlled comparison of the base and the RL version at large k is required;
4. **Don't belittle "sharpening"**: Even if a certain training only improves maj@1, it is a real asset for deployment - the same task is completed with fewer samples, which means that the inference ledger mentioned in T02 is declining.

### 5. From indicators to bills: one conversion

Translate the difference in indicators into deployment costs (teaching illustration, numbers are assumptions): Assume the product target accuracy rate is 0.85, and two candidate models——

| candidate | maj@1 | maj@8 | Ways to get to 0.85 | Single task call cost |
|---|---:|---:|---|---|
| Model P (after RLVR) | 0.86 | 0.94 | A single call meets the standard | 1 generation |
| Model Q (base) | 0.55 | 0.86 | 8 samples per task, followed by voting | 8 times generated + votes |

If you only look at "whether maj@8 is tied", the two candidates are equally good; but model P can do what model Q generates eight times with one generation - this is the book expression of "sampling efficiency is also a real benefit". On the other hand, if the product inherently has a sampling budget (for example, multi-channel sampling is required to ensure robustness), the pass@k measurement basis will reflect the real gap. **Indicators are not high or low, only the measurement basis is right or wrong: first write down the calling method of the product, and then select the main indicator.**

There are two details that are easy to miss when reading maj@k: First, **Tie vote** ——How to record when k is an even number or multiple answers are tied (remember failure, half point, or elimination), you must write it down in the measurement basis; secondly, **Distribution of errors is more important than error rate** ——If the model's errors are highly concentrated on the same type of questions, the majority vote will hardly increase; if the errors are scattered and close to random, the same single correct rate can earn more from the vote. This is also the reason why the independence assumption is inaccurate in real settings, and the "improvement of maj@k" itself carries information about the wrong structure.

> **Judgment boundaries:** "RLVR only sharpens the distribution or expands the boundary" is a research question, and there is no conclusion yet; but in engineering, you can first ask a more pragmatic question - in your deployment measurement basis, which indicator is money? Treat debates as research tracking and indicator selection as decision-making first.

---

## 5. PPO, GRPO and the source of the baseline

Next, two commonly used baseline schemes are described. **Reward is an absolute score, and the update requires a relative amount: better than peers, better than expected. The plan that turns absolute scores into relative quantities is the "baseline plan"; the difference between the two major algorithm families lies in where the baseline comes from.**

### 1. Value, Critic, Advantage: Calculate "how much better than expected"

- **Value**: Starting from the current state and continuing according to the current strategy, what is the expected cumulative return. It is the "expected baseline" - this question, this starting point, how many points the model can get if it performs normally.
- **Critic**: An auxiliary model that learns and outputs Value and is trained simultaneously with the trained Policy (Actor).
- **Advantage**: Actual return minus expected baseline. A positive number indicates that this time is better than expected, which is strengthened; a negative number indicates that it is worse than expected, which is suppressed.

Why use a baseline? Without one, you only know that a trajectory earned 1 point; you do not know whether that is exceptional performance or lucky performance below the expected level. A baseline turns the absolute score into performance relative to expectation, giving the update signal a direction and magnitude and substantially reducing training variance. The opening table of four attempts is a ready example (a teaching illustration with rewards of 1/0):

```text
GRPO perspective (the mean within the group is used as the baseline):
  Group = {A, B, C, D}, Score = {1, 0, 1, 0}, Group Mean = 0.5
  Advantage = {+0.5, −0.5, +0.5, −0.5}
  → A and C strengthen, B and D suppress; there is no all right or all wrong in the group, the signal is established

PPO view (Critic as the baseline):
  Critic estimates that the Value of this question = 0.3 (expected to be 30% sure)
  Advantage of A = 1 − 0.3 = +0.7; Advantage of B = 0 − 0.3 = −0.3
  → A single track can be updated, no need for "four tracks of the same question"; the cost is to train Critic

Counterexample (all pairs in the group): Score = {1, 1, 1, 1} → Advantage all 0
  → The group-based approach gets no task-reward policy gradient on this question (other loss terms are separate)—another way to describe the “boundary region” in section 3
```

There is another dynamic that is easily overlooked: **The baseline is not constant**. The group mean moves upward as the strategy becomes stronger - yesterday's performance of +0.5 may be below the mean today; the Critic's Value estimate must also be relearned following the Policy, otherwise the "expectations" will become outdated and the Advantage will be systematically positive or negative. This is the deep difficulty common to both routes: the baseline must evolve simultaneously with the strategy. The critic route pays for this by "the training burden of the second model", and the group route pays for this by the "continuous group sampling burden" - again, two sides of the same coin.

### 2. Complete data flow for both routes

```text
Critic-based PPO (single trajectory learning) GRPO (group relative optimization)
─────────────────────────────             ─────────────────────────
Policy ──Sampling──→ 1 Rollout Policy ──Sampling of the same question──→ G Rollout
                    ↓                                         ↓
Verifier → Reward(0/1) Verifier → Reward item by item
                    ↓                                         ↓
Critic → Value (expected baseline) within-group mean = baseline for this question
                    ↓                                         ↓
Advantage = Reward − Value Advantage = Score − Group mean
                    ↓                                         ↓
Update Policy; train Critic at the same time to update Policy (enhancement above mean, suppression below mean)
Reference (frozen) ──KL──┐ Reference (frozen) ──KL──┐
                      └→ Constrained Drift └→ Constrained Drift
```

**PPO**（[Original paper](https://arxiv.org/abs/1707.06347), 2017, method origin/historical anchor point) comes from the earlier reinforcement learning tradition: policy gradient plus trust region-style tailoring to ensure that each step of update is not too big. **GRPO** (Group Relative Policy Optimization) was introduced by [DeepSeekMath](https://arxiv.org/abs/2402.03300) (2024, Method Origin/Historical Anchor) proposed: Replace "train a critic as the baseline" in PPO with "take a group of the same questions and use statistics within the group as the baseline". Since then, a number of objective function variants have appeared (such as DAPO, GSPO, and historical anchor points), and improvements have continued around issues such as statistical details of intra-group comparisons, length deviations, etc. The name of the variant is not important, what is important is that they are all answering the same question: how to determine the baseline more stably.

### 3. Comparison: Algorithm selection is a system bill

| Dimensions | Critic-based PPO | GRPO (Group Relative Optimization) |
|---|---|---|
| Baseline source | Train a Critic to output Value | Intra-group statistics of the same question G Rollout |
| additional models | Critic (often the same magnitude as Policy, practiced and deployed together) | No additional models (Reference requires both) |
| Sample tissue | A single track can be updated | Each question must take a set of comparable trajectories |
| Signal granularity | Can achieve Token-level fine-grained Advantage | The group level is relatively relatively dominant (the variants are refined) |
| premise | Critic learns accurately (value deviations will be directly transferred into updates) | Groups are comparable + there is variance within the group |
| typical failure | Critic bias, instability of alternate training of two models | The all-right/all-wrong group has no signal; long-range task groups are difficult to organize |
| System bill | GPU memory, compute and training instability of one more model | With one more group sampling budget, the inference cluster is heavier |

In the public picture of 2026, group routes are a verifiable high-frequency option: [GLM-5 technical report](https://arxiv.org/abs/2602.15763) The disclosed post-training is based on GRPO-based group optimization (official report measurement basis). The community also has an opinion article titled "GRPO Won the Post-Training War" (Medium, 2026)—— **That is an opinion article level narrative, not an industry fact**; What can be verified is that "GRPO and its variants appear frequently in public technical reports", but "the war is over" cannot be verified.

Add another layer of order-of-magnitude intuition (teaching hint): The Critic's bill is "one more model to be trained and deployed" - GPU memory, optimizer state, forward and reverse, the magnitude changes with the scale of the selected Critic; the group mean's bill is "G - 1 more items per question" - according to the algorithm in Section 1, G is added from 8 to 16, and the sampling account is directly doubled. Which of the two options is cheaper depends on where the bottleneck is: with tight graphics memory and high sampling throughput, the group approach is dominant; with tight sampling and rich graphics memory (for example, if there is a large inference cluster and the training cluster is tight on graphics memory), the relative cost of the critic route will decrease. The "System Bill" line in the above table expands into this multiplication problem.

### 4. A public case in the opposite direction: why GLM-5.2 switched to Critic-based PPO

Group routing does not hold true everywhere. [GLM-5.2 official blog](https://z.ai/blog/glm-5.2) (2026-06) gives a description: For ultra-long-range Agent tasks, after the ultra-long trajectory is cut into sub-trajectories with irregular numbers and lengths by Compaction (context compression, fully defined in Chapter 9), the GRPO premise of "a set of regular comparable trajectories for the same question" is no longer naturally established, so it turns to Critic-based PPO for single-trajectory learning and Token-level Advantage (official blog measurement basis; the complete causal chain is dismantled in Chapter 9. This chapter only uses it to explain one thing: **The premise of the algorithm is the usage conditions determined by the task form, not the rank on the ranking list**）。

Two disciplines must be kept up with: First, the direction of cause and effect is "change in task form → failure of method premise → change method", rather than "change method → good results"; second, it cannot be written as "PPO replaces GRPO": GLM-5 is still based on group type, and GLM-5.2 only turns to Critic-based PPO on long-range tasks. The two routes will coexist in 2026, not a substitute relationship.

### 5. KL Control: A common rein for both routes

Regardless of the route, a **Frozen Reference Policy** (snapshot of training starting point), add a KL penalty to the objective function - the probability distribution distance between the current policy and the reference policy. It constrains Policy not to drift too far: the direct cost of drifting too far is the degradation of language ability and the collapse of the output mode, and the indirect cost is the depletion of sampling diversity in subsequent tasks (the entropy curve in the next section is its instrument). The KL coefficient is a real hyperparameter: too loose and the reins are useless; too tight and the model cannot learn new things. Another usage of Reference in DPO was discussed in T07 and will not be repeated here.

> **Architectural wisdom:** The essence of algorithm selection is the selection of the baseline plan, and the baseline plan is connected with a system bill: Critic is the bill for "training a model that can be expected" (GPU memory, compute, training instability), and the group mean is the bill for "sampling more for each question" (sampling budget, group construction constraints). There is no free baseline—only trade-offs that shift costs from one to another.

---

## 6. Read four training-health curves together

The prerequisites have been passed, the algorithm has been selected, and the training is running - now the question becomes: How do you know that the training is getting better, rather than getting worse and looking like it is getting better? **RLVR training monitoring requires looking at at least four curves, and they must be read jointly.

### 1. What do the four curves look at?

| Curve | meaning | The trap of looking alone |
|---|---|---|
| Average training reward | The score given by Verifier changes with the number of steps | It is "the performance of the training target itself". If it rises, it only means that the optimizer is working |
| Policy entropy | The degree of dispersion of the model output distribution: the flatter it is, the more exploratory it is, and the sharper it is, the more it repeats a few practices | The entropy drop itself is a normal part of convergence, and the speed and amplitude are the signals |
| response length | Average number of tokens generated to generate answers | Changing length is often misunderstood as "think harder", or it may just be length reward exploitation |
| within group variance | The difference in scores for a group on the same question | If the variance approaches zero, no matter whether it is all right or all wrong, it means that the learning signal for this question has been lost |

Policy entropy deserves a sentence of its own: it measures "how many alternative options are left" in the model. Training naturally pushes the distribution towards the top - this is what Section 4 calls "sharpening"; the question is how quickly. Healthy convergence is when entropy slowly decreases and then stabilizes; **Entropy collapses rapidly towards zero** It means that the model shrinks to a very small number of methods, and subsequent new tasks and new question types will no longer produce effective gradients - exploration exhaustion is not quiet before the end, but an early exit.

The shape of the four curves under healthy and pathological training:

```text
Healthy convergence Pathological (length reward exploitation + entropy collapse)
reward reward
 │      ＿＿＿──                       │    ＿＿───────── ← Rushing towards perfect score
 │   ＿－                              │ ＿－
 │＿－                                 │－
 └───────────→ Steps └───────────→ Steps
entropy entropy
 │＼                                   │＼
 │ ＼＿                                │ ＼
 │    ＿＿── Stable but less than zero             │   ＿＿＿ ← Quickly hit zero
 └───────────→ Steps └───────────→ Steps
Response length: Smooth or slow change Response length: Continuous sharp increase
Within-group variance: converges but does not return to zero. Within-group variance: quickly returns to zero
```

The method of looking at the graph is more important than the graph itself: don't ask "is this curve right?", ask "what story does the combination of the four curves tell?" - the slowly decreasing entropy of the same period, coupled with the skyrocketing length and zero variance, is another story.

### 2. Joint Reading Table: Mode × Interpretation × Disposal

| reward | entropy | length | within group variance | Interpretation | Dispose |
|---|---|---|---|---|---|
| ↑ | Slow down | stable | Converging but not returning to zero | normal convergence | Continue as planned |
| ↑ | About to collapse | surge | Convergence | Length reward exploitation is suspected: longer does not mean more correct | Check the correlation between length and score; add length penalty or normalization |
| ↑ | About to collapse | stable | Return to zero (all pairs) | Reward saturation + exploration depletion | Increase difficulty, change task pool, reset exploration |
| flat | flat | stable | Return to zero (all pairs) | The task is too easy, there is no signal | Increase difficulty |
| flat | flat | stable | Zero (all answers wrong) | Insufficient ability seeds (opening team C) | Return to SFT/reduce difficulty, pause RL |
| ↑ | Slow down | stable | normal | Independent reviews are flat → suspected of reward exploitation | Spot-checking high-group samples; adversarial audit validators |

The last line is the soul of joint reading: **The four curves on the training side are all "healthy", but they don't move in the independent evaluation - this combination itself is the most important alarm signal. **It is the same as the over-optimized mirror image of T07: there the RM score increases but the manual blind review does not; here the Verifier score increases but the independent review does not. Training rewards should never serve as proof of acceptance alone.

### 3. Case teardown: Official fixes for GLM-5’s sequential RL and ability forgetfulness

Multi-stage RL’s ability to forget will have an official-level public disclosure in 2026. [GLM-5 technical report](https://arxiv.org/abs/2602.15763) (2026-02) disclosed that sequential RL was used for subsequent training (GLM-5’s name for its own three-stage arrangement, which is not an industry standard term): SFT was followed by three stages: Reasoning RL → Agentic RL → General RL; the report clearly admitted that multi-stage sequential RL will erode the skills of the previous stage - the training distribution of the later stage crowds out the behavior of the previous stage, and the abilities learned hard in the previous stage will be rolled back in subsequent stages. The official fix is ​​to add an on-policy cross-stage distillation section at the end of the pipeline, and use the distillation section to make up for the eroded early capabilities (official report measurement basis; the distillation mechanism itself is in T06).

This recipe table has three benefits for the health panel:

- **Ability forgetting is not reflected in training rewards** ——Each stage trains its own task pool, and the rewards are very good; it is reflected in the cross-stage regression evaluation. Without a regression set, forgetting is invisible;
- **"Retraining a segment of repair" is a real engineering method**, but it is an officially recognized price, not a free lunch - the sampling and training costs of the repair segment must be included in the bill of sequential RL;
- Multitasking hybrid is another visible route: [Kimi K3.1 Pro Official Blog](https://www.kimi.ai/blog/kimi-k3-1-pro) It is called large-scale joint RL across hundreds of tasks (official measurement basis) - joint training allows tasks to restrain each other, and the pressure of forgetting is replaced by the complexity of reward design and task matching. A complete comparison of the two routes belongs to Chapters 9 and 11.

To implement the first lesson into a tool, it is a **Cross-stage regression matrix** (Teaching instructions, numbers are fabricated):

| Capability dimension | After SFT | After Reasoning RL | After Agentic RL | General RL + after distillation |
|---|---:|---:|---:|---:|
| mathematical reasoning | 62 | 71 | 66 ↓ | 70 |
| code | 58 | 60 | 74 | 73 |
| instructions to follow | 81 | 78 ↓ | 75 ↓ | 80 |
| General Q&A | 70 | 69 | 66 ↓ | 71 |

How to use the matrix: each row is a capability that must not silently regress; each column is a stage boundary. Arrows mark regressions, and cells beyond the threshold identify targets for a repair stage, such as GLM-5’s cross-stage distillation. Teams without this matrix may only discover a capability lost in stage 2 when product users report that “the model has become less capable.”

> **Judgment boundary:** The joint reading of the four curves can only give "suspect" but not "conviction". The reward increases but the independent evaluation does not. This may be due to reward exploitation, overfitting of the task pool, or the insensitivity of the evaluation set. The final decision relies on sampling manual review and controlled experiments, rather than drawing another curve.

---

## 7. Attribution and stopping conditions

The last question is the conclusion of the whole chapter: after training (or in progress), how to prove that the gains are true generalization, rather than task pool memory or validator reward exploitation?

### 1. Basic attribution: Three versions of comparison + two budget measurement bases

| Control | Answered questions |
|---|---|
| Base (not trained later) | How much of the ability is inherent in the base? |
| Base + SFT | How much did the demonstration section contribute? (The method of T06 is reused here) |
| Base + SFT + RL | What is the contribution margin of the RL segment? |

The budget measurement basis must be declared when comparing, which is the extension of T02's T² logic in RLVR:

- **Fixed sampling budget**: Ratio of accuracy under the same k samples for each question - answer "who is better with the same sampling cost";
- **Fixed calculation budget**: Take into account the additional generation cost of RLVR to make the answer longer - answer "who is more cost-effective with the same total compute".

A model may win with maj@1 but lose with large k pass@k: it spends its compute on "doing the questions it knows stably". This is deployment optimization, not capacity expansion—both benefits are real, but must be named separately, and neither can be attributed when lumped into one number.

There is a third variable that is easily missed: task ratio. If the RL version changes the mix of question types in the task pool, any comparison of a single measurement basis will no longer be a pure ability comparison - the task ratio is a layer 2 variable, and the controlled experiment must lock it.

### 2. Evaluation discipline

- **Separation of task pool and acceptance collection**: training questions must not enter the acceptance set; deduplicate related questions and create variants (chapter 10 covers the complete contamination-control method);
- **dual indicators**: Measure both maj@k and pass@k, mark k, temperature and data set version;
- **Off-distribution tasks**: Leave a batch of questions that are different from the training tasks to test generalization rather than memory;
- **Repeat run**: The randomness of RL training is not small. Key conclusions need to be run multiple times to see the variance. The score difference in a single run is not enough to make decisions;
- **regression set**: No fallback for non-target abilities (General Q&A, Safe Behavior, Instruction Following) - Chapter 10's release gates is previewed here.

### 3. Three common pitfalls of attribution

- **Pitfall 1: Different starting points for comparison**. Comparing the "old scores of the SFT version" with the "new scores of the RL version", there are data updates, prompt template changes, and evaluation set revisions in between - the variables are not locked, and the differences are not attributable. **correct**: All versions are run again using the same set of frozen evaluation assets;
- **Pit 2: Evaluation measurement basis drift**. The measurement of maj@8 (temperature 0.7) at the beginning of the month, and the measurement of maj@8 (temperature 1.0) at the end of the month - temperature is the common degree of freedom of pass@k and maj@k. Once the measurement basis changes, the rise or fall may be measurement noise. **correct**: The measurement basis is written into the evaluation configuration file and versioned;
- **Pit 3: Pick the best seeds to report**. RL training runs three random seeds and only reports the best one. The single best value is a selection effect, not an expectation level. **correct**: Report the mean and variance, or make decisions directly based on the worst seed.

### 4. Two “same base” comparison anchors for 2026

The strongest form of evidence for attribution is a comparison in which the base variable is naturally fixed:

- **GLM-5.3 versus GLM-5.2:** the [official blog](https://z.ai/blog/glm-5.3) and model cards say they use the same 744B-total/40B-active base model with a rewritten post-training pipeline. Terminal-Bench 3.0 rises from 4.6 to 28.3, using officially reported figures on the same version. TB 2.0, 3.0, and 4.0 scores are not interchangeable. Post-training can produce large changes, but this aggregate agentic metric neither implies equal gains in every capability nor attributes all improvement to one RL stage;
- **Kimi K3.1 Pro vs K3**: Reuse the K3 base (2.8T General MoE), significantly increase the compute and then train (hundreds of tasks joint RL, official measurement basis). Mutual confirmation with GLM-5.3 that "the base is not moving, the pure post-training refresh flagship" is a repeatable engineering route in 2026.

Two anchors jointly serve the attribution framework of this chapter: **When the base is fixed, changes can only come from post-training - this is exactly what the control group is trying to create, they naturally have it.**

### 5. Stop criterion one-page table

| Observation (after joint reading) | Interpretation | action |
|---|---|---|
| Rewards are flat + variance approaches zero (all pairs) | reward saturation | Increase difficulty and expand task pool |
| Rewards are flat + variance approaches zero (all wrong) | Not enough seeds | Return to SFT/reduce difficulty/change tasks |
| Increased rewards + flat independent evaluation | suspected of reward exploitation | Spot check + confrontation audit validator, repair rewards |
| Rapid entropy collapse + diversity decrease | Exploration exhausted | Adjust KL, temperature, task mix |
| The regression set significantly regresses | ability to forget | Replay data, mixed training, a lower learning rate, or distillation repair (the GLM-5 approach) |
| Double indicators rose and returned to stability | valid | Can continue; consider expanding the task or moving to the next stage |

### 6. Minimal template for attribution reporting

| Field | Example (illustrative) |
|---|---|
| Compare version | Base @ckpt-1200 / +SFT v3 / +RL v3-step8k |
| Review assets | The test set v2 (with the training pool questions removed) and the regression set v1 are both frozen |
| measurement basis | maj@8, temperature 0.7, consistent with training sampling settings; pass@32 additional test |
| Result | Target set 0.61 → 0.74; pass@32 0.79 → 0.81; regression set −0.4% (within 2% of threshold) |
| Spot check | High group 50 manual reviews: 2 suspected speculations, validator defects have been located |
| Conclusion | Promotion; validator defects will be transferred to issue tickets, and will be retested after the next round of repairs |

Its function is the same as the T02 prediction ledger: it is not a form-filling ceremony, but allows each promotion decision to be reviewed - when you look back three months later, "why you were released at that time" must be read from this table.

> **Architectural wisdom:** RLVR’s acceptance evidence set must be at least five: the target indicator has increased, the pass@k measurement basis is also tested, the independent evaluation does not deviate, the regression set does not fall back, and there is no reward exploitation in sampling. If one thing is missing, the benefit is just "the training goal will get better on its own" - that is not called ability, but self-satisfaction.

---

## 8. Engineering artifact: RLVR Training Plan

Gather the entire chapter into a reusable planner. It corresponds to paragraphs 3, 4, 8, and 9 of the Introduction Training ADR skeleton (learning signals and credit allocation, candidate solution assumptions, verification and release gates, exit conditions), and each item must be calibrated:

**Input:**

| Field | Example value | measurement basis source |
|---|---|---|
| task definition | Mix of mathematical calculations + code questions; divided into difficulty levels according to the passing rate of the base | What-if scenario |
| Task source and leak check | Internal task bank + synthetic variants; deduplicate question text against the acceptance set | What-if scenario |
| Verifier | Numerical comparison + unit test dual channel; false positive rate sampling of 1% of samples per day | design value |
| reward function | Outcome reward 0/1; format violation −0.1; no process reward (v1) | design value |
| Sampling strategy | Group size G = 16; Temperature 1.0; Maximum length 4K Token | design value |
| Algorithms and KL | GRPO system optimization; KL coefficient initial value 0.04, callback according to entropy curve | design value |
| health panel | Reward / entropy / response length / within-group variance, snapshot every N steps + alarm threshold | design value |
| Controlled experiment | Base / SFT / RL version three; fixed sampling and fixed calculation dual aperture; independent test set + regression set | design value |

**Output items:**

| output | criterion |
|---|---|
| Continue / Stop / Modify Rewards | Stop criterion table (Section 7), executed when triggered, no on-site debate |
| promotion | The evidence set consists of five components (targets, dual indicators, independent evaluation, regression, and spot checks) |
| Rollback conditions | Entropy collapse, regression and reward exploitation, any trigger will roll back to the previous checkpoint |

Two disciplines of this table: **The stopping conditions should be written before starting the compute** ——In the middle of training, no one can objectively decide to "try burning for another three days"; **Validator fields separate from reward function fields** —The entirety of verse 2 is a reminder that the two will quietly cease to coincide.

### Pre-training checklist

- [ ] The four questions of the validator (coverage, false positive rate, verification cost, resistance to reward exploitation) have written answers;
- [ ] The validator has been versioned, and the false positive rate monitoring is visible on the panel;
- [ ] The base seed detection is completed, and the task pool is divided into difficulty buckets according to the pass rate;
- [ ] Independent test collection and training task pool complete question-level deduplication;
- [ ] Base/SFT/RL three-version comparison and dual-budget measurement basis are included in the experimental plan;
- [ ] The four-curve panel and alarm threshold are configured;
- [ ] The stopping criteria and rollback conditions have been reviewed - before the hashrate is launched.

> **Architectural Wisdom:** The value of the RLVR Training Plan is not in the plan document itself, but in the answers that were forced to be written down before compute was developed: the four questions of the validator, seed detection, and stopping criteria. After training begins, all judgments that have not been written down will be quietly replaced by "run for a while and see."

---

## 9. Six common reasoning errors

### Mistake 1: "Having a standard answer" equals "the reward is verifiable"

The standard answer is a necessary condition, not a sufficient condition. Before the three questions of coverage, false positive rate, and resistance to reward exploitation are completed, the verifier is just "a piece of code that has not been attacked." **corrective action**: Conduct adversarial audits before going online, and manage the speculative surface of the validator as an attack surface list.

### Mistake 2: Declaring a training session healthy based on just looking at the reward curve

The reward is the training target's own score, and its increase only proves that the optimizer is working. In Team B’s unit testing scam, the reward curve is the most beautiful one in the whole show. **corrective action**: Four-curve joint reading + independent evaluation + high-group manual spot check, three things are indispensable.

### Mistake 3: Treating border disputes as a settled matter

Regardless of the direction—"RLVR just sharpens" or "RLVR expands the boundaries"—the evidence is currently not broad enough. Single-point pass@k comparisons are also criticized for inversion and temperature-sensitive methodologies. **corrective action**: Dual indicators, standard measurement basis, select the main indicator according to the deployment measurement basis, and write "whether the boundary is expanded" as a hypothesis to be verified.

### Mistake 4: The base does not have the ability to seed RL

Under the binary final reward, the task reward advantage of the GRPO all-wrong group is zero, and the sampling bill is paid; this does not mean that all RL must rely on intra-group differences. **corrective action**: Before training, do a base multi-sampling test first, and assign the tasks to the edge range of "right and wrong"; batches with all errors will be returned to SFT or the difficulty will be reduced.

### Mistake 5: Copying the conclusion of the algorithm but not the premise of the algorithm

When I saw GLM-5.2 converting to Critic-based PPO, I followed suit, but there was no long-term, variable-length, compaction trajectory; or in turn, it was announced that "PPO will replace GRPO". The premise is the usage conditions determined by the task form: GLM-5 and GLM-5.2 use different algorithms because the task form is different. **corrective action**: Go through the causal chain of "task form → data form → method hypothesis → system topology" again, confirm the constraint isomorphism and then reuse it.

### Mistake 6: Using the training task pool as a validation collection

A rise in the training distribution is the definition of optimization, not evidence of generalization. The task pool and the test collection have the same origin, which means students can write their own test papers. **corrective action**: Question level deduplication + independent verification collection + out-of-distribution tasks + repeated runs, four sets are written into the schedule.

After reading the six mistakes, we can see the pattern: none of them are "the algorithm is used incorrectly", they are all "the compute is opened without asking the premise" - the premise of reward, the premise of monitoring, the premise of indicators, the premise of seeds, the premise of algorithm, and the premise of acceptance. The engineering difficulty of RLVR is not in the algorithm itself, but in passing these hurdles one by one; this is why "premise" is put in the title of this chapter.

---

## 🎯 Quick check

```quiz
{
  "question": "The team used \"the final answer contains the correct value\" as the verifier, and after two weeks of training, the reward was close to full points; manual spot checks found that the model had learned to enumerate more than a dozen candidate answers in the answer to gain points. What’s the next best thing?",
  "options": [
    "Stopping training and declaring RLVR invalid is a dead end",
    "Repair reward: Tighten the verifier (equivalence determination + format constraints + process consistency check), isolate contaminated Checkpoints, and restart the control experiment",
    "Continue training and wait for the independent evaluation scores to catch up on your own"
  ],
  "answer": 1,
  "explanation": "This is a typical example of \"correct rules but incomplete rewards\": the program is not written wrong, but what it measures no longer coincides with \"getting the task right\". The first premise of RLVR is that rewards are reliable and difficult to speculate on; the faster the rewards increase, the more priority it is to check for reward exploitation rather than waiting for reviews to heal."
}
```

```quiz
{
  "question": "RLVR post-training report: big k’s pass@k is basically unchanged, and maj@8 is significantly improved. What is the safest judgment based on the current evidence?",
  "options": [
    "Proving the expansion of the capability boundary, because maj@8 has increased",
    "It proves that the model is cheating because pass@k has not increased",
    "It is consistent with the explanation of \"sharpening of the sampling distribution\", but it is still inconclusive whether the boundary is expanded - methodological criticisms such as pass@k inversion and evaluation temperature sensitivity indicate that the single-point conclusion is unstable; the main indicator should be selected according to the deployment measurement basis and continue to track the dual indicators"
  ],
  "answer": 2,
  "explanation": "This set of observations is consistent with the \"sharpening\" explanation, but the evidence from both sides is mixed and the conclusion is still inconclusive. A more pragmatic question in engineering is: Which indicator in my deployment measurement basis is money? For a single online call, see maj@1, and for a sampling budget, see pass@k. Even if it's just sharpening, fewer samples for the same task is a real deployment benefit."
}
```

```quiz
{
  "question": "The health panel shows: training rewards continue to rise, policy entropy rapidly drops close to zero, response length is stable, and independent evaluation remains flat. What to check first?",
  "options": [
    "Reward reward exploitation and model collapse: Extract high-group samples from training for manual review to check whether the validator has been systematically bypassed and whether the task pool is too narrow",
    "Hardware failure, because the abnormal entropy curve must be a machine problem",
    "The learning rate is too high, just cut it in half"
  ],
  "answer": 0,
  "explanation": "Rising rewards plus flat independent evaluation is this chapter’s most important alarm. Rapid entropy collapse alongside it suggests mode collapse or reward exploitation. Reading the four curves together identifies suspects; sampled human review and adversarial audits must establish the cause before you start tuning hyperparameters."
}
```

```quiz
{
  "question": "What questions do Verifier, Reward Model, and Critic each answer?",
  "options": [
    "All three are scorers, located at the same decision-making level and can replace each other",
    "Verifier answers \"Is the result this time actually correct?\" (feedback source); Reward Model answers \"Which answer is better\" (learned preference); Critic answers \"How much can you expect to get if you continue from the current state\" (value baseline for credit allocation)",
    "Verifier is used for pre-training, Reward Model is used for post-training, and Critic is used for inference"
  ],
  "answer": 1,
  "explanation": "Both Verifier and Reward Model belong to the feedback source layer, but one execution rule and one learning preference; Critic belongs to the credit allocation layer, and the output is the expected baseline rather than the actual score. If the three are mixed into a \"scorer\", component bills will be miscalculated when comparing plans."
}
```

```quiz
{
  "question": "Under what circumstances does the premise of group relative optimization (GRPO) not hold?",
  "options": [
    "As long as the model is large enough, the premise of GRPO is always true",
    "GRPO only expires when the reward is a continuous value",
    "It is difficult to cheaply extract multiple comparable trajectories for the same question, or when the group is all right/all wrong (variance is zero) for a long time - for example, the number and length of trajectories after ultra-long-distance missions are irregular after compaction, and the group baseline loses meaning (GLM-5.2 turns to a public scenario of Critic-based PPO)"
  ],
  "answer": 2,
  "explanation": "GRPO uses intra-group statistics as the baseline, provided that \"the groups are comparable\" and \"there is variance within the group\". Under the binary reward, the task reward Advantage of all-right or all-wrong groups is all zero, but other loss terms such as KL may still produce gradients; the trajectory shape of long-term tasks may also make it impossible to construct a \"group with the same question\" at all. Pay attention to the direction of cause and effect: it is the change in the task form that invalidates the premise, not the PPO winning on the leaderboard."
}
```

---

## Chapter summary

- First review verification coverage, misjudgment, and resistance to reward exploitation. There should be different processing rules for passing, failing, and failing to determine.
- RLVR describes the source of reward; having variance within the group is the condition for the non-zero reward advantage of the GRPO task, and is not the definition of all RL.
- Jointly check the reward, entropy, response length and intra-group variance, and then use pass@k/maj@k, independent evaluation and comparison with the same budget to confirm the income.

> **Next Chapter Question:** RLVR often has clear answers or verifiers; real Agent tasks may contain dozens of tool calls, state changes, and long-range goals. The next chapter treats the learning environment itself as the core engineering object.

---

## Terminology reference

Newly introduced or redefined words in this chapter are concentrated here in the order of appearance; general terms such as policy, rollout, and reward have been explained in the first section.

| Terminology | How can beginners understand first |
|---|---|
| RLVR | Reinforcement learning that uses rules, standard answers, unit tests or program verifiers as reward sources; "better" is determined by the program, not by people or scoring models |
| Verifier | Program to determine whether the results are right or wrong (numeric comparison, testing, compilation, schema, environment status); reproduction requires fixed rules, environment and randomness |
| Reward Model | The learned scoring model turns "which one is better" into a scalar score; the difference from Verifier: one learns preferences and the other executes rules (T07 home field) |
| Rollout group | A group of comparable responses sampled in parallel for the same question; GRPO’s baseline and learning signals come from within the group |
| within group variance | The difference in scores within the group; in the GRPO of within-group centralization advantage, the task reward advantage for the all-right or all-wrong group is zero |
| pass@k | Sample k independent answers to the same question; count success if at least one is correct. This is an upper-bound view of whether the model can solve the task |
| maj@k | Sampling k times for majority voting on the answer, only the majority is correct will be recorded as successful; close to the deployment perspective of "one call plus voting" |
| Policy entropy | The degree of dispersion of the model output distribution; the flatter it is, the more exploratory it is, and the sharper it is, the more it repeats a few practices |
| Value / Critic | The expected reward of continuing from the current state; Critic is an auxiliary model for learning it |
| Advantage | Actual score minus expected baseline determines whether a trajectory is enhanced or suppressed |
| KL control | A constraint that uses KL distance from a frozen Reference to keep the Policy from drifting too far |
| Reward Hacking | The model finds vulnerabilities in the reward rules to get points instead of completing the task; the formal definition and detection channel are in T10 |

---

## Related links

- Within the topic: [T01 · Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [T02 · Scaling is not about copying proportions](/en/tutorial/t02-scaling-budget-three-ledgers/) · [T07 · Preference learning](/en/tutorial/t07-preference-reward-calibration/) · [T09 · Agentic RL](/en/tutorial/t09-agentic-rl-environment-credit-async/)
- Method source: [DeepSeekMath/GRPO (method origin)](https://arxiv.org/abs/2402.03300) · [PPO (method origin)](https://arxiv.org/abs/1707.06347)
- Cases and Studies: [GLM-5 Technical Report (Sequential RL and Cross-stage Distillation)](https://arxiv.org/abs/2602.15763) · [GLM-5.2 official blog (shifting to Critic-based PPO for long-range missions)](https://z.ai/blog/glm-5.2) · [GLM-5.3 official blog (same base as pure post-training comparison)](https://z.ai/blog/glm-5.3) · [Kimi K3.1 Pro official blog (hundreds of tasks joint RL)](https://www.kimi.ai/blog/kimi-k3-1-pro) · [A review of RLVR capability boundaries (preprint)](https://arxiv.org/html/2510.04028v1) · [ACL 2026: Boundary inspection generalized to visual language models](https://aclanthology.org/2026.acl-long.2102.pdf)
