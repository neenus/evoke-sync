# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Evoke Sync is a MERN web application for Neenus Accounting to manage month-end invoice reconciliation for Evoke Learning (York Region and Consulting). It integrates with QuickBooks Online (QBO) Canadian edition — QBO is always the source of truth for invoice data. No CSV uploads, no billing sheet imports.

Hosted on Synology NAS via Docker Compose. Single user initially (Neenus), with employee access in Phase 2.

## Tech Stack

- **Frontend**: React (Vite), React Router, Axios, TailwindCSS, TipTap rich text editor
- **Backend**: Node.js + Express, MongoDB 7 + Mongoose
- **Auth**: bcryptjs + JWT in httpOnly cookie, QBO OAuth 2.0 (multi-company via `intuit-oauth`)
- **File parsing**: SheetJS (`xlsx`) for practitioner invoices, `exceljs` for export
- **Deployment**: Docker Compose (mongo, server on :5000, client on :3000)

## Git Setup

Initialize a monorepo at the project root before writing any code:

```bash
git init
git add .gitignore
git commit -m "chore: add .gitignore"
```

All commits must follow **Angular Conventional Commits**:
```
<type>(<scope>): <short summary>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `build`, `ci`
Scope examples: `auth`, `qbo`, `reconciliation`, `parser`, `export`, `ui`, `docker`

Examples:
```
feat(auth): add JWT middleware and admin seed on startup
feat(qbo): implement silent token refresh before every API call
fix(parser): handle decimal hour format in session length column
chore(docker): add docker-compose with mongo, server, and client services
```

**Never** include `Co-Authored-By`, `Co-authored-by`, or any AI attribution in commit messages.

## Development Commands

```bash
# Server (from server/)
npm run dev          # nodemon for hot reload

# Client (from client/)
npm run dev          # Vite dev server
npm run build        # production build

# Docker (from project root)
docker compose up --build   # build and start all services
docker compose down         # stop services
docker compose logs -f      # follow logs
```

## Build Order

Follow this sequence strictly — later steps depend on earlier ones:

1. Project scaffold (package.json, Dockerfiles, docker-compose.yml, .env.example, .gitignore) — commit after
2. MongoDB connection (`server/config/db.js`) — commit after
3. User auth — User model, JWT middleware, app auth routes, admin seed, Login page, PrivateRoute, useAuth hook — commit after full login → protected route → logout cycle verified
4. QBO OAuth — port from LedgerIQ project (multi-company token storage pattern) — commit after connect flow verified for both companies
5. QBO invoice fetch — `/api/qbo` routes, normalize invoice shape — commit after shape normalization confirmed
6. ReconciliationMonth model + `POST /api/reconciliation/start` — commit after
7. Billing notes endpoint — `PATCH /:id/notes` — commit after
8. Practitioner parser — `practitionerParser.js` + upload endpoint; test against real files — commit after verified against real practitioner Excel files
9. Reconciliation engine + description generator — wire `reconciliationService.js`, `descriptionGenerator.js`, `PATCH /:id/invoice/:invoiceNo` — commit after
10. Approval workflow — `ApprovalRecord` model, approve endpoint, awaiting_data guard — commit after
11. Excel export — `exceljs`, match existing Python tool colour scheme exactly — commit after
12. React frontend — Login → Dashboard → Reconciliation wizard → History → Settings — commit after each page/step is complete
13. Docker Compose deploy and end-to-end verification on Synology NAS — commit any fixes found during deploy

## Architecture

### API Structure
```
/api/auth/app        # Login, logout, me — app authentication
/api/auth/qbo        # QBO OAuth connect/callback/status/disconnect
/api/qbo             # Invoice fetch from QBO (JWT protected)
/api/reconciliation  # CRUD + approve + export (JWT protected)
/api/practitioners   # File upload + parse results (JWT protected)
```

### Service Layer (`server/services/`)
- **qboService.js** — QBO OAuth token management, auto-refresh before every API call, invoice normalization. Always include `minorversion=65` on every QBO request.
- **reconciliationService.js** — Core business logic: calculates `actualHours`, `actualAmount`, `delta`, `action` from session data; extracts practitioner name and insurance flag from QBO line descriptions using regex
- **practitionerParser.js** — Fault-tolerant SheetJS parser; scans for header row dynamically, handles multiple format variations, returns warnings instead of throwing
- **descriptionGenerator.js** — Generates QBO insurance receipt description strings from session group data; service type is mapped from QBO line description keywords

### Key Calculations (reconciliationService)
```
actualHours = sum of (sessionLength / 60) * sessionDates.length per sessionGroup
actualAmount = actualHours * rate
delta = actualAmount - amountBilled
action: actualHours===0 → "awaiting_data" | delta===0 → "no_change" | delta>0 → "additional_charge" | delta<0 → "credit_memo"
```

### Frontend Auth Flow
`App.jsx` calls `GET /api/auth/app/me` on mount → 401 redirects to `/login`. `PrivateRoute` wraps all non-login routes. JWT stored in httpOnly cookie only — never localStorage.

### Reconciliation Wizard (5 steps)
1. Setup — month/year/company picker, pull invoices from QBO
2. Billing Notes — TipTap WYSIWYG, auto-saves on blur
3. Upload Practitioner Invoices — drag-drop, parse, auto-match to invoice rows
4. Reconciliation View — grouped by practitioner, session groups editable, QBO descriptions auto-generated with copy button
5. Summary & Approval — aggregate totals, approve & lock, triggers Excel download

## Critical Constraints

**QBO Canadian API**: Always include `minorversion=65`. Do not assume US tax codes. Validate against production data, not just sandbox.

**Token refresh**: Must be completely silent — attempt refresh before surfacing any token expiry error to the user.

**Practitioner parser**: Never throw on bad rows. Always return what was parsed with `parseWarnings`. The user must be able to manually override any value.

**Immutable approved reconciliations**: Once `status === "approved"`, return 403 on any PATCH. Render everything read-only in the UI with a locked indicator.

**Approval guard**: `POST /:id/approve` must reject if any invoice rows have `action === "awaiting_data"`. Surface this warning in Step 5 UI before the user can attempt approval.

**Upsert practitioner uploads**: Re-uploading a practitioner file must overwrite, not duplicate (`PractitionerInvoice` upsert by practitionerName + month + year + reconciliationMonthId).

**Multi-company**: Both QBO companies belong to the same user. No role separation needed in Phase 1.

**Currency**: All values are CAD. Display with `$` prefix and 2 decimal places.

**JWT cookie**: `httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production.

**MongoDB credentials**: App connects via scoped credentials in `MONGO_URI`. Root credentials are for `mongo-init/init.js` only.

**Phase 2 out of scope**: Do not build QBO push/amendment endpoints. Design approval endpoint to be extensible (no hard-coded post-approval behaviour).

## Environment Variables

Copy `.env.example` to `.env`. Key vars:
```
NODE_ENV, PORT, APP_URL
JWT_SECRET, JWT_EXPIRY
ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME   # seeded on first run if no users exist
MONGO_INITDB_ROOT_USERNAME/PASSWORD/DATABASE, MONGO_URI
QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_ENVIRONMENT, QBO_MINOR_VERSION
```

Admin account is auto-seeded on startup if no users exist and env vars are set — no manual DB step needed.

## Excel Export Format

Four sheets in order: INSTRUCTIONS, NOTES (billing notes HTML → plain text, `<li>` → `• bullets`), one tab per practitioner, SUMMARY.

Colour scheme (match existing Python tool exactly):
- Dark blue headers: `#1F3864` | Mid blue subheaders: `#2E75B6` | Light blue: `#D6E4F0`
- No-change: bg `#E2EFDA` text `#375623` | Additional charge: bg `#FEF3DC` text `#8B4513` | Credit memo: bg `#FFDAD9` text `#833535`

## QBO Description Format

```
{serviceType} with {practitionerName} under direct supervision of {supervisorDetails}.
Dates of service: {sessionLength} minutes on each of {monthName} {dates}
```

Service type keyword mapping (check in order): "Reading" → "Reading Remediation", "Math Recovery"/"Math" → "Math Remediation", "ADHD"/"Executive" → "Executive Function Coaching", "Postsecondary"/default → "Academic Strategies".

Default supervisor: `Your Supervising Clinician Name, Credentials` (configurable in Settings).
