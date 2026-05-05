# Evoke Sync

Month-end invoice reconciliation for Evoke Learning (York Region and Consulting).
Pulls live invoice data from QuickBooks Online (Canadian edition) and generates QBO-ready insurance receipt descriptions.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + TipTap
- **Backend**: Node.js + Express + TypeScript
- **Database**: MongoDB 7
- **Deployment**: Docker Compose on Synology NAS

## Local Development

**Prerequisites**: Node.js 20+, MongoDB running locally or via Docker.

```bash
# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Install dependencies
cd server && npm install
cd ../client && npm install

# 3. Start server (port 5000)
cd server && npm run dev

# 4. Start client (port 3000)
cd client && npm run dev
```

## Type checking

```bash
cd server && npm run typecheck
cd client && npm run typecheck
```

## Docker (production)

```bash
docker compose up --build
```

Services:
- **mongo** — MongoDB 7 on default port (internal only)
- **server** — API on :5000
- **client** — Nginx serving React build on :3000

## Environment Variables

See `.env.example` for all required variables. Never commit `.env`.
