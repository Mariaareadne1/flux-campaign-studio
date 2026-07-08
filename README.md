# FLUX Campaign Studio

An agentic product-to-campaign studio built on the [FLUX.2](https://bfl.ai) API.
Upload a product photo, type a plain-English goal, and watch an agent plan and
execute a sequence of FLUX.2 calls — generating, editing, and re-framing a full
campaign — live on an interactive canvas.

> 🚧 Phase 0 (foundation + async spike) is complete: a one-button demo proves the
> full submit → poll → proxy-download pipeline against the real FLUX API. The
> interactive canvas and agent land in later phases.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS (`client/`)
- **Backend:** Node + Express (TypeScript), a thin proxy to the FLUX API (`server/`)
- **Shared:** TypeScript types in `shared/` imported by both sides

## Why a backend?

FLUX generation is asynchronous — you `POST` a prompt, get a `polling_url`, poll
it until the image is `Ready`, then download the result within ~10 minutes. On
top of that, FLUX delivery URLs do **not** send CORS headers, so the browser
can't fetch them directly. The backend holds the API key, does the polling, and
proxy-downloads result images, solving CORS + URL expiry in one place. The
frontend only ever talks to our own `/api/*` routes.

## Setup (≤ 5 steps)

**Prerequisites:** Node 20+ and npm.

1. **Clone**
   ```bash
   git clone https://github.com/Mariaareadne1/flux-campaign-studio.git
   cd flux-campaign-studio
   ```
2. **Install** (installs both workspaces)
   ```bash
   npm install
   ```
3. **Add your API key.** Copy the example env file and paste your key:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and set `BFL_API_KEY` to a key from
   <https://dashboard.bfl.ai/get-started>. The `.env` file is git-ignored — never
   commit it.
   ```
   BFL_API_KEY=your-key-here
   PORT=8787
   ```
4. **Run both the server and client**
   ```bash
   npm run dev
   ```
   - Backend: <http://localhost:8787>
   - Frontend: <http://localhost:5173> (proxies `/api` to the backend)
5. **Try it.** Open the frontend and click **Generate demo image**. You should
   see a real FLUX-generated image appear — proving submit → poll → download.

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run server + client together (hot reload) |
| `npm run dev:server` | Run only the Express backend |
| `npm run dev:client` | Run only the Vite frontend |
| `npm run build` | Typecheck the server and build the client |

## API routes (backend)

| Route | Purpose |
| --- | --- |
| `POST /api/generate` | Submit a FLUX generation/edit; returns `{ id, pollingUrl }` |
| `GET /api/status?pollingUrl=…` | Poll a job once; returns status + result URL when Ready |
| `GET /api/image?url=…` | Proxy-download a FLUX result image (defeats CORS + expiry) |

## Notes

- **Result URLs expire in ~10 minutes.** Always fetch generated images through
  `GET /api/image`, which downloads them server-side.
- The backend only follows BFL-owned (`*.bfl.ai`) URLs when polling or
  downloading images (an SSRF guard).
- Models, endpoints, and pricing live in `server/src/flux/models.ts`.
