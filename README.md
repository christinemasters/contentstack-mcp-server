# Contentstack MCP Server

A lightweight Node.js/Express service that exposes your Contentstack stack as an **MCP (Machine‑Callable Platform) Server** so agents and automations can query or mutate content through simple function calls.

---

## 📦  What’s inside?

| Path | Purpose |
| --- | --- |
| `mcp-server.js` | Main application – REST wrapper around Contentstack SDKs. |
| `.well-known/mcp/metadata` | Discovery endpoint consumed by Contentstack Agents. |
| `/functions/execute` | Single RPC endpoint that executes server‑side functions. |
| `.env.example` | Template for local environment variables. |
| `package.json` | Project metadata and run scripts. |

---

## 🚀  Quick start

```bash
# Clone the repo
git clone git@github.com:<org>/<repo>.git
cd <repo>

# Install dependencies
pnpm install            # or npm install / yarn

# Configure credentials
dcp .env.example .env    # fill in STACK_API_KEY, DELIVERY_TOKEN, ENVIRONMENT, MANAGEMENT_TOKEN

# Run
pnpm start               # or npm run dev (nodemon)
```

Visit `http://localhost:3000/ping` ➜ `{ "status": "ok" }` confirms it’s alive.

---

## 🔑  Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `STACK_API_KEY` | ✅ | API key for the stack you want to expose. |
| `DELIVERY_TOKEN` | ✅ | Delivery token with **read** permissions. |
| `ENVIRONMENT` | ✅ | Environment name (e.g. `production`). |
| `MANAGEMENT_TOKEN` | ⬜️ | Enables **write** operations like `createEntry`. |
| `PORT` | ⬜️ | Port the server listens on (default `3000`). |

---

## 📚  Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/ping` | Health probe. |
| `GET` | `/.well-known/mcp/metadata` | Function catalogue + discovery metadata. |
| `POST` | `/functions/execute` | RPC: `{ "fn": "<name>", "args": { ... } }`. |

> **Response shape**: `{ ok: true, result: <any> }` on success; `{ ok: false, error: <msg> }` on failure.

---

## 🛠  Adding new functions

1. **Describe** it in the metadata JSON (inside `mcp-server.js`).
2. **Implement** the logic in the `switch(fn)` block.
3. **Return** clean JSON. Avoid streaming huge SDK objects—agents prefer concise payloads.

---

## 🏗  Deployment suggestions

| Platform | One‑liner |
| --- | --- |
| **Fly.io** | `fly launch --image-node` (auto‑writes Dockerfile) |
| **AWS App Runner** | Container build straight from GitHub. |
| **Google Cloud Run** | `gcloud run deploy` with auto‑scale to zero. |

Add a CDN only if you need caching; most agent calls demand fresh data.

---

## 🧪  Testing

```bash
# Run unit tests (Jest)
pnpm test

# Generate coverage
pnpm run coverage
```

Use `nock` to stub Contentstack responses for fast, offline tests.

---

## 🤝  Contributing

1. Fork ➜ create feature branch (`git checkout -b feature/<name>`)
2. Commit ❯ push ➜ open a PR.
3. Each PR should pass linting and unit tests.

---

## 📄  License

[MIT](LICENSE)

