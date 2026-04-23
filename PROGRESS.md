# Powabase Chat — Build Progress

> A ChatGPT-like UI powered entirely by Powabase's built-in AI platform.
> Inspired visually by [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) but built fresh for Powabase.

---

## Architecture Overview

```
Browser (React/Next.js UI)
        │
        │  fetch("/api/...")     ← service key NEVER reaches browser
        ▼
Next.js API Routes (server-side, thin proxies)
        │
        │  Powabase API calls with secret key in headers
        ▼
Powabase (https://test-app-v3.p.powabase.ai)
  ├── Agents       ← LLM with tools, system prompt, model config
  ├── Sessions     ← conversation history stored & managed by Powabase
  ├── SSE Stream   ← real-time token streaming
  ├── Sources      ← uploaded documents (PDF, DOCX, TXT, etc.)
  └── Knowledge Bases ← RAG: chunk → embed → pgvector → search
```

**Key principle:** All AI intelligence lives in Powabase. Our Next.js app is a pure UI connector — it renders chat, proxies requests, and never handles any LLM logic itself.

---

## Security

- `POWABASE_KEY` lives only in `.env.local` — read only by server-side API routes
- The browser calls `/api/chat`, `/api/sessions`, etc. — never Powabase directly
- `.env.local` is gitignored by default (never committed)

---

## File Structure

```
test-app-v3/
├── app/
│   ├── layout.tsx              ← HTML shell, fonts, metadata
│   ├── page.tsx                ← Main app: state, streaming, agent bootstrap
│   ├── globals.css             ← Tailwind v4 + typography plugin
│   └── api/
│       ├── agents/route.ts     ← GET/POST /api/agents → Powabase agents
│       ├── sessions/route.ts   ← GET/DELETE /api/sessions → Powabase sessions
│       ├── sessions/runs/      ← GET /api/sessions/runs → message history
│       ├── chat/route.ts       ← POST /api/chat → SSE stream proxy
│       ├── upload/route.ts     ← POST /api/upload → Source + KB creation
│       └── sources/route.ts    ← GET /api/sources → source status
├── components/
│   ├── Sidebar.tsx             ← Conversation list, new chat, upload button
│   ├── ChatArea.tsx            ← Message thread with markdown rendering
│   ├── MessageInput.tsx        ← Auto-resize textarea, Enter to send
│   └── FileUpload.tsx          ← Drag-and-drop file upload modal
├── lib/
│   ├── types.ts                ← Shared TypeScript interfaces
│   └── powabase-server.ts      ← Server-only fetch helpers (pbGet, pbPost, etc.)
├── .env.local                  ← POWABASE_URL + POWABASE_KEY (never committed)
└── SKILL.md                    ← Powabase platform reference
```

---

## How Each Feature Works

### Chat (Streaming)
1. User types a message → hits Enter
2. Browser POSTs to `/api/chat` with `{ agentId, message, sessionId? }`
3. API route forwards to Powabase's `POST /api/agents/{id}/run/stream`
4. Powabase runs its ReAct loop (up to 25 steps) and streams SSE events
5. Our route pipes the SSE stream directly back to the browser
6. Browser reads `chunk` events to build the streaming bubble token by token
7. On completion, the full message is committed to React state

### Sessions (Conversations)
- Powabase auto-creates a session on the first message if no `session_id` is provided
- The `session_id` comes back in the SSE start event — we capture it and store it
- The sidebar lists all sessions via `GET /api/agents/{id}/sessions`
- Selecting a conversation loads its runs via `GET /api/sessions/{id}/runs`
- Deleting a conversation calls `DELETE /api/agents/{id}/sessions/{id}` on Powabase

### RAG (Document Upload)
1. User uploads a file via the modal
2. API route posts it to Powabase as a **Source** → triggers async extraction
3. Gets or creates the `default-knowledge-base` KB (ChunkEmbed + hybrid search)
4. Attaches the source to the KB → Powabase indexes it (chunk → embed → pgvector)
5. Attaches the KB to the agent → Powabase auto-creates a `knowledge_search` tool
6. Agent automatically uses `knowledge_search` when answering future questions

### Agent Bootstrap
- On first load, the app calls `GET /api/agents` to find `powabase-chat`
- If it doesn't exist yet, it creates it with a default system prompt
- This agent persists in Powabase — only created once

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + @tailwindcss/typography |
| Icons | Heroicons |
| Markdown | react-markdown |
| AI Platform | Powabase |

---

## Status

| Task | Status |
|---|---|
| Bootstrap Next.js project | ✅ Done |
| Types + server helper | ✅ Done |
| API routes (agents, sessions, chat, upload, sources) | ✅ Done |
| UI components (Sidebar, ChatArea, MessageInput, FileUpload) | ✅ Done |
| Main page (state, streaming, agent bootstrap) | ✅ Done |
| Build passes | ✅ Clean (0 errors) |
| Run dev server + smoke test | 🔲 Pending |
