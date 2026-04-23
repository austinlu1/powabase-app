# Agentic Platform (Powabase) — SKILL.md

> AI Backend-as-a-Service (BaaS) providing a unified REST API for sources, knowledge bases,
> agents, orchestrations, and workflows. Replaces the typical LLM stack (vector DB, agent
> framework, workflow engine, auth, file storage) with a single API. Each project gets a fully
> isolated stack: Postgres + pgvector, API gateway, auth (GoTrue), Storage API, and a dedicated
> AI service worker.

---

## 1. Authentication

Every request requires two headers:

```python
BASE_URL = "https://{your-project}.p.powabase.ai"

API_KEY = "your-service-role-key"  # Full access, bypasses RLS — never expose client-side

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}
```

**Verify setup:**
```python
response = requests.get(f"{BASE_URL}/api/agents", headers=headers)
print(response.json())  # Should return [] or list of agents
```

---

## 2. Three Core Modules

| Module | What It Does | Use When |
|---|---|---|
| **Context Engineering** | RAG-as-a-Service: ingest, index, retrieve documents | You need document search |
| **Agent Orchestration** | LLM agents with tools, memory, sessions | You need reasoning + tool use |
| **Workflow Automation** | DAG-based pipelines with composable blocks | You know the steps, need deterministic flow |

**Composition patterns:**
- Document search only → Context Engineering alone
- Chatbot → Context Engineering + Agent Orchestration
- Fully automated pipeline → All three modules

---

## 3. Sources & Extraction

A **Source** = a single uploaded document. Upload triggers async extraction pipeline.

**Supported file types:**

| Type | Extensions | Extraction Method |
|---|---|---|
| PDF | .pdf | Text extraction + layout analysis; falls back to OCR |
| Word | .docx, .doc | Structured text preserving headings/formatting |
| Images | .png, .jpg, .jpeg, .tiff, .bmp | OCR |
| Text | .txt, .md, .csv | Direct text reading |
| PowerPoint | .pptx | Slide-by-slide extraction |
| Excel | .xlsx | Sheet-by-sheet cell extraction |

**Extraction pipeline:** File Upload → Storage → Extraction Worker → Page Texts → Source record

**Source status lifecycle:**
- `pending` — uploaded, not yet picked up
- `processing` — currently being extracted
- `completed` — page texts available, ready to index
- `failed` — check error message

**Storage integration:** You can also import files already in project storage buckets via the
`import-from-storage` endpoint — avoids re-uploading.

---

## 4. Knowledge Bases & Indexing

A **Knowledge Base (KB)** holds one or more sources and makes their content searchable.
Indexing strategy controls how content is structured; retrieval strategy controls how queries
find content.

**Indexing pipeline:** Source → Chunker → Embedder → pgvector

### 4a. Indexing Strategies

| Strategy | Best For | Cost | Indexing Speed | Compatible Retrieval |
|---|---|---|---|---|
| **ChunkEmbed** (default) | General RAG, most documents | Low | Fast | Vector, Hybrid, Full-text |
| **PageIndex** | Long structured PDFs, complex docs | Medium–High | Slow (many LLM calls) | Tree Search only |
| **GraphIndex** | Cross-referenced documents | High | Slow | Vector, Hybrid, Full-text |
| **Doc2JSON** | Structured field extraction (invoices, forms) | Medium | Medium | Vector on summary |

**ChunkEmbed details:**
- Splits text into overlapping chunks → embeds each → stores in pgvector
- Also builds BM25 sparse index for full-text search
- Fastest and cheapest — no LLM calls needed
- Default chunk size: 2000 tokens, 50 overlap

**Chunking strategies (ChunkEmbed):**

| Chunker | How It Works | Best For |
|---|---|---|
| `markdown_header` (default) | Splits at h1–h6 headers, prepends header as context | Docs with heading structure |
| `recursive` | Splits at paragraph/line/sentence breaks | Unstructured prose, articles |
| `fixed_size` | Fixed token counts with word-boundary snapping | Logs, transcripts, code |

**PageIndex:** Builds hierarchical ToC tree using LLM analysis. Expensive to index (many LLM
calls). Retrieval uses Tree Search (LLM reasoning, not vectors) — 1–3s per query. Use for
compliance manuals, legal contracts, technical specs.

**GraphIndex:** Extends PageIndex with cross-reference enrichment + node embeddings. Expensive
to index but cheap to retrieve (vector/hybrid, no LLM at query time). Best for regulatory
frameworks, codebases with cross-module dependencies.

**Doc2JSON:** Extracts structured fields using a sliding-window LLM approach. You define a
JSON schema; the platform fills fields window-by-window. Supports text mode (default, 4000
token windows) and image mode (page screenshots, default 3 pages per window).

### 4b. Retrieval Strategies

| Method | How It Works | Latency | Cost | Best For |
|---|---|---|---|---|
| `vector_search` | Cosine similarity over embeddings | Very low (<100ms) | Low | Semantic matching |
| `full_text` | BM25 keyword scoring via PostgreSQL tsvector | Low | None | Exact phrases, IDs, error codes |
| `hybrid` (recommended) | Vector + BM25 fused via Reciprocal Rank Fusion | Low | Low | Production RAG |
| `tree_search` | LLM reasons over ToC structure | Medium (1–3s) | Medium | PageIndex KBs only |

**Hybrid search** uses RRF formula: `rrf_score(d) = weight / (k + rank)` across all lists,
k=60. `vector_weight` (default 0.5) balances semantic vs keyword signals.

### 4c. Embedding Models

Default: `text-embedding-3-small` (OpenAI, 1536 dimensions). All chunks in a KB must use the
same model — changing model requires reindexing. HNSW index limit: 2000 dimensions.

| Model | Provider | Dimensions | Notes |
|---|---|---|---|
| text-embedding-3-small | OpenAI | 1536 | Default — best balance |
| text-embedding-3-large | OpenAI | 3072 | Higher quality, exceeds HNSW limit |
| embed-english-v3.0 | Cohere | 1024 | High-quality English |
| embed-multilingual-v3.0 | Cohere | 1024 | 100+ languages |
| voyage/voyage-01 | Voyage AI | 1024 | Strong general purpose |
| gemini/text-embedding-004 | Google | 768 | Google Gemini |
| mistral/mistral-embed | Mistral | 1024 | Mistral AI |

### 4d. Recommended Configurations

| Use Case | Indexing | Retrieval | Notes |
|---|---|---|---|
| General RAG (default) | ChunkEmbed (2000 tokens, 50 overlap) | Hybrid Search | Works for most documents |
| Long structured PDFs | PageIndex | Tree Search | Compliance, legal, technical specs |
| Cross-referenced docs | GraphIndex | Hybrid Search | Regulations, standards |
| Keyword-heavy content | ChunkEmbed | Full-Text Search | Logs, code, error messages |
| Invoice/form extraction | Doc2JSON | Vector Search | Define a schema, extract structured fields |

### 4e. Code Examples

**Create KB with ChunkEmbed (default):**
```python
response = requests.post(
    f"{BASE_URL}/api/knowledge-bases",
    headers=headers,
    json={
        "name": "Product Docs",
        "indexing_config": {
            "strategy": "chunk_embed",
            "chunk_size": 2000,
            "overlap": 50,
            "embedding_model": "text-embedding-3-small",
        },
        "retrieval_config": {
            "method": "hybrid",
            "top_k": 10,
            "vector_weight": 0.6,
        },
    }
)
kb = response.json()
```

**Search a KB:**
```python
response = requests.post(
    f"{BASE_URL}/api/knowledge-bases/{kb_id}/search",
    headers=headers,
    json={"query": "How do I reset my password?", "top_k": 5},
)
for chunk in response.json()["results"]:
    print(f"Score: {chunk['similarity']:.3f}")
    print(chunk["content"][:200])
```

> Warning: Reindexing deletes all existing chunks/nodes and recreates from scratch.
> KB remains searchable during reindexing but results may be incomplete until finished.

---

## 5. Agents & Tools

An **Agent** wraps an LLM with a system prompt, temperature, tools, and optional knowledge
bases. Uses a **ReAct loop** (Reason + Act): LLM decides → calls tool → observes result →
iterates. Loop runs up to 25 steps (configurable). On final step, tools are withheld to force
a text response. Streamed in real-time via SSE.

**Context management:** Agent auto-compacts context when nearing model limit — prunes old tool
results, keeps last 3 user turns, then summarizes older history using gpt-4.1-nano. If output
is truncated, agent injects a "continue" message and retries up to 3 times.

### 5a. Tool Types

**Builtin tools** (assign by name via `POST /api/agents/{id}/tools`):

| Tool | Description | Key Constraints |
|---|---|---|
| `database_query` | Read-only SELECT queries | Must start with SELECT, results capped at 50,000 chars |
| `database_write` | INSERT, UPDATE, DELETE | UPDATE/DELETE require WHERE clause, SQL injection validated |
| `http_request` | Make HTTP requests to external APIs | Response capped at 10,000 chars, 30s timeout, SSRF validation |
| `code_execute` | Run Python or JavaScript in sandbox | 30s timeout (configurable) |
| `storage_read` | List/download files from project storage | Binary files return signed URL |
| `storage_write` | Upload text content to storage buckets | UTF-8 text only |

**Custom tools:** Define name, description, JSON Schema for inputs, endpoint URL, HTTP method,
and optional headers. Agent POSTs tool arguments as JSON to your endpoint. Response capped at
10,000 chars, 30s timeout, SSRF validation.

**MCP servers:** Add an MCP server URL to an agent. At run start, platform sends a
`tools/list` JSON-RPC to discover tools. Namespaced as `mcp__{server_name}__{tool_name}`.
Discovery failure = agent runs without those tools (fail-open). 30s timeout per tool call.

**Knowledge Base Search Tool:** Linking a KB to an agent auto-creates a `knowledge_search`
tool. Multiple KBs = single tool with `knowledge_base_names` filter parameter. Runs
concurrently (read-only, safe).

### 5b. Sessions & Memory

Every conversation happens within a **session**. Stores runs (user input, assistant response,
tool calls, results, usage). New message with a `session_id` → loads all completed runs and
reconstructs full history for the LLM. Sessions persist until explicitly deleted. Auto-created
if no `session_id` provided — start SSE event returns the generated `session_id`.

### 5c. Hooks & Middleware

| Event | When It Fires | Can Block? | Can Modify? |
|---|---|---|---|
| `OnRunStart` | Before agent begins processing | Yes (blocks entire run) | No |
| `PreToolUse` | Before each tool execution | Yes (returns error to LLM) | Yes (replace tool args) |
| `PostToolUse` | After each tool execution | No | Yes (replace tool result) |
| `PreResponse` | After ReAct loop, before returning | Yes (replaces with blocked message) | Yes |
| `OnRunComplete` | After successful completion | No (fire-and-forget) | No |

| Hook Type | Behavior |
|---|---|
| `http` | POSTs event data to webhook URL. Can allow/deny/modify. Fail-open on error. 5s timeout. |
| `rule` | Evaluates conditions against tool args. Operators: CONTAINS, STARTS_WITH, MATCHES (regex), IN. |
| `approval` | Pauses execution, emits `approval_requested` SSE. Blocks until approve endpoint called or 300s timeout. |

**Human-in-the-loop:** Implemented as a `PreToolUse` hook of type `approval`. Your app listens
for `approval_requested` SSE → calls `POST /api/agents/runs/{run_id}/approve` with
`{approved: true/false}`. Set `matcher` field to scope to a specific tool (e.g.
`database_write`).

---

## 6. Multi-Agent Orchestration

A **coordinator agent** analyzes incoming messages and delegates subtasks to specialized
**entity agents** based on role descriptions. Each entity runs independently with its own
tools and knowledge bases. Coordinator synthesizes all results via a single orchestration
endpoint.

---

## 7. Workflow Automation

Workflows are **DAG-based automation pipelines** for semi-deterministic tasks. Follow a fixed
graph of blocks and edges. Individual blocks can still contain LLM calls, agent runs, or code
execution — output is dynamic even though steps are fixed.

**Block types:**

| Block | Description |
|---|---|
| `starter` | Manual/API trigger with typed inputs |
| `webhook` | HTTP trigger from external systems |
| `agent` | Run an existing agent with a message |
| `code` | Execute Python or JavaScript |
| `condition` | Branch flow based on expressions |
| `split` | Parallel fan-out execution |
| `platform_api` | Call platform resources (KB search, agent runs) |
| `general_api` | Call external HTTP APIs |
| `response` | Return results |

Blocks reference upstream outputs using **template syntax**. Triggers: manual API, webhooks
(Stripe, GitHub, forms), or scheduled cron/interval. Once deployed, runs unattended.

---

## 8. Streaming (SSE)

Agent runs stream via Server-Sent Events from `POST /api/agents/{id}/run/stream`.

**Key SSE event types:**
- `step_started` — new ReAct iteration beginning
- `tool_call` — agent is calling a tool
- `tool_result` — tool execution result
- `chunk` — LLM token chunk for final response
- `approval_requested` — waiting for human approval (if approval hook configured)

---

## 9. Per-Project Infrastructure

Every project gets a fully isolated stack:
- **Postgres + pgvector** — your database (AI schema + your own public schema tables)
- **Kong API gateway** — routing and auth
- **GoTrue** — user authentication (full auth system for managing end users)
- **Storage API** — file management
- **AI service worker** — document extraction, indexing, agent execution

Direct **PostgREST access** to your public schema is available for building app features
alongside AI capabilities.

---

## 10. Common Patterns & Gotchas

**Pattern: RAG Chatbot**
1. Upload documents as Sources → poll until `completed` status
2. Create KB with ChunkEmbed + hybrid retrieval
3. Create Agent → attach KB → KB search tool is auto-created
4. Send messages via session → response streamed via SSE

**Pattern: Structured Document Extraction**
1. Upload invoices/forms as Sources
2. Create KB with Doc2JSON strategy + define JSON schema
3. Query KB or use agent with `database_query` to retrieve extracted fields

**Pattern: Automated Pipeline with Human Approval**
1. Build workflow with webhook trigger
2. Add agent block for reasoning
3. Add `approval` hook on `database_write` tool
4. App listens for `approval_requested` SSE → calls approve endpoint

**Key gotchas:**
- Reindexing a KB **deletes all existing indexed content** and rebuilds from scratch
- All chunks in a KB must use the **same embedding model** — changing it requires reindex
- `PageIndex` and `GraphIndex` are **expensive to index** — use only when document structure
  matters for retrieval quality
- `database_write` UPDATE/DELETE **require a WHERE clause** — no mass updates allowed
- MCP server discovery is **fail-open** — if discovery fails, agent runs without those tools
- Sessions persist until **explicitly deleted** — manage session IDs carefully in production
- `text-embedding-3-large` (3072 dims) exceeds HNSW limit — falls back to sequential scan,
  significantly slower for large KBs
