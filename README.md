# Daruka

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Built%20With-Next.js-black?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Auth-Firebase-FFCA28?style=for-the-badge" />
</p>

<p align="center">
  <strong>Your project's second brain — a persistent memory layer that sits above every AI you use.</strong>
</p>

<p align="center">
  Capture conversations from ChatGPT, Claude, Gemini, and more. Never re-explain your stack, decisions, or history again.
</p>

---

## Overview

Daruka isn't another AI chatbot — it's the memory layer that exists *above* every AI model you already use. Save a conversation from ChatGPT, Claude, or any other AI tool, and Daruka automatically extracts the decisions, bugs, features, and code patterns inside it. Over time, this builds a living knowledge graph of your project that you can browse, search, visualize, and ask questions about — and instantly hand off to a brand-new AI session via **Switch Context**, with zero re-explaining.

It's built around one idea: **the knowledge your project builds shouldn't disappear when you switch AI tools, hire someone new, or revisit a decision six months later.**

---

## Features

* **Git-style project timeline** — every saved conversation becomes a permanent, searchable checkpoint, filterable by category (decisions, bugs, features, code)
* **Multi-provider AI extraction** — Gemini and Groq both supported (bring your own API key); if one fails or hits a rate limit, Daruka automatically falls back to the other, then to a rule-based extractor, so saving a memory never fails outright
* **Switch Context** — one click compresses your entire project history into a single AI-optimized document, ready to paste into any model
* **Force-directed knowledge graph** — every memory block renders as a node connected to the facts it produced; drag, zoom, and click through your project's history visually
* **Chat with your project** — ask plain-English questions ("what decisions have I made?", "what's still pending?") and get answers grounded only in what you actually saved
* **Chrome extension** — a floating "Add to Memory" button on ChatGPT and Claude captures the full conversation in one click, authenticated via a private, revocable extension token
* **Manual capture fallback** — paste any conversation directly if you'd rather not use the extension
* **Bring your own key (BYOK)** — your Gemini/Groq API keys are encrypted at rest (AES-256-GCM) and never shared
* **Light and dark mode**, resizable panels, and a UI styled after the tools you already trust — GitHub, Supabase, Linear

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Database** | Supabase (Postgres) |
| **Authentication** | Firebase Auth (Google + email/password) + a custom long-lived token system for the Chrome extension |
| **AI Providers** | Google Gemini, Groq (Llama 3.3), with a rule-based no-AI fallback |
| **Styling** | Tailwind CSS v4 |
| **Hosting** | Vercel |
| **Browser Extension** | Manifest V3, vanilla JS |

---

## Live Demo

**Try Daruka:** https://daruka.vercel.app

---

## Installation

Clone the repository:

```bash
git clone https://github.com/theshekhr/Daruka.git
cd Daruka
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Firebase client config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Used to encrypt user-provided AI keys at rest
ENCRYPTION_SECRET=
```

Run the database migrations found in `/supabase` (or apply the SQL from the project's setup notes) to your own Supabase project, then start the dev server:

```bash
npm run dev
```

### Browser extension (optional)

The Chrome extension lives in `/extension` and isn't built from `npm` — load it directly:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `/extension` folder
4. Generate a token from **Settings → Browser extension** inside the app and paste it into the extension popup

---

## Project Structure

```
Daruka/
├── app/
│   ├── (auth)/login/        ← Login page
│   ├── (app)/
│   │   ├── dashboard/        ← Project list
│   │   ├── project/[id]/     ← Workspace (timeline, graph, chat)
│   │   └── settings/         ← API keys, extension token
│   └── api/                  ← Route handlers (memories, projects, chat, settings...)
├── components/
│   ├── shell/                ← App sidebar, layout chrome
│   └── workspace/            ← Timeline, GraphView, ChatTab, modals
├── lib/
│   ├── providers/             ← Gemini, Groq, and rule-based fallback, behind one interface
│   ├── firebase-client.ts / firebase-admin.ts
│   ├── supabase.ts
│   ├── crypto.ts               ← AES-256-GCM encryption for stored API keys
│   └── graph-builder.ts        ← Builds nodes/links for the knowledge graph view
├── extension/                 ← Chrome extension (Manifest V3)
└── public/
```

---

## Vision

No matter which AI model you choose — today or five years from now — you should always be able to pick up your project exactly where you left it, with full historical context, in seconds. Daruka is the persistent layer that makes that possible.

---

## Contributing

Contributions, ideas, and feedback are welcome.

1. Fork the repository
2. Create your feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit your changes
   ```bash
   git commit -m "Add amazing feature"
   ```
4. Push to the branch
   ```bash
   git push origin feature/amazing-feature
   ```
5. Open a Pull Request

---

## Author

**Shashank Shekhar**
Building products for fun. Shipping ideas to the internet.

GitHub: [github.com/theshekhr](https://github.com/theshekhr)

---

## Show Your Support

If you like this project, consider giving it a star on GitHub — it motivates continued work on it.

<p align="center">
Made with care by Shashank Shekhar
</p>
