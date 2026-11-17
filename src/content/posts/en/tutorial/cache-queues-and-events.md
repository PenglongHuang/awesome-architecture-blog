---
title: "29 · Cache, Message Queue, and Event System Selection"
description: "Choose caches, queues and event systems by the pressures they address: read hotspots, write bursts and cross-boundary coordination."
series: "stack-selection"
order: 3
pubDate: 2026-04-14
kind: "tutorial"
tags: ["Choosing the stack","Tutorials"]
locale: "en"
translationKey: "tutorial/cache-queues-and-events"
sourceHash: "fd6612dff2a95a1f32adbae79d58e4667a05dadedeac943cb628b569e80412f5"
---

> The thesis in one line: **cache is not a database, a queue is not magic, and an event system is not "just add Kafka." They solve three pressures: read hotspots, write spikes, and cross-boundary collaboration. Before choosing, ask whether you are reducing latency, smoothing peaks, or decoupling state progress.**

---

> **🧰 Technology Stack Selection Track, Chapter 3 · One thing to practice**
>
> [Chapter 28](/en/tutorial/databases-and-storage/) covered truth sources and read models. This chapter covers the most common middle layers around them: cache, message queue, and event system. They can save a system, and they can also make it harder to reason about.

---

## Opening: these three are often mixed up

Many diagrams show:

```
   App -> Redis -> MQ -> Kafka -> Worker
```

Then people say the architecture is advanced. Ask instead:

- Is Redis storing disposable cache or business state that must not be lost?
- Is the queue smoothing a spike or coordinating services?
- Is Kafka carrying commands, or events that describe facts?
- What happens on duplicate, out-of-order, failed, or backlogged messages?

> **Architectural judgment:** the value of a middle layer is not its name. It is the quality attribute it changes: latency, throughput, availability, coupling, consistency, recovery cost.

---

## 1. Cache: accelerate, do not usurp truth

Cache solves **read hotspots**:

```
   request -> app -> cache hit -> return
                  \-> miss -> primary DB -> fill cache -> return
```

Three common mistakes:

| Mistake | Result | Better approach |
|---|---|---|
| Treat cache as source of truth | Losing cache loses data | Primary store is truth; cache is rebuildable |
| No invalidation strategy | Users see stale or wrong values | TTL, active invalidation, versions |
| Hot key stampede on miss | Primary DB gets crushed | Null cache, request coalescing, rate limits, warmup |

Types of cache:

| Cache type | Good for | Watch out |
|---|---|---|
| **Local cache** | Config, dictionaries, rarely-changing data | Multiple instances can diverge |
| **Distributed cache** | Hot objects, sessions, counters, rate limits | Network cost, capacity, eviction |
| **CDN** | Images, videos, static resources, public pages | Invalidation delay and edge consistency |

> If cache disappears, the system should get slower, not wrong. If it gets wrong, you stored business truth in cache.

---

## 2. Queue: turn "do now" into "do reliably later"

Queues smooth peaks:

```
   spike -> admission/rate limit -> queue -> workers consume at safe rate -> DB
```

Good fits:

- Ticket notification after seat lock.
- Coupons, SMS, email after order success.
- Parsing, chunking, indexing after document upload.
- Video transcoding after upload.

But queues turn a synchronous world into an asynchronous one:

| New problem | Required answer |
|---|---|
| **Duplicate messages** | Is the consumer idempotent? |
| **Message loss** | How do producer, storage, and ack work? |
| **Ordering** | Do you need order per business key? |
| **Backlog** | What does the user see? How do you degrade? |
| **Dead letter** | Where do failed messages go? Who repairs them? |

A queue is not "add reliability." It trades request latency for asynchronous consistency and recovery work.

---

## 3. Events: say what happened, not what others must do

Commands and events differ:

| Type | Meaning | Example | Who owns the result |
|---|---|---|---|
| **Command** | Please do something | `CreateOrder`, `SendEmail` | Receiver must perform or fail |
| **Event** | Something already happened | `OrderPaid`, `TicketLocked` | Subscribers react as needed |

Events propagate business facts:

```
   Order service: OrderPaid
      |-- Inventory: confirm deduction
      |-- Notification: send message
      |-- Data platform: update reports
      |-- Risk: record behavior
```

This decouples the publisher from downstream consumers. Costs:

- Event schemas become contracts.
- Downstream failure cannot simply roll back the fact.
- Too many small events flood the system; overly broad events hide meaning.
- Tracing is mandatory as the flow spreads.

---

## 4. Understand products by semantics first

| Type | Common examples | Feels like | Good for |
|---|---|---|---|
| **Task queue** | RabbitMQ, Celery, Sidekiq | Work assignment | Background jobs, email, image processing |
| **Log/event stream** | Kafka, Pulsar | Replayable fact log | Event bus, data sync, audit, stream processing |
| **Lightweight messaging/stream** | Redis Streams, NATS | Fast internal channel | Small/mid async workflows, low-latency messaging |
| **Managed cloud queue** | SQS, Pub/Sub | Reliable queue with less ops | Cloud-native teams avoiding self-ops |

Ask:

1. Do messages need replay?
2. Do you need complex routing and delivery guarantees?
3. Can the team operate the cluster?
4. Is this message part of audit truth?

---

## 5. Outbox: do not split DB commit from event publish

Classic failure:

```
   1. Order write succeeds
   2. OrderCreated event publish fails
   result: DB has the order, downstream never hears about it
```

Reversing the order introduces a different failure:

```
   1. Event publish succeeds
   2. Order write fails
   result: downstream receives an event for an order that does not exist
```

Outbox pattern:

```
   one local transaction:
   write business row + write outbox row
          |
          v
   relay scans outbox -> publishes message -> marks delivered
```

It adds a table, relay, retries, and idempotency, but it keeps fact writing and event publishing controllable. This is core [Chapter 11](/en/tutorial/data-consistency-engineering/) consistency engineering.

---

## 6. A technology decision template

```md
### ADR-029: Buffer document ingestion with a queue; distribute indexing events through Kafka

- Context: peak knowledge-base uploads trigger parsing, chunking, embedding and indexing simultaneously. Synchronous processing causes upload requests to time out.
- Decision: the upload endpoint stores the original document and metadata, then enqueues a task. After processing, publish a DocumentIndexed event to Kafka for search, audit and reporting subscribers.
- Give up: immediate searchability of newly uploaded documents; accept 1–3 minutes of indexing delay.
- Gain: stable uploads; background work can be rate-limited, retried and scaled, while events decouple downstream systems.
- Risk: queue backlog increases time to searchability. Add backlog alerts, dead-letter handling and idempotent consumers.
```

---

## 🎯 Quick check

```quiz
{
  "question": "Which statement about cache best matches this chapter?",
  "options": [
    "More cache is always better; avoid the database whenever possible",
    "If cache disappears, the system should get slower, not wrong; the primary store remains the source of truth",
    "Cache can replace all database transactions"
  ],
  "answer": 1,
  "explanation": "Cache accelerates reads and absorbs hotspots. It must not become non-rebuildable business truth. Losing cache should cause fallback to the primary store, not data loss."
}
```

```quiz
{
  "question": "An order service writes an order, then must notify inventory, notification, and reporting systems. What should you watch out for?",
  "options": [
    "Event names not being pretty enough",
    "The database write and message publish are not atomic; use patterns such as Outbox to avoid DB truth with missing messages",
    "Kafka naturally gives exactly-once business correctness"
  ],
  "answer": 1,
  "explanation": "The key problem is splitting the database transaction from event publishing. Outbox writes business fact and pending event in one local transaction, then publishes asynchronously with idempotent consumers."
}
```

---

## Chapter summary

- **Cache solves read hotspots**: it should be rebuildable and not become source of truth.
- **Queues solve spikes and background work**: they introduce async consistency, backlog, and recovery.
- **Events propagate facts**: "what happened," not "please do this."
- **Choose semantics before products**: task queue, event stream, lightweight messaging, managed queue solve different problems.
- **Outbox is a consistency basic** for crossing service boundaries safely.

> **Next:** caches, queues, and events handle pressure behind services. [Chapter 30](/en/tutorial/apis-and-service-communication/) looks at how services speak directly: REST, gRPC, GraphQL, Webhook, and event APIs.

---

## Related links

- Method core: [11 · Consistency engineering](/en/tutorial/data-consistency-engineering/) · [12 · Designing for failure](/en/tutorial/designing-for-failure/) · [13 · Mechanics of scale](/en/tutorial/mechanics-of-scale/)
- Templates: [Notification system](/en/templates/notification-system/) · [Online ticketing](/en/templates/online-ticketing/) · [RAG knowledge base](/en/templates/rag-knowledge-base/)
- Cases: [StarArena](/en/cases/stararena-ticketing/) · [DocuMind](/en/cases/documind-rag/) · [FeedStream](/en/cases/feedstream-content/)
