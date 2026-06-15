# Powabase Platform SKILL.md

> **Source:** https://docs.powabase.ai  
> **Full docs index:** https://docs.powabase.ai/llms.txt

---

## Platform Overview

Powabase is a **multi-tenant AI Backend-as-a-Service** providing a unified REST API for production AI applications. It combines three core modules that work independently or together:

1. **Context Engineering Suite** — RAG-as-a-Service (document ingestion, indexing, retrieval)
2. **Agent Orchestration** — ReAct-loop LLM agents with tools, MCP, and multi-agent coordination
3. **Workflow Automation** — DAG-based automation pipelines with composable blocks

Every project gets a fully isolated stack: its own Postgres database (with pgvector), Kong API gateway, GoTrue auth, Storage API, and a dedicated AI service worker.

### Authentication

All `/api/*` endpoints require:
```
apikey: YOUR_API_KEY
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

---

## API Reference

### 1. Sources

**Base path:** `/api/sources`  
Upload, manage, and extract content from documents and files.

Sources go through an async extraction pipeline (page texts, markdown, per-page images). They are the raw material for knowledge bases.

**Common flow:** Upload → poll until `extraction_status` is `extracted` → retrieve page texts → add to a knowledge base.

| Endpoint | Description |
|---|---|
| `GET /api/sources` | List all sources. Filter by `?status=pending\|extracting\|extracted\|attention_required\|failed\|cancelled` |
| `POST /api/sources/upload` | Upload a file (multipart/form-data). Accepts PDF, DOCX, PPTX, XLSX, PNG/JPG/WebP/GIF/TIFF, plain text. Optional: `name`, `metadata` (JSON string), `extraction_model` (PDF only: `auto`, `mistral`, `paddleocr`, `lighton`, `opendataloader`, `fitz`, `pdfplumber`) |
| `POST /api/sources/import-from-storage` | Import a file already in project storage. Body: `{ "bucket": "...", "path": "...", "name": "..." }` |
| `POST /api/sources/import-url` | Import from web URLs. Body: `{ "mode": "urls"\|"crawl"\|"sitemap", "urls": [...], "max_pages": 50 }`. Requires Firecrawl API key in settings |
| `GET /api/sources/{id}` | Get source details including extraction status |
| `GET /api/sources/{id}/page-texts` | Get extracted text by page. Optional: `?page=N` |
| `PATCH /api/sources/{id}` | Update display name or metadata. Body: `{ "name": "...", "metadata": {} }` |
| `POST /api/sources/{id}/reextract` | Re-run extraction, optionally with a different `extraction_model` |
| `POST /api/sources/{id}/cancel` | Cancel in-progress extraction (must be `pending` or `extracting`) |
| `GET /api/sources/{id}/download` | Download the original uploaded file |
| `GET /api/sources/{id}/derivatives/{type}/download` | Download a derivative. `type`: `markdown`, `text`, `page_text`, `image`. Add `?index=N` for per-page types |
| `DELETE /api/sources/{id}` | Delete source and all associated storage files |

**Error codes:**

| Status | Description |
|---|---|
| 400 | Missing file field, invalid metadata JSON, unsupported extension, invalid extraction_model |
| 404 | Source not found; page/derivative not found |
| 409 | `/cancel`: not in a cancellable state |
| 500 | Extraction or download failed |

---

### 2. Knowledge Bases

**Base path:** `/api/knowledge-bases`  
Create and manage knowledge bases for semantic search and RAG.

Knowledge bases store chunked and embedded text from one or more sources for similarity search.

**Common flow:** Create KB → add sources (triggers async indexing) → search.

#### Core CRUD

| Endpoint | Description |
|---|---|
| `GET /api/knowledge-bases` | List all knowledge bases |
| `POST /api/knowledge-bases` | Create. Body: `{ "name": "...", "description": "..." }` |
| `GET /api/knowledge-bases/{id}` | Get KB with indexed sources and status |
| `PATCH /api/knowledge-bases/{id}` | Update configuration or strategy |
| `DELETE /api/knowledge-bases/{id}` | Delete KB and all indexed data |

#### Source Management

| Endpoint | Description |
|---|---|
| `GET /api/knowledge-bases/{id}/sources` | List indexed sources in this KB. Returns `{ sources: [{ id, source_id, status, ... }] }` — `id` is the `indexed_source_id` used in other endpoints |
| `POST /api/knowledge-bases/{id}/sources` | Add source. Body: `{ "source_id": "uuid" }`. Triggers async indexing |
| `DELETE /api/knowledge-bases/{id}/sources/{indexed_source_id}` | Remove source from this KB only (cascades to chunks, embeddings, etc.). Does NOT delete the underlying source — use this to detach a shared source from one KB without affecting others |
| `POST /api/knowledge-bases/{id}/sources/{indexed_source_id}/cancel` | Cancel in-progress indexing (`pending` or `indexing` only) |
| `POST /api/knowledge-bases/{id}/reindex` | Re-index. Optional body: `{ "indexed_source_ids": [...] }` or `{ "failed_only": true }` |

#### Items

| Endpoint | Description |
|---|---|
| `POST /api/knowledge-bases/{id}/items` | Fetch indexed items for given source IDs. Body: `{ "source_ids": ["uuid"], "limit": 1000, "offset": 0 }` |

Item shape varies by strategy:

| Strategy | `text` is | Extra fields |
|---|---|---|
| `chunk_embed` | full chunk text | `chunk_index`, `start_char`, `end_char`, `tokens` |
| `page_index` | node text | `node_id`, `title`, `depth`, `parent_node_id` |
| `graph_index` | node text | `node_id`, `title`, `depth`, `parent_node_id` |
| `full_document` | document summary | `full_text_path` |
| `doc2json` | document summary | `extracted_json` |

#### Search

| Endpoint | Description |
|---|---|
| `POST /api/knowledge-bases/{id}/search` | Search. Body: `{ "query": "...", "top_k": 5, "retrieval_method": "hybrid"\|"vector_search"\|"full_text"\|"tree_search", "filter_metadata": {}, "similarity_threshold": 0.3 }` |

#### Metadata Enrichment

| Endpoint | Description |
|---|---|
| `PUT /api/knowledge-bases/{id}/enrichment` | Create or replace enrichment config. Body: `{ "fields": [{ "name": "...", "description": "...", "type": "text"\|"boolean"\|"number"\|"enum", "enum_values": [...] }], "llm_model": "gpt-4o", "max_tokens": 500, "use_multimodal": false }` |
| `GET /api/knowledge-bases/{id}/enrichment` | Get enrichment config and run status |
| `DELETE /api/knowledge-bases/{id}/enrichment` | Remove enrichment config and drop its table |
| `POST /api/knowledge-bases/{id}/enrichment/run` | Manually trigger enrichment. Body: `{ "incremental": true, "retry_failed": false }` |
| `GET /api/knowledge-bases/{id}/enrichment/results` | Fetch enriched metadata. `?item_ids=uuid1,uuid2` |

#### Graph-Index Re-enrichment (graph_index KBs only)

| Endpoint | Description |
|---|---|
| `POST /api/knowledge-bases/{id}/graph-enrichment/run` | Re-run graph reference enrichment. Optional: `{ "indexed_source_id": "...", "retry_failed": true }` |
| `GET /api/knowledge-bases/{id}/graph-enrichment/errors` | Per-source enrichment error counts |

**Error codes:**

| Status | Description |
|---|---|
| 400 | Invalid chunking/embedding/enrichment config |
| 404 | KB or indexed source not found |
| 409 | Indexing already finished/cancelled; enrichment config locked during active run |
| 503 | Worker unavailable |

---

### 3. Agents

**Base path:** `/api/agents`  
Create AI agents with tools, knowledge bases, MCP servers, hooks, and streaming execution.

Agents use a ReAct loop. Sessions maintain conversation history across turns.

#### CRUD

| Endpoint | Description |
|---|---|
| `GET /api/agents` | List all agents |
| `POST /api/agents` | Create. Body: `{ "name": "...", "model": "gpt-4o", "system_prompt": "...", "temperature": 0.7 }` |
| `GET /api/agents/{id}` | Get agent by ID |
| `PATCH /api/agents/{id}` | Update name, model, system prompt, or settings |
| `DELETE /api/agents/{id}` | Delete agent |

#### Tool Assignments

| Endpoint | Description |
|---|---|
| `POST /api/agents/{id}/tools` | Assign tool. Body: `{ "tool_name": "database_query" }` |
| `GET /api/agents/{id}/tools` | List tool assignments |
| `PATCH /api/agents/{id}/tools/{assignment_id}` | Update tool assignment config |
| `DELETE /api/agents/{id}/tools/{assignment_id}` | Remove tool assignment |

#### Knowledge Base Assignments

| Endpoint | Description |
|---|---|
| `POST /api/agents/{id}/knowledge-bases` | Link KB (creates dynamic search tool). Body: `{ "knowledge_base_id": "uuid" }` |
| `GET /api/agents/{id}/knowledge-bases` | List KB assignments |
| `DELETE /api/agents/{id}/knowledge-bases/{assignment_id}` | Remove KB assignment |

#### MCP Servers

| Endpoint | Description |
|---|---|
| `POST /api/agents/{id}/mcp-servers` | Add MCP server. Body: `{ "url": "...", "transport": "sse", "name": "..." }` |
| `GET /api/agents/{id}/mcp-servers` | List MCP servers |
| `PUT /api/agents/{id}/mcp-servers/{server_id}` | Update MCP server config |
| `DELETE /api/agents/{id}/mcp-servers/{server_id}` | Remove MCP server |

#### Hooks

| Endpoint | Description |
|---|---|
| `POST /api/agents/{id}/hooks` | Add hook. Body: `{ "event": "before_run", "type": "webhook", "config": { "url": "..." } }` |
| `GET /api/agents/{id}/hooks` | List hooks |
| `DELETE /api/agents/{id}/hooks/{hook_id}` | Remove hook |

#### Execution

| Endpoint | Description |
|---|---|
| `GET /api/agents/{id}/sessions` | List chat sessions |
| `POST /api/agents/{id}/run` | Run synchronously (no tools/streaming). Body: `{ "message": "..." }` |
| `POST /api/agents/{id}/run/stream` | Run with streaming SSE (supports tools, ReAct, multi-turn). Body: `{ "message": "...", "session_id": "optional-uuid", "reasoning_requested": false }`. SSE event types: `start`, `chunk`, `tool_call`, `tool_result`, `reasoning`, `reasoning_summary`, `complete` |
| `GET /api/agents/runs/{run_id}` | Fetch a single run by ID. Returns full run details including `steps`, `events`, `tool_calls`, `reasoning_steps`, `retrieved_context`, `usage` |
| `POST /api/agents/runs/{run_id}/approve` | Approve or deny a pending tool call (human-in-the-loop). Body: `{ "approved": true }` |

**Error codes:**

| Status | Description |
|---|---|
| 400 | Missing/invalid field; invalid tool-config schema |
| 404 | Agent, assignment, or run not found; session not owned by caller (returned as 404) |
| 409 | KB already assigned; MCP server name already exists |

---

### 4. Sessions

**Base path:** `/api/sessions`  
Manage multi-turn chat sessions and their message/run history.

Sessions are auto-created on first agent run. Pass `session_id` from the `start` SSE event to continue conversations.

| Endpoint | Description |
|---|---|
| `GET /api/sessions/{id}` | Get session by ID |
| `GET /api/sessions/{id}/messages` | Get assembled chat messages (each assistant message includes `retrieved_context`) |
| `GET /api/sessions/{id}/runs` | List all agent runs in a session |
| `GET /api/sessions/{id}/runs/{run_id}/retrieved-context` | Get retrieved KB chunks for a specific run (for RAG debugging) |
| `DELETE /api/sessions/{id}` | Delete session and all its runs |

**Error codes:**

| Status | Description |
|---|---|
| 404 | Session not found; run not found within session |

---

### 5. Orchestrations

**Base path:** `/api/orchestrations`  
Combine multiple agents into coordinated multi-agent systems.

A coordinator agent delegates subtasks to specialized entity agents and synthesizes their responses.

#### CRUD

| Endpoint | Description |
|---|---|
| `POST /api/orchestrations` | Create. Body: `{ "name": "Team", "strategy": "supervisor" }` |
| `GET /api/orchestrations` | List all |
| `GET /api/orchestrations/{id}` | Get with entities |
| `PUT /api/orchestrations/{id}` | Update config |
| `DELETE /api/orchestrations/{id}` | Delete |

#### Entities

| Endpoint | Description |
|---|---|
| `POST /api/orchestrations/{id}/entities` | Add agent entity. Body: `{ "agent_id": "uuid", "role": "Handles billing" }` |
| `GET /api/orchestrations/{id}/entities` | List entities |
| `PUT /api/orchestrations/{id}/entities/{eid}` | Update entity role/config |
| `DELETE /api/orchestrations/{id}/entities/{eid}` | Remove entity |

#### Execution

| Endpoint | Description |
|---|---|
| `POST /api/orchestrations/{id}/run/stream` | Run with streaming SSE (includes delegation events). Body: `{ "message": "..." }` |
| `GET /api/orchestrations/runs/{run_id}` | Get orchestration run result |

#### Hooks

| Endpoint | Description |
|---|---|
| `POST /api/orchestrations/{id}/hooks` | Add hook. Body: `{ "event": "after_run", "type": "webhook", "config": { "url": "..." }, "enabled": true, "position": 0 }` |
| `GET /api/orchestrations/{id}/hooks` | List hooks ordered by `position` |
| `DELETE /api/orchestrations/{id}/hooks/{hook_id}` | Remove hook |

#### Sessions

| Endpoint | Description |
|---|---|
| `GET /api/orchestrations/{id}/sessions` | List most recent 100 sessions |
| `GET /api/orchestrations/{id}/sessions/{session_id}/messages` | Assembled messages for a session (includes per-run reasoning metadata, tool calls) |

**Error codes:**

| Status | Description |
|---|---|
| 400 | No entity agents; missing hook fields |
| 404 | Orchestration, hook, or session not found |

---

### 6. Workflows

**Base path:** `/api/workflows`  
DAG-based automation pipelines with composable blocks.

Block types: `starter`, `webhook`, `agent`, `code`, `condition`, `split`, `platform_api`, `general_api`, `response`.

#### CRUD

| Endpoint | Description |
|---|---|
| `GET /api/workflows` | List. Optional: `?limit=N&offset=N` |
| `POST /api/workflows` | Create. Body: `{ "name": "My Workflow" }` |
| `GET /api/workflows/{id}` | Get workflow with blocks and edges |
| `PATCH /api/workflows/{id}` | Update metadata |
| `DELETE /api/workflows/{id}` | Delete |

#### Graph

| Endpoint | Description |
|---|---|
| `PUT /api/workflows/{id}/graph` | Save complete graph. Body: `{ "blocks": [{ "id": "...", "type": "...", "config": {}, "position": {"x":0,"y":0} }], "edges": [{ "source": "...", "target": "..." }] }` |

#### Deploy & Arm

| Endpoint | Description |
|---|---|
| `POST /api/workflows/{id}/deploy` | Deploy (enables webhook triggering) |
| `POST /api/workflows/{id}/undeploy` | Undeploy |
| `POST /api/workflows/{id}/arm` | Arm webhook for single external trigger. Returns `{ "webhook_id": "...", "secret": "..." }` |

#### Execution

| Endpoint | Description |
|---|---|
| `POST /api/workflows/{id}/execute` | Execute synchronously. Body: `{ "input": { "key": "value" } }` |
| `POST /api/workflows/{id}/execute/stream` | Execute with streaming SSE |
| `GET /api/workflows/{id}/executions` | List execution history |
| `GET /api/workflows/{id}/executions/{eid}/logs` | Get per-block execution logs |

**Error codes:**

| Status | `error_code` | Description |
|---|---|---|
| 400 | — | Missing required field |
| 400 | `VALIDATION_ERROR` | Invalid block/edge definitions |
| 404 | `WORKFLOW_NOT_FOUND` | Workflow not found |
| 504 | `EXECUTION_TIMEOUT` | Exceeded synchronous timeout |
| 500 | `EXECUTION_FAILED` | Workflow raised an error |

---

### 7. Webhooks

**Base path:** `/api/webhooks`  
Trigger deployed workflows from external systems.

Webhooks are **unauthenticated by design** — auth is per-webhook via the secret returned on arming.

| Endpoint | Description |
|---|---|
| `POST /api/webhooks/{webhook_id}` | Trigger workflow. Auth via `Authorization: Bearer <secret>` header or `?token=<secret>`. Body becomes workflow input. Returns execution result synchronously (5-minute timeout). |

**Error codes:**

| Status | `error_code` | Description |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `webhook_id` not a valid UUID |
| 401 | — | Missing/incorrect secret |
| 403 | — | Webhook not active |
| 404 | `WORKFLOW_NOT_FOUND` | No workflow with this webhook ID |
| 500 | `EXECUTION_FAILED` | Workflow errored |
| 504 | `EXECUTION_TIMEOUT` | Exceeded 5-minute limit |

---

### 8. Copilot

**Base path:** `/api/copilot`  
AI-powered workflow builder. Describe workflows in natural language to generate their graph.

| Endpoint | Description |
|---|---|
| `POST /api/copilot/sessions` | Create copilot session. Body: `{ "workflow_id": "uuid" }` |
| `GET /api/copilot/sessions` | Get session by `?workflow_id=uuid` |
| `DELETE /api/copilot/sessions/{id}` | Delete session |
| `GET /api/copilot/sessions/{id}/messages` | Get conversation history |
| `POST /api/copilot/sessions/{id}/messages/{mid}/snapshot` | Save a copilot suggestion as a snapshot |
| `POST /api/copilot/sessions/{id}/chat` | Send message, stream copilot response (SSE). Body: `{ "message": "Build a workflow that..." }` |
| `GET /api/copilot/settings/model` | Get copilot model config |
| `PUT /api/copilot/settings/model` | Set copilot model. Body: `{ "model": "gpt-4o" }` |

**Error codes:**

| Status | Description |
|---|---|
| 400 | Missing required field; invalid model |
| 404 | Workflow or copilot session not found |

---

### 9. Tools

**Base path:** `/api/tools`  
Manage custom tools and view builtin tools available to agents.

**Builtin tools:** `database_query`, `database_write`, `http_request`, `code_execute`, `storage_read`, `storage_write`, `web_search`, `web_scrape`

| Endpoint | Description |
|---|---|
| `GET /api/tools` | List all tools (builtin + custom) |
| `POST /api/tools` | Create custom tool. Body: `{ "name": "weather_lookup", "description": "...", "endpoint_url": "https://...", "method": "GET", "input_schema": { "type": "object", "properties": { "city": { "type": "string" } }, "required": ["city"] } }` |
| `GET /api/tools/{id}` | Get tool definition by ID |
| `PUT /api/tools/{id}` | Update custom tool |
| `DELETE /api/tools/{id}` | Delete custom tool |

**Error codes:**

| Status | Description |
|---|---|
| 400 | Missing required field (`name`, `description`, `type`, `input_schema`) |
| 404 | Tool not found |

---

### 10. Context Handlers

**Base path:** `/api/context-handlers`  
Standalone RAG retrieval outside of agent runs. Useful for custom LLM integrations.

| Endpoint | Description |
|---|---|
| `GET /api/context-handlers` | List context handlers with pagination |
| `POST /api/context-handlers` | Create and execute. Body: `{ "query": "...", "knowledge_base_configs": [{ "id": "kb-uuid", "top_k": 5 }], "max_context_tokens": 8000 }` |
| `GET /api/context-handlers/{id}` | Get a handler result by ID |

**Error codes:**

| Status | Description |
|---|---|
| 400 | `query` required; `knowledge_bases` required and non-empty |
| 404 | Handler not found |
| 500 | Retrieval failed |

---

### 11. Database (Authenticated Proxy)

**Base path:** `/api/database`  
Auth-required CRUD over your project's `public` schema via a PostgREST proxy.

System schemas (`ai`, `auth`, `storage`, etc.) are blocked. Use `/api/agents`, `/api/knowledge-bases`, etc. for those.

| Endpoint | Description |
|---|---|
| `GET /api/database/tables` | List tables. `?schema=public` (only public is allowed) |
| `GET /api/database/tables/{table}` | List rows. Optional: `?limit=50&offset=0&schema=public` |
| `GET /api/database/tables/{table}/{row_id}` | Fetch single row by primary key |
| `POST /api/database/tables/{table}` | Insert row. Body: JSON object |
| `PATCH /api/database/tables/{table}/{row_id}` | Update row. Body: JSON object with changed fields |
| `DELETE /api/database/tables/{table}/{row_id}` | Delete row by primary key |
| `GET /api/database/openapi` | Return full PostgREST OpenAPI/Swagger spec for user-defined tables |

**Error codes:**

| Status | Description |
|---|---|
| 400 | Table name invalid; schema not `public` |
| 401 | Missing/invalid auth headers |
| 502 | PostgREST connection failed |
| 4xx/5xx | Forwarded from PostgREST |

---

### 12. Database (PostgREST)

**Base path:** `/rest/v1`  
Direct PostgREST access. Full filtering, ordering, pagination, embedded relations, RPC calls.

Always include `apikey` and `Authorization: Bearer` headers. Anon keys respect Row Level Security; service-role keys bypass it.

#### Reading Rows

| Endpoint | Description |
|---|---|
| `GET /rest/v1/{table}` | List rows. Params: `select=col1,col2`, `order=created_at.desc`, `limit`, `offset`, filter operators like `?id=eq.{uuid}`, `?name=like.*foo*` |
| `GET /rest/v1/{table}?id=eq.{id}` | Single row (add `Accept: application/vnd.pgrst.object+json`) |

#### Writing Rows

| Endpoint | Description |
|---|---|
| `POST /rest/v1/{table}` | Insert. Body: JSON object or array. Add `Prefer: return=representation` to get inserted rows back. Use `Prefer: resolution=merge-duplicates` with `on_conflict=` for upsert |
| `PATCH /rest/v1/{table}` | Update rows matching filter. Always use a filter — without one, updates every row |
| `DELETE /rest/v1/{table}` | Delete rows matching filter. Always use a filter |

#### Stored Procedures

| Endpoint | Description |
|---|---|
| `POST /rest/v1/rpc/{function_name}` | Call a Postgres function in the public schema. Body: `{ "arg1": "value" }` |

**Error codes:**

| Status | Code | Description |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid auth |
| 403 | `rls_denied` | RLS policy denied |
| 404 | `not_found` | Table/view not found |
| 409 | `conflict` | Unique/FK constraint violation |
| 422 | `invalid_request` | Malformed filter or invalid column |

---

### 13. Authentication & Storage

**Base path:** `/api/platform/auth/{ref}/*` and `/api/platform/storage/{ref}/*`  
Proxied through the control plane to each project's GoTrue (auth) and Storage services.

Replace `{PLATFORM_URL}` with your Studio app base URL and `{ref}` with your project ref. Requires a platform JWT (`Authorization: Bearer YOUR_PLATFORM_JWT`).

#### Authentication

| Endpoint | Description |
|---|---|
| `GET /api/platform/auth/{ref}/users` | List project auth users |
| `POST /api/platform/auth/{ref}/users` | Create auth user. Body: `{ "email": "...", "password": "..." }` |

#### Storage

| Endpoint | Description |
|---|---|
| `GET /api/platform/storage/{ref}/buckets` | List storage buckets |
| `POST /api/platform/storage/{ref}/object/{bucket}/{path}` | Upload a file (multipart/form-data) |

**Error codes:**

| Status | Description |
|---|---|
| 401 | Missing/invalid auth credentials |

---

### 14. AI Provider Keys

**Base path:** `/api/ai-provider-keys`  
Store, validate, and rotate per-project credentials for AI providers.

Supported providers: `openai`, `anthropic`, `google`, `openrouter`. Keys are encrypted at rest and returned masked.

| Endpoint | Description |
|---|---|
| `GET /api/ai-provider-keys` | List all configured provider keys (returns `masked_key`, never the raw secret) |
| `POST /api/ai-provider-keys` | Upsert single key. Body: `{ "provider": "openai", "api_key": "sk-..." }`. Returns 201 on insert, 200 on update |
| `PUT /api/ai-provider-keys` | Batch upsert. Body: `{ "openai": "sk-...", "anthropic": "sk-ant-...", "google": null }`. Null/empty values are no-ops |
| `DELETE /api/ai-provider-keys/{provider}` | Remove a stored key (returns 204) |
| `POST /api/ai-provider-keys/validate` | Validate key without storing. Body: `{ "provider": "openai", "api_key": "sk-..." }`. Returns `{ "is_valid": true }` or `{ "is_valid": false, "error": "..." }` |

**Error codes:**

| Status | Description |
|---|---|
| 400 | Invalid provider; provider rejected the key (hard fail) |
| 401 | Missing/invalid auth headers |

---

### 15. Settings

**Base path:** `/api/settings`  
Read and override per-project configuration values from a typed registry.

Categories: `copilot`, `agents`, `tools`, `knowledge-indexing`, `knowledge-retrieval`, `compaction`, `sources`. Keys use `UPPER_SNAKE_CASE`. All values stored as strings — stringify bools/numbers (`"true"`, `"0.7"`).

| Endpoint | Description |
|---|---|
| `GET /api/settings` | Return all settings with defaults, current overrides, type, and category |
| `PUT /api/settings` | Bulk-update overrides. Body: `{ "settings": { "EXTRACTION_DEFAULT_METHOD": "mistral", "COPILOT_TEMPERATURE": "0.5" } }`. All-or-nothing — any failure rejects the entire request |
| `DELETE /api/settings/{key}` | Remove a single override (reverts to registry default) |
| `POST /api/settings/reset-category` | Remove all overrides in a category. Body: `{ "category": "copilot" }` |

**Error codes:**

| Status | Description |
|---|---|
| 400 | Validation failed (PUT); unknown category (reset-category); empty settings object |
| 404 | Key not in registry (DELETE) |

---

## Indexing Strategies (Quick Reference)

| Strategy | Best For |
|---|---|
| `chunk_embed` | General RAG — most documents, fastest and cheapest |
| `page_index` | Long structured PDFs (legal, compliance, specs) |
| `graph_index` | Dense cross-referenced documents (regulations, codebases) |
| `doc2json` | Invoices, forms, resumes — structured data extraction |

## Retrieval Methods (Quick Reference)

| Method | Best For |
|---|---|
| `vector_search` | Fast semantic matching |
| `full_text` | Exact phrases, error codes, IDs |
| `hybrid` | Production RAG (recommended default — uses RRF fusion) |
| `tree_search` | PageIndex KBs — complex structural queries |

---

## Docs Links

- Platform Overview: https://docs.powabase.ai/concepts/platform-overview
- Quickstart: https://docs.powabase.ai/guides/quickstart
- Architecture: https://docs.powabase.ai/concepts/architecture
- Sources & Extraction: https://docs.powabase.ai/concepts/sources-extraction
- Knowledge Bases & Indexing: https://docs.powabase.ai/concepts/knowledge-bases-indexing
- Agents & Tools: https://docs.powabase.ai/concepts/agents-tools
- Multi-Agent Orchestration: https://docs.powabase.ai/concepts/orchestrations-concept
- Workflows: https://docs.powabase.ai/concepts/workflows-concept
- Streaming & SSE: https://docs.powabase.ai/concepts/streaming-patterns
- Database Access: https://docs.powabase.ai/concepts/database-access
- Complete docs index: https://docs.powabase.ai/llms.txt
