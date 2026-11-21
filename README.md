# Kosha : MoneyModel Coach

An active, AI-powered personal finance coach. Upload a messy bank statement and the app redacts sensitive details, categorizes every transaction, learns from your corrections, spots subscriptions and price hikes, warns you before you overspend, and coaches you in plain language, without ever recommending specific securities.

> Built for the Product Space problem statement "Personal finance coach with a living money model".

**Live demo:** `<your-vercel-url>`  |  **Repo:** `<your-repo-url>`

---

## Features

| Area | What it does |
|---|---|
| **Statement import** | Upload `.pdf`, `.xlsx`, `.csv` or paste transaction SMS. Parsed in memory, never stored. |
| **Privacy firewall** | Account numbers, IFSC codes, phone numbers, emails, PAN and card numbers are redacted before any AI call. |
| **Auto-categorization** | Your rules first, then a built-in merchant dictionary, then the LLM with a confidence score. Low confidence goes to a review queue. |
| **Correction loop** | Fix one category and choose to apply it to all similar transactions and future statements. The app learns the rule. |
| **Subscriptions** | Detects recurring payments, price hikes, new subscriptions and missing or unused charges. |
| **Budgets** | Monthly limits per category with live progress and month-end projection. |
| **Alerts and nudges** | Deduplicated, supportive nudges for price hikes, budget drift, upcoming renewals, unusual spending and goals at risk. |
| **Dashboard** | A plain-language home screen: safe-to-spend verdict, what needs attention, budgets, top spending, goals. Charts live under "See details". |
| **Coach** | Chat grounded in your real numbers. Educates and explains, with guardrails against stock, mutual fund and FD advice. |
| **Planner** | Goals, emergency fund tracker and a what-if simulator ("What if I cut food by 30%?"). All math is deterministic code. |
| **Monthly report** | Verified numbers plus a short AI-written narrative, printable as PDF. |

## Tech stack

- **Frontend and backend:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Recharts
- **Database and auth:** Supabase (Postgres, Auth, Realtime, Row Level Security)
- **AI:** Google Gemini, called only from server routes with structured, validated JSON output
- **Parsing:** pdf-parse, SheetJS (xlsx), papaparse
- **Validation and tests:** Zod, Vitest
- **Hosting:** Vercel

## How it works

```
Upload / SMS  ->  parse in memory  ->  redact PII  ->  categorize (rules > dictionary > LLM)
              ->  dedupe  ->  save  ->  detect subscriptions  ->  run alert engine
```

- The LLM never does arithmetic. Totals, budgets, projections and simulations are computed by code; the LLM only classifies merchants, parses wording, and writes explanations from verified numbers.
- Every request takes `user_id` from the authenticated session on the server, and every table is protected by Row Level Security.

## Security and privacy

- Uploaded statements are held in memory only. No disk, no object storage, no logs.
- PII is redacted before any text reaches the LLM or the database.
- API keys exist only in server-side environment variables.
- The Coach has two guardrail layers: a pre-check before the LLM and an output filter after it.
- The service role key is used only for the cron job and account deletion.

---

## Getting started (local)

### Prerequisites

- Node.js 20 or newer and npm (or pnpm)
- A free [Supabase](https://supabase.com) project
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)
- (Optional) Supabase CLI for applying migrations from the terminal

### 1. Clone and install

```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install
```

### 2. Create the database

Run the migrations in order, either with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

or by pasting each file into the Supabase **SQL Editor** and running it:

1. `supabase/migrations/001_core.sql`
2. `supabase/migrations/002_intelligence.sql`

### 3. Configure Supabase Auth

In the Supabase dashboard, go to **Authentication**:

- For a quick demo, turn off "Confirm email" (Sign In / Providers, Email).
- Under **URL Configuration**, set **Site URL** to `http://localhost:3000` for local work (you will add the Vercel URL later).

### 4. Set environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase, Project Settings, API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase, Project Settings, API | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, Project Settings, API | **No, server only** |
| `GEMINI_API_KEY` | Google AI Studio | **No, server only** |
| `CRON_SECRET` | You generate it (see below) | **No, server only** |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `true` to show the demo-data buttons | Yes |

Generate a `CRON_SECRET`:

```bash
openssl rand -hex 32
```

Never commit `.env.local`. Never put a secret in a variable that starts with `NEXT_PUBLIC_`.

### 5. Run it

```bash
npm run dev
```

Open `http://localhost:3000`, sign up, and either upload a statement or use **Settings, Load demo data**.

### 6. Run the tests

```bash
npm test
```

Tests cover redaction, statement parsing, SMS parsing, categorization order, recurring detection, alerts, the simulator, guardrails (including adversarial prompts) and row-level security isolation.

---

## Test data

Sample statements are provided for trying the import flow (fictional data):

| File | Purpose |
|---|---|
| `upload_A_debit_credit_columns.xlsx` | 6 months, separate debit and credit columns, planted price hikes, a duplicate pair and a large unusual purchase |
| `upload_B_signed_amount.xlsx` | Single signed amount column, text dates |
| `upload_C_messy_with_PII.xlsx` | Dr/Cr column, amounts like `1,24,500.00`, account numbers, phone numbers and emails to test redaction |
| `quick_test_1_new_user_SBI.xlsx` | 14 rows, a fresh account with no history |
| `quick_test_2_edge_cases.xlsx` | 15 rows including junk rows that should be dropped (expect 12 inserted, 3 dropped) |
| `bank_statement_test_data.xlsx` | All layouts plus an answer key and a dynamic summary |

Suggested order: import A, re-import A (expect zero new rows), then B and C. Use separate test accounts for A and B since their months overlap.

---

## Deploying to Vercel

### 1. Push the code to GitHub

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Confirm `.env.local` is not in the repo.

### 2. Import the project

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository.
2. Framework preset: **Next.js** (auto-detected). Leave build and output settings at their defaults.

### 3. Add environment variables

In **Project Settings, Environment Variables**, add every variable from the table above for the **Production** environment (and Preview if you use preview deployments):

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_DEMO_MODE`

Then click **Deploy**. Variables that start with `NEXT_PUBLIC_` are baked in at build time, so redeploy after changing them.

### 4. Point Supabase Auth at your Vercel URL

In Supabase, **Authentication, URL Configuration**:

- **Site URL:** `https://<your-project>.vercel.app`
- **Redirect URLs:** add `https://<your-project>.vercel.app/**` (and `http://localhost:3000/**` for local work)

Without this, sign-in redirects can fail in production.

### 5. Set up the daily job

The app has a protected endpoint, `/api/cron/daily`, that refreshes alerts for all users and generates monthly reports on the 1st. Add a `vercel.json` at the repo root:

```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "30 3 * * *" }
  ]
}
```

`30 3 * * *` runs at 03:30 UTC, which is 09:00 IST.

How it is secured:

- When `CRON_SECRET` is set, Vercel sends it automatically as `Authorization: Bearer <CRON_SECRET>` on a `GET` request.
- Make sure the route is a `GET` handler and checks that exact header, and rejects the request if the secret is missing:

```ts
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // run the daily job
}
```

Notes:

- Cron jobs run only on the production deployment, and are not triggered by `next dev`. To test locally, call the route yourself with the header.
- On the Hobby plan, cron jobs are limited in frequency (once per day) and in number, so keep it to one daily job.
- Even without cron, alerts still refresh after every import and when the dashboard is opened, so the app works if you skip this step.

### 6. Allow enough time for imports

Parsing and AI categorization can take longer than the default function timeout. In the import route (`app/api/ingest/route.ts`), set:

```ts
export const maxDuration = 60;
```

The maximum allowed depends on your Vercel plan, so check the current limits in the Vercel docs. If imports time out, the staged progress screen will show an error and offer a retry.

**Request size:** Vercel Functions limit the size of a request body (around 4.5 MB at the time of writing, check the docs). If large statements fail to upload in production, keep test files small or lower the app's file-size limit to match.

### 7. Verify the deployment

- [ ] Sign up and log in on the live URL
- [ ] Upload `quick_test_2_edge_cases.xlsx` and see: 12 inserted, 3 dropped
- [ ] Re-upload the same file and see zero new rows
- [ ] Fix a category and see the rule apply to similar transactions
- [ ] Open the Coach, ask for a stock tip, and see the polite refusal
- [ ] In the browser DevTools Network tab, confirm no API key appears in any request or response
- [ ] Call the cron route without the header and confirm it returns 401:
  ```bash
  curl -i https://<your-project>.vercel.app/api/cron/daily
  ```

### Updating the live app

Every push to `main` triggers a new production deployment. Pull requests get preview URLs (add them to the Supabase Redirect URLs if you want to log in on previews).

---

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| Login redirects to the wrong place in production | Supabase Site URL or Redirect URLs still point to localhost. Update them (step 4). |
| "Invalid API key" or empty data | A Supabase env var is missing or wrong in Vercel. Fix it and redeploy. |
| Import works locally but times out on Vercel | Increase `maxDuration` on the ingest route, or try a smaller file. |
| Large upload fails only in production | Request body size limit on Vercel Functions. Use a smaller file. |
| Coach or alerts show template text instead of AI text | `GEMINI_API_KEY` missing or rate-limited. The app falls back to template copy by design. |
| Users see each other's data | Migrations not applied or RLS disabled. Re-run both migration files and the RLS test. |
| Cron job never runs | It runs only on production, needs `vercel.json` committed, and a daily schedule on Hobby. |
| Scanned PDF rejected | Image-only PDFs are not supported. Upload the CSV or XLSX export instead. |
| `NEXT_PUBLIC_*` change has no effect | Those values are set at build time. Redeploy. |

## Three-minute demo script

1. **Sign up** and land on the dashboard: "Hello, <name>!" and the safe-to-spend sentence.
2. **Import** a messy statement and show the redaction note and the import summary.
3. **Re-import** the same file: zero duplicates.
4. **Fix one category**, apply it to all similar transactions, and watch the rule take effect.
5. **Alerts:** a subscription price hike and a budget warning appear in the bell.
6. **Coach:** ask "Where can I cut Rs 3,000?", then ask for a stock tip and show the refusal.
7. **Planner:** type "what if I cut dining out by 30%" and watch a goal date move.
8. **Report:** generate the monthly review.

## Known limitations

- Scanned (image-only) PDFs are not supported; use CSV or XLSX.
- SMS parsing covers common Indian bank and UPI formats; unusual formats fall back to the LLM.
- Auto-categorization is probabilistic; low-confidence rows are flagged for review.
- Cron frequency on Vercel's free plan is limited to once per day.

## Disclaimer

MoneyModel Coach provides educational cash-flow guidance only. It is not financial, investment, tax or legal advice, and it does not recommend specific stocks, mutual funds, ETFs, crypto assets, fixed deposits or insurance products.

