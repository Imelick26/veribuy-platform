# VeriBuy Platform — Technical Blueprint

**Version:** 1.0
**Date:** March 9, 2026
**Status:** Architecture Design

---

## 1. Recommended Tech Stack

### Frontend
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 15** (App Router) | Unifies frontend + API routes, SSR for SEO, Vercel-native deployment |
| UI Library | **React 19** | Already proven in demo; latest concurrent features |
| Styling | **Tailwind CSS 4** | Replaces inline styles; utility-first, responsive-native |
| State | **Zustand** (client) + **TanStack Query v5** (server) | Lightweight client state + cache-first server data |
| Forms | **React Hook Form** + **Zod** | Validation shared with backend schemas |
| 3D | **Three.js** + **React Three Fiber** | Keep existing 3D viz; R3F adds declarative React bindings |
| Charts | **Recharts** | Market data visualization, pricing charts |
| PDF | **@react-pdf/renderer** | Client-side report preview; server-side PDF generation |

### Backend
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| API | **Next.js Route Handlers** + **tRPC v11** | End-to-end type safety; auto-generated client |
| Runtime | **Node.js 22 LTS** | Stable, broad ecosystem |
| ORM | **Prisma 6** | Type-safe queries, migrations, seeding |
| Database | **PostgreSQL 16** (Supabase) | JSONB for flexible inspection data; PostGIS for dealer geo |
| Auth | **Auth.js v5** (NextAuth) | Multi-provider: email/password + Google SSO + dealer SSO |
| Storage | **AWS S3** + **CloudFront** | Media files (photos, video, audio) with CDN delivery |
| Queue | **Inngest** | Background jobs: image analysis, report generation, market fetch |
| Search | **PostgreSQL full-text** → **Typesense** (later) | Start simple; graduate to dedicated search when needed |
| Email | **Resend** | Transactional emails: reports, invitations, alerts |

### Infrastructure
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Hosting | **Vercel** (app) + **AWS** (media processing) | Vercel for Next.js; Lambda for heavy compute |
| CI/CD | **GitHub Actions** | Automated testing, preview deploys, migrations |
| Monitoring | **Sentry** + **Vercel Analytics** | Error tracking + performance monitoring |
| Logging | **Axiom** (via Vercel integration) | Structured logging with query |
| Secrets | **Vercel Environment Variables** + **AWS SSM** | Per-environment secret management |

### External APIs
| Service | Provider | Purpose |
|---------|----------|---------|
| VIN Decode | **NHTSA vPIC API** (free) | Year, make, model, trim, body style, drivetrain |
| Vehicle History | **Carfax API** or **AutoCheck** | Title, accidents, service history, recalls |
| Market Pricing | **MarketCheck API** or **Black Book** | Live comparable listings, wholesale values |
| Recalls | **NHTSA Recalls API** (free) | Open recall lookup by VIN |
| Image AI | **OpenAI Vision** or **Claude Vision** | Damage detection, paint analysis, component ID |
| Blockchain | **Polygon (MATIC)** | Report hash anchoring (low-cost L2) |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Dealer   │  │Inspector │  │  Buyer   │  │ Admin Dashboard  │   │
│  │  Web App │  │Mobile PWA│  │ Web App  │  │    (Internal)    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘   │
└───────┼──────────────┼──────────────┼───────────────┼──────────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Next.js)                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    tRPC Router                               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ auth.*   │ │vehicle.* │ │inspect.* │ │  report.*    │   │   │
│  │  │          │ │          │ │          │ │              │   │   │
│  │  │ login    │ │ decode   │ │ create   │ │ generate     │   │   │
│  │  │ register │ │ lookup   │ │ capture  │ │ download     │   │   │
│  │  │ session  │ │ history  │ │ finding  │ │ share        │   │   │
│  │  │ org      │ │ recalls  │ │ score    │ │ verify       │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │   │
│  │  │ market.* │ │ media.*  │ │ admin.*  │                    │   │
│  │  │          │ │          │ │          │                    │   │
│  │  │ comps    │ │ upload   │ │ users    │                    │   │
│  │  │ pricing  │ │ process  │ │ orgs     │                    │   │
│  │  │ trends   │ │ analyze  │ │ billing  │                    │   │
│  │  └──────────┘ └──────────┘ └──────────┘                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Auth.js  │  │  Prisma  │  │ Inngest  │  │   S3 Presigned   │   │
│  │Middleware│  │  Client  │  │  Client  │  │   URL Generator  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘   │
└───────┼──────────────┼──────────────┼───────────────┼──────────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA & SERVICES                                │
│                                                                     │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │   PostgreSQL 16   │  │    AWS S3        │  │   Inngest        │   │
│  │   (Supabase)      │  │  (Media Store)   │  │ (Job Queue)      │   │
│  │                   │  │                  │  │                  │   │
│  │ • Users & Orgs    │  │ • Vehicle Photos │  │ • Image Analysis │   │
│  │ • Vehicles        │  │ • Videos         │  │ • Report PDF Gen │   │
│  │ • Inspections     │  │ • Audio Files    │  │ • Market Fetch   │   │
│  │ • Findings        │  │ • Generated PDFs │  │ • History Pull   │   │
│  │ • Reports         │  │ • Report Assets  │  │ • Email Dispatch │   │
│  │ • Market Data     │  │                  │  │ • Hash Anchoring │   │
│  │ • Audit Logs      │  │                  │  │                  │   │
│  └──────────────────┘  └─────────────────┘  └──────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    EXTERNAL APIs                              │   │
│  │  ┌────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐ │   │
│  │  │ NHTSA  │ │  Carfax  │ │MarketCheck│ │  OpenAI Vision   │ │   │
│  │  │vPIC API│ │   API    │ │   API     │ │  (Damage Det.)   │ │   │
│  │  └────────┘ └──────────┘ └───────────┘ └──────────────────┘ │   │
│  │  ┌────────┐ ┌──────────┐ ┌───────────┐                      │   │
│  │  │NHTSA   │ │ Polygon  │ │  Resend   │                      │   │
│  │  │Recalls │ │Blockchain│ │  (Email)  │                      │   │
│  │  └────────┘ └──────────┘ └───────────┘                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Backend Services

### 3.1 Authentication & Authorization Service
```
auth.*
├── auth.register        — Create user + org (dealer, inspector, buyer)
├── auth.login           — Email/password or SSO
├── auth.session         — Get current session + permissions
├── auth.inviteUser      — Invite team member to org
├── auth.updateRole      — Change user role within org
└── auth.resetPassword   — Password reset flow
```

**Roles & Permissions:**
| Role | Scope | Can Do |
|------|-------|--------|
| `owner` | Organization | All actions, billing, invite users |
| `manager` | Organization | Create inspections, view all reports, manage team |
| `inspector` | Organization | Perform inspections, capture media, submit findings |
| `viewer` | Organization | Read-only access to reports |
| `buyer` | Self | View shared reports, request inspections |

### 3.2 Vehicle Intelligence Service
```
vehicle.*
├── vehicle.decode       — NHTSA VIN decode → specs
├── vehicle.lookup       — Find existing vehicle in DB by VIN
├── vehicle.history      — Pull Carfax/AutoCheck report
├── vehicle.recalls      — NHTSA recall lookup
├── vehicle.riskProfile  — Generate pre-inspection risk areas
└── vehicle.upsert       — Create or update vehicle record
```

**VIN Decode Pipeline:**
```
User enters VIN
  → Validate format (17 chars, check digit)
  → Check local cache (vehicles table)
  → If miss: call NHTSA vPIC API
  → Parse response: year, make, model, trim, body, drivetrain, engine
  → Cross-reference with known issue database
  → Return decoded vehicle + risk profile
```

### 3.3 Inspection Workflow Engine
```
inspect.*
├── inspect.create       — Start new inspection (VIN + inspector)
├── inspect.updateStep   — Advance workflow step
├── inspect.addFinding   — Record a finding with evidence
├── inspect.updateFinding — Edit finding details
├── inspect.removeFinding — Remove a finding
├── inspect.score        — Calculate/recalculate condition score
├── inspect.complete     — Finalize inspection
├── inspect.list         — List inspections (filtered, paginated)
└── inspect.get          — Get full inspection with all relations
```

**Workflow State Machine:**
```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
  ┌──────────┐   ┌─▼──────────┐   ┌──────────────┐   ┌──────────┴───┐
  │  CREATED  │──▶│VIN_DECODED │──▶│RISK_REVIEWED │──▶│MEDIA_CAPTURE │
  └──────────┘   └────────────┘   └──────────────┘   └──────┬───────┘
                                                             │
  ┌──────────┐   ┌────────────┐   ┌──────────────┐   ┌──────▼───────┐
  │COMPLETED │◀──│  REVIEWED  │◀──│MARKET_PRICED │◀──│   FINDINGS   │
  └──────────┘   └────────────┘   └──────────────┘   └──────────────┘
```

Each step records:
- Timestamp entered/exited
- User who performed it
- Data captured at that step
- Whether step was skipped (optional steps)

### 3.4 Media Processing Service
```
media.*
├── media.getUploadUrl   — Generate S3 presigned URL for direct upload
├── media.confirm        — Mark upload complete, trigger processing
├── media.analyze        — AI analysis of captured image
├── media.list           — List media for an inspection
├── media.get            — Get single media item + metadata
└── media.delete         — Soft-delete media item
```

**Upload Flow (Direct-to-S3):**
```
Client requests presigned URL
  → Server generates S3 PUT URL (5min expiry)
  → Client uploads directly to S3 (no server bottleneck)
  → Client confirms upload complete
  → Inngest job triggers:
    → Generate thumbnails (sharp)
    → AI damage analysis (OpenAI Vision)
    → Extract EXIF metadata
    → Update inspection media count
```

### 3.5 Market Intelligence Service
```
market.*
├── market.comps         — Pull comparable listings
├── market.adjust        — Calculate condition-adjusted price
├── market.recommend     — Generate acquisition recommendation
├── market.trends        — Historical pricing trends for make/model
└── market.refresh       — Force re-fetch market data
```

### 3.6 Report Generation Service
```
report.*
├── report.generate      — Create report from completed inspection
├── report.regenerate    — Regenerate with updated data
├── report.download      — Get PDF download URL
├── report.share         — Create share link (with optional password)
├── report.verify        — Verify blockchain hash
├── report.list          — List reports for org
└── report.get           — Get report with full data
```

**Generation Pipeline:**
```
Inspection marked complete
  → Inngest "report.generate" event fires
  → Aggregate: vehicle + findings + media + market + history
  → Calculate final scores and adjustments
  → Render PDF via @react-pdf/renderer (server-side)
  → Upload PDF to S3
  → Generate blockchain hash (Polygon)
  → Store report record with hash + S3 URL
  → Send notification email via Resend
```

---

## 4. Database Schema

### Entity Relationship Overview
```
Organization ──1:N──▶ User
Organization ──1:N──▶ Vehicle
Organization ──1:N──▶ Inspection
User ──1:N──────────▶ Inspection (as inspector)
Vehicle ──1:N───────▶ Inspection
Inspection ──1:N────▶ Finding
Inspection ──1:N────▶ MediaItem
Inspection ──1:N────▶ InspectionStep
Inspection ──1:1────▶ MarketAnalysis
Inspection ──1:1────▶ Report
Finding ──1:N───────▶ MediaItem (evidence photos)
Report ──1:1────────▶ BlockchainAnchor
```

### Prisma Schema

```prisma
// ─── Authentication & Multi-tenancy ───

model Organization {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique           // "premier_ford"
  type          OrgType                     // DEALER, INSPECTOR_FIRM, INSURANCE
  logo          String?
  address       String?
  city          String?
  state         String?
  zip           String?
  phone         String?
  website       String?
  subscription  SubscriptionTier @default(FREE)

  users         User[]
  vehicles      Vehicle[]
  inspections   Inspection[]
  reports       Report[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum OrgType {
  DEALER
  INSPECTOR_FIRM
  INSURANCE
  INDIVIDUAL
}

enum SubscriptionTier {
  FREE          // 5 inspections/month
  PRO           // 50 inspections/month
  ENTERPRISE    // Unlimited + API access
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  passwordHash  String?                     // null for SSO-only users
  avatar        String?
  role          UserRole @default(INSPECTOR)

  orgId         String
  org           Organization @relation(fields: [orgId], references: [id])

  inspections   Inspection[]               // inspections performed
  auditLogs     AuditLog[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastLoginAt   DateTime?

  @@index([orgId])
}

enum UserRole {
  OWNER
  MANAGER
  INSPECTOR
  VIEWER
}

// ─── Vehicle Intelligence ───

model Vehicle {
  id            String   @id @default(cuid())
  vin           String   @unique
  year          Int
  make          String
  model         String
  trim          String?
  bodyStyle     String?
  drivetrain    String?
  engine        String?
  transmission  String?
  exteriorColor String?
  interiorColor String?
  msrp          Int?                        // cents

  // Decoded data cache (NHTSA response)
  nhtsaData     Json?

  orgId         String
  org           Organization @relation(fields: [orgId], references: [id])

  inspections   Inspection[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([vin])
  @@index([orgId])
  @@index([make, model, year])
}

// ─── Inspection Workflow ───

model Inspection {
  id            String   @id @default(cuid())
  number        String   @unique           // "VB-2026-00142"
  status        InspectionStatus @default(CREATED)

  // Odometer at time of inspection
  odometer      Int?                        // miles
  location      String?                     // "Portland, OR"
  notes         String?

  // Condition scoring
  overallScore     Int?                     // 0-100
  structuralScore  Int?                     // 0-100
  cosmeticScore    Int?                     // 0-100
  electronicsScore Int?                     // 0-100

  // Relations
  vehicleId     String
  vehicle       Vehicle @relation(fields: [vehicleId], references: [id])

  inspectorId   String
  inspector     User @relation(fields: [inspectorId], references: [id])

  orgId         String
  org           Organization @relation(fields: [orgId], references: [id])

  steps         InspectionStep[]
  findings      Finding[]
  media         MediaItem[]
  marketAnalysis MarketAnalysis?
  vehicleHistory VehicleHistory?
  report        Report?

  startedAt     DateTime @default(now())
  completedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([orgId, status])
  @@index([vehicleId])
  @@index([inspectorId])
  @@index([number])
}

enum InspectionStatus {
  CREATED
  VIN_DECODED
  RISK_REVIEWED
  MEDIA_CAPTURE
  FINDINGS_RECORDED
  MARKET_PRICED
  REVIEWED
  COMPLETED
  CANCELLED
}

model InspectionStep {
  id            String   @id @default(cuid())
  step          WorkflowStep
  status        StepStatus @default(PENDING)
  data          Json?                       // step-specific payload

  inspectionId  String
  inspection    Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  enteredAt     DateTime?
  completedAt   DateTime?

  @@unique([inspectionId, step])
}

enum WorkflowStep {
  VIN_DECODE
  RISK_REVIEW
  MEDIA_CAPTURE
  PHYSICAL_INSPECTION
  VEHICLE_HISTORY
  MARKET_ANALYSIS
  REPORT_GENERATION
}

enum StepStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
}

// ─── Findings ───

model Finding {
  id            String   @id @default(cuid())
  severity      Severity
  category      FindingCategory
  title         String                      // "Head Gasket Compromised"
  description   String                      // detailed explanation
  evidence      String?                     // what was observed
  impact        String?                     // why it matters

  // Cost estimation
  repairCostLow   Int?                      // cents
  repairCostHigh  Int?                      // cents

  // Position on vehicle (for 3D viz)
  positionX     Float?
  positionY     Float?
  positionZ     Float?

  inspectionId  String
  inspection    Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  // Evidence photos linked to this finding
  media         MediaItem[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([inspectionId])
  @@index([severity])
}

enum Severity {
  CRITICAL
  MAJOR
  MODERATE
  MINOR
  INFO
}

enum FindingCategory {
  STRUCTURAL
  DRIVETRAIN
  ENGINE
  TRANSMISSION
  ELECTRICAL
  COSMETIC_EXTERIOR
  COSMETIC_INTERIOR
  ELECTRONICS
  SAFETY
  TIRES_WHEELS
  BRAKES
  SUSPENSION
  HVAC
  OTHER
}

// ─── Media ───

model MediaItem {
  id            String   @id @default(cuid())
  type          MediaType
  captureType   CaptureType?               // which capture step

  // S3 storage
  s3Key         String                      // "orgs/abc/inspections/xyz/front-center.jpg"
  s3Bucket      String @default("veribuy-media")
  url           String                      // CloudFront URL
  thumbnailUrl  String?

  // Metadata
  mimeType      String                      // "image/jpeg"
  sizeBytes     Int
  width         Int?
  height        Int?
  durationMs    Int?                        // for video/audio
  exifData      Json?

  // AI Analysis results
  qualityScore  Int?                        // 0-100
  aiAnalysis    Json?                       // damage detection results

  inspectionId  String
  inspection    Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  findingId     String?                     // optional: evidence for a finding
  finding       Finding? @relation(fields: [findingId], references: [id])

  createdAt     DateTime @default(now())

  @@index([inspectionId])
  @@index([findingId])
}

enum MediaType {
  PHOTO
  VIDEO
  AUDIO
}

enum CaptureType {
  FRONT_CENTER
  FRONT_34_DRIVER
  DRIVER_SIDE
  REAR_34_DRIVER
  REAR_CENTER
  PASSENGER_SIDE
  ENGINE_BAY
  UNDER_HOOD_LABEL
  WALKAROUND_VIDEO
  ENGINE_AUDIO
  INTERIOR_WALKTHROUGH
  FINDING_EVIDENCE
  OTHER
}

// ─── Market Intelligence ───

model MarketAnalysis {
  id              String   @id @default(cuid())

  // Comparable listings
  comparables     Json                      // array of { source, avgPrice, listings, market }

  // Pricing
  baselinePrice   Int                       // cents — wholesale clean baseline
  adjustments     Json                      // array of { reason, amount }
  adjustedPrice   Int                       // cents — final recommended max

  // Recommendation
  recommendation  BuyRecommendation
  strongBuyMax    Int                       // cents
  fairBuyMax      Int                       // cents

  // Profit projection
  estRetailPrice  Int?                      // cents
  estReconCost    Int?                      // cents
  estGrossProfit  Int?                      // cents

  inspectionId    String @unique
  inspection      Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  fetchedAt       DateTime @default(now())

  @@index([inspectionId])
}

enum BuyRecommendation {
  STRONG_BUY
  FAIR_BUY
  OVERPAYING
  PASS
}

// ─── Vehicle History ───

model VehicleHistory {
  id              String   @id @default(cuid())

  provider        String                    // "carfax" | "autocheck"
  titleStatus     String                    // "Clean" | "Salvage" | etc.
  accidentCount   Int @default(0)
  serviceRecords  Int @default(0)
  ownerCount      Int?

  structuralDamage Boolean @default(false)
  floodDamage      Boolean @default(false)

  // Full report data
  rawData         Json?

  // Recalls
  recalls         Json?                     // array of { id, description, status }
  openRecallCount Int @default(0)

  inspectionId    String @unique
  inspection      Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  fetchedAt       DateTime @default(now())
}

// ─── Reports ───

model Report {
  id              String   @id @default(cuid())
  number          String   @unique         // "RPT-2026-00142"

  // Generated PDF
  pdfS3Key        String?
  pdfUrl          String?

  // Sharing
  shareToken      String?  @unique         // public share URL token
  sharePassword   String?                  // optional password hash
  shareExpiresAt  DateTime?
  viewCount       Int @default(0)

  // Blockchain
  blockchainHash  String?                  // "0xf8c2...9a41"
  blockchainTxId  String?
  anchoredAt      DateTime?

  inspectionId    String @unique
  inspection      Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  orgId           String
  org             Organization @relation(fields: [orgId], references: [id])

  generatedAt     DateTime @default(now())

  @@index([shareToken])
  @@index([orgId])
}

// ─── Audit Trail ───

model AuditLog {
  id            String   @id @default(cuid())
  action        String                      // "inspection.created", "finding.added"
  entityType    String                      // "Inspection", "Finding", "Report"
  entityId      String
  metadata      Json?                       // action-specific details

  userId        String
  user          User @relation(fields: [userId], references: [id])

  createdAt     DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt])
}

// ─── Risk Intelligence (Pre-populated Reference Data) ───

model RiskProfile {
  id            String   @id @default(cuid())

  // Vehicle matching criteria
  make          String
  model         String
  yearFrom      Int
  yearTo        Int
  engine        String?                     // specific engine variant

  // Risk data
  risks         Json                        // array of risk objects
  // Each risk: { severity, title, cost, description, impact, symptoms, position }

  source        String                      // "NHTSA_TSB", "OWNER_REPORTS", "VERIBUY_DATA"

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([make, model])
}
```

---

## 5. Inspection Workflow Engine Design

### 5.1 Workflow Configuration

The workflow engine is **configurable per organization**. Dealers may skip Vehicle History; insurance inspectors may require every step.

```typescript
// src/server/workflow/config.ts

export interface WorkflowConfig {
  steps: StepConfig[];
  scoring: ScoringConfig;
  requiredMedia: CaptureType[];
}

export interface StepConfig {
  step: WorkflowStep;
  required: boolean;
  autoAdvance: boolean;     // auto-advance when data is complete
  validations: Validation[];
}

export const DEFAULT_DEALER_WORKFLOW: WorkflowConfig = {
  steps: [
    { step: 'VIN_DECODE',          required: true,  autoAdvance: true,  validations: ['vin_valid'] },
    { step: 'RISK_REVIEW',         required: false, autoAdvance: false, validations: [] },
    { step: 'MEDIA_CAPTURE',       required: true,  autoAdvance: false, validations: ['min_photos_6'] },
    { step: 'PHYSICAL_INSPECTION', required: true,  autoAdvance: false, validations: ['min_findings_0'] },
    { step: 'VEHICLE_HISTORY',     required: false, autoAdvance: true,  validations: [] },
    { step: 'MARKET_ANALYSIS',     required: true,  autoAdvance: true,  validations: [] },
    { step: 'REPORT_GENERATION',   required: true,  autoAdvance: true,  validations: [] },
  ],
  scoring: {
    weights: { structural: 0.45, cosmetic: 0.30, electronics: 0.25 },
    deductions: { CRITICAL: 30, MAJOR: 15, MODERATE: 7, MINOR: 3 },
  },
  requiredMedia: [
    'FRONT_CENTER', 'FRONT_34_DRIVER', 'DRIVER_SIDE',
    'REAR_34_DRIVER', 'REAR_CENTER', 'PASSENGER_SIDE',
  ],
};
```

### 5.2 Condition Scoring Algorithm

```typescript
// src/server/workflow/scoring.ts

export function calculateConditionScore(
  findings: Finding[],
  config: ScoringConfig
): ScoreResult {
  const categories = {
    structural: 100,
    cosmetic: 100,
    electronics: 100,
  };

  for (const f of findings) {
    const deduction = config.deductions[f.severity];
    const cat = mapCategoryToBucket(f.category);
    categories[cat] = Math.max(0, categories[cat] - deduction);
  }

  const overall = Math.round(
    categories.structural * config.weights.structural +
    categories.cosmetic * config.weights.cosmetic +
    categories.electronics * config.weights.electronics
  );

  return {
    overall,
    structural: categories.structural,
    cosmetic: categories.cosmetic,
    electronics: categories.electronics,
  };
}
```

### 5.3 Step Transition Logic

```typescript
// src/server/workflow/engine.ts

export class WorkflowEngine {
  async advanceStep(inspectionId: string, completedStep: WorkflowStep) {
    const inspection = await this.getInspection(inspectionId);
    const config = await this.getWorkflowConfig(inspection.orgId);

    // Validate current step is complete
    const stepConfig = config.steps.find(s => s.step === completedStep);
    await this.runValidations(inspection, stepConfig.validations);

    // Mark step complete
    await this.markStepComplete(inspectionId, completedStep);

    // Find next step
    const nextStep = this.getNextStep(config, completedStep);
    if (!nextStep) {
      // All steps done → complete inspection
      await this.completeInspection(inspectionId);
      return;
    }

    // Auto-advance if configured
    if (nextStep.autoAdvance) {
      await this.executeStep(inspectionId, nextStep.step);
    }

    // Update inspection status
    await this.updateStatus(inspectionId, nextStep.step);
  }
}
```

---

## 6. Media Storage Architecture

### 6.1 S3 Bucket Structure
```
veribuy-media/
├── orgs/
│   └── {orgId}/
│       └── inspections/
│           └── {inspectionId}/
│               ├── photos/
│               │   ├── front-center.jpg
│               │   ├── front-center-thumb.jpg     (320px)
│               │   ├── front-34-driver.jpg
│               │   ├── front-34-driver-thumb.jpg
│               │   └── ...
│               ├── video/
│               │   ├── walkaround.mp4
│               │   └── interior.mp4
│               ├── audio/
│               │   └── engine.webm
│               └── evidence/
│                   ├── finding-{id}-1.jpg
│                   └── finding-{id}-2.jpg
├── reports/
│   └── {reportId}/
│       └── report.pdf
└── public/
    └── models/
        └── vehicles/
            ├── bronco-sport.glb
            └── ...
```

### 6.2 Upload Pipeline

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Client   │────▶│ API: media.  │────▶│  S3 Presign │
│  Request  │     │ getUploadUrl │     │  Generator  │
└──────────┘     └──────────────┘     └──────┬──────┘
                                              │
                        Presigned PUT URL ◀───┘
                                │
┌──────────┐                    ▼
│  Client   │──── Direct PUT ──▶ S3
│  Upload   │                    │
└──────────┘                    │
                                ▼
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Client   │────▶│ API: media.  │────▶│   Inngest   │
│  Confirm  │     │   confirm    │     │  Job Queue  │
└──────────┘     └──────────────┘     └──────┬──────┘
                                              │
                   ┌──────────────────────────┤
                   ▼              ▼            ▼
              ┌─────────┐  ┌──────────┐  ┌──────────┐
              │Thumbnail│  │ AI Vision│  │  EXIF    │
              │ (sharp) │  │ Analysis │  │ Extract  │
              └─────────┘  └──────────┘  └──────────┘
```

### 6.3 AI Image Analysis

```typescript
// src/server/media/analyze.ts

export async function analyzeVehiclePhoto(
  imageUrl: string,
  captureType: CaptureType,
  vehicleInfo: { make: string; model: string; year: number }
): Promise<ImageAnalysis> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyze this ${captureType} photo of a ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}.
                 Identify: 1) Any visible damage, 2) Paint condition, 3) Panel alignment,
                 4) Rust or corrosion, 5) Tire condition (if visible).
                 Rate photo quality 0-100. Return JSON.`
        },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }],
    response_format: { type: "json_object" }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

---

## 7. VIN Decoding System

### 7.1 NHTSA vPIC Integration

```typescript
// src/server/vehicle/vin-decoder.ts

const NHTSA_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

export async function decodeVin(vin: string): Promise<DecodedVehicle> {
  // Step 1: Validate VIN format
  if (!isValidVin(vin)) throw new Error("Invalid VIN format");

  // Step 2: Check local cache
  const cached = await db.vehicle.findUnique({ where: { vin } });
  if (cached?.nhtsaData) return mapNhtsaToVehicle(cached);

  // Step 3: Call NHTSA API
  const res = await fetch(
    `${NHTSA_BASE}/DecodeVinValues/${vin}?format=json`
  );
  const data = await res.json();
  const result = data.Results[0];

  // Step 4: Extract key fields
  const decoded: DecodedVehicle = {
    vin,
    year: parseInt(result.ModelYear),
    make: result.Make,
    model: result.Model,
    trim: result.Trim || null,
    bodyStyle: result.BodyClass,
    drivetrain: result.DriveType,
    engine: `${result.DisplacementL}L ${result.EngineConfiguration} ${result.FuelTypePrimary}`,
    transmission: result.TransmissionStyle,
    doors: parseInt(result.Doors) || null,
    gvwr: result.GVWR,
  };

  // Step 5: Enrich with risk profile
  decoded.riskProfile = await getRiskProfile(decoded);

  // Step 6: Fetch open recalls
  decoded.recalls = await getRecalls(vin);

  return decoded;
}

// NHTSA Recalls API
async function getRecalls(vin: string): Promise<Recall[]> {
  const res = await fetch(
    `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${vin}`
  );
  const data = await res.json();
  return data.results.map(r => ({
    nhtsaCampaignNumber: r.NHTSACampaignNumber,
    component: r.Component,
    summary: r.Summary,
    consequence: r.Consequence,
    remedy: r.Remedy,
  }));
}
```

### 7.2 VIN Validation

```typescript
// src/server/vehicle/vin-validator.ts

const TRANSLITERATION: Record<string, number> = {
  A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,
  J:1,K:2,L:3,M:4,N:5,P:7,R:9,
  S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,
};
const WEIGHTS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

export function isValidVin(vin: string): boolean {
  if (vin.length !== 17) return false;
  if (/[IOQ]/i.test(vin)) return false;   // I, O, Q not allowed

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i].toUpperCase();
    const val = /\d/.test(c) ? parseInt(c) : TRANSLITERATION[c];
    if (val === undefined) return false;
    sum += val * WEIGHTS[i];
  }

  const checkDigit = sum % 11;
  const expected = checkDigit === 10 ? 'X' : String(checkDigit);
  return vin[8].toUpperCase() === expected;
}
```

### 7.3 Risk Profile Database

Pre-populated from NHTSA TSBs, owner complaints, and recall data:

```typescript
// Seeded per make/model/year range
const BRONCO_SPORT_RISKS = [
  {
    severity: "CRITICAL",
    title: "Head Gasket / Coolant Intrusion",
    description: "1.5L EcoBoost prone to head gasket failure...",
    cost: { low: 2800, high: 4200 },
    source: "NHTSA_TSB",
    tsb: "TSB-24-2399",
    position: { x: 0.1, y: 0.3, z: 0 },
    symptoms: ["White exhaust smoke", "Coolant loss", "Overheating"],
  },
  // ... 15 more risk items
];
```

---

## 8. Report Generation Pipeline

### 8.1 Report Data Assembly

```typescript
// src/server/report/assemble.ts

export async function assembleReportData(inspectionId: string): Promise<ReportData> {
  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      vehicle: true,
      findings: { include: { media: true }, orderBy: { severity: 'asc' } },
      media: true,
      marketAnalysis: true,
      vehicleHistory: true,
      inspector: true,
      org: true,
    },
  });

  return {
    reportNumber: generateReportNumber(),    // "RPT-2026-00142"
    generatedAt: new Date(),

    // Vehicle
    vehicle: {
      vin: inspection.vehicle.vin,
      year: inspection.vehicle.year,
      make: inspection.vehicle.make,
      model: inspection.vehicle.model,
      trim: inspection.vehicle.trim,
      odometer: inspection.odometer,
    },

    // Scores
    condition: {
      overall: inspection.overallScore,
      structural: inspection.structuralScore,
      cosmetic: inspection.cosmeticScore,
      electronics: inspection.electronicsScore,
    },

    // Findings
    findings: inspection.findings.map(f => ({
      severity: f.severity,
      title: f.title,
      description: f.description,
      repairCost: { low: f.repairCostLow, high: f.repairCostHigh },
      evidencePhotos: f.media.map(m => m.url),
    })),

    // Market
    market: inspection.marketAnalysis ? {
      comparables: inspection.marketAnalysis.comparables,
      adjustedPrice: inspection.marketAnalysis.adjustedPrice,
      recommendation: inspection.marketAnalysis.recommendation,
    } : null,

    // History
    history: inspection.vehicleHistory ? {
      titleStatus: inspection.vehicleHistory.titleStatus,
      accidents: inspection.vehicleHistory.accidentCount,
      recalls: inspection.vehicleHistory.recalls,
    } : null,

    // Meta
    inspector: inspection.inspector.name,
    organization: inspection.org.name,
    heroImage: inspection.media.find(m => m.captureType === 'FRONT_CENTER')?.url,
  };
}
```

### 8.2 PDF Rendering

```typescript
// src/server/report/pdf.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument } from './ReportDocument';

export async function generatePdf(data: ReportData): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <ReportDocument data={data} />
  );
  return buffer;
}

// Upload to S3 and return URL
export async function generateAndStore(inspectionId: string): Promise<string> {
  const data = await assembleReportData(inspectionId);
  const pdfBuffer = await generatePdf(data);

  const s3Key = `reports/${data.reportNumber}/report.pdf`;
  await s3.putObject({
    Bucket: 'veribuy-media',
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  });

  const url = `https://cdn.veribuy.com/${s3Key}`;

  // Store report record
  await db.report.create({
    data: {
      number: data.reportNumber,
      pdfS3Key: s3Key,
      pdfUrl: url,
      inspectionId,
      orgId: data.orgId,
    },
  });

  return url;
}
```

### 8.3 Blockchain Anchoring

```typescript
// src/server/report/blockchain.ts
import { ethers } from 'ethers';
import { createHash } from 'crypto';

export async function anchorReport(reportId: string, pdfBuffer: Buffer) {
  // SHA-256 hash of the PDF
  const hash = createHash('sha256').update(pdfBuffer).digest('hex');
  const hashBytes = '0x' + hash;

  // Submit to Polygon
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const wallet = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, provider);

  const tx = await wallet.sendTransaction({
    to: process.env.VERIBUY_ANCHOR_CONTRACT,
    data: ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'string'],
      [hashBytes, reportId]
    ),
  });

  await tx.wait();

  // Update report with blockchain data
  await db.report.update({
    where: { id: reportId },
    data: {
      blockchainHash: hashBytes,
      blockchainTxId: tx.hash,
      anchoredAt: new Date(),
    },
  });
}
```

---

## 9. Project Structure

```
veribuy-platform/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx            # Authenticated layout
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── inspections/
│   │   │   │   ├── page.tsx          # List inspections
│   │   │   │   ├── new/page.tsx      # Start new inspection
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx      # Inspection detail
│   │   │   │       ├── capture/page.tsx
│   │   │   │       ├── findings/page.tsx
│   │   │   │       └── report/page.tsx
│   │   │   ├── vehicles/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       ├── team/page.tsx
│   │   │       └── billing/page.tsx
│   │   ├── share/
│   │   │   └── [token]/page.tsx      # Public report view
│   │   ├── api/
│   │   │   └── trpc/[trpc]/route.ts  # tRPC handler
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── server/                       # Server-only code
│   │   ├── db.ts                     # Prisma client singleton
│   │   ├── trpc/
│   │   │   ├── router.ts            # Root tRPC router
│   │   │   ├── context.ts           # Request context (auth, db)
│   │   │   └── procedures/
│   │   │       ├── auth.ts
│   │   │       ├── vehicle.ts
│   │   │       ├── inspection.ts
│   │   │       ├── finding.ts
│   │   │       ├── media.ts
│   │   │       ├── market.ts
│   │   │       └── report.ts
│   │   ├── workflow/
│   │   │   ├── engine.ts            # Workflow state machine
│   │   │   ├── config.ts            # Workflow configurations
│   │   │   └── scoring.ts           # Condition score calculation
│   │   ├── vehicle/
│   │   │   ├── vin-decoder.ts       # NHTSA integration
│   │   │   ├── vin-validator.ts     # VIN check digit validation
│   │   │   ├── history.ts           # Carfax/AutoCheck integration
│   │   │   └── recalls.ts           # NHTSA recalls
│   │   ├── media/
│   │   │   ├── s3.ts               # S3 client + presigned URLs
│   │   │   ├── thumbnails.ts       # Sharp image processing
│   │   │   └── analyze.ts          # AI vision analysis
│   │   ├── market/
│   │   │   ├── comps.ts            # MarketCheck integration
│   │   │   └── pricing.ts          # Price adjustment algorithm
│   │   ├── report/
│   │   │   ├── assemble.ts         # Data aggregation
│   │   │   ├── pdf.ts              # PDF generation
│   │   │   ├── ReportDocument.tsx   # React PDF template
│   │   │   └── blockchain.ts       # Polygon anchoring
│   │   └── jobs/                    # Inngest background jobs
│   │       ├── client.ts
│   │       ├── image-analysis.ts
│   │       ├── report-generation.ts
│   │       ├── market-fetch.ts
│   │       └── email-notifications.ts
│   │
│   ├── components/                   # Shared React components
│   │   ├── ui/                      # Base UI kit
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Progress.tsx
│   │   │   ├── Dialog.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── inspection/
│   │   │   ├── VinInput.tsx
│   │   │   ├── RiskDashboard.tsx
│   │   │   ├── CaptureGrid.tsx
│   │   │   ├── CameraHUD.tsx
│   │   │   ├── FindingCard.tsx
│   │   │   ├── ConditionScore.tsx
│   │   │   └── WorkflowStepper.tsx
│   │   ├── vehicle/
│   │   │   ├── VehicleCard.tsx
│   │   │   ├── Vehicle3D.tsx        # Three.js vehicle model
│   │   │   └── SpecsGrid.tsx
│   │   ├── market/
│   │   │   ├── CompsTable.tsx
│   │   │   ├── PricingBreakdown.tsx
│   │   │   └── BuyRecommendation.tsx
│   │   └── report/
│   │       ├── ReportPreview.tsx
│   │       └── ShareDialog.tsx
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useInspection.ts
│   │   ├── useMediaCapture.ts
│   │   ├── useIsMobile.ts
│   │   └── useTrpc.ts
│   │
│   ├── lib/                          # Shared utilities
│   │   ├── trpc.ts                  # tRPC client config
│   │   ├── utils.ts
│   │   └── constants.ts
│   │
│   └── types/                        # Shared TypeScript types
│       ├── inspection.ts
│       ├── vehicle.ts
│       └── report.ts
│
├── prisma/
│   ├── schema.prisma                # Database schema
│   ├── migrations/                  # Migration history
│   └── seed.ts                      # Risk profiles, test data
│
├── public/
│   ├── models/                      # 3D vehicle models (.glb)
│   └── images/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example
├── .env.local
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── BLUEPRINT.md                     # This file
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [x] Technical blueprint (this document)
- [ ] Next.js 15 project scaffolding with TypeScript
- [ ] Prisma schema + Supabase PostgreSQL setup
- [ ] Auth.js v5 integration (email/password)
- [ ] tRPC router skeleton with all procedure stubs
- [ ] Base UI component library (Tailwind + shadcn/ui)
- [ ] Protected dashboard layout with navigation

### Phase 2: Vehicle Intelligence (Week 3)
- [ ] VIN input + validation component
- [ ] NHTSA vPIC API integration
- [ ] VIN decode results display
- [ ] Risk profile database seeding (top 20 vehicles)
- [ ] Risk dashboard with 3D model
- [ ] NHTSA recalls API integration

### Phase 3: Inspection Workflow (Week 4-5)
- [ ] Workflow engine state machine
- [ ] Inspection create/list/detail pages
- [ ] Guided media capture (camera API + upload)
- [ ] S3 presigned upload pipeline
- [ ] Thumbnail generation (sharp)
- [ ] Finding entry form (severity, description, evidence)
- [ ] Condition score calculation

### Phase 4: Market & Pricing (Week 6)
- [ ] MarketCheck API integration (or mock data initially)
- [ ] Comparable listings display
- [ ] Condition-adjusted pricing algorithm
- [ ] Buy recommendation engine
- [ ] Profit projection calculator

### Phase 5: Reports (Week 7)
- [ ] Report data assembly
- [ ] PDF template (React PDF)
- [ ] Report generation background job
- [ ] Share link system (with optional password)
- [ ] Blockchain hash anchoring (Polygon)

### Phase 6: Polish & Deploy (Week 8)
- [ ] Mobile-responsive inspection flow
- [ ] Vehicle history integration (Carfax API)
- [ ] AI image analysis pipeline
- [ ] Email notifications (Resend)
- [ ] Error tracking (Sentry)
- [ ] Production deployment (Vercel + AWS)
- [ ] End-to-end testing

### Phase 7: Scale (Future)
- [ ] Multi-tenant organization management
- [ ] Team invitations and role management
- [ ] Subscription billing (Stripe)
- [ ] Dealer API access (Enterprise tier)
- [ ] Long-term condition intelligence database
- [ ] Insurance-specific inspection templates
- [ ] White-label report branding

---

## 11. Environment Variables

```bash
# .env.example

# ─── Database ───
DATABASE_URL="postgresql://user:pass@host:5432/veribuy?sslmode=require"

# ─── Auth ───
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# ─── AWS (Media Storage) ───
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-west-2"
S3_BUCKET="veribuy-media"
CLOUDFRONT_URL="https://cdn.veribuy.com"

# ─── External APIs ───
NHTSA_API_URL="https://vpic.nhtsa.dot.gov/api/vehicles"
CARFAX_API_KEY=""
MARKETCHECK_API_KEY=""
OPENAI_API_KEY=""

# ─── Blockchain (Polygon) ───
POLYGON_RPC_URL="https://polygon-rpc.com"
POLYGON_PRIVATE_KEY=""
VERIBUY_ANCHOR_CONTRACT=""

# ─── Background Jobs ───
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""

# ─── Email ───
RESEND_API_KEY=""

# ─── Monitoring ───
SENTRY_DSN=""
```

---

## 12. Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **Monorepo vs Polyrepo** | Monorepo (single Next.js app) | Faster iteration for small team; split later if needed |
| **REST vs tRPC** | tRPC | End-to-end type safety; no API client code generation |
| **ORM** | Prisma | Best TypeScript DX; auto-generated types from schema |
| **Styling** | Tailwind + shadcn/ui | Rapid UI development; consistent design system |
| **Upload** | Direct-to-S3 (presigned) | No server bottleneck for large media files |
| **PDF** | @react-pdf/renderer | React-native syntax; server-side rendering support |
| **Background Jobs** | Inngest | Serverless-native; built for Vercel; retries/scheduling |
| **Blockchain** | Polygon L2 | Low gas fees (~$0.01/tx); Ethereum security |
| **Auth** | Auth.js v5 | First-party Next.js integration; multi-provider |
| **Scoring** | Weighted category deduction | Matches demo algorithm; configurable per org |
| **Image AI** | OpenAI Vision API | Best multimodal accuracy; per-image pricing works at scale |
