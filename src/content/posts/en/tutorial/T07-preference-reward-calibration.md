---
title: "T07 · Reward scores are rising. Is the model actually better?"
description: "Connect preference data, reward models and DPO, then use annotation criteria, candidate distributions and calibration to detect over-optimization."
series: "model-training"
order: 7
pubDate: 2026-11-15
kind: "tutorial"
tags: ["Model training decisions","DPO","Reward models","Preference optimization"]
locale: "en"
translationKey: "tutorial/t07-preference-reward-calibration"
sourceHash: "1f6be175a66a87b1dbf7f66666e371772342a0ea3a805df725a0163ce43f646e"
---

## Three annotators and one scorer disagree

Let’s first look at a project site (the teaching scene is a schematic, the details are made up, and the model really happened).

The team is optimizing preferences for a customer service assistant. A prompt: "The complaint rate increased by 3 percentage points after the new function was launched. Help me analyze the possible reasons and give me a troubleshooting order." Two candidate answers were put on the table:

- **Answer A**: Three sentences. List the three main directions of complaint attribution (release defects, mismatch of expectations, changes in communication channels), and give the order of investigation and a reason. The content is correct without any typesetting modification;
- **Answer B**: Nine paragraphs long essay. The title, bold, points, and summary at the end are all available. First, confirm that the user "asked this question very well", covering the same three directions, and also added a fourth reason - which one is wrong.

The verdict was divided into four parties - the three annotators and the scorers each held their own opinions; domain experts later reviewed and only gave the fifth measurement basis. Putting aside the choices and reasons of each party, the shape of the differences is revealed:

| adjudicator | Choose | reasons given | The criteria behind the rationale |
|---|---|---|---|
| Annotator 1 | B | More detailed and professional | High coverage and format weight |
| Annotator 2 | B | More structured, easier to read | Readability is highly weighted |
| Annotator 3 | A | Point 4 of B is wrong | Correctness vetoed |
| Reward Model | B | Score high 0.7 | Inherits the prior for most annotations |
| Domain expert (review) | A | Error supplements are not acceptable in customer service scenarios | Correctness has the highest priority |

For the same piece of data, the five rulings did not share a common definition of "better". The problem is not with the annotator, nor with the model, but with **"better" is not defined at all in this type of task**: Should wrong additions be vetoed? Do length and structure count? Does being polite count as a plus? Not a single word was written in the specification, so everyone used their own priors to complete it, and the differences were cast into the data as they were, and then learned as they were by the Reward Model (hereinafter referred to as RM, reward model).

There is a second act to this scene. The team continued to mark 20,000 items according to the majority ruling, completed RM training, and ran preference optimization: the internal winning rate indicator continued to rise, but the independent blind review two weeks later barely moved, and the average length of the output increased by 40%. A large part of what the scorer learned was "better" was "longer, more like an expert." The mechanism of the second act is dismantled in Section 5 of this chapter; remember half of the conclusion of this act first: **When "better" is not defined, what you optimize is not the quality of the model, but the prior mean of the annotators.**

Demonstration provides a specific imitation target, and preference compares multiple candidates. Relative judgment requires reusable specifications, otherwise increasing the amount of annotations will only widen the differences.

The derivation route of this chapter is also the unfolding sequence of a production line:

```text
Section 1 Preference signal production line: multiplication of seven processes and scrap rate
    ↓
Section 2 How does preference data come from: sources, candidate distributions and divergent samples
    ↓
Section 3 Reward Model: Machines that learn sorting and the rubric resurgence in 2026
    ↓
Section 4 DPO and offline preference optimization: fold rewards into strategies
    ↓
Section 5 Reward Hacking and Overoptimization: The physics of pleasing graders
    ↓
Section 6 When does the offline signal end: three signals and switching decisions
    ↓
Section 7 Engineering Products: Reward Model Design & Calibration Report
    ↓
Section 8 The six most common misjudgments
```

---

## 1. Seven stages in producing a preference signal

### 1. First write "better" into a specification, and then talk about data

To deal with the A/B split at the beginning, the correct action is not to change the annotator, nor to add three times the data, but to go back to the starting point and make up one copy **Preference Spec** ——Translate "better" into rules that annotators can implement and differences can be arbitrated. Its minimum field set looks like this:

| Field | what does it answer | What will happen if you don’t write? |
|---|---|---|
| Evaluation dimension | What does better mean: correctness, completeness, safety, format, tone | Annotators have their own powers, and differences cannot be arbitrated |
| Hard exclusions | Any errors are vetoed with one vote (factual errors, ultra vires commitments, violation categories) | The wrong answer of "Longer and more beautiful" is a sure win |
| Weight and Arbitration Order | Who should be protected first when dimensions conflict (for example, correctness > completeness > format) | Disagreeing samples are discarded as noise |
| Contextual convention | User intent, domain, language, length expectations | The same batch of data is mixed with conflicting standards |
| Canonical version | Once the specification is changed, it will be a new version, and the existing data will be marked | The specifications have changed, and old data is silently mixed into the new version |

The opening batch of data was defeated in the first line: the specification did not say "whether error additions should be rejected with one vote," so format preference trumped correctness - this was not a problem of annotation quality, but a lack of rules.

### 2. Seven processes

The preference signal is not "a kind of data", it is a production line. Each station has its own input, scrap rate and repair methods:

```text
① Target specification “better” definition: dimensions, exclusions, arbitration order
      ↓
② Candidate generation: chosen/rejected from which model, temperature, and distribution
      ↓
③ Comparison/scoring Who will evaluate, how many people, how to arbitrate, and where differences will be channeled
      ↓
④ Data quality inspection: consistency, coverage, difficulty stratification, standard version verification
      ↓
⑤ Reward modeling Explicit RM / DPO Implicit reward / Generative Rubric RM
      ↓
⑥ Optimize DPO, PPO, etc. to write signals into parameters
      ↓
⑦ Regression evaluation Independent blind evaluation + ability benchmark + anti-reward exploitation check
```

Each process has a typical "scrap phase" - a defective form that can be recognized during quality inspection:

| process | What does scrap look like? | Who will check |
|---|---|---|
| target specification | The specification does not specify the order of arbitration, and similar disagreements occur repeatedly | Data manager |
| candidate generation | Candidates are all from old versions or other models | Sampling ledger |
| Compare / Score | The reason for labeling does not match the normative dimension | Random inspection |
| Data quality inspection | Low consistency but hard cut into the database | Quality inspection post |
| Reward modeling | The accuracy of the same distribution is high, and the online distribution drops sharply | RM Assessment (Section 3) |
| Optimize | Scores rise while blind evaluations stay flat (section 5) | Training monitoring |
| regression evaluation | Only test target ability, fallback if missed test | Evaluation Design(T10) |

### 3. The scrap rate is multiplied by

Each process has a yield rate, and the effective output of the entire line is multiplication, not addition (indicated numbers):

```text
The specification is vague and the yield rate is 0.8 (no one has determined the dimension weights)
Candidate distribution misalignment by 0.7 (candidate comes from another model)
Mark the disagreement as non-arbitrated 0.8 (30% of the samples are arbitrated by default rules)
Quality inspection only randomly checks 5% 0.9 (standard version mismatch slips through the network)
──────────────────────────────
Whole line ≈ 0.8 × 0.7 × 0.8 × 0.9 ≈ 0.40
```

(The numbers are teaching illustrations, used to express the structure, and are not statistics of any real team.) This multiplication explains a common contrast: both teams claim "100,000 preference pairs", one trained RM is stable and reliable in online distribution, and the other was broken down by output length expansion in the first week - the difference is not in the number of items, but in which processes were missed. **One hundred thousand miles multiplied by 0.4, the effective signal is only 40,000; the other party's fifty thousand miles multiplied by 0.9, it is even more.**

> **Judgment boundaries:** "Add 50,000 annotations" fixes the output; vague specifications, misaligned candidates, and lack of arbitration cannot fix the output. When reviewing a preference data proposal, first ask how each of the seven processes is done, and then ask about the total amount - if the order is reversed, you are adding a budget to the worst process.

### 4. A minimum standard capable of adjudicating opening disagreements: excerpts from precedents

A useful preference specification needs **coverage of boundary cases**, rather than more pages. The opening A/B disagreement can be settled with a few rules (teaching example):

| Jurisprudence | rules | Decide which side starts the game |
|---|---|---|
| Correctness first | Answers containing factual errors, no matter how complete, will be disqualified | Annotator 3. Expert wins |
| No points for length | Length only adds points indirectly when it comes to "more complete information", and layout itself has zero weight | The reasons for annotators 1 and 2 are invalid |
| Tone | Reward politeness, but neither reward nor penalize flattery such as “that’s an excellent question” | Starting with B is no longer an advantage |
| Same error handling | Two candidates are wrong together: marked and removed from the training set | Prevent uninformative pairs of diluted signals |
| arbitration order | Check correctness first, compare completeness next, and consider formatting last | Differences should be resolved in order and no longer rely on the number of people |

With these five elements, the opening four-way split can be cut down to a unanimous conclusion at the annotation site: A wins. And without these five elements, the same disagreement will appear ten thousand times in different guises - hundreds of "format preferences over correctness" are cast into every ten thousand preference pairs, and then amplified by RM into the default tendency of the entire data.

There is another often underestimated use of specifications: **It is the common parent for annotator training, AI feedback prompt and rubric generation**. The "machine drafting rubric, manual review" route in the case in Section 3 is drafted from this specification - the more executable the specification is, the higher the consistency of the three downstream annotation channels.

---

## 2. Two factors determine the value of preference data

### 1. Four sources: different costs, scales and deviations

| Source | typical cost | upper limit of scale | Built-in bias | suitable for what |
|---|---|---|---|---|
| Crowdsourcing human preferences | in | Level 10,000 to 100,000/month | Non-expert judgment, preferred formats and surface features | General conversation, tone, common sense preferences |
| Domain expert preferences | high | Thousand level | School and process preferences | High-threshold domains such as medical, legal, and code review |
| AI Feedback(RLAIF) | low | Million level and above | Inherit the blind spots and priors of the review model itself | Large-scale preliminary screening, low-risk dimensions |
| composition preference | low | Million level and above | The error mode is the same when the candidate and the reviewer have the same origin | Format, specification class enumerable dimensions |

This table is the projection of the introduction "feedback source ≠ optimizer" layered on the data side: the source only answers "who defines it better" and does not specify the final optimizer - AI feedback can be made into a preference pair and fed to DPO, or it can be trained into explicit RM and then run PPO. Both paths are legal.

The bias of RLAIF deserves a separate sentence: the review model itself also has priors of "longer is better" and "better structured", and it will use this prior **Batch copy** into your data. Part of the annotation budget saved with AI feedback is destined to be spent on bias audits, otherwise the money saved will be doubled back on the speculative list in Section 5.

Use scarce, expensive experts for **boundary precedents**, rather than ordinary examples. From the crowd-labeled pool, escalate the small fraction with the greatest disagreement and hardest specification questions. Expert output is more valuable as dozens of precedents establishing future rules than as thousands of routine labels. Add those precedents to the specification, then amplify them through crowd and AI channels.

The four sources are usually **mixed**. AI feedback can screen and prelabel the full pool; crowd workers handle mainstream examples; experts resolve the hardest AI–crowd disagreements; synthetic preferences fill targeted long-tail format and specification gaps. Spend each source’s budget where its bias and cost are lowest, rather than assigning the most data to the most expensive channel.

### 2. From which distribution the candidate is drawn: the first multiplier of the preference data

A preference pair is valuable when its candidates cover **mistakes the current policy can actually make**. Another ten thousand labels for errors it no longer makes add no new information. Three common candidate sources introduce different biases:

| candidate source | Deviation direction | risk |
|---|---|---|
| Double sampling for the same question (own strategy, different temperatures) | Closest to online distribution | Two candidates often make the same mistake and have low information content |
| Strong model comparison (strong model vs own model) | "Gap" poor blending ability | Part of what is learned is the imitation gap, not entirely preference |
| People write and edit answers (change good answers to bad ones, or vice versa) | Editing traces themselves become signals | Model learns to recognize artifacts but not quality |

The coverage of the three sources on the "strategy error space" can be compared with a sketch - the ideal goal is to cover the mistakes that the current strategy will actually make, rather than randomly mixing the three sources together:

```text
The room for error in the current strategy (indicative)
┌────────────────────────────────────────┐
│   Common Errors Boundary Errors Difficult Errors     │
│  ▓▓▓▓▓▓▓▓     ░░░          ·           │
│  Double sampling of the same question can be collected and requires difficulty orientation and strong model comparison coverage │
│                (Difficult example mining) (The gap is the sample)   │
└────────────────────────────────────────┘
Both wrong and right (two candidates are wrong together) = no information area: occupying the budget but not generating a ranking signal
```

"Same wrong right" deserves a separate mention: the two candidates picked out by double sampling at high temperatures for the same question are often wrong together - no matter how this preference pair is cut, it does not contain the information "what the current error of the strategy looks like." The ratio of identical, incorrect, and correct results in the data ledger is a direct reading of the quality of candidate generation.

The subtle mismatch is **borrowing across models**: generate candidates with model A to train model B’s RM. The RM learns what bad A-style answers look like, while B’s own failures may be absent. In production, B’s outputs are out of distribution and rankings degrade. This explains a common incident pattern: plenty of data without improved behavior.

Preference data also has a time dimension: **Data expires**. The preference pairs are adopted from the Nth version of the strategy; after the strategy is optimized to the N+5th version, the "bad answers" in the old candidates are no longer mistakes made by the new strategy. Offline preference data is like fresh food, not like mineral deposits - it will not appreciate in value but will only deteriorate. (How to manage freshness in online generation belongs to the decision-making site of T09, and only the coordinates are shown here.)

### 3. Disagreement samples are not noise, they are notices of standard arrears

Two people choose A and one person chooses B. The default process for most teams is "the minority obeys the majority and disagreements are discarded." Better way to handle it: **Treat divergent samples as boundary cases not covered by the specification**, flow back to the specification layer - adding an arbitration rule is much cheaper than discarding and re-labeling a batch, and similar disagreements will not occur again next time.

Track **inter-annotator agreement** and **disagreement by evaluation dimension**. Persistently low agreement first suggests unclear specifications, not careless annotators. Repair the rules before replacing people.

Samples related to "difficulty" deserve separate classification and management, and their information density is different:

| Type | what does it look like | Handle it correctly |
|---|---|---|
| same wrong right | Both candidates are wrong together, and the verdict is uninformative | Record in ledger and provide feedback on sampling strategy |
| edge case | Both are correct / both are good, the specification does not stipulate which one comes first | Reflow standard supplements case law and re-marks |
| Difficult samples | The correct answer rate is extremely low, and there are almost no good candidates | Go first to SFT/distillation to replenish ability (T06), the preference signal is useless |

The third line is often ignored: the preference signal can only "pick the better one among the existing candidates". When there is no correct answer among the candidates, no amount of preference annotation can teach the model new capabilities - that is the jurisdiction of demonstration learning (T06). The division of labor in the signal spectrum becomes apparent again here.

### 4. Inbound quality inspection: acceptance form for preferred data

Before a batch of preference pairs enters reward modeling, it needs at least the following acceptance checks, each with a recorded audit trail rather than a one-off spot check:

| Acceptance items | What to check | Failure to pass |
|---|---|---|
| Standard version consistent | The standard version when labeling each piece of data has been marked | Cross-version data are evaluated separately without mixed training |
| Candidate sources traceable | Which model version and what temperature did the candidate come from? | Non-traceable batch back-labeling |
| same-wrong ratio | Proportion of dual acquisition candidates that are wrong together | If it is too high, adjust the sampling strategy instead of accepting everything as ordered |
| Spot check on reasons for ruling | Annotation reasons can be mapped to normative dimensions | Reasons for drift batch relabeling |
| Difficulty tiers | Easy/medium/hard distribution, proportion of edge cases | All samples are "one-sided", indicating that the difficulty sampling is unbalanced |
| Coverage control | Task type × language × length distribution vs online distribution | Gap directional supplementary mining |

The logic of this list is the same as the data quality inspection of T03: **The "quality" of preference data is not a total score, but a set of process attributes that can be located and reworked**. The difference is that preference data has an extra layer of subjectivity - the same batch of data becomes another batch of data if it is standardized, so version labeling is more important than pre-training corpus.

### 5. Historical anchor: InstructGPT’s 6B RM beat 175B

[InstructGPT](https://arxiv.org/abs/2203.02155) (2022, Method Origin Anchor) reported a counter-intuitive result at the time when training the Reward Model: the ranking accuracy on retained preference pairs, **The RM of 6B parameters is higher than the RM of 175B**; The authors of the paper attribute this phenomenon to an insufficient amount of preference data to feed a larger model (measurement basis: the value reported by the paper on its internal English preference data set).

This 2022 anchor point (verification time 2026-11) has not been overturned. What it illustrates is: the main variable of RM quality is the quantity of preference data × quality × distribution matching, and the parameter quantity is just an amplifier - the amplified can be either a signal or a noise. Therefore, "If the RM is not good enough, increase the RM" is the first option that should be eliminated in most scenarios; fix the production line problems in Sections 1 and 2 first, and then look back at the model size.

> **Architectural wisdom:** The value density of preference data = the probability that a candidate falls in the policy error area × the degree of arbitrability of the annotation. Before stacking the total amount, increase each of these two multipliers by one level - it is usually cheaper and more effective than doubling the total amount.

---

## 3. The reward model learns to rank

### 1. Pairwise Ranking: What RM learns is "who is higher and who is lower", not "how good"

A standard **Reward Model (RM)** training setup is **Pairwise Ranking**: for the same prompt, score a chosen answer above a rejected answer, reducing loss as their margin grows. The classical Bradley–Terry assumption links the probability of preferring A to the difference between A’s and B’s scores. Remember the intuition; the formula is omitted here.

Three direct corollaries, each corresponding to a common misuse:

- An RM predicts **relative ranking**, not absolute quality. A score of 0.8 on prompt A cannot be compared with 0.3 on prompt B. Interpreting those scores as quality percentages is already a mistake;
- RM inherits all biases of the training pairs. In the opening batch of data where "format preference outweighs correctness", the trained RM truly believed that the nine-paragraph text was worth 0.8;
- A single scoring is just a forward calculation and is very cheap - so it can be stuffed into an online RL loop as a "cheap human review". This advantage is also the physical basis for over-optimization in Section 5: anything that is cheap enough to be queried by the optimizer an infinite number of times will be tried out infinite times.

Why not ask annotators for numerical scores and train an RM to regress them? **Absolute scores do not share a scale across annotators**. A 7 from one person and a 9 from another may reflect their scales rather than answer quality. Both people preferring A over B convey the same type of information. Pairwise ranking discards the unstable absolute scale and retains the more stable relative judgment.

### 2. Ranking consistency, calibration, and out-of-distribution behavior: three metrics that cannot replace one another

| indicator | What to measure | Common misuse |
|---|---|---|
| Ranking accuracy (held-out pairs) | Under the same distribution, the probability of ranking a pair in a new preference pair | Use it to claim "RM online is reliable" |
| Calibration | Does the difference in scores correspond to the true preference strength? | Using sorting accuracy as calibration |
| Out-of-distribution (OOD) accuracy | Sorting quality under online prompt and candidate distributions | Never expected, because online distribution is difficult to sample |

The difference between calibration and ranking consistency is one sentence: **Ranking answers "Is A higher than B", calibration answers "How much higher is it credible?" **Methods such as DPO that directly consume preference pairs are sensitive to sorting; methods such as PPO that consume scalar rewards are also sensitive to calibration - as soon as the reward scale drifts, the step size of the policy update will also drift.

**Outside the distribution is RM’s main battlefield. **Training distribution = "model version when selecting candidates × task source when labeling"; online distribution = "current strategy × real users". The distance between these two distributions is the distance between RM sliding from "0.76 good students on the validation set" to "online nonsense". When reporting RM indicators, the same distribution and the online sampling distribution must be reported separately - reporting a single number together is equivalent to not reporting it.

Use a minimum acceptance example to implement the three-piece set (all numbers are teaching instructions):

```text
RM acceptance form (indicative)
  Identical distributed held-out ranking accuracy 0.76 (training task source resampling)
  Online distribution sampling accuracy 0.68 ← gap 0.08 = out-of-distribution cost
  Calibration check Score difference is related to the front part of blind evaluation intensity, high partition distortion
  Conclusion: Can be used for best-of-n rearrangement;
       Before entering online RL, high partition distortion needs to be repaired first (reward scale drift will affect the update step size)
```

These 8 percentage points from 0.76 to 0.68 are the prices of "laboratory to online" - every RM has it, the only difference is whether it is reported or not.

### 3. Explicit RM, DPO implicit reward, generative Rubric RM

"Where to live with rewards" will have three mainstream forms in 2026. A comparison table will be given first, and the mechanisms will be unfolded in the next section and the cases in this section:

| Dimensions | explicit scalar RM | DPO implicit rewards | Generative / Rubric RM |
|---|---|---|---|
| carrier | independent scoring model | Hidden in strategy parameters | The generated model is evaluated item by item according to the scoring criteria |
| Where is the definition of "better"? | In the training data, it is not visible after training | Preference pairs drift with strategy updates | Explicit text (rubric), readable and changeable |
| Cost per assessment | Low (one forward pass) | No independent evaluation, implicitly used when optimizing | High (to generate evaluation text) |
| Interventionability | Bad (reward change = retraining) | Poor | Good (changing the rubric changes the reward) |
| Typical uses | PPO online rewards, best-of-n, data filtering | One-time offline alignment | Quality audit, difficult case arbitration, explainable evaluation |

The hybrid system is not an abstract slogan, but a concrete division of labor. A preference pipeline in the form of 2026 can look like this (schematic): scalar RM gives a cheap score to all rollouts, doing best-of-n and coarse filtering; samples whose scores fall into the high uncertainty range (scores close to the decision boundary) are transferred to rubric RM for detailed evaluation item by item, and readable review reasons are output; samples with conflicting conclusions from the two channels enter manual arbitration, and the arbitration results are backfilled with specifications and rubric - the three carriers are each assigned according to the cost bracket, rather than being mutually exclusive.

### 4. Case study: the 2026 return of rubric-based and generative reward models

A review of public research and engineering in 2026 shows that the reward layer is swinging back from the minimalist configuration of "scalar preference RM + DPO" to rubric / generative RM and hybrid systems (measurement basis: review and resource library inclusion, not an industry-wide census; verification time 2026-11):

- **Rubric-Guided RL Academic Review**(2026-08，[Cameron Wolfe: Rubric RL](https://cameronrwolfe.substack.com/p/rubric-rl)) systematically sorted out the research pedigree of "writing rewards as natural language scoring standards";
- **awesome-rubric-rewards resource library** (2026-10) documents an engineering approach worth examining: **Use feedback from RM to reversely generate atomic, interventionable natural language scoring standards, and then iterate** ——Rubric no longer relies entirely on human writing, but has become an asset that can be machine drafted, manually reviewed, and version managed;
- One study compared "explicitly extracting implicit rewards from a trained DPO policy" with "directly trained explicit RM": **The evaluation accuracy of implicit RM is about 3% lower on average and about 7% lower at worst** (measurement basis: Research conclusion, quoted from the above review; comparison settings, model size and evaluation set are subject to the original paper - this article does not write it as a fixed gap between the two types of methods, but only treats it as a quantitative clue of the "implicit reward reuse cost");
- [Hugging Face’s 2026-08 agentic RL review](https://huggingface.co/blog/sergiopaniego/agentic-rl-2026) traces this evolution from InstructGPT’s RM+PPO, through minimal offline DPO, to mixtures of outcome-based and rubric-based training.

Putting this resurgence back into the production line in this chapter, it mainly rewrites the positional relationship between the ① and ⑤ processes:

```text
Old configuration: Specification (written by humans, one-time) ──Compressed into──> Scalar RM weight (invisible)
              ↑ Retirement after training

New configuration: specification ⇄ rubric (machine drafting, human review, versioning) ⇄ RM feedback
              ↑ The specification changes from "one-time master" to "running assets"
```

For the first time, the definition of "better" includes diff and rollback - this is a qualitative change for high-risk domains (where the basis for each decision must be explained to the auditor), but may not be worth the evaluation cost for low-risk batch scenarios.

A scalar RM is a **lossy compression** of what “better” means. Once the definition is encoded in weights, it cannot be directly audited, diffed, or arbitrated. A text rubric restores those operations and item-by-item debate, but each evaluation generates text, raising cost by an order of magnitude. Rubric quality itself becomes a major variable; section 8’s sixth error examines it.

### 5. How RM will be consumed depends on which measurement basis you want

There are three typical uses of trained RM in the pipeline, each with different requirements for indicators - this is why the "three-piece evaluation package" must be reported separately:

| Consumption pattern | What to do with RM | Requirements for indicators |
|---|---|---|
| best-of-n rearrangement | Generate n candidates at a time, and RM picks the best one | Sorting accuracy (same distribution) is enough, single call |
| Data filter | Score the synthesized/sampled data and store it in the database only if it is higher than the threshold | Out-of-distribution accuracy - filtering samples from new distributions |
| Online RL Rewards | Each Rollout in the PPO cycle is scored | Sorting + Calibration + Anti-reward exploitation, all three |

The third line has the most stringent requirements: the number of times RM is queried in the online loop is several orders of magnitude higher than offline, and any deviation will be continuously amplified by the optimizer - this is the entrance to the topic of over-optimization in the next section. When choosing the RM form, first write down the consumption method: a team that only does best-of-n and a team that does online RL have completely different definitions of "enough".

> **Judgment boundaries:** "Resurgence" does not mean "replacement". In the review and resource library cited in this chapter, hybrid systems are an increasingly common form in public practice in 2026: scalar RM manages cheap online scoring, rubric manages explanation and arbitration, and rules/verifiable rewards manage parts with objective answers (next chapter). Writing any form as "has been eliminated" will not pass the comparison table above - the three carriers answer the same question at three budget brackets.

---

## 4. DPO folds reward into the policy

### 1. First look at what it saves

The classic RLHF is a two-stage process: first train RM, and then use RM as a reward to run PPO. There are two more things on the bill - an RM component to train, deploy, maintain, and retrain; and an RL loop (along with its Rollout cluster) to be sampled online. [DPO (Direct Preference Optimization, direct preference optimization)](https://arxiv.org/abs/2305.18290) (2023, the historical anchor for the method) starts with a direct question: can we eliminate both components and update the policy directly from preference pairs?

```text
Two-stage: Preference pair ──training──> explicit RM ──PPO + online sampling──> strategy
                      (standalone component) (Rollout cluster)

DPO: Preference for ──────────Direct Optimization───────────> Strategy
                      (Rewards are "folded into" the strategy parameters)
```

### 2. Implicit reward: The reward is hidden in the logarithmic ratio of the strategy and the reference

The core of DPO can be explained clearly without formulas. Under the constraint of "maximizing rewards while not being too far away from the reference policy", there is a one-to-one correspondence between the optimal strategy and the reward function—— **Rewards can be deduced from strategies**. DPO exploits this correspondence and defines the reward as "the log probability of this answer given by the current policy, minus the log probability given by the frozen reference policy" scaled by β. Therefore, when training preference pairs, raising the probability of chosen relative to the reference and lowering the probability of rejected relative to the reference is equivalent to optimizing this **implicit reward**。

Two corollaries that must be remembered together:

- **DPO has no RM, but it does have a reference model.** The frozen reference model acts as an anchor; β controls how tightly it holds. A large β keeps the policy near the reference; a small β allows greater drift. This has the same underlying purpose as PPO’s KL budget (see the general definition of Reference Policy in T01’s glossary)— **DPO omits components, not constraints**；
- **The implicit reward drifts with the policy.** Every policy update changes the implicit reward. It is a ruler attached to the policy itself: reusing it offline as a data filter or a best-of-n scorer is less stable than using an explicit RM. The previous section’s research finding—roughly 3% lower on average and 7% lower in the worst case—describes the accuracy cost of using that ruler separately.

```text
Explicit RM: Preference data ──training──> RM (frozen calibration)
                                  ↑ Strategy update does not affect this ruler

Implicit reward: Policy v1 ──Preference data──> Implicit reward v1 (relative reference calibration)
           Strategy v5──Same batch of data──> Implicit reward v5 (already shifted with the strategy)
                                  ↑ The ruler follows the strategy:
                                    The farther away from the original preference distribution, the less reliable the scale is
```

### 3. Applicable conditions and two failure sites

The prerequisites for the establishment of DPO are: high quality of preference pairs, close candidate distribution and target policy distribution, and one or a few rounds of offline updates. Two typical failure scenes:

- **Distribution shift. **The preference pair is adopted from the old strategy, and the implicit reward is "calibrated" on the old distribution; the strategy gets further and further away from training, and the ruler becomes more and more crooked the more it is used. This is two sides of the same coin as "data expiration" in Section 2: one talks about data and the other talks about rewards;
- **chosen is likely to fall. **The loss of DPO only constrains chosen and rejected** relatively poor**, there is no guarantee that the absolute probability of chosen will increase. It is common in actual training: the log-likelihood of chosen has been declining, while the relative difference (a proxy for winning rate) is still rising. This is not a training bug, but the objective function originally only promised relative preference - but it means that the signal no longer delivers "absolutely better". This curve is also the second signal of "Offline End" in Section 6.

Organize the "Symptoms → Troubleshooting → Repair" of the two failure sites into a quick check:

| Failure site | Symptoms | The first step to troubleshoot | Repair direction |
|---|---|---|---|
| Distribution shift | The winning rate in new tasks is artificially high, and old tasks are rolled back | Candidate version of preference pair vs current policy version | Re-acquisition of on-policy candidates, hybrid replay |
| chosen is likely to fall | The winning rate is rising, and the choice is likely to continue to fall | Whether rejected and chosen are close relatives of the same origin | Use harder pairs; monitor proxy features such as response length |

Both lines share a common lesson: **Most of the failures of offline preference optimization first appear in the "distance between data and strategy" rather than the loss function.**

### 4. Other offline preference optimization: classify by question, not queue by name

A whole family of methods emerged after DPO. Instead of memorizing names, it is better to classify them according to the holes they want to fill (the following table summarizes the design motivations described in each method paper, and the actual results are subject to the respective experimental settings):

| A hole that the family needs to mend | Represent ideas | One sentence motivation |
|---|---|---|
| Preference data is noisy and prone to overfitting | IPO Category 1: Change the loss pattern and add regular rules | Don’t memorize label noise as truth |
| The reference model occupies GPU memory and relies on paired data | ORPO (joint SFT single stage), SimPO (length normalization, de-reference) | Merge alignment into one loss |
| There is only a single good/bad tag, not a pair | KTO a type of unpaired target | Good/bad signals do not have to be paired to be available |

The selection questions all come back to the production line in Section 1: Is the data in pairs or single tags? What are the noise levels like? How much drift is allowed? ——Method families are just solutions to different combinations of these constraints. Write down the constraints first, and the method names will naturally be narrowed down to one or two candidates.

### 5. Route decision table: where to place the reward is determined by the consumption method

Combine Sections 3 and 4 of this chapter into a decision-making checklist (the tendency is a directional guide, and the final calculation will be based on the recalculation of the report in Section 7):

| Your constraints/consumption patterns | preferred route | Reason |
|---|---|---|
| Only one or two rounds of offline alignment, no online clustering | DPO family | No need for RM components and rollout, saving the most engineering work |
| Rewards should be reused: filtering, best-of-n, subsequent PPO | Explicit RM route | Implicit rewards drift with the strategy, and reuse accuracy is currently lower |
| Highly divergent domains (medical, legal) require auditability | rubric / generative RM participation | The definition of "better" remains in the arguable text |
| Preference data is noisy | Anti-overfitting variant + stricter quality inspection | Injecting noise into parameters is the most expensive way to deal with it |
| Only good/bad single labels | unpaired target | No need to manually spell rejected just to get the right answer |
| Large-scale low-cost primary screening | RLAIF + random inspection | The saved budget is directed towards deviation auditing |

Each row of this table is a "consumption mode decision carrier": the same "we want to do preference optimization" has six different engineering solutions under different consumption modes.

> **Architectural wisdom:** The DPO removed the Reward Model from the component list, but it did not remove the reward issue - it turned the reward into a shadow of the strategy. The saved graphics memory and engineering complexity are real, as are the calibration obligations and drift risks that cannot be saved. Choosing DPO or explicit RM is a choice of "where the rewards will live", not "whether or not to care about the rewards."

---

## 5. Reward hacking and over-optimization

### 1. Why the more rigorous the optimization, the earlier the submission will be

An RM is a **lossy proxy** for human preferences: labels and coverage are limited, and bias exists. Optimization tends to discover the **largest gap between proxy and objective**. The historical study [Gao et al., “Scaling Laws for Reward Model Overoptimization”](https://arxiv.org/abs/2210.10760) (2022) illustrates the pattern: proxy reward rises while true preference first improves, then plateaus or declines. Smaller RMs and more optimization bring the turning point earlier.

```text
score
 │              Proxy reward (RM score) ＿＿＿＿＿ keeps increasing
 │             ／
 │        ／＿＿True preference: first rise, then level, then fall
 │    ／ ↑ Inflection point: From now on, the model is "pleasing RM" and no longer "getting better"
 │ ／
 └──────────────────────────────→ Optimization intensity (steps / KL)
```

What happens to the right of the turning point has a name: **Reward Hacking(reward reward exploitation)** ——The model finds and exploits loopholes in the scorer to get high scores; the broader phenomenon is called **Overoptimization (over-optimization)**: The proxy indicator diverges from the real target. The response in the InstructGPT era has been written into the recipe: add KL penalty to the PPO target, and tie the strategy near the reference model (method origin anchor point, [InstructGPT](https://arxiv.org/abs/2203.02155))。

A commonly misunderstood boundary: Over-optimization is not exclusive to online RL. **best-of-n rearrangement will also over-optimize** ——Use the same RM to select the highest score from n candidates. The larger n is, the more likely it is that the one selected is "the best in the eyes of the RM" rather than the "really best" one; the above-mentioned classic study draws the two channels of RL and best-of-n on the same picture. The difference is only in intensity: online RL uses gradient to repeatedly drill gaps, and best-of-n uses enumeration to open gaps. The inflection point positions of the two are different and the directions are the same. Therefore, "We did not run PPO, we just used RM to select candidates" does not constitute a reason for exemption.

### 2. Common forms of reward exploitation: every one is an agency gap

| speculative pattern | The “laws” learned by the model | What do you see in independent blind reviews? |
|---|---|---|
| length expansion | Longer = higher score | The number of words has increased by 40%, but the amount of information has not increased |
| Format stacking | Title / List / Bold = High Score | The layout is becoming more and more beautiful, and the content is becoming hollow |
| Flattery | Follow user defaults = high scores | If users make mistakes, they will also make mistakes |
| authoritative look | Quotes, terminology, confident tone = high score | Talking nonsense seriously |
| Keyword repeat | Words favored by the rater appear more frequently | The word frequency is abnormal and the answer is wrong |
| Taking advantage of scoring blind spots | RM A mistake that cannot be seen is not a mistake | The factual error rate increases, and the RM score is higher |

Note the last item: it states **In adversarial evaluation, you cannot just use RM to judge the results yourself** ——reward exploitation detection must rely on channels other than RM (manual blind evaluation, competency benchmarks, fact checking), otherwise the defendant will be the judge.

Among the six forms, **Length drift is the cheapest early signal**: The average number of words does not require manual review, and the curve can be drawn by day in the training log. Of course it will give false positives (some tasks do require longer answers), but as a trigger that is "worth opening a manual spot check", it is much faster than waiting for the blind evaluation cycle - the point of monitoring design is not to be accurate for every signal, but to let the cheapest signal sound first, and then the more expensive signal will rule.

### 3. Five lines of defense and their respective bills

| line of defense | mechanism | cost |
|---|---|---|
| KL budget | Limit the distance of the strategy from the reference. The farther the reward exploitation path, the more expensive it is | The same rope also ties the upper limit of learning; the budget needs to be calibrated with monitoring |
| Reward Ensemble | Multiple RMs are aggregated and scored, and it is difficult for a single point of vulnerability to take effect on all RMs at the same time | Train and maintain N sets of RMs; there must be rules for adjudication of differences among members |
| Rubric refinement | Write "better" in detail to compress agency gaps | Over-elaboration and over-fitting the rubric itself; increased evaluation costs |
| Manual inspection | Regular blind evaluation and comparison of RM scores to detect calibration drift early | Continuous manpower; sampling design should prevent "always selecting the easy ones" |
| Countermeasures | Red team samples, held-out controls, anti-reward exploitation probes | Construction cost; samples will expire with model iteration and need to be rotated |

The Reward Ensemble also has a by-product worth utilizing on its own: **Disagreement among members is itself a signal**. The large differences in the scores of several RMs on the same answer indicate that it falls in the rarefied area of ​​the training distribution. These samples are exactly the boundary cases mentioned in Section 2. They are directly entered into the manual arbitration queue and have a much higher information density than random sampling. The line of defense and data production are connected in a closed loop: the mechanism to prevent reward exploitation is also a mechanism to discover difficult cases.

### 4. How to calibrate KL budget: a minimum process

The KL coefficient (or DPO's β) is most taboo in copying a number from other papers. Four steps of the minimum calibration process:

```text
① Select 2-3 KL budget gears (such as loose/medium/tight)
        ↓
② Take a short training session in each gear and record four curves:
   Agency score / independent blind evaluation / output length / ability benchmark spot check
        ↓
③ Find the widest range where "blind reviews are still rising but the length is not drifting"
        ↓
④ Enter the file and run, review every week; if the blind evaluation is flat, it will return to ② Recalibrate
```

Step 3 is the whole point: the optimal value of KL budget is defined in the joint space of "blind evaluation gain × speculative risk", not on KL's own curve - the gear selected based only on the agent score must be loose.

> **Judgment Boundary:**KL Budget is not insurance, it is exchange. It ties "how far you can learn" and "how far you can drift" on the same rope: tighten, reward exploitation is reduced, and the ceiling of ability is lowered; relax, and vice versa. It is a knob that needs to be calibrated repeatedly according to the monitoring data. It is not a constant that bigger is better. And without independent blind evaluation, you wouldn’t even know that the turning point has been passed—the prerequisite for the defense is that there are referees other than RM.

---

## 6. Three signals that offline feedback has reached its limits

### 1. Three signals

Demonstrate specifying a learning goal and preferring to compare multiple responses. But the offline preference signal has a physical upper limit - the data is fixed, the scorer is fixed, but the strategy is moving. Three signals indicate “it’s over”:

**Signal 1: the static dataset is exhausted.** The policy repeatedly reads the same fixed preference pairs until it memorizes them. Symptoms: training loss plateaus, held-out ranking metrics stop improving, and ablations show that adding more data has near-zero marginal benefit. Further training merely amplifies existing patterns without adding new information.

**Signal 2: chosen seems to be falling.** (DPO family) The winning rate proxy indicator is still rising, but the absolute log-likelihood of chosen is declining. The objective function only promises relative preference, and the signal no longer conveys "absolute improvement" - the ruler still measures "who is higher and who is lower", but it no longer measures "whether it has improved or not."

**Signal 3: The winning rate increases and the ability is flat. **The internal win rate against the old version continues to rise, but the independent human blind review and ability benchmarks are sideways. This is the first scene of overoptimization: the optimization goal has slipped from "getting better" to "please the scorer".

All three signals may be false positives - the winning rate may be flat, or the evaluation may not be sensitive enough; the likelihood of falling may be due to the same origin of chosen / rejected in the data. Therefore, the processing is always multi-channel confirmation and no single indicator decision-making is made:

| signal | Common false positives | Confirm channel |
|---|---|---|
| Static data brushing | Platforms caused by improper learning rate/batch size settings | Run a small data-addition ablation: if it helps, the dataset has not been exhausted |
| chosen is likely to fall | In the data, chosen / rejected close relatives of the same origin | Sampling to check the source of candidate pairs and the same error rate |
| Winning rate increases, ability equals | The evaluation set is insensitive or contaminated | Change independent blind review to rotate annotators; compare with held-out task |

There is another suspicion that is easy to miss: **Commenting on being sick**. The sideways performance of blind evaluation may not be due to the fact that the model has not improved, but because the blind evaluation samples are outdated, annotation fatigue, or the standard version is mismatched. The decision tree in the next section places "independent blind evaluation confirmation" before triage, in order to verify the integrity of the referee first, and then judge the players.

### 2. After the end: fix the data, fix the scorer, or change the route

```text
"End" signal appears
      ↓
Independent blind review confirmation (first rule out false positives such as "the review is not sensitive")
      ↓
┌──────────────────┬──────────────────┬──────────────────┐
│ grader issues         │ Data issues           │ Signal type issue        │
│ reward exploitation/calibration drift     │ Candidate distribution expired        │ The task book has objective answers     │
↓                  ↓                  ↓
Feed back adversarial examples; resample on-policy candidates → move to RLVR (T08)
rubric refinement, remedial cases and edge cases, the task is long-term and multi-step
ensemble / Tighten KL update specification version → Convert to Agentic RL(T09)
↓                  ↓
After completing the training, take another round of training and blindly review the benefits (stop if there is no independent benefit)
      ↓
Still no profit → Stop: This offline signal has been drained, and the budget is transferred to other stages (T11)
```

**Repair before switching:** moving to online RL without fixing the scorer and data transfers a defective signal into a more expensive system. RL amplifies reward defects instead of curing them. Conversely, when objective answers can be verified cheaply, asking which answer is preferred can substitute an expensive preference signal for a cheaper verifier—the subject of T08.

This decision tree also has budget implications (connected to the three ledgers of T02): the cost of repairing the grader is the line of labeling and review, the cost of repairing the data is the line of sampling and quality inspection, and the cost of changing the route is the line of Rollout cluster and training system - the unit price difference of the three lines is one order of magnitude. Writing "where to go after the end" into the plan in advance is essentially to negotiate the switching conditions of these three budget lines in advance, rather than temporarily establishing the project in the middle of training.

### 3. Case dismantling: Officially recognized “signal erosion” and cross-signal repair

The most direct public case in 2026 comes from GLM-5( [technical report](https://arxiv.org/abs/2602.15763), measurement basis: official report disclosure): Subsequent training uses sequential RL—SFT, followed by Reasoning RL, Agentic RL, and General RL— **The official clearly admits that multi-stage sequential RL will erode the skills of the previous stage**, use on-policy cross-stage distillation (OPD) at the end of the pipeline to repair the capability rollback in early stages.

The case matters because it acknowledges that optimizing one stage’s reward can erode capabilities outside that signal. The cited frontier report describes an engineering problem, not merely a theoretical risk, and repairs it by **introducing another signal—distillation** rather than continuing the same optimization. More data or tighter KL within one signal family has limits; cross-signal repair connects preferences, distillation, and verifiable rewards. T11 covers the orchestration.

### 4. Back to the opening: two acts, two antidotes

We can now prescribe a response for each opening scenario:

| opening scene | Cause | The antidote lies |
|---|---|---|
| Act One: The Four Parties Judgment Split | There is no standard for "better" | Section 1 Preference Norms and Case Tables - Five Elements Rules Can Resolve Differences |
| Act Two: Increased winning rate, flat blind evaluation, and expanded length | Optimization goal slides toward pleasing grader | Line of defense in Section 5 (independent blind evaluation, length monitoring, KL calibration) + stop signal in Section 6 |

The two acts are two successive sections of the same causal chain: the first act casts the deviation into the data, and the second act allows the optimizer to amplify the deviation into behavior. The whole job of preference engineering is to repeatedly insert cards between these two stages: specifications are stuck before data, monitoring is stuck during optimization, and exit conditions are stuck after training.

> **Architectural wisdom:** The exhaustion of offline preference signals is not a failure, but a well-designed consumable. Defining "how to count the end" and "where to go after the end" in advance is closer to how the real assembly line will operate in 2026 than counting on a signal to train to the end.

---

## 7. Engineering artifact: Reward Model Design and Calibration Report

Preference and reward projects often fail because **nobody can reconstruct why the choices were made**, rather than because training crashed. This report condenses the pipeline into five tables for review, with illustrative values and explicit measurement definitions.

**A. Preference norms (product of Section 1)**

| Field | Example value | measurement basis |
|---|---|---|
| Evaluation dimensions and weights | Correctness (a veto criterion) > completeness > formatting > tone | Specification v1.3 |
| Hard exclusions | Factual errors, ultra vires commitments, categories of violations | Specification v1.3 |
| Contextual convention | Chinese customer service domain, single round, expected length < 500 words | product definition |
| Changes to arbitration rules | "Error supplementary one-vote veto" added since v1.2 | Specification changelog |

There is only one acceptance criterion for the specification table: two new annotators can only read this table and give unanimous decisions on the same boundary sample - if they cannot do this, they will have to rewrite it.

**B. Candidate distribution and annotation quality (product of Section 2)**

| Field | Example value | measurement basis |
|---|---|---|
| candidate source | Own strategy v12 double sampling of the same question 80% + strong model comparison 20% | Sampling record |
| number of preference pairs | 48,000 (training : validation = 9 : 1) | Data ledger |
| same-wrong ratio | 9% (double mining candidates were wrong together and have been removed from the training set) | Sampling ledger |
| Inter-annotator consistency | 0.81 (three-person verdict) | Random inspection of batches |
| The destination of divergent samples | 12% fed back into the guidelines; 3 arbitration rules added in total | Quality inspection ledger |

An agreement of 0.81 means that about one-fifth of the sample three people disagreed—that fifth is the entry point for the next iteration of the specification, not scrap.

**C. Reward model and calibration (product of Sections 3 and 4)**

| Field | Example value | measurement basis |
|---|---|---|
| Bonus form | Explicit scalar RM (online scoring) + rubric RM (arbitrating disagreements) | Mixed system |
| held-out sorting accuracy | 0.76 (same distribution)/ 0.68 (online distribution sampling) | The two measurement bases are reported separately |
| Calibration check | Piecewise correlation between score difference and blind rating preference strength | Randomly inspect 400 pairs |
| Adversarial sample hit rate | Length speculative sample 3.1% hits | Red Team Set v2 |
| Optimization method | DPO (β according to the table KL monitoring calibration) | training configuration |

**D. Over-optimized monitoring and switching strategy (product of Sections 5 and 6)**

| Monitoring items | Threshold (illustrative) | trigger action |
|---|---|---|
| Correlation between RM scores and blind assessment | < 0.3 for two consecutive weeks | Stop training and reflow adversarial samples |
| Output length drift | > 25% | Check length reward exploitation and consider length penalty |
| chosen log-likelihood | Continuous decline | Review candidate distributions and consider re-acquisition |
| KL / β | over budget line | Tighten the constraint coefficient |
| independent ability benchmark | Any ability regress > 2 points | Freeze and go back to the process (T10) |
| Three signals appear simultaneously | — | Triage according to the decision tree in Section 6 instead of continuing to add data |

**E. Review section (backfill after each round of training)**

| Field | Example value | measurement basis |
|---|---|---|
| Blind review gain in this round | +3.1% (versus the previous version) | Independent blind review, rotating annotators |
| end signal | Signal three (light) | Monitoring ledger |
| Adversarial sample hit changes | 3.1% → 2.4% | Red team set v2, not rotated |
| Next decision | Repair the scorer: rubric, add 2 cases, and train again | decision record |

The review section changes the report from a "project establishment document" to a "rolling ledger" - it is also the direct input for determining "which checkpoint should be stopped in the preferred phase" during T11 training arrangement.

This report has the same nature as the budget table of T02 and the distillation strategy of T06: it does not guarantee that the decision is correct; **Can be reviewed** ——A new colleague took over half a year later and was able to read the current definition, evidence and exit conditions of each signal from these five tables.

> **Architectural wisdom:** Documentation of reward programs is not to pass reviews, but to make deviations attributable. Every time "Why did the model change like this" was asked in the preference project, the answer should be pointed out in a certain table: which version of the specification was changed, which version the candidate was adopted from, which monitoring item sounded first - a team that cannot point out can only regard good luck as a methodology.

---

## 8. Six common reasoning errors

### Mistake 1: Treating preference optimization as an annotation volume issue

If any one of specification, distribution, and arbitration is missing, the annotation volume will amplify the noise. InstructGPT's 6B RM demonstrated in 2022: preference data is the main variable of RM quality. Build the production line first, then talk about the total volume.

### Mistake 2: Treating candidate distribution mismatch as data diversity

Using candidates of model A to train model B, RM learns the defect pattern of A; B’s own error area has no signal coverage, and the evaluation falls outside the distribution. Diversity depends on distribution coverage and freshness, not the number of sources.

### Mistake 3: Taking RM score as true quality

RM learns relative sorting, and scores are not comparable across prompts; identically distributed accuracy does not guarantee online reliability. Reporting of RM indicators must distinguish between ranking, calibration and out-of-distribution measurement bases.

### Mistake 4: Treating the DPO as a free lunch

DPO removes the RM component and online sampling. It does not remove the reference-model dependency, β calibration, implicit-reward drift, or declining chosen-response likelihood. When reusing rewards for filtering, best-of-n, or PPO, an explicit RM is currently more reliable. “Roughly 3% lower on average and 7% lower in the worst case” is a research result, not a fixed gap, but its direction matters.

### Mistake 5: Declare victory when RM score goes up

Monotonically increasing agent scores can be true simultaneously with decreasing true quality - this is the definition of overoptimization, not an accident. Without independent blind reviews, length monitoring, and confrontational reviews, "victory" and "reward exploitation" cannot be distinguished.

### Mistake 6: The finer the rubric, the more reliable it is

Thinning does compress agent gaps, but too thin a rubric will overfit specific instances, drive up the cost of generating each evaluation, and make it difficult to maintain consistency across annotators. Fineness is a variable that needs to be recalibrated as the task distribution drifts, not a constant that bigger is better.

---

## 🎯 Quick check

```quiz
{
  "question": "Preference optimization training for three weeks: RM score and internal winning rate continued to increase, but independent manual blind evaluation went sideways, and the average output length increased by 40%. What should be done next?",
  "options": [
    "Continue training and add 50,000 preference pairs. If there is enough data, blind evaluation will naturally be started",
    "Stop training first and perform optimization troubleshooting: check the correlation between RM score and blind evaluation, adversarial example hit rate, length drift and KL, repair the scorer or tighten the constraints before training again",
    "Immediately change to a Reward Model with a larger number of parameters and retrain it"
  ],
  "answer": 1,
  "explanation": "Increasing winning rate and flat ability are the first signs of overoptimization: the optimization goal has slipped from \"becoming better\" to \"pleasing the scorer\". Adding data cannot fix the scorer defects; the same goes for increasing RM - InstructGPT's 6B RM has long shown that data is the main variable. The correct action is to practice signals first and then talk about training."
}
```

```quiz
{
  "question": "Why does it often fail to achieve results when using candidates generated by model A to train the reward model of model B?",
  "options": [
    "It will not fail. The preference judgment is universal, regardless of which model the candidate comes from",
    "Because the number of parameters of B is different from that of A, the fractional scale does not match",
    "What RM learns from A's output distribution is \"A's poor answer\"; the error area that B himself will make is not covered by the training signal, and RM's real output to B falls outside the distribution, and the ranking is inaccurate"
  ],
  "answer": 2,
  "explanation": "The value density of the preference data depends on whether the candidate falls in a region where the current strategy will make mistakes. By borrowing candidates across models, what is learned is other people's defect patterns; coupled with the data expiration caused by policy updates, the working point of RM continues to drift outside the distribution."
}
```

```quiz
{
  "question": "What does the “implicit reward” of DPO consist of?",
  "options": [
    "The output score of a separately trained Reward Model",
    "\"The difference in the log probability of the same answer between the current policy and the frozen reference policy\" scaled by β, which drifts with policy updates",
    "The difference between the mean scores given by annotators for chosen and rejected"
  ],
  "answer": 1,
  "explanation": "DPO uses the one-to-one correspondence between the optimal strategy and the reward under the KL constraint to back-solve the reward from the strategy: the reward is hidden in the logarithmic ratio of the strategy and the reference. Therefore, DPO does not have RM components, but does have Reference dependencies - what is omitted are components, not constraints; and implicit rewards drift with the strategy, and the accuracy when taken out separately for reuse is not as accurate as explicit RM."
}
```

```quiz
{
  "question": "InstructGPT reports that the RM with 6B parameters beats the RM with 175B in preference ranking. What does this historical anchor point mean?",
  "options": [
    "The main variable of RM quality is the quantity, quality and distribution matching of preference data. The number of parameters is just an amplifier - when there is insufficient data, a larger RM will not be better, and may even be worse",
    "6B is the optimal parameter amount for training Reward Model, and latecomers can just copy it",
    "The Reward Model with larger parameters must be stronger. This result is just a matter of training techniques in 2022"
  ],
  "answer": 0,
  "explanation": "measurement basis reminder: This is the value reported by the InstructGPT paper on its internal English preference data (2022), and is not a universal constant across data sets. The judgment it supports is \"data is the main variable\" rather than \"6B is the magic number\" - if you change a batch of larger and more diverse preference data, the optimal RM scale may completely change."
}
```

```quiz
{
  "question": "\"The more detailed the Rubric is, the more reliable the Reward Model will be\" - is this correct?",
  "options": [
    "Yes, the finer the rubric, the closer it is to the true value. There is no upper limit",
    "Yes, because generative evaluation itself is not biased, the details just make it more accurate",
    "Not necessarily: an overly granular rubric will overfit the specific instance, drive up the generation cost of each evaluation, and make it difficult to maintain consistency across annotators; granularity is a variable that is recalibrated as the task distribution drifts"
  ],
  "answer": 2,
  "explanation": "What is refined and compressed is the \"gap between the agent and the true value\", with diminishing returns; after a certain point, the rubric itself becomes a new over-fitting object and quality main variable. Generative evaluation also inherits the biases of review models and is not unbiased. The engineering route in 2026 is to make rubric draftable, auditable, and iterable, rather than infinitely detailed."
}
```

---

## Chapter summary

- Define an arbitrable preference specification first and let candidates cover the true usage distribution; the number of annotations cannot compensate for specification or sampling bias.
- Explicit RM and DPO bear different component costs; the sorting, calibration and out-of-distribution quality of RM must be accepted separately.
- When the reward score continues to increase but the independent blind evaluation stagnates, you should check the optimization and prioritize the specification, distribution or scorer.

> **Question for the next chapter:** Preference signals usually require judgment of "which answer is better"; if the task has objectively verifiable results, verifiable rewards can be further used. The next chapter discusses the premises and boundaries of RLVR.

---

## Terminology reference

| Terminology | How can beginners understand first |
|---|---|
| Preference pair (Chosen / Rejected) | Two answers to the same question, plus a verdict on which one humans want more |
| Reward Model(RM) | A model that compresses a large number of preference pairs into a scorer: inputs answers, outputs scores, and scores are used for ranking |
| Pairwise Ranking Loss | The standard training goal of RM: only requires that the score of chosen is higher than rejected, and does not require that the score has an absolute meaning |
| Bradley–Terry assumption | Classic approach: Link "the probability of A being preferred" to the score difference between A and B, making the sorting a learnable probability |
| Ranking consistency vs calibration | The former answers "Is A higher than B?" and the latter answers "How much higher is it credible?"; the two indicators cannot replace each other |
| Out-of-distribution (OOD) evaluation | Check whether the RM ranking is accurate on a distribution other than the training data (usually real online traffic) |
| DPO | An offline method that directly uses preference pairs to update the policy: no training of RM, no online sampling, and the reward is implicit in the policy parameters |
| implicit reward | The "difference between the logarithmic probabilities of the current strategy and the reference policy" scaled by β in DPO, drifting as the strategy is updated |
| β (reference constraint coefficient) | The elastic band that ties the distance between the strategy and the reference model in DPO; has the same origin as the KL budget of PPO |
| Reward Hacking / Overoptimization | The model takes advantage of scorer loopholes to get high scores (length expansion, format stacking, flattery); broadly speaking, it means that the agent score rises while the real target first rises and then falls |
| KL budget | The limit of how far a strategy is allowed to drift from the reference model: Tightening reduces reward exploitation and lowers the upper limit, which is a knob that needs to be calibrated |
| Rubric / Generative RM | Use a generative model to evaluate the re-aggregated reward form item by item according to natural language scoring standards: readable, changeable, and auditable |

---

## Related links

- In-topic context: [T01 · Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [T06 · Demonstration learning](/en/tutorial/t06-sft-distillation-transfer-boundary/) · [T08 · Verifiable reinforcement learning](/en/tutorial/t08-rlvr-prerequisites-attribution-health/) · [T10 · Safety and evaluation](/en/tutorial/t10-safety-spec-evaluation-gate/)
- Method origin: [InstructGPT / RLHF](https://arxiv.org/abs/2203.02155) · [DPO](https://arxiv.org/abs/2305.18290) · [Reward Model Overoptimization](https://arxiv.org/abs/2210.10760)
- Current status of reward layer in 2026: [Cameron Wolfe: Rubric RL Review](https://cameronrwolfe.substack.com/p/rubric-rl) · [Hugging Face: Agentic RL 2026 Review](https://huggingface.co/blog/sergiopaniego/agentic-rl-2026) · [GLM-5 technical report](https://arxiv.org/abs/2602.15763)
