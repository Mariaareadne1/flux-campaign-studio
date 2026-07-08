# FLUX Campaign Studio

An agentic product-to-campaign studio built on the [FLUX.2](https://bfl.ai) API.
Upload a product photo, type a plain-English goal, and watch an agent plan and
execute a sequence of FLUX.2 calls — generating, editing, and re-framing a full
campaign — live on an interactive canvas.

> 🚧 Work in progress. Setup and run instructions land at the end of Phase 0.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node + Express (TypeScript), a thin proxy to the FLUX API
- **Shared:** TypeScript types in `shared/` imported by both sides

## Why a backend?

FLUX generation is asynchronous (submit → poll a URL until ready → download the
result within 10 minutes), and FLUX delivery URLs do not support CORS. The
browser therefore cannot talk to FLUX directly — a backend proxy holds the API
key and fetches result images on the client's behalf.
