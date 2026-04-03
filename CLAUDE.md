# VeriBuy

> **Verify Before You Buy.**

VeriBuy is an AI-powered vehicle inspection and valuation platform built for used-car dealers. An inspector walks a vehicle using our guided workflow — snapping 21 photos, answering risk questions, confirming the VIN — and VeriBuy's intelligence engine returns a full condition report, fair acquisition price, recon estimate, and a buy/pass recommendation. Every number is auditable, every AI call has a deterministic fallback, and every report ships with a share link.

**Founded by Isaac** (isaac@notibuy.com)

---

## The VeriBuy Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | SSR, API routes, Vercel-native |
| Language | TypeScript 5 (strict) | Path alias: `@/*` -> `./src/*` |
| Frontend | React 19 | Concurrent features, functional components |
| Styling | Tailwind CSS 4 + PostCSS | Utility-first, no CSS modules |
| State (client) | Zustand | Sidebar, vehicle viewer stores |
| State (server) | TanStack Query v5 | Cache-first server data via tRPC |
| API | tRPC v11 | End-to-end type safety, SuperJSON transformer |
| Database | PostgreSQL 16 (Supabase) | JSONB for flexible inspection/risk data |
| ORM | Prisma 7.4 | Schema at `prisma/schema.prisma`, types at `src/generated/prisma` |
| Auth | Auth.js v5 (NextAuth) | Credentials provider, JWT sessions |
| Payments | Stripe v20 | Subscriptions + one-time inspection pack purchases |
| Storage | Supabase Storage | Photos, videos, generated PDFs |
| Email | Resend | Transactional: welcome, password reset, outcome follow-up |
| AI/Vision | OpenAI API (GPT-4o, GPT-4o-mini) | Damage detection, valuation, risk analysis |
| OCR | Tesseract.js | VIN extraction from photos |
| 3D | Three.js + React Three Fiber + Drei | Vehicle hotspot visualization |
| PDF | @react-pdf/renderer | Report generation (server-side) |
| Validation | Zod 4 | Shared client/server schemas |
| Icons | Lucide React | SVG icon library |

---

## Repo Layout

```
src/
  app/                    # Next.js App Router
    (admin)/              # Admin dashboard (dealer/user management)
    (auth)/               # Login, register, password reset
    (dashboard)/          # Main app: inspections, vehicles, reports, settings
    api/
      auth/[...nextauth]/ # NextAuth route handler
      trpc/[trpc]/        # tRPC endpoint
      cron/outcome-emails/ # Daily cron: purchase follow-up emails
      outcome/            # Outcome recording (bought/passed) via email link
      webhooks/stripe/    # Stripe webhook handler
  components/
    inspection/           # StepPanel, GuidedCapture, GuidedRiskCheck, RiskChecklist, FindingFromRisk
    report/               # MarketAnalysisSection, PhotoGallery, ReportModal
    layout/               # Navigation, sidebar, headers
    billing/              # Subscription/payment UI
    vehicle/              # Vehicle details, specs display
    ui/                   # Reusable primitives (buttons, cards, forms)
  lib/
    ai/                   # 15 AI valuation modules (see Intelligence Engine below)
    pdf/                  # report-template.tsx, generate-report.ts
    auth.ts, auth.config.ts
    stripe.ts, supabase.ts, openai.ts
    market-data.ts        # Orchestrator: fetches all pricing sources in parallel
    market-valuation.ts   # Condition/history multiplier math + price bands
    pricing-consensus.ts  # Weighted median consensus across sources
    blackbook.ts          # Black Book API integration
    nada-guides.ts        # NADA Guides API integration
    marketcheck.ts        # MarketCheck API (dealer inventory comps)
    vehicledatabases.ts   # VehicleDatabases API
    vinaudit.ts           # VinAudit API
    geo-pricing.ts        # State-level regional multipliers
    config-premiums.ts    # Trim/config premium lookup (diesel, manual, Raptor, etc.)
    nhtsa.ts              # NHTSA vPIC decode + complaints/recalls/investigations
    vehicle-models.ts     # Vehicle model utilities
    vehicle-archetypes.ts # Vehicle category classification
    vin-ocr.ts            # Tesseract VIN extraction
    risk-profiles.ts      # Risk profile DB queries + 3D hotspot conversion
    capture-prompts.ts    # Photo guidance per risk category
    confidence.ts         # Inspection confidence scoring
    scoring.ts            # 4-area condition scoring (0-100)
    email.ts              # Email templates (welcome, reset, outcome, upgrade)
    api-health.ts         # External API health checks
    utils.ts              # General utilities
  server/
    trpc/
      init.ts             # Context setup, procedure types (public/protected/manager/superAdmin)
      router.ts           # Root router combining all sub-routers
      procedures/
        auth.ts           # Login, register, session, roles, invites
        inspection.ts     # Core workflow (67KB - the heart of VeriBuy)
        vehicle.ts        # VIN decode, lookup, history, recalls
        report.ts         # Generate PDF, download, share, view shared
        media.ts          # Upload, process media
        billing.ts        # Pack purchases, subscriptions, portal
        admin.ts          # User/org management
  types/
    risk.ts               # AggregatedRisk, AIAnalysisResult, ConditionAssessment, RiskCheckStatus
    vehicle.ts            # Vehicle-related types
    next-auth.d.ts        # NextAuth session extension
  stores/
    sidebar-store.ts      # UI sidebar state
    vehicle-viewer-store.ts # 3D viewer state
  hooks/
    useMediaUpload.ts     # Media upload hook
  generated/
    prisma/               # Auto-generated Prisma client (do not edit)
prisma/
  schema.prisma           # Database schema (645 lines, 20+ models)
  migrations/             # Migration history
  seed.ts                 # Database seeding
landing-site/             # Separate Next.js app for marketing landing page
```

---

## Data Models

| Model | What it holds |
|-------|--------------|
| **Organization** | Multi-tenant container. Types: DEALER, INSPECTOR_FIRM, INSURANCE, INDIVIDUAL. Tracks subscription tier, Stripe billing, inspection limits, pricing preferences (target margin %, min profit/unit) |
| **User** | Auth.js compatible. Roles: SUPER_ADMIN, OWNER, MANAGER, INSPECTOR, VIEWER. Scoped to org |
| **Inspection** | Central workflow record. Statuses: CREATED -> VIN_DECODED -> RISK_REVIEWED -> MEDIA_CAPTURE -> AI_ANALYZED -> MARKET_PRICED -> REVIEWED -> COMPLETED. Stores 4 condition scores, purchase outcome |
| **InspectionStep** | Per-step data storage. Steps: MEDIA_CAPTURE, VIN_CONFIRM, AI_CONDITION_SCAN, RISK_INSPECTION, VEHICLE_HISTORY, MARKET_ANALYSIS, REPORT_GENERATION. Each has status + JSON data blob |
| **Vehicle** | VIN, year, make, model, trim, body style, drivetrain, engine, colors, NHTSA decode data (JSON) |
| **Finding** | Issues found during inspection. Severity: CRITICAL/MAJOR/MODERATE/MINOR/INFO. Categories: ENGINE, TRANSMISSION, BODY, etc. Includes repair cost range, 3D position, linked media |
| **MediaItem** | Photos/videos/audio. Supabase Storage. Includes EXIF, quality score, AI analysis results |
| **MarketAnalysis** | Full pricing output. Source estimates, consensus value, multipliers, recon costs, deal rating, auditor approval |
| **VehicleHistory** | Title status, accident count, owner count, structural/flood damage, recalls |
| **Report** | Generated PDF. Supabase URL, share token, expiry, view count |
| **ValuationLog** | AI module audit trail. Module name, model used, input/output, tier that succeeded |
| **InspectionPackPurchase** | One-time pack billing (1/3/10 inspections) |
| **RiskProfile** | Reference data: make/model/year -> known issues (JSON risk arrays) |

---

## The VeriBuy Inspection — 7 Steps

Every inspection follows this sequence. Each step persists its payload to `InspectionStep.data` (JSON).

### 1. MEDIA_CAPTURE — Guided Photo Capture
**21 standard photos**, 3 sections:
- **Exterior (9):** front, all four corners, both sides, rear, roof
- **Interior (5):** dashboard, odometer, front seats, rear seats, cargo
- **Mechanical (7):** engine bay, door jamb, undercarriage, all 4 tires

Full-screen guided walkthrough with auto-advance. Inspector notes with speech-to-text. All 21 required before proceeding.

### 2. VIN_CONFIRM — VIN Decode
- OCR extraction from door jamb photo via Tesseract
- Manual VIN input/correction
- NHTSA vPIC API decode (year, make, model, trim, body, drivetrain, engine, transmission)
- Creates/links Vehicle record
- **Triggers risk profile generation** — curated DB + NHTSA complaints/recalls/investigations + AI risk summarizer builds the vehicle's known-issues checklist

### 3. AI_CONDITION_SCAN — Vision Analysis
Runs in parallel:
- **4-area condition assessment** via OpenAI Vision: exterior body, interior, mechanical/visual, underbody/frame (1-10 per area, weighted to 0-100 overall)
- **Tire assessment** per wheel: tread depth, sidewall, GOOD/WORN/REPLACE
- **Unexpected issues scan**: AI flags damage not in the risk profile
- **Odometer extraction** from dashboard photo

### 4. RISK_INSPECTION — Questions-First Risk Check
**This is VeriBuy's newest major redesign.** Two paths:

**Questions-first (new):** Each risk has `inspectionQuestions` — yes/no questions the inspector answers. If all answers indicate no problem, the risk auto-marks as NOT_FOUND. If a failure answer is given, VeriBuy prompts for an evidence photo. Much faster than photographing everything.

**Legacy photo path:** Risks without `inspectionQuestions` use the old flow — take photos per risk, manually mark pass/fail.

**Statuses:** NOT_CHECKED, CONFIRMED, NOT_FOUND, UNABLE_TO_INSPECT

### 5. VEHICLE_HISTORY — History Pull
- VinAudit API (paid) or NHTSA (free) as fallback
- Collects: title status, accident count, owner count, structural/flood damage, open recalls

### 6. MARKET_ANALYSIS — The Intelligence Engine
The most complex step. Fetches 6 market data sources in parallel, runs through 11 AI modules, and produces: fair acquisition price, deal rating, recon estimate, price bands, and an audit result. See full pipeline below.

### 7. REPORT_GENERATION — PDF Report
- Assembles everything: scores, findings, risks, market analysis, photos
- Generates report number (`RPT-YYYY-#####`)
- Creates PDF via @react-pdf/renderer
- Uploads to Supabase, creates share token for public viewing

---

## The VeriBuy Intelligence Engine

All AI modules live in `src/lib/ai/`. This is VeriBuy's core differentiator — a multi-module valuation pipeline where every module is independently resilient and every price is auditable.

### The 3-Tier Reliability Pattern (`validate-and-retry.ts`)

Every AI module uses this. VeriBuy never silently fails.

- **Tier 1:** Primary AI call -> validate JSON fields -> if partial, surgical follow-up asking *only* for missing fields -> merge
- **Tier 2:** Simplified/different prompt, sometimes upgraded model (GPT-4o instead of mini). Single attempt.
- **Tier 3:** Emergency deterministic heuristic. Always produces a result. Always flagged in logs.

Every response carries metadata: `{ result, aiAnalyzed, fallbackTier: 1|2|3, retried, model, reasoning }`

### The Valuation Pipeline

```
                         MARKET DATA SOURCES
    ┌──────────┬──────────┬──────────┬──────────┬──────────┐
    │BlackBook │  VDB     │  NADA    │ VinAudit │MarketChk │
    │wholesale │12-tier   │retail +  │VIN-based │real dealer│
    │+ retail  │retail    │loan val  │mkt value │inventory │
    └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
         └──────────┴──────────┴──────────┴──────────┘
                              |
                              v
              source-normalizer (acquisition-cost lens)
              BB=wholesale adjust UP, MarketCheck=strip dealer markup
                              |
                              v
              consensus-weighter (AI-powered dynamic weights)
              Weighted median, outlier rejection (>40% dev = halved)
                              |
                              v
                    [ Base Consensus Value $ ]
                              |
                              v
              config-premium-analyzer (diesel/manual/4WD/Raptor/TRX)
              Market-aware, tracks premium compression over time
              Avoids double-counting (Raptor already includes 4WD)
                              |
                              v
              geo-pricing-analyzer (regional x0.85-1.20)
              Trucks premium in TX, sedans in CA, urban vs rural
                              |
                              v
                    [ Adjusted Base Value $ ]
                              |
                              v
              condition-adjuster (per-area condition impact)
              Mechanical > cosmetic on trucks; opposite on luxury
              7/10 at 120K miles = GOOD, 7/10 at 20K = concerning
                              |
                              v
              history-adjuster (title/accident/owner/flood multipliers)
              Salvage on truck != salvage on sedan
              Fender bender != frame damage
                              |
                              v
                    [ Value Before Recon $ ]
                              |
                              v
              recon-estimator (repair cost from confirmed findings)
              ZIP-based labor rates, overlapping labor deduction
                              |
                              v
              acquisition-adjuster (retail/wholesale -> true acquisition cost)
              Enthusiast platforms = tighter margins (87-95%)
                              |
                              v
              deal-rater (STRONG_BUY / FAIR_BUY / OVERPAYING / PASS)
              "200K miles on a diesel is mid-life, not high-mileage"
                              |
                              v
              price-auditor (final coherence gate)
              Catches misaligned modules, flags contradictions
                              |
                              v
                    [ Fair Acquisition Price + Audit Result ]
```

### Risk Intelligence Flow (Separate from pricing)

```
NHTSA Complaints/Recalls/Investigations + Curated Vehicle Risk DB
                              |
                              v
              risk-summarizer (GPT-4o-mini)
              Generates known-issues checklist with:
              - Yes/no inspection questions per risk
              - Cost tiers, component hints, photo prompts
              - Wayfinding directions for the inspector
                              |
                              v
          [ Aggregated Risk Profile per vehicle ]
                              |
                              v
              Inspector answers questions / captures evidence
                              |
                              v
              media-analyzer (GPT-4o Vision)
              Per-risk verdict: CONFIRMED / CLEARED / INCONCLUSIVE
              Processes 4 risks concurrently for speed
                              |
                              v
          [ Refined findings -> feeds into recon-estimator ]
```

---

## VeriBuy Market Data Sources

| Source | Endpoint | What VeriBuy gets |
|--------|---------|-------------------|
| **Black Book** | `service.blackbookcloud.com` | Wholesale + retail, condition-tiered (extra_clean/clean/average/rough) |
| **VehicleDatabases** | External API | 12 condition-tiered retail price points |
| **NADA Guides** | RapidAPI | Retail (3 tiers), trade-in (3 tiers), loan value |
| **VinAudit** | External API | VIN-based market value with mileage adjustment |
| **MarketCheck** | `/v2/search/car/active` | Real dealer inventory: active + sold listings, days-on-market |
| **AI Fallback** | GPT-4o | Backup when APIs fail — understands enthusiast markets (Raptors, Powerstrokes, etc.) |

**Default consensus weights:** BB=0.25, VDB=0.25, NADA=0.20, VinAudit=0.15, MarketCheck=0.10, Fallback=0.05

These are overridden by the AI consensus-weighter which assigns dynamic weights per vehicle based on source reliability for that specific type.

---

## Auth & Multi-Tenancy

- **Auth:** Credentials (email/password with bcrypt), JWT sessions with orgId + role
- **Roles:** SUPER_ADMIN > OWNER > MANAGER > INSPECTOR > VIEWER
- **All queries scoped to `orgId`** — strict tenant isolation
- **tRPC procedure types:**
  - `publicProcedure` — no auth
  - `protectedProcedure` — any authenticated user
  - `managerProcedure` — OWNER or MANAGER
  - `superAdminProcedure` — SUPER_ADMIN only

---

## VeriBuy Billing

**Subscription tiers:** BASE (25 inspections/mo), PRO (100/mo), ENTERPRISE (custom)

**One-time packs:** 1 ($39.99), 3 ($99.99), 10 ($249.99) inspections

**Dealer pricing preferences** (per org):
- `targetMarginPercent` — dealer's target gross margin
- `minProfitPerUnit` — minimum acceptable profit per vehicle

**Stripe webhooks:** checkout completion, invoice paid, subscription updates/cancellation, payment failures

---

## VeriBuy Comms

| Email | Trigger | Details |
|-------|---------|---------|
| Welcome | Registration | Includes temp password |
| Password Reset | Forgot password | 1-hour expiry link |
| Outcome Follow-up | Cron, 7 days post-completion | 2-button: "I Bought It" / "I Passed" — JWT tokens, 30-day expiry |
| Upgrade Request | User action | Sent to isaac@notibuy.com with org usage stats |

**Cron:** `/api/cron/outcome-emails` runs daily, batches up to 50, tracks `outcomeEmailSent` flag to prevent duplicates.

---

## Heavy Files (Handle With Care)

These are VeriBuy's most complex files — read before modifying:

| File | Size | What lives there |
|------|------|-----------------|
| `server/trpc/procedures/inspection.ts` | 67KB | The entire inspection workflow backend. The heart of VeriBuy. |
| `lib/ai/media-analyzer.ts` | 51KB | OpenAI Vision analysis engine |
| `components/inspection/StepPanel.tsx` | 38KB | Main inspection flow UI container |
| `lib/ai/risk-summarizer.ts` | 35KB | Risk profile generation from NHTSA + AI |
| `lib/pdf/report-template.tsx` | 31KB | React PDF report layout |
| `components/report/MarketAnalysisSection.tsx` | 27KB | Market data display (dual audience: dealer vs seller) |
| `components/inspection/GuidedRiskCheck.tsx` | 21KB | Questions-first risk inspection UI |
| `components/inspection/GuidedCapture.tsx` | 20KB | Guided photo capture walkthrough |
| `components/inspection/RiskChecklist.tsx` | 20KB | Risk checklist display |

---

## Development

```bash
npm run dev          # Start dev server
npm run build        # prisma generate + next build
npm run lint         # ESLint
```

**Required env vars** (`.env.local`): DATABASE_URL, NEXTAUTH_SECRET, OPENAI_API_KEY, STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, BLACKBOOK_API_KEY, NADA_RAPIDAPI_KEY, MARKETCHECK_API_KEY, VINAUDIT_API_KEY, NHTSA endpoints, CRON_SECRET.

**Database:** `npx prisma migrate dev` / `npx prisma db push`

**Prisma client:** Auto-generated on `postinstall` and before `build`. Output: `src/generated/prisma`

---

## VeriBuy Conventions

- **tRPC for all API calls** — no raw fetch to internal endpoints. Client uses `@trpc/react-query` hooks.
- **Zod schemas** shared between client form validation and tRPC input validation.
- **InspectionStep.data is JSON** — each step stores its own typed payload. See `src/types/risk.ts` for shapes.
- **Backward compatibility:** Codebase supports both `RISK_INSPECTION` (current) and `RISK_REVIEW` (legacy) step names. When querying risk data, check both.
- **AI modules are independent** — each can fail without blocking others. The 3-tier pattern guarantees every module always produces output (worst case: flagged heuristic).
- **ValuationLog** — every AI module call is logged with module name, model, inputs, outputs, and which tier succeeded. This is VeriBuy's audit trail.
- **Condition attenuation** — when a pricing source already accounts for condition (e.g., Black Book condition tiers), the condition multiplier is attenuated to avoid double-counting. Same for config premiums.
- **Inspection numbers:** `VB-YYYY-#####` (max existing + 1, collision fallback)
- **Report numbers:** `RPT-YYYY-#####`
- **Share tokens:** 16-byte random hex for public report viewing
- **MarketAnalysisSection `audience` prop:** `"dealer"` shows internal economics (margins, recon, acquisition cost), `"seller"` shows customer-facing pricing.

---

## Common Tasks

**Adding a new AI valuation module:**
1. Create file in `src/lib/ai/` following existing module patterns
2. Define: system prompt, user prompt builder, validation function, emergency heuristic
3. Use `callWithRetry()` from `validate-and-retry.ts` for the 3-tier pattern
4. Wire into the pipeline in `src/server/trpc/procedures/inspection.ts` (market analysis section)
5. Add ValuationLog entry for audit trail

**Adding a new inspection step:**
1. Add to `WorkflowStep` enum in `prisma/schema.prisma`
2. Run `prisma migrate dev`
3. Add step creation in `inspection.create` procedure
4. Add UI panel in `StepPanel.tsx`
5. Add server procedure for step completion

**Adding a new risk question format:**
- Risk questions live in the `inspectionQuestions` field of `AggregatedRisk` (see `src/types/risk.ts`)
- Each question has: `question`, `failureAnswer` ("yes" or "no"), `evidencePrompt`, `wayfinding`
- `GuidedRiskCheck` component renders them automatically

**Adding a new pricing data source:**
1. Create integration file in `src/lib/` (see `blackbook.ts` as template)
2. Return a `SourceEstimate` object with: source name, values, confidence, whether condition-tiered
3. Add to parallel fetch array in `market-data.ts`
4. Add default weight in `pricing-consensus.ts`
5. The AI consensus-weighter will automatically incorporate it
