---
title: "25 · Eval-Driven: Bake \"Good Enough\" Into Architecture"
description: "Make AI quality measurable with evaluation datasets, acceptance criteria and regression gates integrated into delivery."
series: "ai-collaboration"
order: 3
pubDate: 2026-03-31
kind: "tutorial"
tags: ["Working with AI","Tutorials"]
locale: "en"
translationKey: "tutorial/eval-driven-architecture"
sourceHash: "9aaa5fe54e0fbff0f63182e8b2b6ee0d728593f95dc8dd9e4571f52e0b8bee50"
---

> The thesis in one line: **[Chapter 17](/en/tutorial/architecture-judgment-in-llm-era/) pulled out the bedrock of "same input → same output," and `assert result == expected` stopped working. How do you prevent "swap the model, tweak a prompt, and quality quietly degrades"? Quantify "good enough" into an eval suite, wire it up as a CI gate — so quality shifts from "discovered via complaints" to "measurable and gateable."**

---

> **🤝 AI-collaborative design track, ch. 3 · This chapter drills one thing**
>
> [Chapter 24](/en/tutorial/review-checklist-for-ai-output/) relied on humans reviewing line by line, but "is answer quality holding steady?" is too much for humans to check continuously. This chapter upgrades the gate from "manual, one by one" to "machine, continuous." This is the full expansion of the **eval gate** referenced repeatedly in [Chapter 20 ADR-005](/en/tutorial/evolution-playbook-mvp-to-scale/) and [Chapter 22](/en/tutorial/ai-native-system-design/), and the only reliable solution to nondeterminism ([Chapter 17](/en/tutorial/architecture-judgment-in-llm-era/)).

---

## 1. Why traditional testing breaks on AI systems

Traditional testing is built on **determinism**:

```
   Traditional:  assert summarize(x) == "the expected sentence"     ← binary: right / wrong, precise assertion possible
   LLM:          summarize(x) returns A this time, maybe A' next    ← temperature, model version, context shift → different output
                 both are "right," but literally different → assert == fails immediately
```

[Chapter 17](/en/tutorial/architecture-judgment-in-llm-era/) said it: LLMs pull out the deterministic bedrock. Traditional testing then hits two dead ends:

1. **No assertion is possible**: output is not fixed; `== expected` will always misfire.
2. **Silent regression**: you upgrade the model or adjust a system prompt, and the answers to a certain class of questions quietly get worse — no test turns red, you can only wait for user complaints (the "didn't find out until two weeks later via complaints" trap in [Chapter 20](/en/tutorial/evolution-playbook-mvp-to-scale/)).

> **The core shift (from [Chapter 17](/en/tutorial/architecture-judgment-in-llm-era/)): from "asserting one row is correct" to "measuring a quality distribution."** Stop asking "is this one row right?" and start asking "across this **batch** of representative inputs, is the overall quality distribution good enough — has it regressed from the last version?" That is eval.

---

## 2. The three-piece eval kit

```
   ┌─────────────────┐   ┌───────────────────┐   ┌──────────────────────────┐
   │ ① eval set       │──▶│ ② scoring          │──▶│ ③ gate (CI)              │
   │ representative   │   │ rules / model /    │   │ score below baseline →    │
   │ inputs           │   │ human sampling     │   │ block the release         │
   │ + expected cues  │   │ score each row     │   │                          │
   └─────────────────┘   └───────────────────┘   └──────────────────────────┘
```

### ① The eval set: the AI-era test suite

A batch of **representative inputs** plus **expected criteria** for each (note: criteria / rubric points, not a word-for-word gold answer).

> Example (AI customer service): input "The shoes I bought last week are delaminating — can I get a refund?" → expected criteria: `① cited the warranty policy ② gave a clear yes/no ③ did not fabricate a non-existent policy ④ appropriate tone`. Scored on how many of these criteria are met, not on verbatim matching.

### ② Scoring: who decides "good enough"

| Scoring method | Best for | Cost / risk |
|---|---|---|
| **Rules / programmatic checks** | Objective criteria (contains a keyword, correct format, citation present) | Cheap and stable, but only judges "hard" standards |
| **LLM-as-judge** (model as referee) | Subjective quality (is the answer good? relevant?) | Flexible, but **the judge itself is nondeterministic, fallible, and burns tokens** |
| **Human sampling** | Calibrating the above two, backstopping high-value scenarios | Most accurate, but slow and not scalable |

> In practice: **use rules first for anything rules can judge** (cheap and reliable); use LLM-as-judge for subjective quality; then **periodically use human sampling to calibrate the judge** — do not trust the model judge blindly; it is a model that makes mistakes too.

### ③ The gate: making eval actually "guard the door"

Running eval alone is not enough — **wire it into CI as a gate** (exactly what [Chapter 20 ADR-005](/en/tutorial/evolution-playbook-mvp-to-scale/) specifies): **before any model swap, prompt change, or retrieval-strategy change, CI runs eval automatically; if the overall score falls below baseline, the release is blocked.**

```
   change prompt / swap model ──▶ CI runs eval ──┬─ score ≥ baseline → ship it
                                                 └─ score < baseline → 🔴 blocked (prevents silent regression)
```

---

## 3. How to build your first eval (do not try to do it all at once)

Newcomers hear "eval set" and imagine collecting thousands of rows — then never start. The right approach is to **grow it from small, from real failures**:

1. **Seeds come from real bad cases in production**: every user complaint, every "wrong answer" screenshot is the most valuable eval sample you have — it is a real failure, not an imagined one. Start with a dozen or two dozen rows and you can already run it.
2. **Offline and online, two legs**:
   - **Offline eval**: fixed dataset, runs in CI, gates "before release" (prevents regression).
   - **Online eval**: score a sample of **real traffic** / shadow-run scoring (exactly the shadow traffic of [Chapter 21](/en/tutorial/splitting-and-migration-in-practice/)!), gates "after release" (real distributions are always trickier than your dataset).
3. **Keep adding cases**: every time you find a new failure pattern, **solidify it as an eval row** — same logic as writing regression tests. The eval set is "alive" and grows with the system.

> This rhythm of "accumulate from real failures, move in small steps, keep expanding" is exactly the same spirit as [Chapter 21](/en/tutorial/splitting-and-migration-in-practice/)'s GitHub Scientist "use real traffic as the judge," and [Chapter 07](/en/tutorial/designing-from-zero-to-one/)'s "architecture is iterated, not designed once" — **do not wait for a perfect eval set; get the loop running with a rough one first.**

---

## 4. Eval does not replace traditional testing — it adds a new layer

Do not mistake this for "once you have eval, skip unit tests." In an AI system, **deterministic parts still use traditional testing**; eval only governs "the quality of nondeterministic output":

```
            ╱╲   eval layer (new)
           ╱  ╲  ── "quality distribution" of nondeterministic output: is the answer good? has it regressed?
          ╱────╲
         ╱  E2E  ╲    traditional pyramid (unchanged)
        ╱──────────╲  ── deterministic logic: refund idempotency, state machines, auth, API contracts
       ╱  integration / unit ╲    these have one correct answer → assert == still holds
      ╱────────────────────────╲
```

Back to the AI customer-service system from [Chapter 19](/en/tutorial/full-design-walkthrough/): **the refund service is deterministic → use unit tests to assert idempotency and validate amounts** (`assert ==` works fine); **the model-generated answer is nondeterministic → use eval to measure the quality distribution**. Both suites coexist, each governing its own segment. **The payoff of "keep nondeterminism out of side effects" ([Chapter 19](/en/tutorial/full-design-walkthrough/)) shows up here again: the deterministic parts can still be tested with deterministic methods.**

---

## 5. Eval's costs and pitfalls (it is not free)

Treat eval as an architecture component, which means looking at its costs the way you would any component:

- **Running eval burns money and time**: every sample row requires a real model call; LLM-as-judge doubles the cost — "one evaluation = another model call." The larger the eval set and the more often you run it, the higher the cost. You must weigh **coverage against cost** (once again a [Chapter 06](/en/tutorial/quality-attributes-and-tradeoffs/) trade-off).
- **The judge makes mistakes**: LLM-as-judge is itself nondeterministic and biased (for example, it tends to favor longer answers). Calibrate it with human sampling; do not treat its scores as gospel.
- **Overfitting and staleness**: tuning against a fixed eval set for too long means "optimizing for the exam," and performance outside the set may not improve; and as the business evolves, old eval sets go stale. Keep them updated (same lesson as [Chapter 23](/en/tutorial/spec-as-architecture/)'s AGENTS.md: "outdated is worse than absent").

> **Architectural wisdom**: **eval is the "quality fitness function" of an AI system** — its relationship to answer quality is exactly what [Chapter 14](/en/tutorial/evolving-and-splitting-large-systems/)'s fitness functions have to architectural boundaries: both are about "turning what you care about into an automated check that can fail and block CI." The only difference: architectural boundaries can be precisely asserted; answer quality can only be scored as a distribution. **Bake "good enough" into eval and wire it up as a gate, and you can confidently upgrade models and iterate prompts — otherwise every "upgrade" is a blind gamble that nothing got worse.**

---

## 🎯 Quick check

```quiz
{
  "question": "An AI customer-service system is upgrading its underlying model from an old version to a new one. How do you ensure answer quality does not silently regress?",
  "options": [
    "Run a round of unit tests, assert the output string equals the expected answer, and ship if it passes",
    "Maintain a representative eval set of inputs with expected criteria, score with rules and LLM-as-judge before the upgrade, and block in CI if the overall score falls below baseline",
    "Ship it first and roll back once enough user complaints come in"
  ],
  "answer": 1,
  "explanation": "LLMs are nondeterministic: asserting string equality will always misfire and cannot detect quality regression. Waiting for complaints is the 'did not find out until two weeks later' trap from Chapter 20. The right approach is to quantify 'good enough' into an eval set with scoring, wired into CI as a gate — if the score falls below baseline, block the release and prevent silent regression after a model swap or prompt change."
}
```

```quiz
{
  "question": "What is the correct relationship between eval and traditional unit tests?",
  "options": [
    "Once you have eval you do not need unit tests — an AI system runs entirely on eval",
    "Eval does not replace traditional testing; it adds a new layer: deterministic logic (such as refund idempotency and auth) still uses assert == unit tests, while eval governs the quality distribution of nondeterministic output",
    "The two are completely the same thing, just different names"
  ],
  "answer": 1,
  "explanation": "Eval is a new layer added on top of the traditional test pyramid, dedicated to the 'quality distribution' of nondeterministic output. Deterministic parts of the system (refund idempotency, state machines, API contracts) have one correct answer and still use traditional assert == tests. This is also the payoff of 'keeping nondeterminism out of side effects': the deterministic parts can still be tested with deterministic methods."
}
```

---

## Chapter summary

- **Traditional testing breaks on AI**: output is nondeterministic, so `assert ==` misfires; worse, quality regression is **silent** — you can only wait for complaints.
- **From "asserting one row" to "measuring a distribution"**: this is the core shift from [Chapter 17](/en/tutorial/architecture-judgment-in-llm-era/), and eval is its concrete form.
- **The three-piece eval kit**: ① eval set (representative inputs + expected criteria) ② scoring (rules / LLM-as-judge / human sampling) ③ **gate** (wired into CI, block below baseline — i.e. [Chapter 20 ADR-005](/en/tutorial/evolution-playbook-mvp-to-scale/)).
- **Grow it from real failures, move in small steps**: seeds come from production bad cases; offline (CI) + online (shadow, [Chapter 21](/en/tutorial/splitting-and-migration-in-practice/)) on two legs; keep adding cases.
- **Eval does not replace traditional testing**: deterministic logic still uses unit tests; eval only governs the quality distribution of nondeterministic output.
- **Eval is not free**: it burns money, the judge makes mistakes, it overfits and goes stale — balance coverage against cost, calibrate and maintain continuously. It is the "quality fitness function" of an AI system ([Chapter 14](/en/tutorial/evolving-and-splitting-large-systems/)).

> **Bridging forward**: at this point, the three weapons of AI collaboration are complete — **spec (23) supplies the constraints, checklist (24) reviews the output, eval (25) guards quality**. But when do you reach for which weapon? When is it fine to vibe, and when must you go spec-first? The final chapter of the AI-collaborative track, [26 · Collaboration decision tree: when to vibe, when to spec-first](/en/tutorial/when-to-vibe-when-to-spec/), wraps all three weapons into **a workflow you can actually follow**.

---

## Related links

- Theory foundation: [17 · Architecting in the age of LLMs](/en/tutorial/architecture-judgment-in-llm-era/) (nondeterminism → eval-driven)
- Same-source cases: [20 · Evolution playbook: MVP → scale (ADR-005 eval gate)](/en/tutorial/evolution-playbook-mvp-to-scale/) · [22 · AI-native system design](/en/tutorial/ai-native-system-design/) · [21 · Splitting & migration in practice (shadow traffic / online eval)](/en/tutorial/splitting-and-migration-in-practice/)
- Companions: [14 · Evolving & splitting large systems (fitness functions)](/en/tutorial/evolving-and-splitting-large-systems/) · [06 · Quality attributes & trade-offs (coverage vs cost)](/en/tutorial/quality-attributes-and-tradeoffs/)
