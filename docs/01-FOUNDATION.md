# Phase 1: App Foundation & UI Shell

## Goals
- Initialize the Next.js 15 project with TypeScript, Tailwind CSS, and the App Router
- Configure Supabase client packages (`@supabase/supabase-js`, `@supabase/ssr`)
- Establish the shared UI component library and design system (colors, typography, spacing)
- Build the application layout shell (header, navigation, responsive container)
- Set up PWA manifest and service worker scaffolding
- Define shared TypeScript types and constants

## Tech Stack
- Next.js 15 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- PNPM (package manager)

## Folder Structure

```
src/
  app/
    (auth)/
      login/
      register/
    (dashboard)/
      provider/
      patient/
    layout.tsx
    page.tsx
  components/
    ui/          # primitives (Button, Card, Input, Modal, etc.)
    shared/      # app-level shared (Header, Navbar, Avatar, etc.)
  lib/
    supabase/
      client.ts
      server.ts
      middleware.ts
    types.ts
    constants.ts
  hooks/         # shared React hooks
public/
  manifest.json
  icons/
```

## Shared UI Components (primitives)

All components should be server-component-safe where possible. Use `"use client"` only when interactivity is required.

- **Button** — variants: `primary`, `secondary`, `ghost`, `danger`; sizes: `sm`, `md`, `lg`; loading spinner state
- **Card** — container with optional header, body, footer slots
- **Input** — text input with label, error message, disabled state
- **Select** — dropdown with label and error state
- **Modal** — accessible dialog overlay with close-on-escape, focus trap
- **Badge** — status indicator (e.g., active/completed/pending)
- **Avatar** — user avatar with fallback initials
- **LoadingSpinner** — full-page and inline variants
- **EmptyState** — placeholder when no data exists
- **Toast** — ephemeral notification (success/error/info)

## App Layout Shell

```tsx
// src/app/layout.tsx
// - <html> with lang="en"
// - Inter font via next/font
// - SupabaseProvider (client context for Supabase)
// - ToastContainer
// - metadata (title, description, viewport)
```

### Navigation

- Responsive sidebar (desktop) / bottom tab bar (mobile)
- Role-aware: different nav items for Provider vs Patient
- Active link highlighting
- Collapsible sidebar on desktop

### Auth Guard

- `AuthGuard` component wraps protected routes
- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from `/login` and `/register`

## PWA Configuration

- `public/manifest.json` — name, short_name, icons (SVG + PNG), theme_color, background_color, display: "standalone"
- Root `layout.tsx` includes `<link rel="manifest">` and `<meta name="apple-mobile-web-app-capable">`
- Service worker registration (optional at this stage, scaffold file)

## Type Definitions

```typescript
// src/lib/types.ts

export type UserRole = "provider" | "patient";

export interface Profile {
  id: string;
  role: UserRole;
  provider_id: string | null;
  created_at: string;
}

export interface SessionTemplate {
  id: string;
  provider_id: string;
  patient_id: string;
  name: string;
  provider_notes: string | null;
  created_at: string;
}

export interface Exercise {
  id: string;
  session_template_id: string;
  name: string;
  sets: number;
  reps: number;
  patient_notes: string | null;
  sort_order: number;
}

export interface SessionExecution {
  id: string;
  session_template_id: string;
  patient_id: string;
  status: "pending" | "completed";
  ease_score: number | null;
  pain_score: number | null;
  completed_at: string | null;
}

export interface Video {
  id: string;
  uploader_id: string;
  exercise_id: string | null;
  storage_path: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
}
```

## Test Cases

### Unit: U3 — Exercise reorder is client-side only
Mount `ExerciseList`, simulate drag-and-drop reorder, assert internal state mutates without network calls.

### Unit: U4 — MediaRecorder API fallback
Mock `navigator.mediaDevices.getUserMedia` as `undefined`, assert utility returns graceful fallback.

## Acceptance Criteria
- [ ] `pnpm dev` starts the app without errors
- [ ] Shared UI components render correctly in Storybook (or inline tests)
- [ ] Layout renders responsive sidebar/tabs
- [ ] Auth guard redirects correctly
- [ ] PWA install prompt works on iOS Safari
- [ ] TypeScript strict mode passes with zero errors
