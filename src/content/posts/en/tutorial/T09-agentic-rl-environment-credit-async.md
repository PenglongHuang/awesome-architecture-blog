---
title: "T09 · Training an agent: why the environment is harder than the task list"
description: "Turn tool interaction into useful learning trajectories, with environment isolation, credit assignment, asynchronous policy lag and cost per valid trajectory."
series: "model-training"
order: 9
pubDate: 2026-11-17
kind: "tutorial"
tags: ["Model training decisions","Agentic RL","Training environment","Asynchronous training"]
locale: "en"
translationKey: "tutorial/t09-agentic-rl-environment-credit-async"
sourceHash: "b946c9fc0b321809f5fcd3d98c310d5c9708c434f5329111b9009bd7a7e8dfc4"
---

## Why the same RL machinery struggles with a real repository

First place the two scenes side by side.

**Scenario 1 (T08’s main setting)**: Mathematics RLVR. The model receives a question and generates a reasoning and answer worth several thousand Tokens. The verifier compares the standard answer and gives a 0/1 reward within a few seconds. One sampling = one generation; tasks are independent of each other; the environment does not exist - in other words, the environment is the thin paper of "topic + verifier".

**Scene 2 (the home field of this chapter)**: Fix a GitHub issue in a real repository. The model needs to clone the repository, read the code, locate the suspect file, change the code, run the test, read the error report, and change again - dozens of tool calls, each step changing the environment state (file system, test results, processes in the terminal); the reward is only revealed at the end: whether the test passes or not. How long does it take to complete a track? [Inkling 2 Small’s RL ledger](https://thinkingmachines.ai/news/inkling-2-small) provides a real scale: per-rollout token counts of p50 = 43K and p99 = 1.5M, with durations of about 8 minutes at p50 and 4 hours at p99 (officially disclosed RL rollout statistics). **what does it mean**: Also called "taking a sample", RLVR's sample is "generated once", and Agentic's sample is "a history with side effects that takes minutes to hours".

The first move of many teams is to take the T08 RLVR training plan as it is and replace it with a batch of more difficult task lists. Then the training loop breaks in three places:

- **environmental rupture**: Dozens of concurrent Rollouts change files and run tests at the same time. The environment contaminates each other and randomly crashes. Half of the tracks die from environmental failures rather than strategy errors;
- **attribution break**: The reward only appears at the ending. In the 60-step trajectory, the error may occur at step 5 or step 55. The premise of "a set of regular and comparable trajectories for the same question" is no longer naturally true;
- **throughput break**: A trajectory starts in 8 minutes and has a long tail of 4 hours. Synchronous training makes the GPU spend most of its time waiting for the slowest trajectory to end.

The three fractures each belong to different coordinate system layers, and therefore each has its own solution:

```text
Environmental Fracture → Layers ②⑥⑦: Environmental Assets + Isolated Components + Topology (Section 1, 5, 7)
Broken attribution → layer ④: choose a credit-assignment method (section 3)
Throughput Break → Layer 7: Asynchronous Topology and Scheduling (Section 4)
```

The derivation route of this chapter:

```text
Section 1 The environment is a first-class training asset (four-piece, isolated, reproducible)
    ↓
Section 2 From Task to Trajectory (Observation/Action/Compaction/Replayable)
    ↓
Section 3 Reward and Credit Allocation (Main Case: GLM-5.2 to critic-based PPO)
    ↓
Section 4 Asynchronous training topology (On-policy/Policy Lag/Prefix cache)
    ↓
Section 5 Environment Throughput and Training Economy (Cost of Each Valid Trajectory)
    ↓
Section 6 Evaluation of Agentic RL (isolated from the environment in addition to success rate)
    ↓
Section 7 End-to-end architecture derivation (data flow of a software engineering agent)
    ↓
Section 8 Engineering Products: Agent Environment Specification
```

First use a table to separate T08 from the decision-making scene in this chapter:

| Judgment layer | RLVR（T08） | Agentic RL（T09） |
|---|---|---|
| Minimal training materials | Prompt + Multiple entries for the same question Rollout + Reward | Multi-round interactive trajectory + environmental feedback + Reward |
| Reward time | Verification at the end of generation | Usually only in the task final state (there may also be process signals) |
| role of environment | Almost non-existent (question + validator) | First class training assets: status, tools, reset, isolation |
| Trajectory shape | Generated once and of the same length | Dozens of tool calls, length difference of more than an order of magnitude |
| System focus | Group integrity, anti-reward exploitation | Environment throughput, policy lag, cost per trajectory |

> **Architectural wisdom:** Understanding Agentic RL as "changing a batch of more difficult task lists" is equivalent to treating a drama performance as changing the script - the real new engineering object is the stage itself: environment, trajectory, asynchronous arrangement. The task list is only the most superficial part of the asset that is the environment.

---

## 1. The environment is a first-class training asset

### 1. Four-piece definition of environment

In engineering discussions in 2026, "RL environment" has converged into a fairly specific definition: **Task + test + container + reward rules** (a qualitative observation from industry blog discussions around 2026-09). Break it down:

- **Task**: Initial status and target description (an issue, a web page operation instruction, a data query request);
- **test**: Methods to determine whether the final state has been reached (unit testing, end-to-end assertions, page status checks);
- **container**: The isolated space where the task runs (Docker container, virtual machine, microVM);
- **Bonus rules**: Map test results and process constraints (upper limit of steps, illegal operations) into scores.

Control [GLM-5 technical report](https://arxiv.org/abs/2602.15763) (2026-02) The three-piece agentic environment set disclosed by (2026-02) shows that this definition is not an abstract deduction: **Real issue-PR pair** (Tasks + tests are all from real repository history), **Dockerized terminal** (container), **web knowledge graph** (another source of tasks). The same report gives SWE-bench-Verified 77.8 and Terminal-Bench 2.0 56.2 (as reported; the highest among open-source models at release). Note the benchmark version: TB 2.0. Section 6 explains why a score must travel with its version number.

### 2. Seven aspects of environmental specifications

Think of "environment" as an engineering object for which specifications can be written. It has at least seven aspects that must be answered:

```text
┌──────────────────────────────────────────────────┐
│ Agent environment                                         │
│                                                    │
│  ① Task definition: where the task comes from and how the difficulty is stratified          │
│  ② Initial state: What does the environment look like after each reset?            │
│  ③ Tool interface: What can be called by the model, parameters and return format    │
│  ④ Permission boundaries: Which operations are prohibited and how to deal with cross-border violations      │
│  ⑤ Reset mechanism: How to return to a clean state after the trajectory ends      │
│  ⑥ Termination conditions: when to determine success/failure/timeout            │
│  ⑦ Reward and verification: How to test the final state and how to punish the process constraints        │
└──────────────────────────────────────────────────┘
```

Dimensions ④ and ⑤ are easily missed by task-list thinking. Without explicit permissions, a model may use `rm -rf` to make tests impossible to run and evade failure checks. Without strict resets, files changed by one trajectory leak into the next and contaminate the learning signal with environment noise. Condense the seven dimensions into a review table:

| noodles | key questions | Typical consequences of not writing |
|---|---|---|
| ① Task definition | Where do tasks come from and how are the levels of difficulty stratified? | The tasks are all piled on the difficulty zone that the model just can't handle, the reward is always 0, and the training is idle |
| ② Initial state | What does the environment look like after the reset? | The initial state drifts randomly, and "comparable problems with the same question" fail from the source |
| ③ Tool interface | What tools, parameters and return formats are there? | The model learns the calling habit itself, and the ability to change a set of tool names returns to zero |
| ④ Permission boundaries | What operations are prohibited and what are the penalties for crossing the line? | The model found that "making the test not run" is easier to score than "fixing the code" |
| ⑤ Reset mechanism | How to get clean after the track is over | Changes from the previous item are leaked into the next item, and environmental noise is mixed into the learning signal |
| ⑥ Termination conditions | When to determine success/failure/timeout | In the absence of a timeout policy, long trajectories occupy the Worker indefinitely |
| ⑦ Rewards and verification | How to measure the final state and how to punish the process | After the revision of the reward rules, old trajectories are mixed with new rules, and the experiments are incomparable |

### 3. Three realizations and costs of reset

The fifth aspect deserves to be expanded separately because it is the most stable expense in the "environmental account". There are three mainstream implementations of reset:

| reset implementation | practice | Advantages | cost |
|---|---|---|---|
| rebuild | Each track starts fresh from the image | Cleanest, no risk of residue | Startup overhead = fixed tax per trajectory |
| Snapshot recovery | Take a snapshot before the trajectory starts and roll back when it ends | Recovery is fast, within seconds | Storage costs; side effects (external network calls) not covered by snapshots will still remain |
| template clone | Clone new instances in seconds using microVM templates | Clean and fast, one-sandbox-per-rollout vector | Template version management is required. Template aging is a new source of drift |

Pay attention to a blind spot in snapshot recovery: if the tool call leaves traces outside the environment (side effects of external APIs, commits in remote warehouses), the snapshot cannot be rolled back - such "side effects outside the environment" are either prohibited in the task agreement, or explicitly checked during acceptance. The state residual check should be a fixed release gates before the environment goes online: run a trajectory that is known to modify the environment, and compare the initial state item by item after reset.

### 4. Reality, simulation, synthesis: the choice between three environmental sources

| environmental sources | Typical example | Advantages | cost |
|---|---|---|---|
| real environment | Real issue-PR pair, real website | The distribution is closest to the online scenario | The status is uncontrollable, difficult to reset, and may have copyright and privacy issues |
| simulated environment | Locally cloned services and replayed web page snapshots | Resettable, repeatable, cheap | There is a distribution difference with the real world, and the model may learn "simulator-specific skills" |
| synthetic environment | Procedurally generated task families (inject bugs and then require fixes) | The amount of tasks is almost unlimited and the difficulty is controllable | The task distribution is narrow and it is easy to overfit to the generated template |

GLM-5's "real issue-PR pair" chooses the real route at the expense of dealing with the diversity and noise of real warehouses; the typical risk of the synthetic route is the opposite - the injection bug fix may converge into template matching. The three routes are not single choices, and it is normal to mix them in the same set of training; what really needs to be written into the decision-making record is their respective proportions and acceptance methods - especially a separate set of "set-out tasks" for each source: simulator skills and template overfitting are only exposed in the set-out sets for the respective sources, and they are all averaged out when mixed into a total score.

### 5. Isolation levels: from shared containers to one sandbox per rollout

When dozens of Rollouts are executed concurrently, the isolation level directly determines the probability of "state pollution":

| Isolation plan | startup overhead | isolation strength | Typical questions |
|---|---|---|---|
| Shared container/shared file system | lowest | weak | Modification of one trajectory affects another, and the learning signal is contaminated |
| One container per task | Second level | in | Multiple Rollouts in the same task still interfere with each other |
| One sandbox per rollout (one-sandbox-per-rollout) | Depends on implementation | Strong | Sandbox startup costs must be reduced to negligible |
| VM / microVM | Traditional VM in minutes; microVM in seconds | strongest | Increased resource and management complexity |

Engineering discussions in 2026-09 crystallized “one sandbox per rollout” into an explicit slogan (a practitioner blog post dated 2026-09-11, titled “one-sandbox-per-rollout”). The associated hardware direction is microVM sandboxing: lightweight virtual machines that start in seconds reduce the overhead of assigning a sandbox to each trajectory (Prime Sandboxes, 2026-09-23). **what does it mean**: Isolation is no longer a bonus item in the "safety specifications", but a prerequisite for learning signal purity - a dirty trace in a shared environment, the cost is not a sample, but contamination of the entire group comparison.

During the same period, the "marketization" of RL environments also appeared: Hugging Face published a post on 2026-09-28 to introduce RL environments to the hub ("Welcome RL Environments to the hub", blog post title + date reference). The environment began to become a releasable, reusable, and outsourced asset, rather than a self-built island for each laboratory. One industry observer from 2026-09 even called lab investment in RL environments "more than almost everything else" - a qualitative observation worth recording, but not a recalculable number, and treated as an observation when cited (F12 Discipline).

### 6. Versioning, reproducibility and task leakage

The environment must be versioned like the data, for three reasons all pointing to training evidence:

- **Reproducible**: With the same strategy + the same environment version, the two Rollout results should be statistically consistent (allowing the randomness inherent in the environment, but not allowing unrecorded version drift); Section 6 will expand on why "high success rate but non-reproducible" is the poison of training;
- **Task leak**: check that the training environment’s task pool is isolated from evaluation benchmarks. Otherwise, scores measure memorization rather than capability—the same contamination problem as T03, with tasks replacing corpus text;
- **Return to comparable**: After the environment is revised (changing the base image, adding testing), the success rate across versions cannot be directly compared, and the baseline must be rerun.

> **Judgment Boundary:** The first indicator of the environment is the triangle: authenticity (how close to the online distribution), stability (whether reset and isolation are credible), and cost (how much to pay for each trajectory). The three are often mutually exclusive - the most realistic environments are the hardest and most expensive to reset. When reviewing environmental plans, first ask how much of each of these three corners has been conceded, instead of asking "whether it is realistic enough".

---

## 2. From task to trajectory: observations, actions and compaction

### 1. Five nouns, a piece of history

Agentic RL trains on **trajectories**: histories of actions with side effects, rather than prompt–response pairs. The following diagram defines five terms without requiring the introduction:

```text
Trajectory = an alternate history
─────────────────────────────────────────────────────
Observation (Observation) What the model sees at this moment: issue description,
                      File content, output of the previous command
      ↓
Action (action) The model decides what to do: a generation
      ↓
Tool Call The part of the action that really changes the world:
                      Read files, change code, run tests
      ↓
Environment State
                      What does the environment look like after the tool is executed:
                      File tree, process, test results
      ↓ (Return to Observation and loop dozens of times until the termination condition)
─────────────────────────────────────────────────────
```

The biggest difference from T08 is in the fourth line: **Tool calls will change the environment state, and the environment state determines the next observation**. There are multiple Rollouts with the same title in RLVR, which are natural "parallel universes"; there are no parallel universes in the Agentic trajectory, only a reality that continuously bifurcates with each step.

### 2. Compaction: context management for long-horizon trajectories

After dozens of interactions, the history quickly exceeds the context available to the model. **Compaction (trajectory compression)** can first be understood as: compressing the history that has been passed into a summary, freeing up context for subsequent steps - which details to retain and which to fold are a set of independent engineering decisions.

```text
Original trajectory: [obs1 act1 obs2 act2 … obs40 act40 obs41 …]
                              ↓ Context approaches the upper limit
Compaction: compress the first 40 steps into a summary S
                              ↓
Continue execution: [S, obs41, act41, …]
```

Compaction allows longer execution at the cost of **information loss**. Details omitted by the summary, such as an intermediate error or failed attempt, disappear from the model’s view. Deciding what to retain and what to collapse requires its own editing policy:

| Tend to retain | Tend to fold |
|---|---|
| Paired records of errors and fixes (which attempt failed, and why) | Repeated file reading, multiple outputs of the same command |
| Key decision points (why you chose this document and this plan) | Very long test log (pressed into conclusion sentence) |
| Current mission goals and completed progress | Validated intermediate derivation |

What's more critical is the morphological change it brings to the training material - an ultra-long trajectory will be cut into **Sub-trajectories with different numbers and lengths**: A smooth task may only be cut once, a tortuous task may be cut into five sections, and each section will be restarted from the summary. This seemingly technical detail is the direct driver of the method switching in the main case in Section 3. Let’s hang the conclusion on the wall first:

> **Architectural wisdom: **The form of training materials determines the premise of the method. When "one trajectory" turns into "several irregular sub-trajectories", all algorithms that assume "samples are regular and comparable" are quietly failing - the complexity will not disappear, but will only be transferred to the layer you haven't seen yet.

### 3. Replayable and auditable tracks

Trajectories are not only training data, but also material for subsequent evidence collection. A usable trajectory schema contains at least:

| Field | What to remember | What to support |
|---|---|---|
| step_id / turn_id | Step numbers and rounds | At which step did the positioning failure occur? |
| observation | The input seen by the model at the current step (including truncation strategy) | Recurrence model perspective |
| action | Complete actions generated by the model | Audit decision quality |
| tool_call_raw | Tool name, parameters, original return | Distinguish between "wrong model call" and "strange tool return" |
| env_snapshot_handle | Environment snapshot handle (can restore the current state) | Post-event replay and evidence collection |
| reward_event | Reward value + version number of the rule that triggered it | Comparability after the revision of reward rules |
| policy_version | Policy version at sampling time | Policy Lag statistics (section 4) |
| compaction_marks | Between which steps does compression occur? | Interpret sub-trajectory boundaries |

Two scenarios rely heavily on this Schema:

- **failure attribution**: Reward anomaly is found during training. It is necessary to be able to play back this trajectory and distinguish between "the strategy is really wrong" and "the environment collapsed in step 37" - replaying a bad trajectory for ten minutes can determine the blame. Without a snapshot, you can only guess;
- **Speculative forensics**: When it is suspected that the model has bypassed the test (such as changing the test file itself), replay is the only source of evidence - this is the same logic as the anti-reward exploitation check of T08, but the carrier is replaced by the trajectory. T10 will connect the "track-level audit" to the release evidence chain, and here we first establish the recording obligation.

### 4. Failure recovery: What to do after the trajectory is interrupted

Trajectories lasting 4 hours at p99 will encounter interruptions: worker disconnections, environment crashes, and cluster deployments. Choose a recovery strategy during design, rather than improvising during an incident:

| recovery strategy | practice | cost |
|---|---|---|
| Abandon the trajectory and re-acquire | If interrupted, the task is discarded and the task is requeued | Long task re-mining is the most expensive; p99 tracks may die from the same type of interruption repeatedly |
| Resume from breakpoint | Restore environment state from snapshot, continue context | Snapshot overhead + context splicing error at continuation (a passive compaction) |
| Downgrade collection | Completed prefixes are retained, settled according to partial progress or voided | Settlement rules must be hard-coded in advance, otherwise they will become implicit process rewards |

The three options transfer the interruption cost to the sampling account, snapshot account and reward design respectively - the same sentence "the environment must be fault-tolerant", but three completely different amounts of money fall on the ledger. Which one to choose depends on the task duration distribution: p50 short tasks are the easiest to abandon and re-acquire; p99 extremely long tasks are not worthy of breakpoint resumption, which is equivalent to leaving the most expensive samples to luck.

---

## 3. Rewards and credit assignment: why GLM-5.2 uses critic-based PPO

### 1. Four forms of rewards

| Bonus form | Give time | Advantages | risk |
|---|---|---|---|
| Final result reward | Task final state (test passed=1) | The most reliable and hardest to exploit | Dozens of steps share a signal, with the roughest attribution |
| process rewards | Key milestones (e.g. "located the correct file") | Alleviating sparsity | Milestone definition introduces subjectivity and can be catered to |
| Step level rewards | every step/round | The most detailed attribution | The scorer itself is a new source of Reward Model bias (T07) |
| restraint punishment | Violation is punishable | Keep permissions and security boundaries | Penalty design and accidental injury rate must be independently inspected and accepted |

In practice, it is usually "result rewards are covered + constraints and punishments are demarcated", and process/step rewards are introduced as needed. When introducing process rewards, take the lessons of T07 with you: Every "thing that scores the process" is a scorer, which will bring the risk of scorer bias and being catered to - the rule itself of "locating the correct file and giving 0.2 points" may teach the model to guess a bunch of files first to complete the milestone. Each rule of process rewards is paired with an anti-reward exploitation test case, which is a continuation of the T08 validator discipline on track.

The difficulty is not only scoring but **Credit Assignment**: once the score is known, how should credit and responsibility be distributed across dozens of steps and tens of thousands of tokens?

### 2. Two attribution routes: In-group baseline vs Critic

The two mainstream routes to Layer 4 (signal granularity and credit allocation) have different prerequisites and costs:

| route | mechanism | premise | system cost |
|---|---|---|---|
| Group baseline (GRPO series) | A group of trajectories is adopted for the same task, and relative comparison within the group forms an advantage | The trajectories within the group are regular and comparable, with variance | Group sampling and group integrity maintenance; no independent critic required |
| Critic / Value route (PPO system) | Train a value model to estimate "how good it is expected to be if we continue from the current state" and obtain Token-level Advantage | Critic learns accurately and does not introduce systematic bias | Additional models, memory, GPU and synchronization; stability of value learning |

Group-based methods replace the Critic with additional samples, explaining their popularity since 2024. Critic-based methods maintain another model in return for **learning from individual trajectories** and finer attribution. Neither is universally superior; their prerequisites depend on trajectory structure.

[GLM-5 technical report](https://arxiv.org/abs/2602.15763) It is clear that its RL is built on GRPO, and the Agentic stage adopts group strategy optimization: the same task generates multiple trajectories, and the relative results within the group are used to form training signals. So far, this is the mainstream shape in 2024--2026.

First, a teaching illustration of within-group comparison (illustrative numbers, not a real experiment): sample 4 trajectories for the same task. Two pass the tests and receive 1 each; two fail and receive 0 each. The group mean is 0.5, so the two passing trajectories have positive advantages (better than the baseline), while the two failures have negative advantages. The mechanism’s prerequisite is already visible: **The four trajectories face the same initial state, have the same length, and are not compressed or re-cut midway**. If any premise is broken, "better than the baseline" is no longer synonymous with "better strategy".

### 3. Main case: complete causal chain of GLM-5.2

Coming to GLM-5.2 (2026-06), [Official description](https://z.ai/blog/glm-5.2) Describes training variations for ultra-long-range Agent missions. Completely lay out the chain of cause and effect (the expression is checked and organized according to the evidence base, and the direction of cause and effect is the official narrative):

```text
Changes in task form: longer-term, more complex Agent engineering tasks
        ↓
The ultra-long trajectory is cut into multiple trainable sub-trajectories by Compaction
(different counts and lengths—the change in shape discussed in section 2)
        ↓
The premise of "the same prompt adopts a set of regular and comparable trajectories"
no longer naturally established
        ↓
Move to critic-based PPO
        ↓
Learning from a single Rollout, estimating Token-level Advantage by Critic
        ↓
Actively deviate from the mainstream of the relative route within the industry group (official knowledge)
```

A teaching illustration shows how the prerequisite breaks (illustrative, not official data): sample 4 trajectories for the same long-horizon task—

```text
Track A (smooth): 43K Token, Compaction cut into 1 segment, test passed → 1
Track B (Zigzag): 900K Token, cut into 4 segments, test passed → 1
Trajectory C (Zigzag): 1.2M Token, cut into 6 segments, ultimately failed → 0
Track D (successful): 51K Tokens, 1 stage, failed → 0
```

The group mean is still 0.5, but now the "unit" has been confused: A's 1 segment and C's 6 segments are no longer comparable samples - C's intermediate sub-trajectories have contributed both correct steps and fatal errors. Marking them all as 0 (inheriting the final state) is equivalent to punishing the correct parts; scoring separately according to sub-trajectories does not have their own final states to rely on. **Relative comparison within a group requires "regular and comparable sample units", and Compaction just eliminates this. **This is what the middle square of the causal chain is all about.

Map it back onto the eight-layer framework, one layer at a time:

| Judgment layer | GLM-5 group route | Long-range mission constraints for GLM-5.2 |
|---|---|---|
| ① Ability goals | Agentic、Reasoning、Coding | Longer-term, more complex Agentic engineering tasks |
| ② Training materials | Generate multiple trajectories in groups under the same task | Irregular number and length of sub-trajectories after compaction |
| ③ Learning signals | Environment final state + relative within group | Environment final state + Critic value estimate |
| ④ Credit allocation | Relative Advantage of Group Normalization | Critic estimates Token-level Advantage |
| ⑤ Optimization method | GRPO-based group strategy optimization | Critic-based PPO, single trajectory learning |
| ⑥ Auxiliary components | No need for independent Critic | Added Critic (new bill for GPU memory and GPU) |
| ⑦ System impact | Group sampling, group integrity maintenance | Scheduling and synchronization of three types of resources: Actor/Critic/Rollout |
| ⑧ Evidence of promotion | Target benchmark improvement, no reward exploitation | Same as above, but also covering the risk of critic bias |

### 4. Three disciplines that must be followed

**First, it is strictly prohibited to read "PPO instead of GRPO". **GLM-5 still focuses on GRPO-based group optimization, while GLM-5.2 only turns to critic-based PPO for long-range missions; the industry default is still the GRPO system (including GSPO and other variants), and GLM-5.2 is officially stated as a "conscious departure from the mainstream." The correct sentence is "A certain model adopts X in a specific task form", not "The industry has turned to X".

**Second, critics are not free.**[Slime usage documentation](https://github.com/THUDM/slime) This account is visually displayed: GRPO workflow does not require Critic; PPO workflow requires three types of GPU resources: Actor, Critic, and Rollout. "Add a model" at the method level, and at the system level there are new memory bills, new synchronization paths, and three new failure modes:

| Failure modes of the Critic route | performance | Monitoring points |
|---|---|---|
| value estimate bias | Critic systematically overestimates/underestimates certain states, Advantage distortion | Value loss and actual return deviation distribution |
| Value learning is unstable | Value loss spikes, Advantage noise amplification | Linked observation of Value loss curve and gradient norm (T08 indicator group) |
| resource squeeze | Critic squeezes the GPU memory and card of Actor/Rollout | Review of the allocation of three types of resources |

Compare the sampler of the Inkling ledger in Section 5: trainer = 5:3 and think about it again: Critic belongs to the trainer side, and the Critic compute saved by the group route can be used to exchange for more samples - this is also one of the real motivations of the "de-Critic" trend at the system level.

**Third, reuse reasoning and do not copy answers. **If your task is a short answer, multiple comparable trajectories can be mined cheaply for the same question, and Reward has sufficient intra-group variance - the GRPO system is still a lighter choice. What is worth copying in GLM-5.2 is not the conclusion of "choose PPO", but the reasoning chain of "task form → trajectory form → method premise → system topology".

> **Judgment Boundary:** When selecting credit allocation, don’t ask “who is stronger?”, first ask two factual questions: Is my trajectory subject to compaction, is it irregular? Can I afford the resource and stability costs of Critic? When the two answers come together, the selection often emerges on its own.

---

## 4. Asynchronous topology: on-policy training, policy lag and freshness

### 1. Two self-sufficient definitions: On-policy and Policy Lag

**On-policy** means the current policy version actually generates the training data. Strictly discarding all earlier experience after every update would leave a trainer waiting on agent trajectories lasting eight minutes. Engineering systems therefore use **approximate on-policy learning**, tolerating some staleness to overlap sampling with training.

**Policy Lag**: Rollout Worker is sampling using the strategy of version v_t, and Trainer has been updated to v_t+k - the difference between these k versions is lag. The larger the lag, the farther the experience distribution is from the current strategy, and the greater the "effectiveness discount" of each experience; if the lag is zero, it returns to synchronization and waiting. The entire tension of asynchronous training lies in this quantity. It has three commonly used metrics, each focusing on a different perspective: by version difference (how many updates v_t lags behind), by time (how old the weight is when this trajectory starts sampling), and by proportion (the mixing ratio of old experiences in the training batch). Monitor at least one of the distributions (p50/p99) rather than the mean - lag damage is concentrated in the tail, and the mean hides the worst case scenario.

### 2. Choices among three topologies

| Topology | working method | Advantages | cost |
|---|---|---|---|
| sync | All Rollout completed→training step→issue new weights | lag=0, the theory is the cleanest | The slowest trajectories such as the trainer, the GPU is idling a lot |
| Partially asynchronous | Rolling in batches: new weights are issued periodically and old experiences are mixed | Compromise, project controllable | Need to manage mixed version data |
| Completely asynchronous | Generation and training continue to overlap, each at full speed | Maximum throughput, able to handle both long and short tasks | lag fluctuates uncontrollably, requiring empirical filtering and discarding strategies |

```text
Fully asynchronous topology (decoupled generation and training)
─────────────────────────────────────────────────
Environment factory ──▶ Rollout Worker group (sampled with weight v_t)
     ↑            │  Track + reward (with version number v_t)
     │            ▼
     │      Experience queue / buffer (monitor lag and discard stale data)
     │            │
     │            ▼
     │      Trainer (updating v_t+k)
     │            │ New weight (issued regularly/continuously)
     └─────────────┘ v_t lags behind. The more v_t+k, the larger the lag
─────────────────────────────────────────────────
```

### 3. Ecological convergence in 2026: cross-engine is the central issue

This year, asynchronous RL has converged from "each company's self-developed script" to a publicly discussed system issue. [Review of Hugging Face 2026-03 "Keep the Tokens Flowing"](https://huggingface.co/blog/async-rl-training-landscape) We sorted out 16 open source asynchronous training projects and defined async as "effective overlapping parallelism of generation and training"; the multi-framework review and "Lessons from 16 Open Source Frameworks" (2026-03) in the first half of the same year pointed to the same bottleneck: **The core system issue of agentic RL is the cross-engine data flow between the training engine and the inference engine** ——Policy Lag and Rollout throughput are stuck on this boundary.

The ecological response is division of labor and convergence:

| components | Responsibilities | Examples in 2026 (according to the measurement basis of respective official documents) |
|---|---|---|
| training engine | Gradient update, weight management | veRL (with official Agentic RL training document route), torchtitan’s TitanRL (unified engine for pre-training and post-training) |
| inference engine | High-throughput Rollout generation | vLLM |
| Training stack/glue layer | Connect the two into an asynchronous loop | slime (THUDM, supports fully asynchronous rollout, decoupling generation and training); vime (vLLM released on 2026-06-09, connects slime training stack and vLLM rollout) |

The [vime announcement](https://vllm.ai/blog/2026-06-09-announcing-vime), bringing the slime and vLLM ecosystems together, illustrates acceptance of a training engine, inference engine, and dataflow integration rather than one framework doing everything. **Selection implication:** evaluate cross-engine weight distribution, experience feedback, and lag monitoring, rather than training FLOPs alone.

### 4. Weight synchronization and prefix caching: hidden levers of throughput

There are three mechanisms in the asynchronous loop that are inconspicuous but determine success or failure.

**Weight synchronization** To answer the question of delivery frequency and consistency, there are three common strategies:

| Issue strategy | practice | suitable for |
|---|---|---|
| Regular batch delivery | Send full/incremental weights every N steps of training | Small and medium scale, simple and controllable; upper limit of lag = N steps |
| Continuous delivery | The trainer continues to push the latest parameters | Large clusters pursue low lag; bandwidth and consistency management are more important |
| Worker pulls on demand | Worker pulls the latest version after completing the current batch | Worker autonomy, mixed long and short tasks; lag is determined by task duration |

**Filtering and discarding experience** is the other half of lag management. Tag trajectories with policy versions and discard or downweight those beyond a version-gap or age threshold. Monitor the discard rate itself: a spike signals mismatched sampling and training speeds, often from an environment or queue bottleneck.

**prefix cache** It takes advantage of the natural structure of Agent tasks: multiple attempts of the same task, multiple rounds of requests within the same trajectory, and highly overlapping prefixes, so there is no need to recalculate hits in the cache. [RL Run by Inkling 2 Small](https://thinkingmachines.ai/news/inkling-2-small) reports a prefix-cache hit rate of 93%+ (official disclosure)— **what does it mean**: The actual reasoning overhead of 17M Rollouts is directly rewritten by this number; the same algorithm, coupled with different caching and scheduling, has completely different bills (the same conclusion in Section 5 of T02 is repeated on the RL side).

> **Architectural wisdom:** The net benefit of asynchronous training = amount of experience × effectiveness of each experience. Throughput raises the first item, and lag lowers the second item—an asynchronous solution review that only reports GPU utilization is equivalent to reporting only the numerator but not the denominator.

---

## 5. Throughput and cost per valid trajectory

### 1. Record the account to "each valid track"

T02 Use three ledgers to calculate the training budget; Agentic RL should list a separate item in addition to these three ledgers **environmental account**, and change the unit from "Generate Token" to "Each valid trajectory":

```text
Environmental account (according to training period)
    Environment startup: the cost of creating a sandbox for each Rollout
  + Task execution: tool invocation, calculation of test runs
  + Reset and Clean: Restore to a clean state after the track ends
  + Verification: final state determination (running the test itself can be expensive)
  + replay and audit: track storage, snapshots, evidence collection
        ÷ Number of valid trajectories (excluding waste samples caused by environmental faults, timeouts, and incomplete groups)
        ↓
    Cost per effective trajectory ←── Basic unit of environmental economics
```

The most expensive word in the denominator is “valid.” At a 10% environment-crash rate, every 9 valid trajectories must also cover the startup and execution cost of 1 wasted trajectory. Group-based methods are stricter: one broken trajectory may invalidate the entire group, amplifying T08’s group-integrity problem on the environment side. A teaching example works through this allocation (all numbers are hypothetical and serve only to demonstrate the formula):

```text
Assumption: The target takes 1,000 valid trajectories, and the group size is 4 (group route)
Single environment crash rate 10%
    → When not in a group: activate about 1,111 items (1,000 ÷ 0.9)
    → When forming a group: If any track in the group fails, the entire group will be invalid
      Single group survival rate = 0.9⁴ ≈ 0.66
      It takes about 1,500 activations (250 groups ÷ 0.66 × 4) to collect 1,000 effective ones
Environment cost per trajectory (illustrative): 5s for sandbox startup + 480s for execution + 60s for verification
    → Effective trajectory environment cost for grouped routes ≈ 1.5 times nominal cost
If the group is changed to 8: the survival rate of a single group drops to 0.43, and the magnification continues to increase
```

The conclusion of this question is universal: **The larger the group, the more fragile the environment, and the heavier the environmental tax with the word "effective"**; The Critic route does not need to be grouped, but is more tolerant of the environmental collapse rate (one bad one is lost) - credit allocation selection and environmental stability are coupled again at the system level.

### 2. Mixing long and short tasks: the bifurcation of p50 and p99

A pair of numbers in the Inkling ledger is worth looking at separately: Rollout Token p50 = 43K, p99 = 1.5M (the measurement basis is the same as before). **what does it mean**: half the trajectories finish within 8 minutes, but the slowest 1% run for 4 hours—a 30× difference. In a synchronous topology, every training step waits for the p99 tail. Asynchrony removes that barrier but moves the problem to scheduling: short tasks must be able to get through while long tasks occupy workers; trajectories with different durations must form uneven batches; and timeout policy (terminate or allow continuation) itself changes the learning signal. If a failed trajectory is forcibly terminated, was the policy poor or the environment slow?

This is where one-sandbox-per-rollout (Section 1) and microVM really come in: isolation needs to be strong, startup needs to be fast, both are true at the same time, and "a clean environment per track" is affordable.

The timeout policy is the final step of scheduling, and the three options have different costs:

| timeout policy | practice | cost |
|---|---|---|
| Hard Kill 0 | Terminate after timeout and settle as failure | Mistaking "slow environment" for "poor strategy" penalizes slow but correct trajectories |
| Hard kill and discard | It will be terminated after timeout and will not be included in the training | Data is less but clean; signals for long tasks are systematically absent |
| Grading timeout | Set time limits based on task difficulty | The most reasonable and most dependent on the quality of the difficulty layer (back to the mission protocol) |

### 3. Read the entire Inkling RL ledger

Put together this most complete RL ledger currently publicly disclosed (the measurement basis is official disclosure, 2026-11-05 page; the model is 594B General Staff/17B Activated MoE):

| accounts | numerical value | what does it mean |
|---|---|---|
| RL Run form | Single Combined RL Run | One continuous run, not multiple splices |
| Number of training steps | 1,075 steps | There are not many steps - behind each step is a massive amount of sampling |
| Rollout total amount | Over 17M items | About 16,000 trajectories per step on average; sampling is the main workload |
| duration | 9 days | The same magnitude coordinate system as the 68 hours of pre-training H1 (control T02) |
| sampler:trainer compute ratio | 5 : 3 | The compute of the sampling side is greater than that of the training side - the ledger structure of RL reverses the pre-training |
| prefix cache hit | 93%+ | The number one lever that determines the actual cost of 17M Rollouts |
| Rollout Token | p50 43K / p99 1.5M | Mixing long and short tasks, scheduling and timeout strategies become first-class decisions |

**sampler : trainer = 5 : 3 is the most important single number in this chapter**: It confirms the judgment in the opening sentence with official measurement basis - Agentic RL is not "fine-tuning with environment", but a machine with sampling as the main load. The budget review only counts options for training GPUs, which misses the bulk from day one.

### 4. The environment changes from self-built assets to outsourced assets

The environmental account is too heavy, and the market is beginning to split this cost: Hugging Face introduced the RL environment into the Hub (environmental market) on 2026-09-28; ProRL Agent proposed Rollout-as-a-Service (outsourcing the entire sampling cycle) on 2026-03-19; 2026-10-05 already covered coding-agent RL List of commercial suppliers of the environment (the three entries are all blog post titles + date references, which are industry narratives rather than final conclusions). The judgment of self-built or outsourced is the same as T02's three ledgers: outsourced buys startup speed and maintenance exemption, and self-built buys distribution control and data sovereignty. The evaluation environment usually must be self-built and isolated, while the training environment can be mixed.

> **Architectural wisdom:** "Environmental engineering" must be listed separately in the RL budget and cannot be folded into the GPU account to round up. An Agentic RL proposal that only says "128 calories × N days" is equivalent to a restaurant opening plan that doesn't mention the cost of ingredients.

---

## 6. Evaluate agentic RL beyond success rate

### 1. Six evaluation dimensions

| Dimensions | What to measure | Why the success rate is not enough |
|---|---|---|
| Mission success rate | Final state compliance ratio | Basic metrics, but masks path quality |
| step efficiency | How many steps/Tokens did it take to complete the task? | Two equally successful trajectories, the cost difference is an order of magnitude |
| Tool calling accuracy | Is the calling sequence reasonable (parameters, order, redundancy) | Successful but detour strategies pass costs onto reasoning bills |
| Resilience | Can you correct yourself after making a mistake? | There must be disturbances in the real environment, and a model that will collapse after one failure cannot be used |
| security violation | Frequency of permission out-of-bounds operations | Success + Override = More Dangerous Model (Entrance to T10) |
| Stability over multiple runs | Variance of success rate for repeated runs with the same settings | Agent tasks are highly random, and single results are not trustworthy |

The two-dimensional approach is worth expanding on. **Resilience** You can't just test the "smooth sailing" path: inject disturbances in the middle of the trajectory (roll back a repaired file, let a tool temporarily time out), and see if the model can detect and correct it - injecting disturbances itself is a controlled environment operation, which is one of the reasons why the training environment and the test environment use different random seeds. **Stability over multiple runs** Report the distribution rather than the mean: run the same Checkpoint and the same environment version N times, and report the success rate range; the "average 60 points" with a wide range and the "average 58 points" with a narrow range have completely different project values.

### 2. The training environment and testing environment must be isolated

Task leakage was mentioned in Section 1, and here is its complete form during the previous evaluation: deduplication checks need to be carried out between the training task pool and the evaluation benchmark (same source warehouses and tasks with the same template are considered suspects), and the evaluation environment version and the training environment version must be managed separately. **Environments with high success rates but no reproducibility are particularly dangerous**: two runs of the same policy produce different results, mixing reward noise directly into the learning signal. You cannot distinguish “the model improved” from “the environment was lucky this time,” invalidating both ablations and regression tests. Reproducibility is a prerequisite for the signal-to-noise ratio of training, not merely an academic preference.

### 3. Terminal-Bench version discipline

There is no stable neutral scale for Agentic ability evaluation, and Terminal-Bench is the most frequently cited one, so the version discipline becomes the citation discipline:

| Baseline version | model | score | measurement basis |
|---|---|---|---|
| Terminal-Bench 2.0 | GLM-5 | 56.2 | Technical report reveals that open source was the highest at the time of release |
| Terminal-Bench 3.0 | GLM-5.2 → GLM-5.3 | 4.6 → 28.3 | Official model card report value, comparison within the same baseline version |
| Terminal-Bench 4.0 | Kimi K3.1 Pro | 65.7% (including 86 CLI tasks) | Artificial Analysis summary measurement basis |

The three lines of numbers belong to three different versions, **Not comparable across versions**: You cannot draw an arrow to say "exceed" between TB 4.0's 65.7 and TB 2.0's 56.2. When seeing any Agent benchmark score, the first question is always "which version, who tested it, and how many tasks it contains."

### 4. Limitation of Agent Arena and List Narrative

In addition to static benchmarks, dynamic lists have become a new battlefield in 2026. [Agent Arena](https://arena.ai/leaderboard/agent) Dynamically ranked by task success rate, user satisfaction and controllability of real Agent sessions (still updated on 2026-11-08). There are two restrictions that must be followed when using it to narrate:

- **First in open source ≠ First in the field**: The 2026-07 list is led by Claude Fable 5 (High); the first place in the open source model (such as Kimi K3.1 Pro, which topped the open source list after opening the weight in 2026-11-05) is a sub-list narrative;
- **representativeness controversy**: Arena's own paper disclosed that 83 open source models accounted for only 29.7% of the list data - the representativeness of the open source models in the list data itself is questionable, and the conclusion that "the open source community has tied up" cannot be derived from this list.

Kimi K3.1 Pro also provides an open-weight reference point: 2.8T parameters and roughly 5.6TB of weights, released on Hugging Face on 2026-11-05. Local deployment on consumer hardware is difficult—another reminder of T02’s discipline: **Open weight ≠ self-deployable**, reaching the top of the open source list and "everyone can run" are two different propositions.

### 5. Pipeline perspective: cross-stage rollback

The last piece of the evaluation puzzle comes from GLM-5's own report: subsequent training uses sequential RL (three-stage sequential execution of Reasoning → Agentic → General, which is GLM's name for its own formula, not an industry standard term). The official clearly admits that sequential training will cause the regression of the front-end capabilities, and uses on-policy cross-stage distillation to repair it at the end of the pipeline. **what does it mean**: The benefits of the Agentic stage must be reviewed and accepted by the entire pipeline - it is not enough to just look at how much the benchmark has increased in this stage. It is also necessary to check whether the capabilities of the previous stage (Reasoning) have been eroded, and whether the repair method (distillation) has paid a new price. This is also the entrance to the T11 layout chapter. This chapter first establishes the acceptance criteria.

The evaluation was run three times on the timeline, each answering a different question:

| timing | What are you running for? | What to answer |
|---|---|---|
| Training (ongoing) | Small-scale probe mission + training health indicators (T08 indicator group) | Is Learning Signal Still Healthy? Is the environment crash rate normal? |
| end of stage | Complete evaluation matrix + cross-stage rollback inspection | Is this Checkpoint better than the last one? |
| Before publishing | Held-out tasks + contamination checks + safety-violation audits (connect to T10) | Is the chain of evidence complete? Can it be issued? |

> **Judgment boundary:** There are at least four sets of evidence for Agentic RL's promotion: target benchmark improvement (with version measurement basis), no unacceptable regressions across stages, multiple stable runs, and no signs of environmental reward exploitation (test changes, reading hidden answers). Without any one of them, the score will not constitute a basis for release.

---

## 7. Derive a software-engineering agent training architecture

### 1. Data flow panorama

Put the previous sections together into a complete training structure for a software engineering agent (issue-fixing task):

```text
Task library (real issue-PR pairs, layered in difficulty, isolated from the evaluation pool)
    ↓
Environment Factory ──── Each Rollout has a sandbox (microVM/container)
    ↓
Rollout Worker group (inference engine, weight v_t)
    │  ①Read the repository ②Change the code ③Run the test ④Read the error report... (dozens of steps in a loop)
    ↓
Trajectory + final state reward (test passed=1/failed=0, with constraint penalty)
    ↓
Verifier/Filter ─ Eliminate environmental fault traces and reward exploitation traces (replay evidence collection)
    ↓
Experience queue (tagged with policy versions; monitor lag and discard stale data)
    ↓
Trainer (Actor [+ Critic, selected according to Section 3])
    ↓ New weights are issued regularly/continuously
    └────────▶ Return to Rollout Worker group
Bypass: Monitor (success rate/entropy/reward curve/environmental health)
      Archive: trajectory store (replayable and auditable)
```

Two easily omitted components sit beyond the dashed boundary. The **Monitor** tracks both learning health from T08 and environment health, including crashes, reset failures, and lag. The **trajectory store** supplies evidence for reward-exploitation investigations and failure attribution. Summarize their responsibilities and deployment requirements in a table:

| components | Responsibilities | Deployment/selection considerations |
|---|---|---|
| Task library | Supply tasks, difficulty tiering, isolation checks | Physical separation from review pool; task versioning |
| Environmental factory | Create a clean sandbox for each Rollout | Startup latency budget (microVM/container/snapshot) |
| Rollout Worker Group | Run trajectory with inference engine | Inference engine throughput, prefix cache, weight version management |
| validators/filters | Determine the final state and eliminate environmental faults and reward exploitation trajectories | Verification rules are versioned; filtering standards must prevent accidental killing |
| experience queue | Caching tracks, monitoring lag, and discarding after expiration | Capacity and discard rate are a contradiction |
| Trainer | Update Actor (dual model when including Critic) | Three types of GPU ratio (Inkling measurement basis 5:3 trainer side) |
| Monitor | Learning Indicators + Environmental Health Dual Channel | Missing environmental indicators = flying blind |
| Track library | Save snapshot handle and complete track | Storage cost vs. forensic capabilities trade-off |

**Which way does the fault go?** It is also necessary to design in advance: trajectories of environmental collapse will go into the "waste sample bucket" (counted into the environment account, not training data); trajectories suspected of reward exploitation will go into the "evidence bucket" (frozen for manual replay); timeout trajectories will be determined according to the timeout strategy in Section 5. The three types of exits are mixed in a "failure" pipeline and are the most common entrances for training signals to be contaminated.

### 2. Synchronous or asynchronous: Selection basis

| Conditions | tendency to synchronize | Prefer asynchronous |
|---|---|---|
| Task duration distribution | Short and homogeneous (within minutes, concentrated length) | Mix of long and short (the difference between p50/p99 is more than an order of magnitude) |
| Sensitivity to lag | Simple tasks and quick generalization of experience | The task is long, the experience itself takes a long time, and the waiting ratio is higher |
| Environmental failure rate | low and controllable | High (asynchronous can bypass the fault trace and continue throughput) |
| Engineering capabilities | Small team, quick verification | Have cross-engine data flow and version management capabilities |

The selection is not a matter of choosing one or the other: many teams start with synchronous verification signals, then move to partial asynchronous, and finally move to full asynchronous under the pressure of mixed long and short tasks. What is really undesirable is "implicit asynchrony" - the system is actually decoupled, but there is no lag monitoring and expiration discard strategy, allowing old experience to be silently mixed into training.

[GLM-5 technical report](https://arxiv.org/abs/2602.15763) It disclosed that it uses an asynchronous RL training framework; third-party reviews also noted that this report "spent an unusually large amount of time on infrastructure" (qualitative observation) - this confirms the main line of this chapter from the side: the failure of agent training comes more from system bottlenecks than algorithm bottlenecks. The space allocated to the report is evidence in itself.

> **Architectural wisdom:** Every choice at the algorithm layer will grow new components and new bills at the system layer: group routes will grow group sampling and group integrity maintenance, critic routes will grow value models and three types of GPU scheduling, and asynchronous topology will grow weight distribution and lag monitoring. When reviewing any "We Scale X" proposal, a component diagram is required indicating the GPU memory and GPU for each box.

---

## 8. Engineering artifact: Agent Environment Specification

Environment specifications are the reusable products delivered in this chapter. The skeleton is as follows (pass it line by line during the review, and an empty line is a mine waiting to be detonated):

| module | What to fill in | Common rollover points |
|---|---|---|
| mission agreement | Task sources, difficulty tiering, and isolation checks with evaluation pools | Task leakage: evaluation benchmarks mixed into training pool |
| Environment mirroring and startup | Basic image, dependency locking, startup time budget | Image drift leads to "same version" in different environments |
| permission boundaries | List of allowed/prohibited operations, cross-border handling and penalties | Rely on "model awareness" rather than sandbox enforcement |
| State management and reset | Reset steps, snapshot mechanism, status residual check | Modifications to the previous track are leaked into the next one |
| Tool definition | Tool list, parameter and return schema, timeout | Tool outputs ultra-long explosion context without truncation strategy |
| Rewards and validators | Final state determination method, constraint penalty, version number | After the reward rules are changed, the old tracks are mixed with the new rules |
| Trajectory Schema | Observations/Actions/ToolOutputs/SnapshotHandles/VersionNumber | Only text is saved, not snapshots, and cannot be played back afterwards |
| Replay and Audit | replay interface, evidence collection process, retention period | There is a speculative controversy but no evidence can be produced |
| Concurrency and isolation | Sandbox strategy (one-sandbox-per-rollout?), microVM selection, timeout strategy | Shared environment saves money and learns signals when dirty |
| Monitor | Environment crash rate, reset failure rate, lag distribution, success rate variance | Only monitors the training curve, not environmental health |
| version strategy | Environment version number, rules for rerunning baselines across versions | Directly compare cross-version success rates after environment revision |

This specification is directly connected to the Training ADR paragraphs 2 and 6 (training materials, system impact) of the introduction: the task agreement is filled in the material section, and the remaining modules are filled in the system impact section. Agentic RL proposals that do not meet the environmental specifications should be rejected directly like pre-training solutions that exceed the memory limit.

Three moments to use it:

```text
At project initiation: establish the task protocol and permission boundaries first—these determine whether sampling the task is safe
During the review, the three elements of reset/isolation/monitoring must be reviewed - to determine whether the learning signal can be trusted
During review: fill in the versioning strategy and replay evidence—these determine whether the next run can improve on this one
```

---

## 9. Six common reasoning errors

### Mistake 1: Treating Agentic RL as "a new batch of harder tasks"

The task list is just one corner of the environment's four-piece set (task + test + container + reward rules). Without a task list of reset, isolation, and versioning, you will die from state pollution and environment collapse in the first week of operation. **corrective action**: Proposals must be accompanied by Agent Environment Specification, and any missing corners must be filled first.

### Mistake 2: Only counting the training GPU, not the environment account and sampling account

The official measurement basis of sampler : trainer = 5:3 indicates that the compute of the sampling side is greater than that of the training side; the environment startup/reset/verification/replay must be in separate columns. If you only write a budget of "N cards × M days", you will miss out on the big part. **corrective action**: Budget converted to "cost per effective trajectory", listed in the environmental bill.

### Mistake 3: Copying the GLM-5.2 selection into a general formula

Follow up when you see critic-based PPO, but there are no irregular sub-trajectories through Compaction, and there is no need for Token-level attribution - what is copied is the conclusion, not the reasoning. The industry default is still the GRPO system, and GLM-5.2 is an official self-aware deviation. **corrective action**: Re-walk the causal chain of "task form → trajectory form → method premise → system topology", confirm the constraint isomorphism and then reuse it.

### Mistake 4: Only reporting throughput but not lag

While asynchronous increases GPU utilization, it reduces the effectiveness of each piece of experience; asynchrony without lag monitoring and expiration discarding strategies is diluting the learning signal with old experience. **corrective action**: The asynchronous scheme must report both the experience quantity and the lag distribution, and it is best to attach a synchronous comparison.

### Mistake 5: Drawing conclusions based on a single benchmark score

Terminal-Bench is not comparable across versions (TB 2.0/3.0/4.0 are three different rulers); Agent Arena has open source representativeness disputes (83 open source models only account for 29.7% of the list data). **corrective action**: Each score has three elements: version, evaluation method, and number of tasks; the sublist narrative must indicate that it is a sublist.

### Mistake 6: Follow the instructions in an environment with high success rate but unrepeatable

An irreproducible environment mixes reward noise into the learning signal: within-group comparisons lose comparability, failures cannot be attributed to an environment bug or a policy error, and ablations become invalid. **corrective action**: Before the environment goes online, run a reproducibility acceptance test - run the same strategy and version repeatedly, and the result distribution must be statistically consistent.

---

## 🎯 Quick check

```quiz
{
  "question": "The environment returns a reward only at task completion (tests pass = 1, fail = 0). What goes wrong with this design on a 60-step trajectory?",
  "options": [
    "No problem-reinforcement learning only needs the ending reward, and it is enough if the reward is accurate",
    "The problem is that the rewards are too sparse, which can be solved by setting the reward for each step to 1/60",
    "With only a final outcome of 0/1, the contributions of the 60 individual actions cannot be distinguished. In equally unsuccessful trajectories, the error might occur at step 5 or step 55. The signal has high variance and coarse attribution; a within-group baseline, a Critic, or process-level signals are needed to associate the score with specific steps"
  ],
  "answer": 2,
  "explanation": "This is a credit allocation problem (layer ④ of the eight-layer coordinate system). The ending reward itself is reliable, but the granularity is too coarse; even splitting assumes that the contribution of each step is the same, which is also wrong. Possible directions are relative comparison within the group, Critic's estimation of Token-level Advantage, or designing process rewards that are not easily catered to."
}
```

```quiz
{
  "question": "After moving the training to fully asynchronous, the Rollout throughput increased several times, but the Policy Lag became significantly larger. How to judge whether the exchange is worth it?",
  "options": [
    "There is no single answer: net benefit = amount of experience × effectiveness of each experience. To compare the product of 'more experience",
    "Throughput always takes priority - GPU utilization is the only important metric for training systems",
    "Policy Lag must be zero, otherwise the experience will be wrong and any asynchrony is not worth it"
  ],
  "answer": 0,
  "explanation": "The whole tension of asynchronous training lies in Policy Lag: throughput raises the numerator, and lag lowers the denominator. Reviews that only report utilization rates only see the elements. In engineering, we use lag monitoring + expired discard strategy to control the denominator, and then use controlled experiments to verify the net benefits."
}
```

```quiz
{
  "question": "Why is an environment with a 'high task success rate but no reproducibility' suitable for training?",
  "options": [
    "As long as the success rate is high and positive samples can be produced, reproducibility is something that only needs to be concerned about during the evaluation stage",
    "Irreproducibility means two rollouts of the same policy can produce different results: reward noise enters the learning signal, within-group comparisons lose comparability, failures cannot be attributed to an environment bug or a policy error, and neither ablations nor regression tests are valid",
    "Non-reproducibility only affects paper publication and has no impact on engineering training"
  ],
  "answer": 1,
  "explanation": "Reproducibility is the prerequisite for learning signal-to-noise ratio, not scientific research obsessiveness. Reproducibility acceptance should be done before the environment goes online: the same strategy and environment version should be run repeatedly, and the results distribution statistics should be consistent before release."
}
```

```quiz
{
  "question": "GLM-5.2 shifts from group routing to critic-based PPO on long-range Agent tasks. Which of the following interpretations is correct?",
  "options": [
    "PPO is more advanced than GRPO. The industry has turned to PPO as a whole. Just follow up",
    "The entire GLM series has given up on group optimization, and GRPO has become obsolete",
    "After the long-range trajectory is cut into sub-trajectories with irregular numbers and lengths by Compaction, the premise of \"a set of regular and comparable trajectories for the same question\" is no longer naturally true. The team is willing to pay Critic's resource and stability costs in exchange for single-trajectory learning and token-level advantages - this is a choice under a specific task form and does not represent the best practice for all Agent tasks"
  ],
  "answer": 2,
  "explanation": "The causal chain is 'task form → trajectory form → method premise → system topology'. GLM-5 is still based on GRPO basis set optimization, and the industry default is still the GRPO system; GLM-5.2 is a conscious deviation stated by the official. Reuse reasoning, don’t copy answers."
}
```

```quiz
{
  "question": "Model A scored 56.2 in Terminal-Bench 2.0, and model B scored 65.7% in Terminal-Bench 4.0 (including 86 CLI tasks). Can we say that B is better than A?",
  "options": [
    "It cannot be directly compared: TB 2.0 and 4.0 are different versions, with different task sets and difficulties, so cross-version comparisons are invalid; they can only be compared within the same version, or compared with other models under their respective versions",
    "Yes—65.7 > 56.2; the numbers alone tell the whole story",
    "Yes - just divide both scores by the total number of tasks, convert them into percentages and compare"
  ],
  "answer": 0,
  "explanation": "The benchmark version is part of the citation discipline: TB2.0 (GLM-5, 56.2), TB3.0 (GLM-5.2→5.3, 4.6→28.3), TB4.0 (K3.1 Pro, 65.7%) are not comparable to each other. When you see the Agent benchmark score, first ask about the version, evaluation method, and number of tasks."
}
```

---

## Chapter summary

- The environment is a training asset: tasks, tests, runspaces, and reward rules all require versioning, isolation, and reproducibility checks.
- Long trajectories increase the long-tail problems of credit allocation and sampling, and the algorithm selection must be based on the actual trajectory shape to test the premise.
- Asynchronously improves throughput and also introduces Policy Lag. Measure benefits in terms of cost per valid trajectory and distinguish policy failures from environmental failures.

> **Question for the next chapter:** When the model can act autonomously in a complex environment, security risks and evaluation complexity will increase. The next chapter discusses how to turn security requirements into verifiable specifications and establish a chain of release evidence.

---

## Terminology reference

| Terminology | How can beginners understand first |
|---|---|
| Agentic RL | Let the model complete reinforcement learning of long-term tasks in tools and environments; the new engineering objects are environment, trajectory and asynchronous orchestration |
| Environment | A four-piece set of tasks + tests + containers + reward rules; a first-class asset for training, not a background board |
| Trajectory | The history of a complete attempt: dozens of rounds of observations, actions, tool calls, and environmental states alternating |
| Observation / Action | What the model sees at this moment / what the model decides to do; the two alternately form the trajectory |
| Tool Call | The part of the action that actually changes the state of the environment: reading files, changing code, and running tests |
| Compaction | Condensing the history traveled into a summary to free up context; the cost is loss of information and cutting the trajectory into irregular sub-trajectories |
| On-policy | Training data is generated by the current policy; engineering reality is an "approximate on-policy" that allows a small amount of expiration |
| Policy Lag | The gap between the policy version used for sampling and the version used in training; the trade-off between asynchronous throughput and empirical validity |
| Rollout Worker | The inference process group responsible for generating trajectories; decoupling from Trainer is the basic structure of asynchronous training |
| Credit Assignment | How can the final result be spread over dozens of steps and tens of thousands of Tokens (Level 4 of the eight-layer coordinate system) |
| Token Level Advantage | Good/bad rating falls to fine-grained attribution of each Token; usually estimated by Critic |
| Prefix Cache | Reuse calculations with the same prefix; Agent trajectory prefixes are highly overlapping, and the hit rate determines the rollout bill |

---

## Related links

- This series: [T01 · Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [T08 · Verifiable Reinforcement Learning: Premise, Attribution and Health](/en/tutorial/t08-rlvr-prerequisites-attribution-health/) · [T10 · The line of defense is not a wall: security specifications, full life cycle evaluation and release release gates](/en/tutorial/t10-safety-spec-evaluation-gate/) · [T05 · Training system: from one-step training to distributed topology](/en/tutorial/t05-training-system-distributed-topology/)
- Main case: [GLM-5 technical report](https://arxiv.org/abs/2602.15763) · [GLM-5.2 official description](https://z.ai/blog/glm-5.2)
- The asynchronous RL ecosystem: [Hugging Face · Keep the Tokens Flowing (a review of 16 asynchronous training programs)](https://huggingface.co/blog/async-rl-training-landscape) · [vLLM · vime released (slime × vLLM confluence)](https://vllm.ai/blog/2026-06-09-announcing-vime) · [slime（THUDM）](https://github.com/THUDM/slime)
- Ledger and evaluation: [Inkling 2 Small training ledger](https://thinkingmachines.ai/news/inkling-2-small) · [Agent Arena List](https://arena.ai/leaderboard/agent) · [Kimi K3.1 Pro model page](https://huggingface.co/moonshotai/Kimi-K3.1-Pro)
