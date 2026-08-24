# RAG architecture decision

## Status

Current: relational PostgreSQL storage with direct vector-style retrieval and a
deterministic local embedding fallback.

## Context

Finance AI retrieves a small set of financial knowledge chunks to ground AI
responses. A graph-based RAG design was considered for richer entity and
relationship traversal, but it would add a graph database, additional indexing
pipelines, more network calls, and higher operational cost.

## Decision

Keep the current PostgreSQL-backed retrieval path. It matches the present data
volume and keeps local development, testing, and deployment within the existing
database and application stack.

## Consequences

- fewer services and credentials to operate;
- direct, testable retrieval behavior;
- lower infrastructure and request complexity; and
- weaker multi-hop relationship traversal than a graph-backed design.

Reconsider graph retrieval only when measured evaluation cases require
multi-hop relationships that the current model cannot represent accurately.
