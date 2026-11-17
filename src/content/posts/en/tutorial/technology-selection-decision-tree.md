---
title: "34 · Technology Selection Decision Tree"
description: "Choose technology by pruning alternatives against requirements, stage, team capability, benefits and exit costs."
series: "stack-selection"
order: 8
pubDate: 2026-05-01
kind: "tutorial"
tags: ["Choosing the stack","Tutorials"]
locale: "en"
translationKey: "tutorial/technology-selection-decision-tree"
sourceHash: "449948e284dccd0e4d003f0f073c3d7606a3848abf1e6b9d4dcb6096bf7ef18a"
---

> The thesis in one line: **technology selection is not choosing the strongest tool from a pile. It is pruning along requirements, constraints, stage, team capability, and exit cost. A mature selection does not prove a technology is good; it proves its benefit is worth the cost under current constraints.**

---

> **🧰 Technology Stack Selection Track, Chapter 8 · Track wrap-up**
>
> The previous seven chapters covered language, database, cache/queue/events, API, deployment, observability, and AI infrastructure. This chapter adds no new tools. It gives one decision tree you can use whenever someone asks "should we use X?"

---

## Opening: the root is not A versus B

The first question is not:

```
   PostgreSQL or MongoDB?
   REST or gRPC?
   PaaS or K8s?
   API or self-hosted inference?
```

It is:

> Do we really need a new technology?

If the current stack can meet target performance, cost, reliability, and delivery time, default to keeping it. Every new technology brings learning, integration, operations, and migration cost.

This is the same restraint as earlier chapters: monolith before microservices, workflow before Agent, hosted API before self-hosted GPU. Architects treat selection as paying a clear cost for a clear problem.

---

## 1. First cut: what stage are you in?

| Stage | Scarce resource | Selection tendency |
|---|---|---|
| **MVP** | Validation speed | Few components, mainstream stack, managed first, low migration cost |
| **Growth** | Controlled scaling | Observability, gradual release, clear boundaries, local scalability |
| **Scale** | Efficiency and cost | Deep optimization, platformization, unit cost, automation |
| **Critical** | Stability and compliance | Audit, isolation, DR, SLO, incident process |

The right mature-stage technology can be over-engineering in MVP. While validating, choose fewer components. While growing, choose control. Only at scale should you pay for unit-cost and throughput optimization.

---

## 2. Second cut: where will the system die first?

If the current stack is insufficient, locate the failure mode before comparing tools:

| Failure mode | Look first at |
|---|---|
| Data wrong or state mismatch | Data model, transaction boundary, idempotency, Outbox, reconciliation |
| Read hotspot crushes DB | Cache, read model, CDN, rate limit |
| Write spike crushes backend | Queue, backpressure, smoothing, async state |
| P99 amplified by fan-out | API boundary, timeout budget, degradation, trace |
| Releases cause incidents | Deployment platform, canary, rollback, config governance |
| Incidents are hard to locate | Metrics, logs, traces, SLO alerts |
| AI quality drifts | Eval, trace, RAG evaluation, model routing |
| Team collaboration blocks | Module boundaries, platform engineering, service ownership |

> **Rule:** tools are the outer shell of the answer. Failure mode is the question.

---

## 3. Third cut: can the team operate it?

Benchmarks can look great while your team cannot run the system. Operating means:

- Can you deploy it?
- Can you debug it?
- Is it monitored?
- Who fixes it when production breaks?
- Will upgrades break you?
- Are enough people able to understand it?

A system with lower performance but a team that can operate it often beats a faster system nobody can repair. Technology selection is not a lab contest. It is a long-term operating contract.

---

## 4. Fourth cut: can you exit?

Mature selections have exit paths:

| Technology | Exit question |
|---|---|
| New database | How migrate data? How verify dual writes? Where roll back? |
| Model provider | Can the API be adapted? Can prompts and evals be reused? |
| Framework | Is business logic swallowed by framework? Can it be layered away? |
| Message system | How migrate topics, schemas, offsets? |
| Cloud platform | Can images, config, secrets, storage, network be moved? |

No exit path means binding the future. Before important technology enters production, you need a spike, rollout plan, rollback plan, and ADR.

---

## 5. The unified decision tree

```
Need a new technology?
  |
  |-- Existing stack meets target? -- yes --> keep it + local optimization
  |
  \-- no
      |
      |-- MVP? -- yes --> fewest components, fastest validation, low migration cost
      |
      \-- no
          |
          |-- What is the failure mode?
          |    |-- data/consistency -> storage and transaction boundaries
          |    |-- latency/throughput -> cache, batching, scaling
          |    |-- availability/failure -> redundancy, degradation, isolation
          |    |-- AI quality -> eval, RAG, model routing
          |    \-- team collaboration -> module boundaries, platform capability
          |
          \-- Can the team operate it and exit?
               |-- no  -> choose a lighter option
               \-- yes -> spike -> ADR -> gradual rollout
```

---

## 6. Technology selection ADR template

```md
### ADR-034: Introduce OpenTelemetry for distributed tracing

- Background: order requests cross 7 services. P99 sometimes exceeds 2s. Each service has local logs only, and one investigation takes about 3 hours.
- Goal: connect request path and per-hop latency, reducing MTTR to under 30 minutes.
- Candidates:
  - Add more logs: cheap, but cannot reliably reconstruct paths.
  - Build private tracing: flexible, but migration risk is high.
  - Use OpenTelemetry: standardized instrumentation, replaceable backend.
- Decision: use OpenTelemetry traces, starting with order, inventory, and payment paths.
- Trade-off: short-term instrumentation and sampling governance cost.
- Benefit: slow requests become traceable across services, backend remains replaceable.
- Review trigger: telemetry cost exceeds budget, or critical path coverage stays below 90%.
- Exit plan: keep standard trace context; observability backend can change; business code does not bind to one vendor SDK.
```

The format matters less than making the reason and exit explicit.

---

## 7. One table for the whole track

| Chapter | Do not ask first | Ask first |
|---|---|---|
| [27](/en/tutorial/languages-and-backend-frameworks/) Language/framework | Which language is more advanced | Do team, ecosystem, runtime, and business complexity fit? |
| [28](/en/tutorial/databases-and-storage/) Database/storage | Which database is strongest | Who is source of truth, what is the query shape? |
| [29](/en/tutorial/cache-queues-and-events/) Cache/queue/events | Should we use Kafka | Is this read hotspot, time mismatch, or fact broadcast? |
| [30](/en/tutorial/apis-and-service-communication/) API/communication | REST or gRPC | Sync/async, internal/external, contract strength? |
| [31](/en/tutorial/cloud-native-and-deployment/) Deployment platform | Should we use K8s | Does the team need and support platform capability? |
| [32](/en/tutorial/observability-and-reliability/) Observability/reliability | Which monitoring tool | What is user SLO and how does incident response work? |
| [33](/en/tutorial/ai-infrastructure/) AI infrastructure | Should we self-host GPU | Is the scarce resource model, context, cost, quality, or control? |

---

## 🎯 Quick check

```quiz
{
  "question": "A team wants to introduce a very new database because benchmarks are fast. The current DB has not hit a bottleneck, and nobody has production ops experience with the new one. What does the decision tree say?",
  "options": [
    "Introduce it immediately; performance is the answer",
    "Do not introduce it yet. There is no clear failure mode and the team cannot operate it, so this is buying future incidents",
    "Move all data at once to force the team to learn"
  ],
  "answer": 1,
  "explanation": "The first cut is necessity. If the current stack has no bottleneck, there is no reason to pay new-tech cost. Lack of ops capability amplifies production risk. Benchmarks are not selection conclusions."
}
```

```quiz
{
  "question": "Before an important technology selection enters production, what should remain?",
  "options": [
    "A note saying the technology is advanced",
    "An ADR: selection reason, alternatives, accepted costs, review triggers, and exit plan",
    "A passing demo is enough"
  ],
  "answer": 1,
  "explanation": "Important selection must be traceable, reviewable, and exit-ready. ADRs capture why this, why not the alternatives, what it costs, when to revisit, and how to back out."
}
```

---

## Chapter summary

- **The root is "do we need new technology?"** If the current stack meets targets, keep it.
- **Stage changes the answer**: MVP buys speed, growth buys control, scale buys efficiency, critical systems buy stability and compliance.
- **Locate failure mode before comparing tools**: data, latency, cost, quality, collaboration are different problems.
- **The team must be able to operate it**: operability beats paper performance in production.
- **Good selection can exit**: spike, ADR, gradual rollout, migration path.

> **Technology stack track wrap-up:** these 8 chapters are not about memorizing more tool names. They train one sentence: **read constraints first, select technology second; acknowledge the cost before enjoying the benefit.** When you read `templates/` and `cases/`, ask the reverse question: why this stack, and would the answer change if constraints changed?

---

## Related links

- Method core: [02 · Thinking framework](/en/tutorial/architects-thinking-framework/) · [06 · Quality attributes](/en/tutorial/quality-attributes-and-tradeoffs/) · [08 · ADRs](/en/tutorial/adr-and-evolution/) · [09 · Taste](/en/tutorial/architectural-taste/)
- Practice entry: [templates overview](/en/templates/) · [cases overview](/en/cases/)
- Track review: [27](/en/tutorial/languages-and-backend-frameworks/) · [28](/en/tutorial/databases-and-storage/) · [29](/en/tutorial/cache-queues-and-events/) · [30](/en/tutorial/apis-and-service-communication/) · [31](/en/tutorial/cloud-native-and-deployment/) · [32](/en/tutorial/observability-and-reliability/) · [33](/en/tutorial/ai-infrastructure/)
