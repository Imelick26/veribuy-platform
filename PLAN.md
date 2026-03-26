# VeriBuy Landing Page — Implementation Plan

## Project Setup
- New standalone Next.js app at `/landing-site` within the repo
- Next.js 15 + React 19 + Tailwind CSS 4 + TypeScript
- Fully static/SSG — no backend needed (form submits via mailto or API route)
- Matches VeriBuy brand palette (purple/pink gradient: #ff4289 → #be00a4 → #5c0099)

## Page Sections (Top to Bottom)

### 1. Navigation Bar (sticky)
- VeriBuy logo (left)
- Nav links: Features, How It Works, About, Contact
- CTA buttons: "Request Demo" (secondary) + "Get Started" (primary gradient)
- Mobile hamburger menu

### 2. Hero Section
- Large bold headline conveying the value prop (vehicle verification/inspection)
- Subheadline — one sentence expanding on the benefit
- Two CTA buttons: "Request a Demo" + "Schedule a Meeting"
- Abstract/gradient background visual (no product screenshots to avoid giving away details)
- Subtle floating animation elements for premium feel

### 3. Trust Bar
- "Trusted by leading dealerships and inspection firms"
- Placeholder logos (styled as grayscale silhouettes) — can swap for real ones later

### 4. Problem Statement Section
- Headline: "The Problem" or "Why VeriBuy?"
- 2-3 pain point cards with icons:
  - Inconsistent vehicle inspections
  - Lack of transparency in vehicle condition reporting
  - Manual, error-prone processes that cost time and money

### 5. Solution / What We Do Section
- Headline: "One Platform. Complete Vehicle Confidence."
- High-level description of VeriBuy's capabilities (kept vague enough to not reveal competitive details):
  - AI-powered vehicle inspection workflows
  - Standardized condition reporting
  - Real-time collaboration across teams
  - Comprehensive vehicle history and risk insights
- Each with an icon and short 1-2 sentence description
- NO screenshots of actual UI

### 6. How It Works (3-Step Process)
- Step 1: "Decode" — Enter a VIN to instantly pull vehicle data
- Step 2: "Inspect" — Follow guided inspection workflows
- Step 3: "Report" — Generate comprehensive condition reports
- Numbered steps with connecting lines/arrows, icons for each

### 7. Key Benefits / Differentiators
- Grid of 3-4 cards:
  - "Save Time" — Reduce inspection time by streamlining workflows
  - "Reduce Risk" — Catch issues before they become costly problems
  - "Build Trust" — Transparent reports that build buyer confidence
  - "Scale Operations" — Multi-team, multi-location support
- Each card with gradient accent top border (matching existing card-accent-top style)

### 8. Demo Access / CTA Section
- "See VeriBuy in Action"
- Lightweight form: Name, Email, Company Name
- Submit → redirects to platform registration (or shows confirmation)
- Alternative: "Or schedule a meeting with our team" link scrolls to contact

### 9. Contact / Request a Meeting Section
- "Let's Talk"
- Full contact form: Name, Email, Company, Phone (optional), Message
- Submits to API route that sends email to isaac@notibuy.com and cody@notibuy.com
- Also displays: email addresses for direct contact

### 10. Footer
- VeriBuy logo + tagline
- Quick links: Features, How It Works, Demo, Contact
- Legal: Privacy Policy, Terms of Service (placeholder links)
- "© 2026 VeriBuy. All rights reserved."
- Domain: getVeriBuy.com

## Technical Details

### Stack
- Next.js (App Router, static export compatible)
- Tailwind CSS 4 with custom theme matching platform branding
- Lucide React for icons
- Framer Motion for scroll animations and micro-interactions
- React Hook Form + Zod for form validation
- API route for contact form (sends email via Resend or simple fetch)

### Design Principles
- Dark sections alternating with light for visual rhythm
- Purple/pink gradient accents throughout
- Large typography, generous whitespace
- Smooth scroll-linked animations
- Fully responsive (mobile-first)
- Fast — static generation, optimized images, minimal JS

### Files Structure
```
/landing-site
├── package.json
├── next.config.ts
├── tailwind.config.ts (if needed beyond CSS)
├── tsconfig.json
├── postcss.config.mjs
├── public/
│   └── logo.png (copy from platform)
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout with Inter font, metadata
│   │   ├── page.tsx          # Main landing page
│   │   ├── globals.css       # Tailwind + brand tokens
│   │   └── api/
│   │       └── contact/
│   │           └── route.ts  # Contact form handler
│   └── components/
│       ├── Navbar.tsx
│       ├── Hero.tsx
│       ├── TrustBar.tsx
│       ├── ProblemSection.tsx
│       ├── SolutionSection.tsx
│       ├── HowItWorks.tsx
│       ├── Benefits.tsx
│       ├── DemoAccess.tsx
│       ├── Contact.tsx
│       └── Footer.tsx
```
