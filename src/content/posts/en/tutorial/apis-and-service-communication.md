---
title: "30 · API and Service Communication Selection"
description: "Choose service communication by boundary, latency and contract needs, including synchronous calls, events, queries and streaming."
series: "stack-selection"
order: 4
pubDate: 2026-04-17
kind: "tutorial"
tags: ["Choosing the stack","Tutorials"]
locale: "en"
translationKey: "tutorial/apis-and-service-communication"
sourceHash: "9b5510195ae7f545645ac355884bbee9858ab948833295bd4725c357992b3121"
---

> The thesis in one line: **API selection is not a format choice between REST and gRPC. It is a boundary choice. Sync or async, internal or external, strict contract or flexible query, one response or continuous stream: these decide how services should communicate.**

---

> **🧰 Technology Stack Selection Track, Chapter 4 · One thing to practice**
>
> [Chapter 04](/en/tutorial/ten-core-patterns/) covered layered, microservice, and event-driven patterns. [Chapter 29](/en/tutorial/cache-queues-and-events/) covered async middle layers. Now we focus on service boundaries: once two systems talk, you must choose communication style, contract, versioning, failure handling, and permission boundary.

---

## Opening: communication style determines coupling style

The same "order tells inventory to deduct" can be done as:

```
   A. Order calls inventory REST API synchronously
   B. Order calls inventory gRPC synchronously
   C. Order publishes OrderCreated; inventory consumes asynchronously
   D. Inventory exposes GraphQL; order queries as needed
   E. Inventory calls order via Webhook
```

All can work. They couple differently:

- Synchronous calls give clear results, but the caller is slowed or broken by the callee.
- Async events decouple, but results are not immediate and consistency is harder.
- GraphQL gives clients flexibility, but server governance and performance get harder.
- Webhooks fit external notifications, but require retry, signature, and idempotency.

> **Architectural judgment:** choose interaction semantics before protocol. Do not start with "we use gRPC." Start with "does this path need to know the result now?"

---

## 1. First cut: sync or async

| Style | Good for | Cost |
|---|---|---|
| **Synchronous request/response** | User waits for result, immediate validation, direct failure feedback | Longer chains, P99 tail latency adds up, failures propagate |
| **Async message/event** | Can finish later, smooth spikes, multiple downstream consumers | State progression, idempotency, compensation, backlog |
| **Streaming** | Continuous output, realtime state, long task progress | Connection management, backpressure, reconnect recovery |

Rule:

```
   User must know whether to continue now -> sync
   User only needs "accepted"             -> async
   User needs continuous updates          -> streaming
```

In [StarArena](/en/cases/stararena-ticketing/), entry/admission needs sync; ticket notification can be async; queue position updates fit streaming or polling.

---

## 2. REST, gRPC, and GraphQL do not replace each other

| Style | Better fit | Poor fit |
|---|---|---|
| **REST** | External APIs, normal Web/SaaS, easy debugging, common ecosystem | Very high-frequency internal calls needing strict types |
| **gRPC** | Internal service calls, low latency, high throughput, strict IDL | Browser-first public APIs, low-friction partner APIs |
| **GraphQL** | Multi-client aggregation, fast-changing fields, frontend flexibility | Complex writes, weak cache/permission/limit governance |
| **Webhook** | Third-party event notification, payment callbacks, external integration | Core sync path that needs immediate result |
| **MCP** | Exposing tools/resources/context to AI Agents | Normal business service calls with no Agent semantics |

Boundary matters:

- External APIs should be understandable, stable, and versionable.
- Internal hot paths can prefer strong contracts and performance.
- Frontend aggregation can use GraphQL if governance exists.
- Webhooks need signature, idempotency, replay protection.
- Agent tool APIs need permissions and human approval in the boundary ([Chapter 23](/en/tutorial/spec-as-architecture/)).

---

## 3. Contract matters more than protocol

API failures often come from unclear contracts:

| Contract point | Must specify |
|---|---|
| **Input/output** | Field meaning, required/optional, units, enums |
| **Error semantics** | Retryable, user error, system error |
| **Idempotency** | What happens if the same request repeats? |
| **Versioning** | How fields are added, deprecated, removed |
| **Rate limits** | Who can call how much? What happens when exceeded? |
| **Security boundary** | Authn, authz, signatures, audit |

Without contract governance, REST becomes random URLs, GraphQL becomes arbitrary database exposure, and gRPC becomes a strongly typed ball of mud.

---

## 4. Internal calls: prevent unbounded call chains

Microservice performance often fails through fan-out:

```
   user request
      \- A
         |-- B
         |   |-- D
         |   \-- E
         \-- C
             |-- F
             \-- G
```

Each hop adds:

- Network latency.
- Timeout and retry storms.
- Dependency failure propagation.
- Trace/debugging cost.

Internal APIs need:

1. **Timeout budgets**: if upstream has 500ms, every downstream cannot also get 500ms.
2. **Retry discipline**: retry only idempotent operations, with backoff and jitter.
3. **Degradation**: when non-critical dependency fails, return partial or fallback result.

This is [Chapter 12](/en/tutorial/designing-for-failure/) resilience engineering.

---

## 5. External APIs: stability beats elegance

Once an external API is published, it is a promise:

- **Backward compatibility**: adding fields is usually safe; removing or changing meaning is dangerous.
- **Stable errors**: customers write code against error semantics.
- **Docs and examples**: if external developers cannot understand it, elegance does not help.
- **Signatures and replay protection**: critical for payment, webhooks, Agent tools.
- **Audit and rate limits**: you need traceability and abuse control.

For platform products, API is part of the product. Versioning and compatibility are architecture boundaries.

---

## 6. A communication decision ADR

```md
### ADR-030: Use gRPC between orders and inventory; receive payment callbacks through an idempotent webhook

- Context: orders and inventory communicate frequently over an internal network and need a strong contract. A third-party payment provider can only notify us asynchronously.
- Decision: define the internal order–inventory contract with gRPC + protobuf. Receive external payment results through a webhook, verify the signature, and advance the state machine idempotently using payment_id.
- Give up: exposing internal interfaces directly to browsers and completing payment-result handling synchronously.
- Gain: clear contracts and stable internal performance; external integration matches the asynchronous nature of payment systems.
- Risk: handle replayed and out-of-order webhooks; set timeout budgets and traces for internal call chains.
```

---

## 🎯 Quick check

```quiz
{
  "question": "Before choosing REST, gRPC, GraphQL, or Webhook, what should you judge first?",
  "options": [
    "Which name is most popular",
    "Whether this interaction is sync or async, internal or external, strict contract or flexible query, and how failure recovers",
    "Which one uses the least code"
  ],
  "answer": 1,
  "explanation": "Protocol follows semantics. Define boundary, sync/async needs, contract strength, failure handling, and permissions before choosing the protocol."
}
```

```quiz
{
  "question": "A third-party payment provider needs to tell your system that a user has paid. What is the common reasonable style?",
  "options": [
    "Keep the order request blocked until payment completes",
    "Receive a signed Webhook, verify it, then idempotently advance the payment/order state machine",
    "Trust the frontend when it says payment succeeded"
  ],
  "answer": 1,
  "explanation": "Payment results are usually external async callbacks. Webhooks need signatures, replay protection, idempotency, active query, and reconciliation. Do not block the user request indefinitely or trust the frontend."
}
```

---

## Chapter summary

- **Communication style determines coupling**: sync, async, and streaming fit different semantics.
- **REST, gRPC, GraphQL, Webhook, and MCP have different boundaries**.
- **Contract matters more than protocol**: fields, errors, idempotency, versions, limits, security.
- **Internal calls need fan-out control**: timeout budget, retry discipline, degradation, trace.
- **External API is a product promise**: compatibility, docs, errors, signatures, audit.

> **Next:** we have chosen service implementation, storage, middle layers, and communication. [Chapter 31](/en/tutorial/cloud-native-and-deployment/) asks where these things run, who scales them, who releases them, and who rescues them.

---

## Related links

- Method core: [04 · Core patterns](/en/tutorial/ten-core-patterns/) · [12 · Designing for failure](/en/tutorial/designing-for-failure/) · [16 · Security and multi-tenancy](/en/tutorial/security-and-multi-tenancy/)
- AI collaboration: [23 · Spec as architecture](/en/tutorial/spec-as-architecture/) · [26 · Collaboration decision tree](/en/tutorial/when-to-vibe-when-to-spec/)
- Cases: [StarArena](/en/cases/stararena-ticketing/) · [CodePilot](/en/cases/codepilot-agent/) · [SyncRoom](/en/cases/syncroom-collaboration/)
