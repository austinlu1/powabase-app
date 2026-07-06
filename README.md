# Powabase Chat App

![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![AWS Amplify](https://img.shields.io/badge/AWS_Amplify-FF9900?logo=awsamplify&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

A full-stack AI chat platform built on [Powabase](https://powabase.ai). Users sign up, create AI agents backed by their own knowledge bases, upload documents and URLs as sources, and chat with streaming responses. Public agents can be shared via a direct link or embedded as a floating chat widget on any external website with two lines of HTML.

Clone it, point it at your Powabase project, and you have a working multi-user AI chat platform.

## What it does

**For logged-in users:**
- Create multiple AI agents, each with a name, system prompt, avatar color, and emoji
- Set an agent's knowledge mode: let the AI draw on both the knowledge base and its own training, or restrict it to only answer from what's in the knowledge base
- Set company/product name and a support contact per agent
- Upload documents (PDF, DOCX, TXT, CSV, PPTX, XLSX, images) or import URLs into each agent's knowledge base
- Chat with streaming responses and full conversation history
- Attach files or URLs directly in the chat input for one-off context without indexing them into the KB
- Rename, search, and switch between past conversations
- Export any conversation as a `.txt` file
- View a usage dashboard with per-agent stats and platform limits
- Set agents to Public or Private. Only Public agents can be shared or embedded.

**For visitors (no account needed):**
- Open a public agent's shareable link and chat in a full-screen browser page
- Chat with an agent embedded on any website without leaving the page
- Upload files or import URLs as session context
- Switch between past sessions via a sliding sidebar (stored in `localStorage`)

## Features

- **Two-step agent creation**: first step sets name and system prompt; second step sets company/product, support contact, and knowledge mode. The agent is created after step one; step two saves preferences on top of it.
- **Knowledge mode**: two options at creation and in settings. "AI + Knowledge Base" has the agent search the KB first, then fill gaps with its own training. "Knowledge Base only" restricts it to KB results; if the answer isn't there, it says so rather than guessing.
- **Agent card management**: a three-dot hover menu on each card lets you rename inline, duplicate, share, or delete. Deleting shows a confirmation before anything is removed.
- **Public / Private visibility**: Private agents cannot be shared or embedded. The Go Live section shows a lock screen for private agents with a direct link to settings. The sidebar shows a lock badge on the Go Live nav item for private agents.
- **Shareable chat link**: each public agent has a `/chat/[agentId]` page. The URL encodes display name, avatar color, emoji, and welcome message so visitors see the right branding without any server lookup.
- **Share modal**: clicking Share in the card menu (or copying from Go Live) opens a small dialog with the full URL and a copy button.
- **Embeddable widget**: a two-line HTML snippet drops a floating chat button onto any website. No backend required on the host site. Only available for Public agents.
- **Streaming responses**: answers stream token-by-token over SSE with a live typing indicator
- **Conversation history**: sessions persist server-side; users can rename, search, and switch
- **Export conversations**: downloads as `.txt`; attached sources are listed at the top, not repeated in every message
- **Usage dashboard**: per-agent session count, message exchange count, estimated token usage, and a platform limits reference (50K session token cap, 25-page file limit, 10-chunk KB retrieval, etc.)
- **Markdown rendering**: assistant responses render headers, lists, code blocks, bold/italic
- **Cookie-based auth**: `httpOnly` cookies with 30-day rolling expiry

## Powabase features used

- **Sources**: file uploads and URL imports via Powabase's Firecrawl integration
- **Knowledge Bases**: one KB per agent, indexed with `chunk_embed` strategy and hybrid retrieval
- **Agents**: each agent has a custom system prompt linked to its own KB; knowledge mode is encoded in the system prompt at creation/update time
- **Sessions**: Powabase manages server-side conversation history; the app stores only the session ID
- **Streaming (SSE)**: `POST /api/agents/{id}/run/stream` drives real-time token delivery
- **Auth (GoTrue)**: email/password signup and login; tokens verified server-side on every API request
- **PostgREST**: the `session_sources` table stores session-scoped attachment metadata

## Architecture

```
Browser
  |
  |- app/page.tsx              Main SPA: agent selection, chat, conversation management
  |- app/login/page.tsx        Sign in / sign up
  |- app/chat/[agentId]/       Public shareable chat page (no auth)
  |- app/usage/page.tsx        Usage dashboard
  +- app/widget/page.tsx       Iframe chat UI (embedded on external sites)
        |
        v
  Next.js API Routes (server-side)
  |- /api/auth/*               Login, signup, logout, password reset
  |- /api/user/setup           Bootstrap first agent for new users
  |- /api/agents/*             Agent + KB CRUD (knowledge_mode accepted on POST and PATCH)
  |- /api/chat                 Authenticated SSE streaming proxy
  |- /api/sessions/*           List, delete, load history
  |- /api/sources/*            KB source management
  |- /api/upload               File upload to KB
  |- /api/session-sources      Session-scoped attachments (no KB indexing)
  |- /api/usage                Per-agent stats
  +- /api/widget/*             Public (no auth): chat, attach-file, attach-url
        |
        v
  Powabase (AI BaaS)
  |- GoTrue Auth               User identity
  |- Agents + KBs              System prompts, knowledge base search
  |- Sources                   File/URL extraction (Firecrawl)
  |- Sessions + Runs           Conversation history
  +- PostgREST                 session_sources table
```

## Knowledge mode and system prompts

When an agent is created or updated, the API appends one of two instruction blocks to the system prompt based on `knowledge_mode`:

- `"ai"` (default): instructs the agent to call `knowledge_search` first, then draw on its own training to expand or fill gaps
- `"kb"`: instructs the agent to only answer from KB results; if the answer isn't found, it tells the user rather than guessing

The instruction is stored as part of the system prompt in Powabase. Changing the mode via Agent Settings issues a PATCH with the new prompt variant.

## Agent preferences

Per-agent preferences are saved in `localStorage` under `agentPrefs_{agentId}` and are never sent to Powabase. They control client-side display and behavior:

| Field | Description |
|---|---|
| `displayName` | Name shown in the UI (defaults to the Powabase agent name) |
| `avatarColor` | Hex color for the avatar circle and accent |
| `avatarEmoji` | Optional emoji shown in place of the initial |
| `welcomeMessage` | First message shown when opening a new chat |
| `visibility` | `"public"` or `"private"`, controls sharing and embedding |
| `companyName` | Company or product this agent represents |
| `supportContact` | Email or phone shown in agent settings |
| `knowledgeMode` | `"ai"` or `"kb"`, mirrors what was sent to the server |

## Database setup

One table is required: `session_sources`. It stores the extracted text of files and URLs attached inline in the chat (injected as context without being indexed into the KB).

Run this in your Powabase project under **SQL Editor**:

```sql
create table if not exists public.session_sources (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_id    text not null,
  source_id     text not null default '',
  name          text not null,
  type          text not null,
  extracted_text text not null default '',
  created_at    timestamptz not null default now()
);

alter table public.session_sources enable row level security;

create policy "Users manage their own session sources"
  on public.session_sources
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `user_id` | uuid | References `auth.users`, scopes rows to the logged-in user |
| `session_id` | text | The Powabase agent session this attachment belongs to |
| `source_id` | text | Internal reference ID |
| `name` | text | Display name (filename or URL) |
| `type` | text | `"file"` or `"url"` |
| `extracted_text` | text | Full extracted content injected as context |
| `created_at` | timestamptz | When the attachment was added |

## Ownership model

No extra tables for agents or sources. Ownership is encoded in Powabase name fields:

- **Agents**: `{userId}__{kbId}__{displayName}`, parsed server-side to filter each user's agents
- **Sources**: `{userId}:{kbIds}:{uuid}:{filename}`, multiple KBs joined with `+` when shared

`session_sources` is the only application-specific table.

## Session-scoped vs KB-indexed context

| Method | How | Indexed in KB? | Persists across sessions? |
|---|---|---|---|
| Upload via Sources panel | Drag-drop or URL import | Yes (RAG) | Yes |
| Attach in chat input (`+`) | File or URL per message | No (injected inline) | That session only |

Chat-input attachments prepend extracted text to the message as `[Context: File - name]\n...\n\n---\n\n`. This prefix is stripped when displaying old messages.

## Public agents and sharing

Set an agent's visibility to **Public** in Agent Settings to unlock sharing and embedding.

**Shareable link**: each public agent gets a `/chat/[agentId]` page. Display params (name, color, emoji, welcome message) are encoded in the URL query string so visitors see the right branding with no server-side store. Copy the link from the Go Live section or the Share option in the card menu.

**Embed widget**: paste the two-line snippet into any website's `<head>` or end of `<body>`:

```html
<script>
  window.PowabaseChat = { agentId: "YOUR_AGENT_ID" }
</script>
<script src="https://YOUR_APP_URL/widget.js" defer></script>
```

The Go Live section in the sidebar generates this snippet for you. Private agents show a lock screen in Go Live instead of the snippet.

### What the widget does

- Floating chat button, bottom-right, 68x68px
- Opens a 390x620px chat panel as an iframe
- No auth required for visitors
- Streams responses with markdown rendering
- Supports file uploads (up to 25 pages) and URL imports
- Sliding sidebar with conversation history, search, and rename, stored in `localStorage`
- Full-width below 460px

## Prerequisites

- A [Powabase](https://powabase.ai) project
- The `session_sources` table created (see above)
- Node 20+ / npm
- An AWS account (for Amplify hosting)

## Setting up Powabase

1. Go to [https://powabase.ai](https://powabase.ai) and create an account
2. Click **New Project**, name it, and wait for provisioning to finish
3. Click **Connect** at the top of the page
4. Copy the **Project URL** (this is your `POWABASE_URL`)
5. Copy the **Secret key** (the long string starting with `ey`) - this is your `POWABASE_KEY`
6. Go to **SQL Editor** and run the SQL from Database setup above

## Local development

1. Clone the repository:
   ```bash
   git clone https://github.com/austinlu1/powabase-app.git
   cd powabase-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file:
   ```env
   POWABASE_URL=https://your-project.powabase.ai
   POWABASE_KEY=your-service-role-key
   ```
   Find these in your Powabase dashboard under **Project Settings -> API**.

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and sign up.

## Hosting on AWS Amplify

### 1. Install the AWS CLI

**Mac:**
```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

**Windows:** Download and run [AWSCLIV2.msi](https://awscli.amazonaws.com/AWSCLIV2.msi). If `aws` is not recognized after installing, add `C:\Program Files\Amazon\AWSCLIV2\` to your PATH via **Start -> Environment Variables -> System variables -> Path -> Edit**.

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

Verify: `aws --version`

### 2. Configure the CLI

```bash
aws configure
```

Enter your Access Key ID, Secret Access Key, region (`us-east-1`), and output format (`json`). Verify with `aws sts get-caller-identity`.

### 3. Connect your repository

1. Go to the [Amplify console](https://console.aws.amazon.com/amplify)
2. Click **Create new app** and select **GitHub**
3. Authorize AWS, select the repository and `main` branch
4. Leave the auto-detected build settings and click **Save and deploy**

### 4. Add environment variables

In Amplify, go to **Environment variables** and add:

| Variable | Value |
|---|---|
| `POWABASE_URL` | Your Powabase project URL (no trailing slash) |
| `POWABASE_KEY` | Your Powabase service role key |

Then go to **Deployments** and click **Redeploy this version**.

Your app is live at the Amplify URL (e.g. `https://main.xxxx.amplifyapp.com`). Update widget embed snippets to use this URL.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `POWABASE_URL` | Yes | Base URL of your Powabase project |
| `POWABASE_KEY` | Yes | Service role key, server-side only, never sent to the browser |

## Project structure

```
app/
|- api/
|   |- auth/              Login, signup, logout, me
|   |- user/setup         Bootstrap new users
|   |- agents/            Agent + KB CRUD (knowledge_mode on POST/PATCH)
|   |- chat/              Authenticated SSE chat proxy
|   |- sessions/          Conversation list and history
|   |- sources/           KB source management
|   |- upload/            File upload to KB
|   |- session-sources/   Session-scoped attachments
|   |- usage/             Per-agent stats
|   +- widget/            Public chat, attach-file, attach-url
|- chat/[agentId]/        Public shareable chat page
|- login/                 Sign in / sign up / forgot password
|- usage/                 Usage dashboard with platform limits
|- widget/                Iframe chat UI
+- page.tsx               Main SPA

components/
|- AgentsScreen.tsx        Agent card grid: create (2-step), rename, duplicate, share, delete
|- AgentSettingsPanel.tsx  Settings panel: visibility, knowledge mode, avatar, company, contact
|- Sidebar.tsx             Navigation: sessions, sources, Go Live (with lock badge for private agents)
|- SessionsPanel.tsx       Conversation list, search, rename, export
|- GoLivePanel.tsx         Share link + embed snippet (locked for private agents)
|- CustomizationsPanel.tsx Avatar, color, emoji, welcome message, display name
|- CollectedDataPanel.tsx  Data collected by the agent
|- ChatArea.tsx            Message history with markdown rendering
|- MessageInput.tsx        Input bar with file/URL attachment
+- SourcesModal.tsx        KB source management

lib/
|- agentPrefs.ts           AgentPrefs type, localStorage helpers, knowledge mode instructions
|- powabase-server.ts      Server-only Powabase helpers + auth
+- types.ts                TypeScript interfaces

public/
+- widget.js               Self-contained embeddable widget script
```

## Design decisions

- **Auth per route, not middleware**: each API route calls `getUserFromCookie` directly. The client redirects to `/login?reason=session_expired` when setup returns 401.
- **Rolling cookie expiry**: both cookies are re-set on every authenticated request to extend the 30-day window for active users.
- **Ownership without extra tables**: agent and source ownership is encoded in Powabase name fields, not a separate table.
- **Knowledge mode in system prompt**: rather than a separate database field, the mode is encoded as an appended instruction block in the system prompt. The API strips whichever variant is present before writing the new one on PATCH.
- **Share link without a server store**: display preferences (name, color, emoji, welcome message) are encoded directly in the `/chat/[agentId]` URL query string. No extra table or API call needed for public visitors to see the right branding.
- **50,000-token session cap**: estimated at 4 chars/token across all runs in a session. When hit, a banner tells the user to start a new chat.
- **25-page file limit**: files over 25 pages are rejected after extraction to keep context sizes manageable.

## Known limitations

- **Password reset requires SMTP**: the forgot password flow is built but emails won't send until SMTP is configured in Powabase under Authentication settings
- **No social login**: email and password only
- **Widget branding**: button color, position, and header title are set by the agent's preferences at embed time; changing them requires updating the snippet or agent settings
- **Widget attachments are session-scoped**: files and URLs attached in the widget are lost on page refresh
- **50,000-token session limit**: very long conversations will hit the cap; start a new chat to continue
- **25-page file limit**: split large documents before uploading

## Troubleshooting

**"TypeError: Failed to parse URL from undefined/auth/v1/..."**
`POWABASE_URL` is not being read. Check that the variable name is exactly `POWABASE_URL` (uppercase, no spaces), there is no trailing slash, and you redeployed after adding it in Amplify.

**"Invalid authentication credentials" on signup/login**
`POWABASE_KEY` is wrong. Go to your Powabase dashboard, click **Connect**, and copy the full secret key again with no extra spaces.

**"aws: command not found" on Windows**
Add `C:\Program Files\Amazon\AWSCLIV2\` to your PATH (Start -> Environment Variables -> System variables -> Path -> Edit), then reopen the terminal.

**Build fails on Amplify with a TypeScript error**
Run `npm run build` locally first. Fix any errors, commit, and push. Amplify redeploys automatically.

**Amplify app not showing in the console**
Check that you're in the correct AWS region. Use the region dropdown in the top-right of the AWS console to switch.

## Powered by

- [Powabase](https://powabase.ai): AI BaaS (agents, knowledge bases, sources, auth, sessions)
- [Next.js](https://nextjs.org): React framework
- [Tailwind CSS](https://tailwindcss.com): styling
- [AWS Amplify](https://aws.amazon.com/amplify/): hosting
