---
title: "T03 · Which data recipe produces the capability you need?"
description: "Compare data mixtures, deduplication, synthetic data and mid-training under a fixed token budget to establish the net benefit of data processing."
series: "model-training"
order: 3
pubDate: 2026-11-11
kind: "tutorial"
tags: ["Model training decisions","Data engineering","Synthetic data","Mid-training"]
locale: "en"
translationKey: "tutorial/t03-data-recipe-quality-synthesis"
sourceHash: "06dbb2aabbaf527f5537dbb31f3fc3d2804937788d38df51f036bf01e1fdadb0"
---

## One token budget, two different models

Let’s first look at a project site (the following is a teaching schematic scenario, the numbers are hypothetical budgets, not the data of any real model).

Two teams each have a pretraining data budget of about **1T tokens**, targeting the same capabilities: a general Chinese-language assistant, code, and mathematics.

- **Team A** spends the entire budget on a general web-crawl corpus, mixes it in the proportions collected, and trains on the full 1T tokens.
- **Team B** divides the budget: most goes to multilingual web data, with explicit shares for code, mathematical reasoning, instruction-style conversations, and Chinese technical documentation. A final small allocation emphasizes high-quality code and mathematics near the end of pretraining.

After training, compare on the same evaluation set: the total scores of the two models may be close, but their ability profiles are very different. A's model is more like a "person who has read all the web pages", and B's model is significantly more stable in code, structured output and mathematical tasks, although it has read less "total web pages".

A repeatedly cited comparison supports investigating this choice: [FineWeb-Edu’s curated 1.3T-token corpus often outperforms a raw 10T-token corpus in evaluations](https://presenc.ai/research/open-pretraining-datasets-2026). This summary is a data-service provider’s research page; its trend aligns with Hugging Face’s open-model review, while individual figures should be checked against dataset cards. Such comparisons suggest filtering may help, but total dataset size is not the number of tokens actually consumed in an experiment. The 1.3T-versus-10T size difference alone cannot establish training efficiency; check the model, training budget, and evaluation setup.

```text
Conclusion of T02: Budget is limited, money should be spent wisely
        ↓
The question of this chapter: How to allocate the same Token budget so that it can be "spent wisely"
        ↓
Mixture (which data categories, and how much of each)
   × Quality (what does each type of data look like and how to wash it)
   × Timing (which data should be added at the end of pre-training)
        ↓
With the same Token order of magnitude, models with completely different capability profiles can be trained
```

So the first discipline comes first: **The ratio is an experimental variable, not a fixed answer in the industry. **Any statement that "all large models are allocated 20% code" mistakenly turns other people's experimental conclusions with specific goals and specific corpus into a recipe that can be copied. All ratio numbers in this chapter will be marked with source and measurement basis. What can be reused is the derivation method, not the number itself.

Taking over the three ledgers of T02, the data budget actually has four destinations, and each destination buys different things:

```text
Data budget for T02
    ├── Buy/collect new data (what you buy covers: new languages, new fields, new knowledge)
    ├── Clean existing data (buy density: the same number of Tokens, the information is purer)
    ├── Synthetic data (buying directional: materials with specified abilities, and lower unit FLOP)
    └── Increase mid-training (buying timing: a final intervention before the model settles)
```

The following sequence of this chapter is the expansion of these four directions: first the recipe (where to spend it), then the pipeline (how to clean it), then the vocabulary (interface), then synthesis and mid-training (two new directions), then the data wall and restricted training (macro constraints), and finally attribution (how to know that the money is not wasted).

---

## 1. Derive the data recipe from capability goals

**Data Recipe** can first be understood as an ingredient list: how many tokens are there in total, which categories they are divided into, how many tokens are in each category, which sources they come from, what quality they are washed into, and in what order they are fed to the model.

### 1. Write the ability goals first, then the ingredients list

The order cannot be reversed. A common mistake is to first take stock of "what corpora are on hand", mix them in according to the stock ratio, and finally see what the model can do. The correct derivation direction is:

```text
Capability goals (where do you want the model to become better)
        ↓
Target evaluation set (what is used to prove that it is getting better)
        ↓
Data category (which types of materials may feed this ability)
        ↓
Source and quality (where each type of material comes from and to what extent it is washed)
        ↓
Proportion and timing (how much of each, feeding at what stage)
```

A **capability matrix** connects data categories to target evaluations and forms half of this chapter’s engineering artifact:

| Data category | target ability | Corresponding evaluation | key risks |
|---|---|---|---|
| Multilingual web pages | Universal language, world knowledge | General Understanding/Q&A | High noise, copyright and privacy risks |
| code | Code generation, structured output, reasoning migration (hypothesis to be verified) | Code benchmark, reasoning benchmark | Migration benefits do not hold in all settings |
| Mathematics and Reasoning Materials | Symbolic reasoning, multi-step calculations | Math Benchmarks | High-quality corpus is naturally scarce |
| command dialogue | Follow instructions | Command evaluation | The boundary with post-training SFT (supervised fine-tuning) data should be clearly drawn |
| Encyclopedias and reference books | factual knowledge | Trivia | Timeliness, knowledge conflict handling |
| Chinese technical documentation (Chinese target) | Chinese technical expression | Chinese review | High-quality Chinese corpus is relatively scarce |

### 2. Stratification dimension: the ratio is not a one-dimensional percentage

The ingredient list must make at least one decision on each of these dimensions:

- **Source**: Web scraping, code repository, books, papers, authorized procurement, synthesis.
- **Domains and Languages**: Target share by field and language.
- **Quality tiers:** split a source into quality bands. OpenCSG’s Chinese educational corpus, for example, has approximately 4–5-point and 3–4-point tiers supporting curriculum learning; [its official page](https://opencsg.com/blogs/794a4844-9dc5-4c57-8783-5440413def20) explains the design.
- **Difficulty and order**:Curriculum makes the model universal and avoids difficulties.
- **Repetition and sampling weights:** high-quality data can be reused, within limits discussed in section 6. More generally, **sampling weights** determine the difference between a source’s nominal share and how often the model actually sees it. **Temperature sampling** controls how strongly sampling favors the leading high-quality sources when several sources are available: lower temperature concentrates sampling more heavily on them.

### 3. Code data: a "migration hypothesis" worth talking about separately

Code occupies a much larger share of recent high-performing pretraining recipes than of ordinary web pages. [Toloka’s 2026 review of frontier practices](https://toloka.ai/blog/how-frontier-labs-build-pre-training-datasets) gives an empirical range of **approximately 15–25% code**. This is the review’s summary of publicly disclosed laboratory practices, not an industry consensus; recipes for different models and objectives may fall outside it.

Why allocate so much? The usual explanation is a **transfer hypothesis that still needs testing**: code is structured, causal material with executable feedback. Learning to decompose problems, organize structure, and solve them step by step may transfer to general reasoning. Supporting evidence exists, but the benefit depends on model scale and the rest of the recipe. Do not assume adding code automatically improves reasoning scores.

### 4. How little current models disclose about their data

Formulations are one of the core experimental assets of each laboratory and are rarely publicly disclosed. Two anchors for 2026:

- **GLM-5:** pretraining data increased from GLM-4.5’s 23T to **28.5T tokens**, while parameters increased from 355B-A32B to 744B-A40B. Both can be checked in the [official GitHub repository](https://github.com/zai-org/GLM-5). However, **the Chinese/code/synthetic-data mixture is undisclosed**; do not invent GLM-5’s proportions.
- **Kimi K3:** the [technical report](https://arxiv.org/abs/2607.24653) discloses 2.8T total and 104B active parameters, 1M context, native vision, and selection of 16 of 896 experts per token, alongside large-scale task synthesis and million-token agentic RL. However, **the detailed pretraining data recipe is also undisclosed**. Watch the units: K3’s “2.8T” counts **total parameters**, while GLM-5’s “28.5T” counts **pretraining tokens**. These two uses of “T” measure different things.

> **Architectural wisdom: **The first principle of data formulation is to "infer the material backward from the ability to be evaluated", rather than "to infer the ability forward from the corpus at hand". The capability matrix precedes the ingredient list; the ingredient list precedes the cleaning pipeline; each step retains a traceability chain of "which capability target does this row of configuration correspond to?"

### 5. Set the mixture through experiments, from coarse to fine

No one can write a match the first time. The possible path is a series of experiments from small to large, each level is only to answer one question:

```text
Level 1 Small Model + Small Budget
    └─ Answer: Which data categories are related to the target capabilities? (Preliminary screening of the capability matrix)
Level 2 fixed category, sweep ratio
    └─ Question: where is each category most sensitive? For example, does adding 5% code change the reasoning score?
Level 3 Add quality variables
    └─ Answer: How to compromise between quality level and retention rate in the same category?
Level 4 Medium-Scale Validation
    └─ Answer: If the small-scale conclusion is extrapolated to the target scale, is the direction still correct?
Level 5 Mass training + mid-training
    └─ Answer: Final formula, and leave a complete set of ledgers
```

Two disciplines:

- **A record of "predicted value vs actual value" must be kept at each level. **The value of small-scale experiments is not only the selection ratio, but also the calibration of "how reliable our extrapolation is" itself (this is a direct reuse of the T02 experimental design method).
- **Don’t waste your budget on low-sensitivity areas. **If level 2 shows that a category barely moves the indicator from 10% to 15%, don’t do expensive scans for it at level 5; budget for sensitive variables.

---

## 2. The pipeline from raw corpus to trainable data

The recipe determines "what you want" and the pipeline is responsible for "creating it". A typical pipeline looks like this:

```text
Original corpus (webpage / code repository / book / authorization data)
    ↓ Extraction and parsing (HTML→Text, PDF→Text, encoding repair)
    ↓ Language and domain identification, rough classification
    ↓ Deduplication (exact → approximate → cross-source)
    ↓ Filtering and quality scoring (rules + quality model)
    ↓ Privacy and copyright management (right to withdraw, license registration)
    ↓ Depollution (aligned with evaluation benchmarks)
    ↓ Bucket storage: Register by source × domain × language × quality file
    ↓ Proportioning and sampling (take numbers from each barrel according to the formula)
    ↓ Trainable data set (with version and ledger)
```

### 1. Three levels of duplication removal

| level | practice | What to catch? | Missing something |
|---|---|---|---|
| **Accurate deduplication** | Exactly the same text (always hashed) | Mirror the entire article and repost it repeatedly | Reprinted with a few words changed |
| **Approximate deduplication** | Similarity clustering such as fingerprint/minimum hash | Slightly rewritten repetition | Semantically identical, literally rewritten copy |
| **Cross-source deduplication** | Deduplication after merging different sources | The same document is included in multiple corpora | Cost increases with number of sources |

Weight removal is not as harsh as possible. Moderate filtering of duplicates can improve data efficiency, but if the deduplication threshold is too tight, "legal duplicates" will be mistakenly deleted - such as recurring examples in API documents and reasonable template sentences in textbooks.

The order is also a design point: first accurate and then approximate, first in the database and then across sources - cross-source deduplication is the most expensive, and it is only done on the "surviving" corpus at the end, which can reduce the calculation amount to an affordable range.

### 2. Deviation between quality scoring and quality model

Modern pipelines commonly score and filter documents with a **quality model**, an approach exemplified by FineWeb-Edu’s educational-quality classifier and its curated 1.3T-token subset. The quality model is trained too: label a small set of high- and low-quality examples, train a classifier, and score the full collection. Thus, **annotators’ ideas of quality are amplified through the classifier into the distribution of the entire corpus**. Common quality-model biases include:

- Filters trained with "English web pages" may systematically lower scores for minority languages and non-mainstream styles, resulting in **A few languages are eaten by the cleaning pipeline**;
- If "high quality" is implicitly defined as "like a textbook", long-tail knowledge, spoken corpus, and difficult samples may be filtered out as a whole;
- The preferences of the filter will directly become the preferences of the training distribution—— **Cleansing rules are part of the recipe, not neutral infrastructure**。

### 3. How to prove that cleaning has net benefits: retention rate + sub-dimensional profit and loss

The cleansing account must be calculated like this, rather than "cleaner = better":

```text
Corpus pool before cleaning
    ├── Retention rate = Tokens retained after cleaning / Tokens before cleaning
    └── Cost and benefit per 1% retention rate
          ├── Benefits: general benchmark, target ability, training stability (loss curve)
          ├── Loss: Language, domain, and long-tail knowledge covered by the filtered corpus
          └── Control: a small ablation with the same recipe and budget, changing only cleaning intensity
```

**Keep Rate** is a core pipeline metric: a 30% keep rate means discarding 70% of tokens, which alone is neither good nor bad. A high rate may indicate conservative cleaning and remaining noise; a low rate may indicate excessive deletion. There is only one criterion: **In a controlled experiment with a fixed calculation budget, whether the model trained on the cleaned corpus makes a net profit in the sub-dimensional evaluation**. "Dimensionality" is the key word: if the total score increases by 1 point but a certain language decreases by 10 points, it will be a net loss for a multi-language model.

Put this set of accounts into a table (the numbers are teaching instructions, showing notation rather than actual experiments):

| Dimensions | Clean v1 (retention rate 62%) | Clean v2 (retention rate 41%) | How to read |
|---|---|---|---|
| Common Benchmarks of Understanding | baseline | +0.8 | v2 small profit |
| Goal Reasoning Benchmark | baseline | +1.5 | v2 main goal achieved |
| a low-resource language | baseline | -9.3 | Filters eat up the language, net loss |
| training loss stability | baseline | Slightly more stable | minor bonus points |
| Conclusion | — | Test again after adding language awareness filtering | Just looking at the first two lines will misjudge "v2 is better overall" |

This table is the minimum form of "Dimension Profit and Loss": **Each row corresponds to a row of the capability matrix. Any row falling below the threshold can reject the entire pipeline**, rather than being averaged out by the total score.

### 4. The 2026 generation of open datasets: a map with explicit measurement bases

| Dataset | institution | Scale (measurement basis) | Licensing/Governance Points |
|---|---|---|---|
| FineWeb 2 | Hugging Face | ~10T (after multi-language filtering) | ODC-BY, multi-language 500+ |
| Common Pile | AI2 + EleutherAI + Community | ~8T | Fully licensed corpus of explicit copyright clearance |
| Dolma 3 | AI2 | ~6T | Documented traceability, OMLo series base |
| RedPajama 2 | Together | ~30T(raw + filtered dual measurement basis) | Large scale, special measurement basis |
| Nemotron-CC | NVIDIA | ~6.3T (CC high-quality subset) | quality route |
| Common Corpus | Common Pile Ecology | ~2T | All copyright-free/open license, [ICLR 2026 Oral](https://arxiv.org/abs/2506.01732), with complete traceability |

Three cautions. First, **token counts cannot be compared directly across datasets**: FineWeb 2’s ~10T is filtered multilingual data; RedPajama 2’s ~30T involves raw and filtered definitions; Nemotron-CC’s ~6.3T is a high-quality subset. State those definitions when comparing them. These figures come from a [2026 open-corpus review](https://presenc.ai/research/open-pretraining-datasets-2026); verify the dataset cards before use. Second, the main 2026 trends are **quality over quantity, interest in copyright-compliant corpora, and substantial multilingual expansion**, replacing the Pile-era assumption that bigger is always better. Third, **there is no new 2026-generation open Chinese baseline** in this account: reference points remain [IndustryCorpus 5T](https://aihub.caict.ac.cn/datasets/zhinao/Pretraining-Corpus-5T), about 5T tokens of high-quality Chinese text, and OpenCSG’s Wukong series. A frequent citation error is calling Wanjuan-CC Chinese: it is **a 1T-token English CommonCrawl corpus** and must not be cited as a Chinese-data example.

### 5. Licensing and copyright management: from bonus points to threshold

By 2026, privacy and copyright governance has become a dataset admission criterion rather than an optional compliance benefit. Copyright litigation and frameworks such as the EU AI Act have made legal suitability for training an early dataset-design question (see [Overview of open source corpus](https://presenc.ai/research/open-pretraining-datasets-2026) A review of the trend of "copyright compliance corpus becoming popular"). When it comes to engineering, this link at least includes:

- **License registration**:Each data bucket records the source, license type and collection date, and corpus with unknown authorization will not be included in the database;
- **Respect opt-outs:** publishers who prohibit training must be removable from the corpus pool. Apple AFM 3’s [data disclosure](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models), for example, publicly commits to respecting publisher opt-outs and not using private user data by default;
- **Removable**: When the permission changes, a certain batch of data can be removed from the training set as a whole according to the source. This requires that the previous "bucket storage" step has actually been registered according to the source.

Licensing governance also explains the changes in the open source corpus landscape: the reason why corpora such as Common Pile and Common Corpus, which are "all copyright-free or open licensed, with complete traceability," will become the main line in 2026 (the latter will receive the ICLR 2026 Oral) is precisely because they put the governance cost in the data set design stage, rather than leaving it to the downstream model team.

> **Judgment boundary:** A cleaning rule, a quality model, and a deduplication threshold. Only by showing three pieces of evidence: "retention rate + change in sub-dimensional capabilities + fixed budget comparison" can the net benefit be proved. Without these three, "we clean more strictly" is just a configuration change to be verified.

---

## 3. Tokenizers and vocabularies connect data, architecture and deployment cost

Data teams often skip this section, but it is the **interface between data, model architecture, and deployment cost**. A wrong interface choice creates rework on both sides.

**Tokenizer** cuts the text into the Tokens actually seen by the model; **Vocabulary** is a list of all available Tokens. The size of the vocabulary (commonly tens of thousands to more than 200,000) is a structural parameter that must be determined before training.

### 1. Fertility: For the same word, different vocabulary lists produce different costs

**Fertility (fertility/expansion rate)** refers to the average number of Tokens that each word (or each Chinese character) is divided into. It directly rewrites three ledgers:

```text
The same Chinese paragraph
    ├── Word list A:fertility = 1.6 Token/Chinese characters → Training fee, reasoning fee, and context usage are all higher
    └── Vocabulary B:fertility = 0.7 Token/Chinese characters (Chinese characters are more complete) → The same character, less Token
          ↓
Effective context = nominal context length ÷ your fertility
Deployment cost = number of input and output Tokens × unit price
```

This is what "interface" means: **A document on the data side is converted into the number of tokens and bills on the model side after vocabulary conversion**. Chinese, code, and small languages ​​​​are the three types of materials with the most acute fertility problems-indentation, variable names, and rare Unicode characters in the code will be chopped into pieces if the vocabulary is not covered.

### 2. Triangular trade-offs in vocabulary decision-making

| Dimensions | Larger vocabulary | Vocabulary smaller |
|---|---|---|
| Compression rate (fertility) | Usually better, fewer tokens for the same text | Worse, rare content chopped into pieces |
| Embedding parameters | Vocabulary × hidden layer dimensions have more parameters | Save more |
| Low-frequency Token learning | Low-frequency token training is insufficient, and the long tail is more brittle | See more with each Token |
| Multi-language/code coverage | There is space for Chinese, code, and minor languages | Easy to partial to English text |

### 3. Compatibility cost of vocabulary swapping

The vocabulary is almost impossible to change during training: changing the vocabulary means that the identity of each Token is completely changed. The trained embedding is incompatible with the model, and usually only retraining or expensive vocabulary expansion surgery (initialization of new tokens + continued training) can be done. So the correct timing is: **First determine the language and modal coverage goals (part of the data recipe), then determine the vocabulary, and then start large-scale pre-training**. This also explains why models with clear multi-language goals (such as the GLM series that takes care of Chinese) will invest in decisions during the vocabulary design stage, rather than remedial measures afterwards.

### 4. An example of calculating money

For the same product requirement - "can read technical documents with 60,000 Chinese characters at a time and answer questions", the two word lists give two completely different accounts (the numbers are teaching instructions, showing the algorithm rather than a certain product):

```text
Requirement: input 60,000 Chinese characters at one time
Vocabulary A:Chinese fertility = 1.5 Token/word
    → Actual input of 90,000 Token
    → Models with nominal context ≥ 90K are required; inference is billed by 90K Tokens
Vocabulary B: Chinese fertility = 0.7 Token/word
    → Actual input of 42,000 Token
    → A model with a nominal size of 48K is enough; inference is billed based on 42K Tokens
```

Same task, Vocabulary A pushes it into a more expensive, context-heavy gear. This is also the entrance to the T02 inference ledger on the data side: **A fertility difference of 0.1 can materially change costs for a service processing millions of requests per day**。

### 5. What are the signs that the vocabulary has become "partially subject"?

Vocabulary problems usually do not report errors directly, but appear with these symptoms:

- The output of a certain language is slow and expensive (fertility is abnormally high), and users complain about the price first and then the quality;
- Code indentation, rare identifiers are chopped into pieces, and the model "cannot understand" long variable names;
- After changing the language, the nominal context remains unchanged, but the number of document pages that can be crammed into it is significantly reduced.

When these signals occur, the problem is probably not the amount of data, but the interface.

> **Judgment boundary:** The vocabulary is not an accessory to the "Model Structure" chapter, but a pre-constraint of the data recipe. When reviewing a pre-training program, ask three things: What is the fertility of the target language? Is the effective context (nominal length ÷ fertility) sufficient input for the target task? Is there still room for the modalities/languages ​​to be added in the future and the vocabulary?

---

## 4. Synthetic data: target capabilities rather than volume

The role of synthetic data has changed in 2026: in the early days, it was often used as a "filling patch when the corpus is insufficient", but now its positioning is closer **Cost Reduction Variables and Capability Orientation Tools**. Look at the definition first, then the evidence, and finally the risks.

### 1. Production pipeline for synthetic data

Synthesis is not "generated and directly entered into the training set", but a pipeline with the same weight as cleaning:

```text
Seed materials (real corpus/question bank/tool call records)
    ↓ Teacher model generation (rewrite, expand, solve problems, construct tasks)
    ↓ Filter (Quality Model + Rules)
    ↓ Verification (executable code running test, math answer to answer, fact checking)
    ↓ Deduplication and diversity control (preventing generation distribution collapse)
    ↓ Mixed with real data in proportion
    ↓ Training + comparative evaluation (synthetic/real/mixed three groups)
```

**Web Rephrasing**, described in [Toloka’s 2026 review](https://toloka.ai/blog/how-frontier-labs-build-pre-training-datasets), is a representative process: a stronger model rewrites low-quality web pages into higher-quality text, followed by verification before ingestion. Proposed in late 2024, it is described by the review as routine in frontier data pipelines by 2026. Attribute that assessment to the review. The same review says human expert data—instruction sequences, expert reasoning traces, edge cases, and manual spot checks of synthetic data—now enters pretraining and mid-training, replacing the older division that assigned human data only to post-training.

### 2. Evidence and measurement basis: What exactly does synthesis bring?

- **Evidence of cost reduction direction**:[Transcript of Epoch AI 2026-05 report](https://techjacksolutions.com/ai-brief/epoch-ai-reports-synthetic-data-gains-cut-frontier-flop-requ) reports that synthetic data can reduce the training FLOPs needed for frontier models: at a fixed capability target, synthesis mixed with high-quality data may cost less than accumulating raw web pages. This is a secondary account; label the evidence level when citing it.
- **Proportion: **2026** No cutting-edge laboratory has published precise proportions of synthetic data**. Apple AFM 3 only discloses the category but not the ratio (see below); GLM-5 and K3 are not disclosed. Any unsourced percentage that reads "Synthetic data accounts for X%" should be considered a rumor.
- **Risk evidence in the opposite direction: **Cyclic training of models on self-produced data may amplify deviations and collapse diversity (research in the direction of Model Collapse), and synthetic data that does not pass quality verification will pollute downstream. Net effect of synthetic data** No conclusion yet** ——The conclusion is highly dependent on the teacher quality, verification strength and task type, and evidence from both sides should be retained.

Both positions have evidence: **cost-reduction evidence**, including Epoch’s account of synthetic-data gains reducing frontier FLOP requirements, and **risk evidence** from studies of bias amplification and collapse in self-generated data loops. The dispute concerns which verification standards and task types produce a positive net benefit. **There is no settled conclusion; manage it as an experimental variable.**

Therefore, this chapter is written as follows: synthetic data is treated as **experimental variables** Management - real group, synthetic group, mixed group comparison, fixed budget, look at sub-dimensional evaluation; rather than treating it as a belief or taboo.

### 3. Evaluation discipline: why teacher self-evaluation is insufficient

Teacher scores its own output, which is equivalent to letting the producer double as a quality inspector: it prefers its own distribution and will misjudge "like Teacher" as "high quality". There must be at least three levels of acceptance: Verifiable tasks are verified using programs (code running tests, mathematical answers); non-verifiable tasks are verified using independent models or manual inspections; and there is another layer of distribution inspection (diversity, difficulty coverage, and difference measurement with real data).

### 4. Capability-oriented synthesis: an active case of task synthesis

Beyond adding volume, synthetic data can **target specific capabilities**: generate training material for what the model lacks. [Kimi K3’s technical report](https://arxiv.org/abs/2607.24653) describes large-scale task synthesis for general, agentic, and coding RL, paired with million-token agentic rollouts and persistent sandbox state. The teaching point is the change in form: **synthesis expands from corpus documents to tasks and interaction trajectories**. Verification likewise moves from scoring text quality to testing whether tasks can be completed and code can run.

This creates an attribution requirement: judge task synthesis by the trained model’s performance on **held-out tasks and newly generated tasks**, rather than by how realistic the synthetic examples look. Coverage of the task distribution matters more than the quality of one example.

### 5. How to design three groups of comparisons

The beginning of the fourth section says "three sets of comparisons of real/synthetic/mixed", which looks like this:

| group | data | Answered questions |
|---|---|---|
| baseline group | Full reality, fixed budget | Check origin |
| Synthetic group | Part of the real thing is replaced by synthesis, and the total Token is aligned with the compute | Under the same budget, will synthetic replacement make money or lose money? |
| Enhancement group | The truth is fully retained, and additional synthesis is added (the compute is increased accordingly) | How much marginal revenue is left from the additional synthesis? |

A common mistake is to just run "synthetic group vs baseline group" and draw conclusions: when the score goes up, it is unclear whether "synthetic replacement is effective" or "enlarging the total amount is effective"; when the score drops, it is not clear whether the synthesis quality is poor or the ratio is not adjusted correctly. Only when all three groups run together can "replacement income" and "additional income" be attributed separately.

> **Architectural wisdom:** The correct question to ask about synthetic data is not "should it be used?", but "which part of the budget should be replaced/added with synthetic tokens, and how much capacity can be purchased per unit of compute?" It is a price variable in the budget equation, not a free patch in the corpus pool - there is a cost to generate, there is a cost to verify, and there are negative benefits if the verification is not strict.

---

## 5. Mid-training: a targeted late-stage recipe

### 1. Stage position: between the end of pre-training and post-training

The definition of **Mid-training** in 2026 has been solidified: in the final stage of pre-training, high-quality, ability-oriented data (typically code, mathematics, instructional content) is directionally added, between "general pre-training" and "post-training (SFT, etc.)".

```text
Pre-training (large-scale general mixing)
    ↓
mid-training (targeted plus: 50-500B Token-level high-quality content)
    ↓ ← The protagonist of this section
SFT / alignment fine-tuning (AFT) and other post-training
    ↓
publish model
```

### 2. Economics: How to evaluate this targeted investment

[Toloka’s 2026 review](https://toloka.ai/blog/how-frontier-labs-build-pre-training-datasets) gives an order of magnitude: adding **50–500B tokens** of expert-curated, high-quality content late in pretraining can measurably improve reasoning, instruction following, and domain tasks. The review’s claim is that a few million dollars of expert-curated mid-training data can improve downstream benchmarks more than additional ordinary web data costing ten times as much.

Let's first explain "what it means": pre-training subjects often have twenty or thirty trillion Tokens (such as GLM-5's 28.5T), and mid-training only accounts for about 1% of it, but it appears at the moment when the model is "about to be finalized", and the marginal efficiency of learning is the highest. This is similar to human learning - reading a few right books in the final sprint is much more cost-effective than extensive reading of an entire library.

This is why this topic calls mid-training the **highest-leverage second recipe**. The first recipe—the main pretraining mixture—establishes baseline capabilities; the second uses a smaller budget for targeted improvements. Both should work backward from capability goals, rather than simply feed more of the same data.

### 3. Research case: Anthropic’s Model Spec Midtraining (MSM)

In May 2026, Anthropic introduced [Model Spec Midtraining (MSM)](https://alignment.anthropic.com/2026/msm) ([paper](https://arxiv.org/abs/2605.02087)): after pretraining and before Alignment Fine-Tuning (AFT), mid-train on documents discussing the Model Spec to shape how later alignment generalizes.

Pay attention to two disciplines:

- **MSM is a method proposed by a particular research team and validated within its experimental setup**, not an industry-wide standard. Public evidence does not establish that frontier laboratories generally mid-train on specification text;
- Its **robustness under pressure is disputed**: by September 2026, opposing papers had questioned its behavior under stress tests. Present both the preliminary positive findings and the lack of a settled conclusion when writing or making decisions.

The data engineering implications of MSM are worth remembering separately: the training data stratification has been expanded from "pre-training/mid-training (ability)/post-training" to **fourth floor** ——The mid-training container now contains not only ability data such as coding and mathematics, but also values and normative corpus. The "category table" of data recipes has become longer.

### 4. The boundary between mid-training and SFT

Mid-training is not a forward move from SFT. The data forms and goals of the two are different:

| | Mid-training | SFT |
|---|---|---|
| location | At the end of pre-training, the autoregressive language target is still the main focus | Post-training starting point, directly aligned with target behavior |
| Data magnitude | Tens of billions of Tokens | Usually one or two orders of magnitude smaller |
| Typical materials | High-quality code/mathematics/imperative long text, (MSM type) specification documents | Finely labeled demonstrations, conversations, and preferences |
| Answered questions | "What capabilities will the chassis be strengthened in the end?" | "How should the model behave" |

### 5. Triage: mid-training, continuing pre-training or direct SFT

Put mid-training back into the decision-making menu, it solves a different problem than its two neighbors:

| candidate stage | Applicable issues | Data form | Main risks |
|---|---|---|---|
| Continue pre-training | The base model broadly lacks data from a **domain**, such as an industry’s documents | A lot of domain text, autoregressive objectives | General capability rollback requires replay data buffering |
| Mid-training | The base is established, but needs targeted **capability** improvements in code, mathematics, or instructions, or specification conditioning such as MSM | Selected content from tens of billions of Tokens | Enhanced Overcrowding Universal Distribution |
| Direct SFT | The base model is capable enough, but its **behavior** does not meet product requirements | Small quantity precision standard demonstration | SFT can’t teach you the abilities that the base doesn’t have |

The order of judgment in triage: first ask "Is it missing domain corpus, ability strength or behavioral norms", and then select a stage; if a model is missing three things at the same time, stage arrangement (which one should be filled first) is a training arrangement issue for T11. This chapter only requires the option of "second recipe" to be put into the menu.

### 6. A deduction: the second recipe of Chinese Code Assistant

Use the method in this chapter to go through it (all numbers are teaching instructions and show derivation, not any real formula):

```text
Goal: Chinese technical Q&A + medium difficulty code generation
    ↓ Backward capability shortcomings (capability matrix from the previous generation model)
    ① Code: Able to write boilerplate, complex refactoring is difficult → Insufficient coding ability
    ② Chinese technical terminology: OK in colloquial expression, but unstable in documentation → Insufficient corpus in the field
    ③ Instruction: Basically qualified → Behavior is not the main shortcoming → No need to increase investment before SFT
    ↓ Derivation of the second recipe (mid-training, the total amount is 120B Token)
    Code (including selected open source warehouses with testing) 45% ← Align the shortcomings ①, and choose the high segment within the experience range
    Chinese technical documents/specifications/interface manuals 35% ← Align shortcomings②, all sources are registered and approved
    Mathematics and Reasoning Materials 10%
    Universal high-quality replay data 10% ← Buffer: Prevent universal capabilities from being occupied
    ↓ Verify design
    Fixed budget comparison + Capability matrix cell by cell + Forgetting check (focus on Chinese general Q&A)
```

Three noteworthy trade-offs: the code is selected from the high end of the experience range, because shortcoming ① has the highest weight; 10% of the "replay data" is specially used to prevent forgetting. It is not a waste, but insurance; behavioral shortcoming ③ is not compensated with the data budget - that is the account of the SFT stage, don't waste money in mid-training. **Every choice is linked back to a grid of the ability matrix**, this is what "recipe backward from ability target" looks like on the second recipe.

> **Judgment boundary: **The high leverage of mid-training only belongs to the model with "the chassis is in place and the goal is clear". If the main pre-training recipe has not yet converged and the ability matrix is ​​still changing significantly, revise the first recipe first; adding weight to the drifting foundation will only amplify the wrong direction.

---

## 6. The data wall and data-constrained training

### 1. Data wall: both exhaustion intervals are correct

The **Data Wall** is the finite stock of high-quality public text. An [account of Epoch AI’s estimates](https://techjacksolutions.com/ai-brief/epoch-ai-reports-synthetic-data-gains-cut-frontier-flop-requ), based on Villalobos et al.’s 2024 paper “Will we run out of data to train large language models?”, still commonly cited in 2026, estimates roughly **300T tokens** of high-quality human public text, exhausted during **2026–2032** at the consumption growth rate assumed then. Toloka’s review quotes a tighter **2026–2028** range under a stricter quality threshold.

The two intervals are not contradictory—— **Different measurement basis**: The former is based on the baseline definition of "high-quality text" in Epoch's original text. The latter raises the quality threshold and the stock is smaller and exhausted earlier. The measurement basis must be stated when quoting, and do not write a definite date such as "the data wall will expire in a certain year". What it means: The marginal cost curve of data budget is steepening. This is the macro background for this chapter to use quality, synthesis and mid-training as the main variables.

### 2. Three quantities that must not be equated

```text
The amount of public data that can be crawled (trillions of raw bytes)
    ≠ The amount of corpus that can be parsed into text (parsing rate, after language recognition)
    ≠ Effective training data volume (after deduplication, filtering, quality thresholds, licensing compliance)
```

"Catchable volume" is directly quoted as "effective training volume", which is the most common measurement basis slippage in data discussions. The data wall constrains the last layer.

Measure this funnel yourself: the loss rate at each layer determines your **procurement leverage**. If cleaning consistently discards 90% of a data category, collecting ten times more raw data and improving that category’s cleaning are directly comparable options. One buys coverage; the other buys usable density. Only a complete ledger tells you which costs less. Teams often measure the first layer alone and can only argue for collecting more.

### 3. What to do when data is limited: the boundary between research and reality

Responses to scarce high-quality data include multiple epochs, synthetic substitutes, and data-constrained scaling research. Repetition can help, with diminishing returns and eventual generalization damage—hence treating repetition as a mixture variable in section 1. [Q Labs’ data-constrained scaling research](https://arxiv.org/abs/2610.37842) examines hyperparameter transfer and ensembles, among other approaches. Its limited experimental scale does not establish frontier-model benefits; retain the scale and extrapolation limits when citing it.

### 4. Repeated training under a data constraint, and its limits

When fresh high-quality data is scarce, the oldest approach is more **epochs** over existing data: the second epoch shows the model the same material again. Only the qualitative framework is given here. Useful repetition limits depend strongly on dataset size, model capacity, and the rest of the recipe, so there is no universal number:

- **Moderate repetition can help:** a second or third exposure to high-quality material often still produces useful learning. This supports section 1’s allowance for reusing high-quality corpora;
- **Diminishing Margin, Overhead Injury Model**: After a certain number of repetitions, the new information approaches zero, the model begins to overfit the training distribution, and the generalization ability is impaired;
- **Repetition is part of the mix**: Configurations such as "data set 1.5 Epoch, high-quality bucket 2 Epoch" should be written in the recipe table together with the data ratio, rather than the hidden default value in the training script.

The 2026 response combines repetition, synthesis and data constraints: prefer genuinely new high-quality data when it can be acquired or cleaned; when it cannot, combine targeted synthesis, controlled repetition and targeted mid-training. Establish the limits of each through experiments.

### 5. Decontamination: From "Quality Enhancement" to "Release Blocking"

**Decontamination** removes training material overlapping evaluation benchmarks. [Toloka’s review](https://toloka.ai/blog/how-frontier-labs-build-pre-training-datasets) describes frontier laboratories upgrading it from a quality improvement to a **release-blocking compliance step**, extending n-gram checks with embedding-similarity retrieval because literal matching misses paraphrased leaks.

How much can contamination matter? An [industry methodology article](https://www.digitalapplied.com/blog/llm-benchmark-methodology-2026-contamination-leaderboard-guide) estimates a 10–20-percentage-point leaderboard difference for the same weights depending on contamination. Attribute this to a methodology blog, not a controlled experiment. One research response is to [build contamination resistance into benchmark design](https://arxiv.org/html/2605.19999v1), alongside reproducibility, reliability, and discrimination, rather than repeatedly clean after release. For data teams: **check every target evaluation set against the corpus in both directions before ingestion**, and record contamination risk in the data ledger.

> **Judgment boundaries:** When quoting figures such as "When did the data wall arrive?" and "How much is the pollution falsely high?" first ask three things: who estimated it, what the measurement basis is, and whether it is supported by controlled experiments. It is better not to use figures of unknown measurement basis, rather than to add certainty to uncertain quantities for the sake of argument strength.

---

## 7. Attribute improvements to the data that produced them

Data teams often fail at **attribution**, rather than cleaning: a score changes, but nobody can identify which part of the recipe caused it.

### 1. Three Attribution Tools

```text
1. Data ablation: hold the model, budget and other data fixed; add or remove only the target category
        ↓
② Matching scan: Scan several matching points for the same category, and look at the ability curve instead of a single point
        ↓
③ Fixed calculation budget comparison: new formula vs old formula, total number of Tokens aligned with compute
        ↓
Dimensional capability matrix: Target capability ↑? Are there any unacceptable fallbacks for non-target capabilities?
        + Forgetting assessment (whether old abilities are degraded after multi-stage training)
        + Contribution margin: how much power you buy per PFLOP/dollar
```

Key disciplines: **The total number of tokens and the calculation budget must be aligned**. "The score increases after adding new data." If the total amount also becomes larger at the same time, the benefits may come from "more" rather than "better" - this is the illusion that the title of this chapter is intended to prevent.

### 2. How to read ratio scan: look at the curve, not the single point

A mixture sweep—for example, testing code shares of 10%, 15%, 20%, and 25%—is easily mistaken for “find the highest-scoring point.” The right approach is to examine the shape of the curve:

```text
target ability score
  ↑ .--------● ← 25%: Level again? Or is it starting to hurt other dimensions?
  |      .---●          20%
  |   .-●                15%
  |.-●____________________ 10% non-target abilities (such as general Q&A)
  +--------------------→ Is the code proportion declining simultaneously?
```

- **Still in the linear segment**: There is a high probability that overweighting will continue to be effective, and it is worth doing a more expensive experiment for the next level;
- **Entering the plateau period**: Scanning this variable again is a waste of budget and moves to the next sensitive variable;
- **Non-target capabilities decline simultaneously**: You are already borrowing general abilities in exchange for target abilities. It’s time to stop and go through the ability matrix again.

These three things are invisible to single-point comparison, only the curve is visible. This is also the output of "Level 2" of the Experimental Ladder in Chapter 1: a small set of curves, not an optimal number.

### 3. Use public figures to practice measurement basis awareness

GLM-5 provides a calculation using only disclosed figures from the [official repository](https://github.com/zai-org/GLM-5): 28.5T pretraining tokens, 744B total parameters, and 40B active parameters.

- Using **total parameters**: 28.5T ÷ 744B ≈ **38 tokens per total parameter**;
- Using **active parameters**: 28.5T ÷ 40B ≈ **712 tokens per active parameter**.

Both ratios are correct but describe different things: 38 is the data-to-total-capacity ratio, while 712 describes overtraining relative to per-token compute. T02 explains why deployment-oriented models often exceed early compute-optimal ratios. **Every token-to-parameter ratio must identify total or active parameters as its denominator**, especially for MoE models. These calculations use disclosed totals alone; GLM-5’s Chinese/code/synthetic mixture remains undisclosed, and the ratios establish nothing about that recipe.

### 4. Disclosure transparency: comparison of three companies

| model | what was disclosed | Nothing disclosed | Teaching points |
|---|---|---|---|
| GLM-5 | 28.5T pre-training Token, 744B-A40B parameters | Data ratio and source composition | Total amount is transparent ≠ Formula is transparent |
| Kimi K3 | 2.8T total parameters, 104B activations, 896 selected 16 experts, task synthesis and agentic RL overview, weighted open | Pre-training data recipe details | **Open weight ≠ Transparent training ≠ Self-deployable**, the three concepts cannot be inferred from each other |
| Apple AFM 3 | Data is disclosed in five categories: public information, authorized procurement, open source, special research, and synthesis; user private data is not used by default; publishers’ right to withdraw is respected | Various proportion figures | "Category-level transparency" and "digital-level confidentiality" can coexist |

Apple AFM 3’s [data disclosure](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models) illustrates category-level transparency: it states governance principles and data categories without giving proportions, showing that mixture figures themselves can be competitive assets. Distinguish disclosure of categories, principles, and numbers when assessing a model’s data practices.

### 5. Forgetting and cross-task generalization: the other half of attribution

Measuring only target capabilities will miss two types of hidden accounts of data changes:

- **Forgetting or capability regression:** a new recipe strengthening capability A may weaken B, especially when later training distributions displace earlier ones. Rerun the capability matrix from **before training** and **compare every cell**, rather than testing only the new objective. A cell below a promised product floor is a recipe-level problem, not merely training noise.
- **Cross-task generalization:** did the model learn how to solve this type of task or memorize this dataset’s phrasing? Evaluate **the same capability from a different source**. Gains that disappear on another source are tied to the distribution rather than the capability itself, reducing expected production benefit.

Add these two items to the attribution list, and the complete evidence of promotion is a four-piece set: **Target ability improvement + Non-target ability unacceptable fallback + Generalization established by changing sources + Fixed budget comparison**. When all four pieces are in place, the credit for this batch of data can be considered solid.

> **Architectural wisdom:** The evidence for advancement in data-based decision-making is a set of component-dimensional numbers plus a reviewable ledger, rather than a single-point improvement in the total score of the list. The total score is the result, and the ledger is the decision-making asset—draw what the ledger looks like in the next section.

---

## 8. Seven common reasoning errors

Each of the following items can be seen in real reviews. What they have in common is that they treat a judgment that requires evidence as a conclusion that can be quoted directly.

### Mistake 1: Copying other companies’ ratios as the industry’s fixed answers

The code ratio of 15-25% is the empirical range sorted out by Toloka's review, and it is not a standard answer. Copying numbers without copying the method of "working back from ability goals" is tantamount to copying other people's conclusions and discarding other people's reasoning.

### Mistake 2: The higher (or lower) the cleaning retention rate, the better

Retention is a meter not a goal. Keeping 90% may leave noise, leaving 10% may accidentally delete the entire language. The only qualifying criterion: net profit based on dimensional capabilities compared to a fixed budget.

### Mistake 3: Making up proportions for synthetic data, or treating it as a free patch

No cutting-edge laboratory has announced the precise synthesis ratio; synthesis has production costs and verification costs, and lax verification can lead to negative returns. If you see the unsourced statement that "synthesis has accounted for X%", you should treat it as a rumor.

### Mistake 4: Declaring the data formula valid when the ranking points increase

Scores can rise because of contamination, evaluation leakage, extra training or another unrecorded change. Without an ablation control, the attribution is unsupported. This is why frontier labs have elevated decontamination into a release-blocking step.

### Mistake 5: Open weights and transparent training

Kimi K3 opened the weights, but its data formula was not disclosed. Open weighting, transparent training, and self-deployment are three independent propositions that cannot be derived from each other.

### Mistake 6: Treating the amount of crawlable data as the amount of effective training data

From the original web page to the valid training data, it has to go through layers of damage such as parsing, deduplication, filtering, quality thresholds and licensing compliance. The data wall restricts the last layer. measurement basis slippage can cause budget estimates to differ by orders of magnitude.

### Mistake 7: Vocabulary decision-making was put behind the scenes, and it was discovered midway through training that fertility had eaten up the context

The word list was treated as a "little thing about the model structure" and was postponed until the eve of training. As a result, the fertility of the target language was on the high side: for the same nominal context, the number of documents inserted was 30% less, and the inference bill was 30% more. The vocabulary is almost impossible to change midway - interface decisions must be made in advance.

---

## Engineering artifacts: Data Recipe and Data Quality Scorecard

Collate the methods in this chapter into two document skeletons that can be placed directly on the table. The recipe table answers "What does the model look at and why it matches so well"; the scorecard answers "What thresholds does each batch of data pass and what is the evidence?" The two forms share the same set of IDs and will look at each other during review.

**Data Recipe(data recipe table)** ——Answer "What does the model look at":

| Field | Example | Description |
|---|---|---|
| Capability target | Code generation, Chinese technical Q&A | Measurable capabilities translated from product goals |
| target evaluation set | Code Base v3.1, Chinese Understanding Suite | Indicate version for decontamination alignment |
| data bucket | Webpage - Multilingual / Code / Mathematics / Imperative / Chinese Technical Documentation | Source × Domain × Language × Quality Profile |
| The ratio and sampling weight of each bucket | Code 18% (points taken within the experimental interval) | The ratio is an experimental variable, and the reason for the value is recorded |
| Stage ownership | Main body pre-training / mid-training / SFT | The same bucket may be reused across stages |
| Repetition and Curriculum Strategies | High quality buckets epoch 2; sorted by increasing difficulty | Record nominal proportion and actual visits |
| Vocabulary and fertility | Vocabulary 150K; Chinese fertility 0.8 Token/word | Interface parameters of data and structures |
| Decision and ablation links | ADR-T03-004; ablation #12 | Each line of configuration can be traced back to a decision |

**Data Quality Scorecard** ——Answer "Is this batch of data worth it?":

| Dimensions | indicator | threshold/evidence |
|---|---|---|
| Source and Authorization | Source registration, license type, withdrawal right compliance | Register bucket by bucket, if the authorization is unclear, it will not be stored in the repository |
| Cleaning intensity | Retention rate, deduplication rate (exact/approximate/cross-source) | Compared with the previous version, only one variable has been changed |
| mass distribution | Quality model score histogram, retention rate by language | Prevent filters from eating minority languages |
| contamination risk | Overlap check on target evaluation set (n-gram + embedding) | release-blocking, release only after passing the double check |
| synthetic data | Teacher and verification method, random inspection pass rate, mixed ratio | Three sets of controls: real/synthetic/mixed |
| training effect | Dimensional ability matrix, forgetting assessment | fixed budget comparison |
| marginal revenue | Capacity Points Per PFLOP/Dollar Exchanged | Decide where to spend the next round of budget |
| Conclusion | Upgrade / rollback / try again | Record the judge and date |

The two tables combined form the "ledger" mentioned at the beginning of this chapter: the configuration is on the left, the evidence is on the right, and any row of data decisions can be reviewed.

Minimum circulation of one recipe experiment:

```text
Change the recipe (add a row to the Recipe table and indicate the reasons and expectations)
    ↓
Accept data against Scorecard thresholds (two contamination checks and a recorded keep rate)
    ↓
Fixed-budget comparison: ablation versus control
    ↓
Ability Matrix Comparison + Forgetting Check + Generalization by Changing Sources
    ↓
All four pieces → Update the main version of Recipe and record the promotion date
    ↓ Any item is missing
Roll back or experiment again, write the differences back to the "Conclusion" line of the Scorecard
```

The key to this transfer is: **Each row of the recipe table corresponds to a conclusion of the Scorecard, and each conclusion of the Scorecard points to a certain change in the recipe table**. The most valuable asset of the data team is not any version of the corpus, but this "change → evidence" correspondence table - after personnel movements and corpus replacement, it remains the team's judgment.

---

## 🎯 Quick check

The first four questions correspond to the four core judgments of this chapter (proportion selection, synthesis acceptance, cleaning attribution, measurement basis discipline), and the fifth question tests the reasoning of the vocabulary interface. It is recommended to figure out the answer yourself first, and then look at the analysis.

```quiz
{
  "question": "After a certain type of new data is added, the total model evaluation score increases, but the coding ability decreases significantly. How should one judge whether to retain this type of data?",
  "options": [
    "An increase in the total score indicates that it is effective. Keep it directly and increase the proportion",
    "Compare the capability matrix with product goals: is code capability a committed target, and does the regression exceed its threshold? Use fixed-budget ablations to establish attribution rather than relying on the aggregate score",
    "The decline in code capability indicates that the new data is harmful and should be removed immediately"
  ],
  "answer": 1,
  "explanation": "An aggregate score is one point; the capability matrix reveals the gains and losses. Retention depends on goal weights and regression thresholds, with ablations needed to attribute gains to this data rather than simultaneous changes."
}
```

```quiz
{
  "question": "Why can’t high-quality synthetic data be accepted using just the Teacher model’s own ratings?",
  "options": [
    "Because Teacher’s ratings must be more accurate than others, there is no need for acceptance",
    "Because synthetic data cannot have quality at all, all can only be manually re-labeled",
    "Because Teacher is both a producer and a quality inspector, he will prefer the output in his own distribution and misjudge those that are \"like Teacher\" as \"high quality\"; acceptance requires independent verification (executable testing, answer verification), independent models or manual sampling plus distribution inspection"
  ],
  "answer": 2,
  "explanation": "The lack of independence in self-evaluation will amplify the deviation of the generated distribution. It's not that synthetic data is unavailable, but that the acceptance chain must be independent of the generation chain - this is the three-layer acceptance discipline of Section 4."
}
```

```quiz
{
  "question": "A purge line increases retention from 60% to 85%. Does this mean the training data quality has improved?",
  "options": [
    "Improved retention means improved quality",
    "Don’t just look at retention rate: retention rate is a gauge, not a goal. Whether the quality is improved depends on whether the sub-dimensional capabilities make a net profit compared with the fixed budget, and whether the risk of noise and pollution increases after relaxing filtering",
    "An increase in the retention rate indicates that the cleaning is more stringent, so the quality must have declined"
  ],
  "answer": 1,
  "explanation": "The retention rate only shows 'how many people are retained', not 'the ones who are retained are better'. Relaxing filtering may introduce noise and evaluation pollution, while tightening may accidentally delete long tails; the only qualifying criterion is comparative evidence of sub-dimensional net income."
}
```

```quiz
{
  "question": "The pre-training data of GLM-5 is 28.5T Token, the total parameters are 744B, and the active parameters are 40B. Some people quote two Token/parameter ratios of 'approximately 38:1' and 'approximately 712:1'. Why do both numbers exist and what should we pay attention to?",
  "options": [
    "The denominator of 38:1 is the total parameter, and the denominator of 712:1 is the activation parameter. The two measurement bases have different meanings. The denominator must be stated when citing any Token/parameter ratio, especially for the MoE model",
    "One of the two numbers must be wrong, so only one can be kept",
    "The Token/parameter ratio has nothing to do with the parameter measurement basis, you can use any one"
  ],
  "answer": 0,
  "explanation": "28.5T ÷ 744B ≈ 38; 28.5T ÷ 40B ≈ 712. Both calculations are correct, but they respectively correspond to the 'feeding ratio relative to the entire capacity' and the 'super-training degree relative to the actual calculated amount'. Ratios without denominators are meaningless."
}
```

```quiz
{
  "question": "The nominal context of a model is 128K Tokens. The target users mainly input Chinese long documents, and the fertility of the vocabulary for Chinese is 1.6 Tokens/word. The product promises to \"read 100,000 words of documents at a time\". Which of the following is correct?",
  "options": [
    "128K is greater than 100K, the commitment is established",
    "100,000 words × 1.6 ≈ 160,000 Tokens, which exceeds the 128K nominal context; the effective context must be calculated by dividing the nominal length by fertility. If the commitment is not established, either change the vocabulary or change the commitment",
    "fertility only affects the training cost, not the context"
  ],
  "answer": 1,
  "explanation": "The vocabulary is the interface between data and model structure: the same 100,000 words, but the number of Tokens cut out by different fertility is more than doubled. Effective context = nominal context ÷ fertility, which is one of the reasons why vocabulary decisions must be made before training."
}
```

---

## Chapter summary

- The evaluation set is deduced from the ability target, and then the data categories and ratios are deduced. Proportions require experimentation, and there are no universal percentages.
- Only by fixing the training budget and looking at quality, retention rate, sub-dimensional capabilities and forgetting can we judge whether there is a net benefit from a cleaning or synthesis.
- Synthetic data and mid-training are both candidates for investment; whether it is worth adding more money depends on independent verification and marginal cost.

> **Question for the next chapter:** The data determines "what" the model learns, but the model's capacity, attention, and modal structure determine "how it represents and processes this information." The next chapter enters the model skeleton design.

---

## Terminology reference

| Terminology | How can beginners understand first |
|---|---|
| Data Recipe | A list of ingredients: how many tokens are there in total, which categories they are divided into, how much each accounts for, and at what stage they are fed |
| Proportion | The share of various types of data in the total; it is an experimental variable, not a fixed answer in the industry |
| Sampling weight | The relative probability of the same bucket of data being drawn, distinguishing between "nominal proportion" and "actual number of views" |
| Keep Rate | Fraction of tokens retained after cleaning. A diagnostic metric, not something to maximize indiscriminately |
| Decontamination | Clear out the content in the training corpus that overlaps with the evaluation benchmark. In cutting-edge practice, this is a release blocking step |
| Data Wall | The upper limit of the stock of high-quality public texts; the two exhaustion intervals have different measurement bases, and the citations must be clearly stated |
| synthetic data | Training materials generated by the model and filtered by the verification pipeline are stored in the database; managed as cost reduction variables |
| Web Rephrasing | The process of using strong models to rewrite low-quality web pages into high-quality text and then verifying and storing them in the database |
| Mid-training | Targeted data stage at the end of pre-training, typical magnitude 50-500B Token High-quality content |
| Tokenizer / vocabulary | A tokenizer that cuts text into Tokens and a list of all available Tokens; determined before training |
| Fertility | On average, each word/word is divided into several Tokens to determine the effective context and reasoning bill |
| competency matrix | A comparison table connecting "data categories" and "target evaluation", an attribution tool for data decision-making |

---

## Related links

- This series: [T01 · Understanding model training: from pre-training to post-training](/en/tutorial/t01-introduction-map/) · [T02 · Scaling is not about copying proportions: three general ledgers](/en/tutorial/t02-scaling-budget-three-ledgers/)
- This repository methodology: [08 · Architecture decision recording and evolution](/en/tutorial/adr-and-evolution/) · [05 · Data and status](/en/tutorial/data-and-state/)
- A review of cutting-edge practices: [Toloka · How Frontier Labs Build Pre-training Datasets](https://toloka.ai/blog/how-frontier-labs-build-pre-training-datasets)
- Data set replacement: [2026 Overview of Open Source Pre-training Corpus](https://presenc.ai/research/open-pretraining-datasets-2026) · [Common Corpus(ICLR 2026 Oral)](https://arxiv.org/abs/2506.01732) · [BAAI IndustryCorpus 5T](https://aihub.caict.ac.cn/datasets/zhinao/Pretraining-Corpus-5T)
- Research case: [Anthropic · Model Spec Midtraining](https://alignment.anthropic.com/2026/msm)([Paper](https://arxiv.org/abs/2605.02087)) · [Q Labs · Data Constrained Scaling](https://arxiv.org/abs/2610.37842) · [Anti-pollution baseline design](https://arxiv.org/html/2605.19999v1) · [Epoch synthetic data and data wall measurement basis (paraphrased)](https://techjacksolutions.com/ai-brief/epoch-ai-reports-synthetic-data-gains-cut-frontier-flop-requ)
- Disclosure standards: [GLM-5 official repository](https://github.com/zai-org/GLM-5) · [Kimi K3 Technical Report](https://arxiv.org/abs/2607.24653) · [Apple AFM 3 Data Disclosure](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models)
- Pollution and Baseline: [Baseline pollution methodology analysis (including 10-20 point estimate)](https://www.digitalapplied.com/blog/llm-benchmark-methodology-2026-contamination-leaderboard-guide) · [WanJuan-CC dataset page; note that this corpus is English-language](https://opendatalab.com/OpenDataLab/WanJuanCC)
