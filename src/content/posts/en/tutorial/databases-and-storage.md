---
title: "28 · Database and Storage Selection"
description: "Choose storage from access patterns, consistency, query needs, growth and failure costs, rather than product popularity."
series: "stack-selection"
order: 2
pubDate: 2026-04-10
kind: "tutorial"
tags: ["Choosing the stack","Tutorials"]
locale: "en"
translationKey: "tutorial/databases-and-storage"
sourceHash: "0433f5725fd5af00e55594bc05b25bb56dc25b18a3bd36db2218e58352689d27"
---

> The thesis in one line: **database choice is not just "MySQL or PostgreSQL." It is "what are this data's access patterns, consistency needs, query shapes, growth rate, and failure cost?" Choose storage by drawing the data lifecycle first. Tool names come later.**

---

> **🧰 Technology Stack Selection Track, Chapter 2 · One thing to practice**
>
> [Chapter 05](/en/tutorial/data-and-state/) said the hard part of systems is data. Languages can be changed, services can be split, but data placed in the wrong model is expensive to move. This chapter puts databases, caches, search, object storage, and vector stores on one selection map.

---

## Opening: do not make one database solve every problem

Many systems start like this:

```
   App -> one relational database
          |-- transaction data
          |-- reports
          |-- search filters
          |-- file attachments
          |-- AI retrieval vectors
```

For an MVP, this can be fine. As the system grows, these access patterns diverge:

- Orders need correctness and audit.
- Reports scan a lot of history and should not slow the primary database.
- Search needs relevance ranking, not only `LIKE`.
- Images and videos need cheap storage and CDN delivery.
- RAG needs vector retrieval, metadata, citations, and permission filtering.

> **Architectural judgment:** do not ask "which database is best." Ask "which storage model should carry which kind of data." A system may need multiple stores, but every new store adds synchronization, consistency, ops, and debugging cost.

---

## 1. Draw the data lifecycle

Before choosing a database, trace a piece of data:

```
   write -> validate -> commit -> query/search -> analyze/report -> archive/delete
      |        |          |          |              |                 |
   who?     how?      how consistent? query shape?   how often?        retention?
```

Ask five questions:

| Question | Why it matters |
|---|---|
| **Read-heavy or write-heavy?** | Drives read replicas, cache, index model |
| **Where is the transaction boundary?** | Decides whether relational transactions can protect it |
| **What is the query shape?** | Key lookup, range query, full-text, vector similarity are different |
| **How fast does data grow?** | Drives partitioning, hot/cold tiering, archival |
| **What happens if it is wrong?** | Drives consistency, backup, audit, recovery |

This is the same discipline as the back-of-the-envelope work in [Chapter 07](/en/tutorial/designing-from-zero-to-one/): estimate volume, read/write ratio, and retention before tool choice.

---

## 2. Primary storage: relational is still the default start

| Type | Good for | Poor fit |
|---|---|---|
| **Relational database** | Transactions, orders, permissions, tenants, ledgers | Huge analytics, full-text search, large binary files |
| **Document database** | Flexible structure, whole-document reads/writes | Strict transactions, complex joins, rigorous reporting |
| **Key-value store** | High-speed key access, simple shape, very large scale | Ad hoc joins and flexible querying |
| **OLAP / analytical store** | Reports, aggregation, logs, behavior analytics | High-frequency small transactions |

> **Default:** keep core transaction data in a relational source of truth. Split reports, search, logs, and vectors only when they become real pressure.

---

## 3. Read models: search, analytics, and vectors are not the primary truth

| Need | Common engine | Trade-off |
|---|---|---|
| **Full-text search** | Elasticsearch, OpenSearch, Meilisearch | Strong relevance, but index sync and eventual consistency are required |
| **Analytics** | ClickHouse, BigQuery, Snowflake | Fast scans/aggregates, not a transaction source |
| **Object storage** | S3, OSS, GCS | Cheap durable files, not complex querying |
| **Vector database** | Milvus, Qdrant, pgvector | Similarity retrieval, but permissions and recall need design |
| **Time-series database** | Prometheus, InfluxDB | Metrics over time, not generic business objects |

The common mistake is making a read model the source of truth:

```
   Correct:
   primary DB = source of truth
   search / analytics / vector store = read model rebuilt from source

   Wrong:
   user updates profile -> only search index changes -> primary DB never knows
```

Read models may lag, but you must state how much lag is acceptable, how to repair, and how to rebuild. That is [Chapter 11](/en/tutorial/data-consistency-engineering/) in practice.

---

## 4. RAG: the vector store is not the whole system

An enterprise RAG system such as [DocuMind](/en/cases/documind-rag/) is often oversimplified as:

```
   chunk document -> vector DB -> topK -> LLM answer
```

A real system is closer to:

```
   original object storage -> parsing/chunking -> metadata DB
          |                                      |
          +--------------> keyword index <------+
          +--------------> vector index  <------+
          +--------------> permission filter <--+
```

Ask:

- Is permission filtering before retrieval or after retrieval?
- Is retrieval vector-only, or hybrid search (keyword + vector)?
- Where are originals and citations stored?
- Can indexes be rebuilt from originals and metadata?
- Does cost scale with document and query volume?

> A vector database solves similarity recall. It does not solve source of truth, permissions, citations, evaluation, or cost by itself.

---

## 5. When to split storage

| Signal | Meaning | Possible action |
|---|---|---|
| Reports slow the transaction DB | OLTP and OLAP interfere | Sync to an analytical store |
| Search relevance is poor or `LIKE` scans are slow | Query shape is full-text search | Build a search index |
| Attachments bloat the DB | Binary files do not belong in core tables | Move to object storage + CDN |
| Table growth slows indexes and backups | No lifecycle strategy | Partition, archive, tier hot/cold data |
| RAG recall quality is unstable | Single vector retrieval is not enough | Hybrid retrieval + rerank + eval |

The opposite matters too: if data volume is small, team size is small, and failure cost is low, one relational database with good indexes and backups may be healthier than five stores.

---

## 6. Write a storage decision ADR

```md
### ADR-028: Move reporting queries from the transactional database to ClickHouse

- Context: ticket lists and state transitions depend on the primary database. Monthly reports now scan 200 million historical events, increasing transactional P99 from 120ms to 900ms.
- Decision: keep the primary database as the source of truth; synchronize Outbox events to ClickHouse, and query the analytical database for reports.
- Give up: strongly real-time reporting; accept a delay of up to one minute.
- Gain: isolation between transaction and reporting workloads, faster aggregations, and stable primary-database load.
- Review trigger: reconsider streaming synchronization and pre-aggregation if reports require second-level freshness or synchronization lag exceeds business tolerance.
```

The ADR explains **which read model is overwhelming which source of truth**, rather than merely claiming that ClickHouse is fast.

---

## 🎯 Quick check

```quiz
{
  "question": "An e-commerce system needs correct order, payment, and inventory state transitions. What is the best default source of truth?",
  "options": [
    "A relational database with transactions, constraints, and a state machine",
    "A full-text search engine because it is flexible",
    "Object storage because it is cheap"
  ],
  "answer": 0,
  "explanation": "Orders, payments, and inventory are core transaction data. The source of truth needs transactions, constraints, recovery, and audit. Search and object storage can be read models or file stores, not the core truth."
}
```

```quiz
{
  "question": "What is the right relationship between search indexes, analytical stores, vector stores, and the primary database?",
  "options": [
    "All of them should be separate sources of truth",
    "The primary DB or original object store is usually the source of truth; search/analytics/vector stores are read models for specific query shapes",
    "Once you have a vector store, you do not need metadata or permissions"
  ],
  "answer": 1,
  "explanation": "Read models optimize search, analytics, or vector recall, but they usually should not become the only truth. You must explain sync lag, rebuild path, permissions, and consistency boundaries."
}
```

---

## Chapter summary

- **Draw the data lifecycle before choosing storage**: write, validate, commit, query, analyze, archive.
- **Relational databases remain the default truth source** for many business systems.
- **Search, analytics, and vector stores are read models** for specific query shapes.
- **RAG is not a vector store**: it also needs originals, metadata, permissions, retrieval strategy, citations, and evals.
- **Split storage on signals**: reports hurting transactions, search getting slow, files bloating DB, recall failing.

> **Next:** primary storage answers "where does truth live." Hotspots, traffic spikes, and cross-boundary collaboration bring caches, queues, and events. [Chapter 29](/en/tutorial/cache-queues-and-events/) covers those middle layers.

---

## Related links

- Method core: [05 · Data and state](/en/tutorial/data-and-state/) · [06 · Quality attributes](/en/tutorial/quality-attributes-and-tradeoffs/) · [11 · Consistency engineering](/en/tutorial/data-consistency-engineering/)
- Evolution: [13 · Mechanics of scale](/en/tutorial/mechanics-of-scale/) · [14 · Evolution and splitting](/en/tutorial/evolving-and-splitting-large-systems/)
- Case references: [DocuMind](/en/cases/documind-rag/) · [StarArena](/en/cases/stararena-ticketing/)
