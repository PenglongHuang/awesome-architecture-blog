---
title: "33 · AI Infrastructure Technology Stack Selection"
description: "Choose AI infrastructure by identifying scarce resources and using components that address model, retrieval, compute, cost and control constraints."
series: "stack-selection"
order: 7
pubDate: 2026-04-28
kind: "tutorial"
tags: ["Choosing the stack","Tutorials"]
locale: "en"
translationKey: "tutorial/ai-infrastructure"
sourceHash: "132aa20710444d203b1cd483150e36eb5c742a6416182819f618b58239a03a5e"
---

> The thesis in one line: **AI infrastructure selection is not wiring every hot tool together. First identify your scarce resource: model capability, GPU, context, retrieval quality, cost, or controllability. The goal is not tool names; it is using the fewest components to contain AI system risk.**

---

> **🧰 Technology Stack Selection Track, Chapter 7 · One thing to practice**
>
> [Chapter 17](/en/tutorial/architecture-judgment-in-llm-era/) introduced nondeterminism, context, and agentic hard parts. [Chapter 22](/en/tutorial/ai-native-system-design/) designed AI-native systems. This chapter asks how to choose the AI stack underneath: when a hosted API is enough, and when model gateways, self-hosted inference, GPUs, or eval platforms become justified.

---

## Opening: what are you actually self-building?

When people hear AI infrastructure, they often list:

- GPU (compute commonly used for model training/inference)
- Vector database
- Agent framework
- Model gateway
- Inference engine
- Eval platform

But the first question is:

> Are you building infrastructure, or just building an AI application?

For an early product, the sane MVP default is usually hosted model API + minimal logs and cost tracking. Only when clear trigger signals appear, such as cost loss, data cannot leave boundary, latency misses target, provider outage is unacceptable, or model customization is necessary, should you sink lower into gateways, self-hosted inference, and GPU pools.

> **Architectural wisdom:** lower-level AI infrastructure is not automatically more advanced. It gives control, but also hands you cost, capacity planning, failure recovery, security isolation, and operations.

---

## 1. Four layers of an AI stack

```
   Entry governance:
      AI Gateway / auth / rate limit / cost logging / model routing

   Context:
      RAG / vector store / document permissions / rerank / citations

   Inference:
      inference serving / GPU / KV cache / batching

   Guardrail:
      observability / eval / trace / human approval
```

You do not need all four from day one. Add the layer that addresses the risk you can see:

- Cost invisible? Add gateway or usage logs.
- Retrieval quality limits answers? Add RAG evals.
- Many teams call models? Add a model gateway.
- GPU cost beats API cost? Consider self-hosted inference.
- Agent can take actions? Add permissions, human approval, and audit.

---

## 2. API or self-hosted inference is a cost/control trade

| Choice | Strengths | Costs |
|---|---|---|
| **Hosted model API** | Fast, stable, low ops, updated models | Vendor lock-in, data path limits, unit cost at scale |
| **Self-hosted inference** | Control model, data, cost structure, deployment | GPU, memory, batching, scaling, failures, capacity |
| **Hybrid routing** | Cheap model for simple tasks, stronger model for hard tasks | Routing, evals, fallback, cost accounting |

Do not ask which is more advanced. Ask:

1. Can data leave the boundary?
2. Can hosted API meet latency?
3. Is volume high enough that self-hosting is cheaper?
4. Can the team operate GPU serving?

One yes is usually not enough. Two or three yes answers start to justify going lower.

---

## 3. RAG, long context, and fine-tuning solve different problems

| Route | Solves | Fits |
|---|---|---|
| **RAG** | Retrieve external knowledge at answer time | Many documents, frequent updates, citations, permission filtering |
| **Long context** | Put lots of material into one request | Small one-off material, fits in context |
| **Fine-tuning** | Change stable behavior, style, or format | Stable output format, strong samples, domain style |

Common mistake: poor retrieval gets blamed on the model, or a knowledge-update problem gets sent to fine-tuning.

> **Rule:** use retrieval for knowledge; use fine-tuning for behavior. If you need citations, updates, and permissions, make RAG work first.

---

## 4. Agent framework: workflow first, autonomy later

Use the [Chapter 22](/en/tutorial/ai-native-system-design/) fork:

```
   Can a deterministic workflow solve it?
        |-- yes -> workflow first
        \-- no  -> Agent, with permissions, budget, human approval, trace, eval
```

If the flow is fixed, such as "look up order -> check refund rules -> call refund API -> send notification," do not rush to an autonomous Agent. Workflow is more predictable, testable, and auditable. Agent becomes useful when steps are open, tools are many, and the task needs dynamic planning.

Agent selection should focus on:

- Can tool permissions be tiered?
- Is human approval supported?
- Are all steps traceable?
- Can budget and max steps be limited?
- Are context compaction and task recovery supported?

---

## 5. Guardrail layer is production baseline

AI systems differ because output is unstable and quality drifts. After launch, API success rate is not enough. You need to see:

- Prompt and context.
- Retrieved chunks.
- Model cost.
- Tool authorization.
- Whether the final answer has citations or hallucinations.
- Whether model/prompt/retrieval changes regress quality.

That is [Chapter 25](/en/tutorial/eval-driven-architecture/)'s eval discipline. If the system touches money, user data, or automatic actions, eval is not a future nice-to-have. Without eval, every model or prompt change is a blind release.

---

## 6. AI stack selection table

| Question | Starting choice | Upgrade trigger | Cost reminder |
|---|---|---|---|
| Just validating product? | Hosted model API + basic logs | Many apps share usage, cost invisible, provider outage hurts | Do not self-host GPU first |
| Many models/teams? | AI Gateway | Need auth, rate limit, billing, failover | Gateway sits on critical path |
| Need private knowledge? | RAG + simple vector retrieval | Retrieval quality unstable, permissions complex, corpus grows | RAG ceiling is retrieval quality |
| Small vector scale? | pgvector / single-node vector search | Millions of vectors, complex filters, tight latency | Dedicated vector DB is new ops surface |
| Model cost high? | Model routing + cache + quotas | API cost exceeds self-host total cost, data cannot leave | Self-hosting means GPU and memory ops |
| Need automatic action? | Deterministic workflow | Open-ended steps, dynamic planning required | Agent needs permissions, budget, human approval |
| Need stable iteration? | Trace + small eval set | Production, money/data, frequent model changes | No eval, no reliable upgrade |

---

## 🎯 Quick check

```quiz
{
  "question": "A team is building an AI customer-service MVP. Daily calls are low and user demand is not validated. What is the best AI infrastructure choice?",
  "options": [
    "Buy GPUs, self-host inference, add distributed vector DB and multi-Agent platform immediately",
    "Start with hosted model API, basic logs and cost tracking, and the fewest components needed to validate the business loop",
    "Fine-tune a model first, otherwise it is not real AI infrastructure"
  ],
  "answer": 1,
  "explanation": "The MVP goal is business validation, not owning lower-level infrastructure. Hosted API is fastest and lowest-ops. Upgrade to gateway, self-hosting, or GPU pool only when cost, data, latency, or provider-risk signals appear."
}
```

```quiz
{
  "question": "Documents are many, frequently updated, and answers must cite sources. Which route should be preferred?",
  "options": [
    "RAG, because it retrieves current material at answer time and can point back to sources",
    "Fine-tuning, because all knowledge should be trained into the model",
    "Only increase context window and paste all documents every time"
  ],
  "answer": 0,
  "explanation": "Many, changing, source-cited documents are RAG territory. Fine-tuning is more about behavior/style. Long context is simple but expensive and limited."
}
```

---

## Chapter summary

- **AI infrastructure starts with the scarce resource**: model, GPU, context, retrieval quality, cost, controllability.
- **Hosted API is the default start** unless data, cost, latency, customization, or availability force an upgrade.
- **Think in four layers**: entry governance, context, inference, guardrails. Add what risk requires.
- **Use RAG for knowledge and fine-tuning for behavior**.
- **Production AI needs guardrails**: traces show the path, evals guard quality.

> **Next:** language, data, middle layers, API, deployment, observability, and AI infrastructure are now on the table. [Chapter 34](/en/tutorial/technology-selection-decision-tree/) turns them into one decision tree.

---

## Related links

- AI method: [17 · Architecting in the age of LLMs](/en/tutorial/architecture-judgment-in-llm-era/) · [22 · AI-native design](/en/tutorial/ai-native-system-design/) · [25 · Eval-driven](/en/tutorial/eval-driven-architecture/)
- Templates: [AI Gateway](/en/templates/ai-gateway/) · [Inference Serving](/en/templates/inference-serving/) · [RAG Knowledge Base](/en/templates/rag-knowledge-base/) · [Vector Database](/en/templates/vector-database/)
- Cases: [DocuMind](/en/cases/documind-rag/) · [CodePilot](/en/cases/codepilot-agent/)
