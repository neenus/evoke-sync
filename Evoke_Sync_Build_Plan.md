# Evoke Sync App — Claude Code Build Plan

## Project Overview

A standalone MERN web application for Neenus Accounting to manage month-end
invoice reconciliation for Evoke Learning (York Region and Consulting).
The app integrates with QuickBooks Online (QBO) Canadian edition to pull
live invoice data directly — QBO is always the source of truth.
Parses practitioner session invoices, reconciles discrepancies, and generates
QBO-ready insurance receipt description strings.

**No CSV files. No billing sheet uploads. No correction logs.**
All invoice data comes directly from QBO via API.

Hosted on Synology NAS via Docker Compose. Single user for now (Neenus),
with employee access added in a later phase.

---

## Tech Stack

- **Frontend**: React (Vite), React Router, Axios, TailwindCSS
- **Rich text editor**: TipTap (`@tiptap/react`, `@tiptap/starter-kit`)
- **Backend**: Node.js, Express
- **Database**: MongoDB 7 with Mongoose (authentication enabled)
- **App auth**: bcryptjs, jsonwebtoken (httpOnly cookie)
- **QBO auth**: QBO OAuth 2.0 (multi-company)
- **File parsing**: xlsx (SheetJS) for practitioner invoice Excel files
- **Excel export**: exceljs
- **Deployment**: Docker Compose on Synology NAS

---

## Repository Structure

```
evoke-Sync/
├── mongo-init/
│   └── init.js                    # MongoDB user init — runs once on first start
├── client/                        # React frontend (Vite)
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.jsx
│       │   │   └── Sidebar.jsx
│       │   ├── reconciliation/
│       │   │   ├── MonthSelector.jsx
│       │   │   ├── InvoiceTable.jsx
│       │   │   ├── PractitionerUpload.jsx
│       │   │   ├── ReconciliationRow.jsx
│       │   │   ├── SummaryPanel.jsx
│       │   │   ├── ApprovalBlock.jsx
│       │   │   └── BillingNotesEditor.jsx
│       │   └── shared/
│       │       ├── StatusBadge.jsx
│       │       ├── FileDropZone.jsx
│       │       ├── PrivateRoute.jsx
│       │       └── ProgressBar.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Reconciliation.jsx
│       │   ├── History.jsx
│       │   └── Settings.jsx
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useQBO.js
│       │   └── useReconciliation.js
│       ├── utils/
│       │   └── formatters.js
│       ├── App.jsx
│       └── main.jsx
├── server/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   ├── auth.js                # JWT verification — protects all API routes
│   │   └── asyncHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── QBOToken.js
│   │   ├── ReconciliationMonth.js
│   │   ├── PractitionerInvoice.js
│   │   └── ApprovalRecord.js
│   ├── routes/
│   │   ├── appAuth.js             # Login / logout / me
│   │   ├── qboAuth.js             # QBO OAuth connect / callback / status
│   │   ├── qbo.js                 # QBO invoice fetch
│   │   ├── reconciliation.js
│   │   └── practitioners.js
│   ├── services/
│   │   ├── qboService.js
│   │   ├── reconciliationService.js
│   │   ├── practitionerParser.js
│   │   └── descriptionGenerator.js
│   └── index.js
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile.client
├── Dockerfile.server
└── README.md
```

---

## Environment Variables

Create `.env` in the project root. Never commit this file — only commit
`.env.example` with placeholder values. Ensure `.env` is in `.gitignore`.

```env
# ── App ────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=5000
APP_URL=http://your-nas-ip:3000

# ── JWT ─────────────────────────────────────────────────────────────────────
JWT_SECRET=your_long_random_jwt_secret
JWT_EXPIRY=8h

# ── Admin seed account (created on first run if no users exist) ─────────────
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme
ADMIN_NAME=Neenus

# ── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_INITDB_ROOT_USERNAME=your_db_username
MONGO_INITDB_ROOT_PASSWORD=changeme
MONGO_INITDB_DATABASE=your_database_name
MONGO_URI=mongodb://your_db_username:changeme@mongo:27017/your_database_name?authSource=evoke-sync

# ── QBO OAuth (Intuit Developer Portal) ─────────────────────────────────────
QBO_CLIENT_ID=your_intuit_client_id
QBO_CLIENT_SECRET=your_intuit_client_secret
QBO_REDIRECT_URI=http://your-nas-ip:5000/api/auth/qbo/callback
QBO_ENVIRONMENT=production
QBO_MINOR_VERSION=65
```

---

## Docker Compose

```yaml
version: '3.8'

services:
  mongo:
    image: mongo:7
    container_name: evoke-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: ${MONGO_INITDB_DATABASE}
    volumes:
      - mongo_data:/data/db
    networks:
      - evoke-net

  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    container_name: evoke-server
    restart: unless-stopped
    ports:
      - "5000:5000"
    env_file: .env
    depends_on:
      - mongo
    networks:
      - evoke-net

  client:
    build:
      context: .
      dockerfile: Dockerfile.client
    container_name: evoke-client
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - server
    networks:
      - evoke-net

volumes:
  mongo_data:

networks:
  evoke-net:
    driver: bridge
```

---

## MongoDB Schemas

### User
```js
{
  email: String,          // unique, lowercase, trimmed
  passwordHash: String,   // bcrypt hash — never store plain text
  name: String,           // display name e.g. "Neenus"
  role: String,           // "admin" | "employee" — for Phase 2 employee access
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### QBOToken
```js
{
  companyId: String,      // QBO realmId
  companyName: String,    // "Evoke York Region" | "Evoke Consulting"
  accessToken: String,
  refreshToken: String,
  tokenExpiry: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### ReconciliationMonth
```js
{
  month: String,          // "March"
  year: String,           // "2026"
  company: String,        // "york_region" | "consulting"
  status: String,         // "draft" | "in_progress" | "pending_approval" | "approved"
  billingNotesHtml: String, // Rich text HTML from TipTap WYSIWYG editor
  invoices: [
    {
      invoiceNo: String,
      clientName: String,
      practitioner: String,
      serviceType: String,
      hoursBilled: Number,
      rate: Number,
      amountBilled: Number,
      isInsurance: Boolean,
      actualHours: Number,
      actualAmount: Number,
      delta: Number,
      action: String,     // "no_change" | "additional_charge" | "credit_memo" | "awaiting_data"
      sessionGroups: [
        {
          sessionLength: Number,   // minutes
          sessionDates: [String],  // ["3", "8", "10"]
          qboDescription: String   // auto-generated insurance receipt string
        }
      ],
      parseWarnings: [String],     // surfaced from practitioner parser for this client
      notes: String
    }
  ],
  approvedBy: String,
  approvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### PractitionerInvoice
```js
{
  reconciliationMonthId: ObjectId,
  practitionerName: String,
  month: String,
  year: String,
  rawFileName: String,
  parsedSessions: [
    {
      clientName: String,
      sessionDate: String,
      sessionLength: Number,  // minutes
      billable: Boolean,
      notes: String
    }
  ],
  parseWarnings: [String],   // rows the parser could not confidently parse
  uploadedAt: Date
}
```

### ApprovalRecord
```js
{
  reconciliationMonthId: ObjectId,
  approvedBy: String,
  approvedAt: Date,
  totalBilled: Number,
  totalActual: Number,
  totalDelta: Number,
  actionsRequired: {
    additionalCharges: Number,
    creditMemos: Number,
    noChange: Number
  },
  notes: String
}
```

---

## API Endpoints

### App Auth Routes `/api/auth/app`
```
POST /login
     Body: { email, password }
     Validates credentials with bcrypt, returns JWT in httpOnly cookie
     Body response: { user: { name, email, role } }

POST /logout
     Clears the JWT httpOnly cookie
     Response: { message: "Logged out" }

GET  /me
     Returns current authenticated user from JWT
     Used by frontend on mount to check session validity
     Response: { user: { name, email, role } } or 401
```

### QBO Auth Routes `/api/auth/qbo`
```
GET  /connect/:company     Initiate QBO OAuth for a company
                           company: "york_region" | "consulting"
GET  /callback             OAuth callback — stores tokens in MongoDB
GET  /status               Returns connection status for both companies
POST /disconnect/:company  Revoke and delete tokens for a company
```

### QBO Routes `/api/qbo`
All routes protected by JWT auth middleware.
```
GET  /invoices/:company/:month/:year
     Pull all invoices from QBO for a given company and month
     Returns invoice array normalized to ReconciliationMonth invoice shape

GET  /invoice/:company/:invoiceNo
     Pull a single invoice by number
```

### Reconciliation Routes `/api/reconciliation`
All routes protected by JWT auth middleware.
```
POST /start
     Body: { company, month, year }
     Pulls invoices from QBO, creates ReconciliationMonth document
     Returns: { reconciliationMonthId }

GET  /history
     Returns list of all past reconciliation months (summary only)
     Sorted by year desc, month desc

GET  /:id
     Returns full reconciliation document by ID

PATCH /:id/notes
     Body: { billingNotesHtml }
     Saves TipTap HTML billing notes — callable any time before approval
     Returns: updated billingNotesHtml

PATCH /:id/invoice/:invoiceNo
     Body: { sessionGroups, notes }
     Updates session data for one invoice row
     Server recalculates: actualHours, actualAmount, delta, action,
     and all qboDescription strings
     Returns: updated invoice object

POST /:id/approve
     Body: { approvedBy, notes }
     Validates no invoices remain in "awaiting_data" state — reject if any do
     Sets status to "approved", creates ApprovalRecord
     Reconciliation is permanently read-only after this point
     Returns: ApprovalRecord

GET  /:id/export
     Generates and streams reconciliation Excel workbook (.xlsx)
     Format: INSTRUCTIONS tab, NOTES tab, one tab per practitioner,
     SUMMARY tab with sign-off block
     billingNotesHtml is stripped to plain text with bullets preserved
```

### Practitioners Routes `/api/practitioners`
All routes protected by JWT auth middleware.
```
POST /upload/:reconciliationMonthId
     Multipart form — accepts one or more practitioner Excel files
     Parses each file using practitionerParser service
     Upserts PractitionerInvoice documents (safe to re-upload)
     Automatically matches parsed sessions to invoice rows by client name
     Updates sessionGroups on matched invoice rows
     Returns: { parsed: [...], warnings: [...] }

GET  /parsed/:reconciliationMonthId
     Returns all parsed practitioner invoices for a month
     Grouped by practitioner name
```

---

## Service Layer

### qboService.js
Wraps the Intuit OAuth2 client. Port this directly from LedgerIQ.

Key responsibilities:
- Exchange authorization code for tokens
- Refresh expired tokens automatically and silently before every API call
- Store updated tokens back to MongoDB after each refresh
- Fetch invoices filtered by CustomerRef and TxnDate for a given month
- Normalize QBO invoice shape to internal ReconciliationMonth invoice shape

Use the `intuit-oauth` npm package for OAuth flow.
Use direct Axios calls to the QBO API v3 endpoint:
`https://quickbooks.api.intuit.com/v3/company/{realmId}/`

**Critical for Canadian QBO:**
- Always include `minorversion=65` on every API call
- Tax codes differ from US — do not assume TaxCodeRef values
- Use `CAD` as currency where required
- Token refresh must be completely silent — never surface a token expiry
  error to the user without first attempting a refresh automatically

### reconciliationService.js
Core business logic. Called server-side whenever session data is saved.

Calculations per invoice row:
- `actualHours` = sum across sessionGroups of: (sessionLength / 60) * sessionDates.length
- `actualAmount` = actualHours * rate
- `delta` = actualAmount - amountBilled
- `action`:
  - actualHours === 0 → "awaiting_data"
  - delta === 0 → "no_change"
  - delta > 0 → "additional_charge"
  - delta < 0 → "credit_memo"

Practitioner name extraction from QBO invoice line description:
```
/with ([A-Z][a-zA-Z\-]+(?: [A-Z][a-zA-Z\-]+)+) for the month/i
```

Insurance flag detection from QBO invoice line description:
```
/Insurance re[ck]ip[ie]t|Insurance receipt/i
```

### practitionerParser.js
Parses practitioner Excel invoices using SheetJS. Must be fault-tolerant —
never throw on bad rows, always return what was parsed with warnings.

**Parsing strategy:**
1. Scan all rows to find the header row — look for a row containing
   any of: "Date", "Client", "Student", "Duration", "Length", "Session"
2. Map column indices for: date, client name, session length/duration,
   billable flag, notes/description
3. For each data row after the header:
   - Classify as non-billable if notes column contains any of:
     "make-up", "makeup", "rescheduled", "non-billable", "no charge", "complimentary"
   - If no billable flag column exists, assume billable = true
4. Normalize session date to day-of-month integer (e.g. "March 3, 2026" → "3")
5. Normalize session length to minutes integer
6. Group sessions by clientName + sessionLength
7. Return parsedSessions array + parseWarnings for any row that
   could not be confidently parsed

**Known format variations to handle:**
- Duration column may be labelled "Duration", "Length", "Session Length", or "Min"
- Session length values may be "45 min", "45", "0:45", or "0.75" (decimal hours)
- Date column may contain full dates or day numbers only
- Billable flag may be Y/N, TRUE/FALSE checkbox, or absent entirely
- Non-billable sessions may be in a separate section below a divider row
- Client name may appear as "Last, First" or "First Last"

### descriptionGenerator.js
Generates QBO insurance receipt description strings.

Format — one string per session group:
```
{serviceType} with {practitionerName} under direct supervision of {supervisorDetails}.
Dates of service: {sessionLength} minutes on each of {monthName} {dates}
```

Where `{dates}` is a comma-separated, ascending sorted list of day numbers:
`3, 8, 10, 24, 30, 31`

`{supervisorDetails}` is configurable in Settings.
Default value: `Your Supervising Clinician Name, Credentials`

For clients with mixed session lengths, generate one description string per
session group. Store all strings in the sessionGroups array on the invoice row.

Service type mapping — check in this order against QBO line description:
- Contains "Reading" → "Reading Remediation"
- Contains "Math Recovery" → "Math Remediation"
- Contains "Math" → "Math Remediation"
- Contains "ADHD" or "Executive" → "Executive Function Coaching"
- Contains "Postsecondary" → "Academic Strategies"
- Default → "Academic Strategies"

---

## User Authentication

### Overview
Basic email + password login with JWT stored in an httpOnly cookie.
Single admin account seeded automatically on first run via environment
variables. Designed to support additional employee accounts in Phase 2
without schema or architectural changes.

### Admin Seed on Startup
On server start, check if any User documents exist in MongoDB.
If none exist and `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` are set
in the environment, create the admin account automatically.
If env vars are missing, log a warning but do not crash.
This means first deploy is zero-config — no manual database step required.

### Password Reset
No forgot-password flow — this is a single-user internal tool.
To reset the password: update `ADMIN_PASSWORD` in `.env` and delete
the existing User document, then restart the container. The seed logic
will recreate the account.

### JWT Configuration
- Stored in an httpOnly, sameSite=strict cookie — never in localStorage
- Expiry: 8 hours (covers a full working day)
- Secret: `JWT_SECRET` environment variable

### Auth Middleware (`server/middleware/auth.js`)
Verifies JWT from httpOnly cookie on every protected route.
Returns 401 if missing, expired, or invalid.
All `/api/reconciliation`, `/api/qbo`, `/api/practitioners`,
and `/api/auth/qbo` routes must be protected by this middleware.

### Frontend Auth Flow
- `App.jsx` calls `GET /api/auth/app/me` on mount
- If 401 → redirect to `/login`
- If valid → render the app with user context
- `PrivateRoute` wrapper component protects all routes except `/login`
- On JWT expiry → automatic redirect to `/login`
- `useAuth.js` hook provides `{ user, login, logout }` to all components

### Phase 2 — Employee Access
When ready to add employee accounts:
- Add `POST /api/auth/app/register` (admin only — creates new user)
- Add a Users management section to the Settings page
- Employee role: can view and enter reconciliation data, cannot approve
- Admin role: full access including approve and lock

---

## Frontend Pages

### Login (`/login`) — Public route
- Email and password inputs
- "Sign In" button
- Error message on invalid credentials: "Invalid email or password"
- Redirects to Dashboard on success
- Only public route in the app — all others require authentication

### Dashboard (`/`)
- QBO connection status cards for both companies
  (Evoke York Region · Evoke Consulting)
- Connect / Reconnect button per company
- "Begin Month-End Reconciliation" quick-start button
- Recent reconciliation history list (last 3 months) with status badges
- Logged-in user name displayed in navbar with logout button

### Reconciliation (`/reconciliation`) — 5-Step Wizard

**Step 1 — Setup**
- Month / year picker
- Company selector: York Region | Consulting | Both
- "Pull Invoices from QBO" button
- Live status indicator while invoices are being fetched from QBO

**Step 2 — Billing Notes**
- TipTap WYSIWYG rich text editor
- Toolbar supports: bullet list, ordered list, bold, italic, paragraph
- Label: "Month-End Notes & Changes from Evoke"
- Placeholder: "Enter any billing notes or changes Evoke communicated
  for this month — service endings, new students, schedule changes, etc."
- Auto-saves on blur via PATCH /:id/notes
- Notes are included in the NOTES tab of the Excel export as plain text
  with bullets preserved

**Step 3 — Upload Practitioner Invoices**
- Drag and drop zone — accepts multiple Excel files simultaneously
- Per-file upload progress indicator
- Per-file parse result: "✅ Parsed — X sessions" or "⚠️ X warnings"
- Warnings expandable inline — shows row number and description of issue
- Re-upload allowed at any time before approval (upserts, never duplicates)
- After upload, matched sessions automatically populate invoice rows

**Step 4 — Reconciliation View**
- Grouped by practitioner in accordion panels
- Each panel header shows practitioner totals: billed vs actual, net delta
- Each client row shows:
  - Invoice #, client name, service type
  - Hours billed (from QBO) vs actual hours (calculated)
  - Amount billed vs actual amount
  - Delta — colour coded (neutral = 0, orange = positive, red = negative)
  - Action badge: ✅ No Change | 🔶 Additional Charge | 🔴 Credit Memo | ⏳ Awaiting Data
- Session groups expandable per client:
  - Session length in minutes — editable
  - Session dates as comma-separated day numbers — editable
  - QBO description string — auto-generated, one-click copy to clipboard
- All fields manually overridable
- Changes auto-save on blur

**Step 5 — Summary & Approval**
- Full summary table across all practitioners and clients
- Aggregate totals: total billed, total actual, net delta
- Action counts: X additional charges, X credit memos, X no change, X awaiting
- Cannot approve if any rows remain in "awaiting_data" — show clear warning
- Notes field (plain text)
- "Approve & Lock" button
  - Calls POST /:id/approve
  - Reconciliation becomes permanently read-only
  - Triggers automatic Excel export download on approval

### History (`/history`)
- Full list of all past reconciliation months
- Filterable by: company, year, status
- Columns: month, company, status badge, total delta, approved by, approved date
- Click any row → read-only reconciliation detail view
- Download Excel export button per row

### Settings (`/settings`)
- **QBO Connections**: connect / disconnect / reconnect per company
- **Supervisor Details**: configurable string used in QBO description generation
  (label: "Supervising Clinician", default: "Your Supervising Clinician Name, Credentials")
- **Approver Name**: pre-fills the "Approved by" field on the approval block
- **Account**: display logged-in user name and email, change password form

---

## Excel Export

Generated by `GET /api/reconciliation/:id/export` using `exceljs`.
Streams the file directly to the browser as a download.

Sheet structure (in tab order):
1. **INSTRUCTIONS** — step-by-step guide for whoever completes the reconciliation
2. **📋 NOTES** — billing notes rendered from TipTap HTML to plain text,
   `<li>` items converted to `• bullet` lines, all other HTML tags stripped
3. **One tab per practitioner** — all reconciliation data shown as read-only,
   matching the format of the existing Python tool output
4. **✅ SUMMARY** — all practitioners consolidated into one view,
   aggregate totals row, supervisor sign-off block at the bottom

Colour scheme (match the existing Python tool exactly):
- Dark blue headers: `#1F3864`
- Mid blue subheaders: `#2E75B6`
- Light blue highlights: `#D6E4F0`
- Grey pre-loaded cells: `#F2F2F2`
- Pale blue input cells: `#EBF3FA`
- Green no-change action: background `#E2EFDA`, text `#375623`
- Orange additional charge: background `#FEF3DC`, text `#8B4513`
- Red credit memo: background `#FFDAD9`, text `#833535`

---

## Build Order

Build in this exact sequence to avoid dependency issues:

1. **Project scaffold**
   Full folder structure, `package.json` for both client and server,
   `Dockerfile.client`, `Dockerfile.server`, `docker-compose.yml`,
   `.env.example`, `.gitignore`, `README.md`, `mongo-init/init.js`

2. **MongoDB connection**
   `server/config/db.js` — connect using `MONGO_URI` from env,
   log success or fatal error on server start

3. **User auth**
   `User` model, bcrypt password hashing, JWT middleware,
   app auth routes (`/api/auth/app`), admin seed on startup,
   `Login.jsx` page, `PrivateRoute.jsx` wrapper, `useAuth.js` hook.
   Test full login → protected route → logout cycle before continuing.

4. **QBO OAuth**
   Port from LedgerIQ: `QBOToken` model, QBO auth routes (`/api/auth/qbo`),
   `qboService.js` token exchange, refresh, and storage.
   Test connect flow end-to-end for both companies.

5. **QBO invoice fetch**
   `qboService.js` invoice fetch methods, `/api/qbo` routes.
   Test against QBO sandbox — confirm invoice shape normalization.

6. **ReconciliationMonth model + start endpoint**
   `ReconciliationMonth` model, `POST /api/reconciliation/start` —
   pulls invoices from QBO and creates the document.

7. **Billing notes endpoint**
   `PATCH /api/reconciliation/:id/notes` — stores TipTap HTML string.

8. **Practitioner parser**
   `practitionerParser.js` + `POST /api/practitioners/upload`.
   Test against real practitioner Excel files before proceeding.
   Confirm session matching and upsert logic works correctly.

9. **Reconciliation engine + description generator**
   `reconciliationService.js`, `descriptionGenerator.js`,
   `PATCH /api/reconciliation/:id/invoice/:invoiceNo`.
   All three built and wired together in this step.

10. **Approval workflow**
    `ApprovalRecord` model, `POST /api/reconciliation/:id/approve`.
    Enforce awaiting_data guard. Make reconciliation read-only post-approval.

11. **Excel export**
    `GET /api/reconciliation/:id/export` using `exceljs`.
    Match formatting exactly to the existing Python tool output.

12. **React frontend**
    Build pages in this order:
    Login → Dashboard → Reconciliation wizard (all 5 steps) → History → Settings
    Install and configure TipTap in `BillingNotesEditor.jsx`.

13. **Docker Compose deploy**
    Build and test images locally first, then deploy to Synology NAS.
    Verify MongoDB auth, JWT flow, and QBO OAuth callback all work
    in the containerized environment before signing off.

---

## Important Notes for Claude Code

- **No CSV files, no billing sheet uploads** — all invoice data comes
  from QBO API directly. Do not build any file input for invoice data.

- **Port QBO OAuth from LedgerIQ** — do not rewrite from scratch.
  The multi-company token storage pattern from LedgerIQ applies directly.

- **Token refresh must be silent** — never surface a token expiry error
  to the user without first attempting a refresh automatically.

- **Practitioner parser must be fault-tolerant** — log warnings, never
  throw. The user must always be able to manually override any parsed value.

- **Reconciliation is re-runnable** — use upsert logic on `PractitionerInvoice`
  documents. Re-uploading a practitioner file must overwrite, not duplicate.

- **Approved reconciliations are immutable** — once status is "approved",
  no fields can be edited. Return 403 on any PATCH attempt. Render
  everything read-only in the UI with a clear locked indicator.

- **Approval guard** — `POST /:id/approve` must reject with a clear error
  if any invoice rows have `action === "awaiting_data"`. Surface this
  in the UI on Step 5 before the user attempts to approve.

- **Multi-company is not multi-tenant** — both QBO companies belong to
  the same user (Neenus). No user role separation is needed in Phase 1.

- **All monetary values are CAD** — display with `$` prefix and 2 decimal
  places throughout. No currency conversion needed.

- **Canadian QBO API** — always include `minorversion=65` on every request.
  Do not assume US tax code behaviour. Validate against real production
  data, not just sandbox, before considering the QBO integration complete.

- **httpOnly cookie for JWT** — never use localStorage for the JWT.
  Set `httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production.

- **MongoDB root credentials are not for the app** — the app connects
  only via `MONGO_URI` using the scoped `evoke_user` credentials.
  The root account is for MongoDB initialization only.

- **Never commit `.env`** — ensure `.gitignore` includes `.env` before
  the first commit. Only `.env.example` with placeholder values goes
  into version control.

- **Phase 2 (QBO push) is out of scope for this build** — do not build
  amendment push endpoints. Design the approval endpoint to be extensible
  (do not hard-code post-approval behaviour) so Phase 2 can be added
  without refactoring the approval flow.
