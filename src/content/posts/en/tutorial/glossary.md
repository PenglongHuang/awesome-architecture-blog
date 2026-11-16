---
title: "Appendix · Architecture Glossary"
description: "Look up architecture terminology through short explanations and links to the relevant tutorials and system maps."
series: "appendix"
order: 1
pubDate: 2026-05-29
kind: "tutorial"
tags: ["Reference guides","Tutorials"]
locale: "en"
translationKey: "tutorial/glossary"
sourceHash: "c36e70f8f15e308eb24a76fbcc94e0ea2b9f052822635b6c53b00084d63ebc32"
---

> Hit an unfamiliar term while reading the tutorial or templates? Look it up here. Each entry gives a **one-line intuition** + a link to the chapter or template that explains it in depth.
> No textbook definitions — just enough so you instantly get what it means.

---

## Scale & Performance

| Term | One-Line Intuition | Where It's Explained in Depth |
|---|---|---|
| **QPS / TPS** | Queries per second / transactions per second — measures how busy a system is. | [07 Back-of-the-Envelope Estimation](/en/tutorial/designing-from-zero-to-one/) |
| **Latency** | How long a single operation takes (how fast it feels). | [06 Quality Attributes](/en/tutorial/quality-attributes-and-tradeoffs/) |
| **Throughput** | How much work the system handles per unit time (how much volume it carries). | [06](/en/tutorial/quality-attributes-and-tradeoffs/) |
| **P99 (Tail Latency)** | 99% of requests finish faster than this value — watch P99 instead of the average, because the slowest 1% hurts user experience the most. | [06](/en/tutorial/quality-attributes-and-tradeoffs/) |
| **Read/Write Ratio** | Whether reads or writes dominate — decides whether the architecture leans toward read optimization or write optimization. | [02 Six Soul Questions](/en/tutorial/architects-thinking-framework/) |
| **Back-of-the-Envelope Estimation** | Using a few quick divisions to estimate orders of magnitude (QPS, storage) and spot what will crush the system first. | [07](/en/tutorial/designing-from-zero-to-one/) |

## Data & Consistency

| Term | One-Line Intuition | Where It's Explained in Depth |
|---|---|---|
| **Strong vs. Eventual Consistency** | Everyone sees the new value immediately after a write (expensive) vs. everyone converges after a short delay (cheap, highly available). | [05 Data & State](/en/tutorial/data-and-state/) |
| **CAP** | Once a network partition happens, you must choose between Consistency (C) and Availability (A). | [05](/en/tutorial/data-and-state/) |
| **ACID / BASE** | The rigorous school (strong consistency, strict guarantees) vs. the pragmatic school (high availability, eventual consistency). | [05](/en/tutorial/data-and-state/) |
| **Transaction** | A group of operations that either all succeed or all fail together. | [05](/en/tutorial/data-and-state/) |
| **Idempotency** | Executing the same request multiple times produces the exact same effect as executing it once — retries won't cause double charges. | [Payment System Template](/en/templates/payment-system/) |
| **Stateless vs. Stateful** | Remembers nothing across requests (easy to clone and scale) vs. holds state (hard to clone, the root of distributed headaches). | [05](/en/tutorial/data-and-state/) |

## Scaling Levers

| Term | One-Line Intuition | Where It's Explained in Depth |
|---|---|---|
| **Vertical vs. Horizontal Scaling** | Make one machine bigger (treats the symptom, hits a ceiling) vs. add more machines (cures the root cause, requires statelessness). | [06](/en/tutorial/quality-attributes-and-tradeoffs/) |
| **Replication** | Maintain multiple read-only copies, primarily to scale reads and improve availability. | [05](/en/tutorial/data-and-state/) |
| **Sharding** | Partition data across multiple machines by a rule, primarily to scale writes and storage capacity. | [05](/en/tutorial/data-and-state/) |
| **Cache** | Keep hot data in a faster tier to cut latency and offload reads; the trade-off is cache invalidation and consistency. | [05](/en/tutorial/data-and-state/) |
| **CDN** | Push static or cacheable content to edge nodes closest to users to cut latency and save origin bandwidth. | [Video Streaming Template](/en/templates/video-streaming/) |
| **Peak Shaving / Rate Limiting** | Use queues or admission control to smooth sudden traffic spikes into a steady flow so the backend isn't crushed. | [04 Message Queues](/en/tutorial/ten-core-patterns/) |

## Architecture Patterns

| Term | One-Line Intuition | Where It's Explained in Depth |
|---|---|---|
| **Monolith vs. Microservices** | A single deployable unit (simple, badly underrated) vs. independently deployed small services (solves *people* scaling, badly overused). | [04](/en/tutorial/ten-core-patterns/) |
| **Event-Driven / Pub-Sub** | Broadcast "what happened" and let interested subscribers react independently — decoupling and fan-out. | [04](/en/tutorial/ten-core-patterns/) |
| **CQRS** | Split the write path and read path into separate models optimized for their own access shapes. | [04](/en/tutorial/ten-core-patterns/) |
| **Fan-out** | One action triggers work across many recipients — push model (fan-out on write) vs. pull model (fan-out on read). | [Social Feed Template](/en/templates/social-feed/) |
| **Inverted Index** | Flip "document → words" into "word → list of documents" — the foundation of full-text search engines. | [Search Engine Template](/en/templates/search-engine/) |
| **ANN (Approximate Nearest Neighbor)** | Trade a tiny bit of recall accuracy for massive speedups when searching millions of high-dimensional vectors. | [Vector Database Template](/en/templates/vector-database/) |

## Reliability & Operations

| Term | One-Line Intuition | Where It's Explained in Depth |
|---|---|---|
| **Availability / "Nines"** | The percentage of time a system is operational; 99.9% = three nines, and each extra nine raises cost by an order of magnitude. | [06](/en/tutorial/quality-attributes-and-tradeoffs/) |
| **Durability** | How unlikely stored data is to be lost (e.g., S3's 11 nines of durability). | [06](/en/tutorial/quality-attributes-and-tradeoffs/) |
| **SLO / Error Budget** | Set an availability target (SLO); the remaining allowed downtime is the error budget — once spent, freeze features and fix reliability. | [06](/en/tutorial/quality-attributes-and-tradeoffs/) |
| **Single Point of Failure (SPOF)** | A component whose failure brings down the entire system — availability's #1 enemy, eliminated through redundancy. | [06](/en/tutorial/quality-attributes-and-tradeoffs/) |

## Process & Evolution

| Term | One-Line Intuition | Where It's Explained in Depth |
|---|---|---|
| **Quality Attributes / Non-Functional Requirements** | *How well* the system performs (fast, reliable, scalable), as opposed to *what* it does (features). | [02](/en/tutorial/architects-thinking-framework/) |
| **Trade-off** | Every architectural decision trades A for B; there is no silver bullet. | [02](/en/tutorial/architects-thinking-framework/) |
| **ADR** | Architecture Decision Record: a one-page record capturing *why* a decision was made and what alternatives were given up. | [08 ADRs](/en/tutorial/adr-and-evolution/) |
| **Technical Debt** | A conscious expedient chosen for speed today — healthy only when recorded on a ledger and repaid on schedule. | [08](/en/tutorial/adr-and-evolution/) |
| **Conway's Law** | A system's architecture will mirror the communication structure of the organization that builds it. | [08](/en/tutorial/adr-and-evolution/) |
| **C4 Model** | Draw architecture diagrams across four zoom levels like a map app: Context → Container → Component → Code. | [03 Drawing Diagrams](/en/tutorial/reading-and-drawing-diagrams/) |

---

> Didn't find the term you're looking for? Feel free to [open an issue](https://github.com/study8677/awesome-architecture/issues). A glossary is just an entry point — real understanding lives in the chapters linked above.
