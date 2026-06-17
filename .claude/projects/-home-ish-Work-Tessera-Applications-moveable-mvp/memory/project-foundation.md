---
name: project-foundation
description: Phase 1 foundation complete — what was built and where things live
metadata:
  type: project
---

Phase 1 foundation (01-FOUNDATION.md) is complete as of 2026-06-17.

**Why:** Initial scaffold to establish the app shell before building features.

**How to apply:** All future features build on top of this structure.

## File structure (root-level, no src/)
- `app/` — Next.js App Router pages
- `components/ui/` — UI primitives (Button, Card, Input, Badge, Avatar, LoadingSpinner, EmptyState, Modal, Toast)
- `components/shared/` — App-level shared (BottomTabBar)
- `lib/types.ts` — Domain types (UserRole, Profile, SessionTemplate, Exercise, etc.)
- `lib/constants.ts` — APP_NAME, ROUTES, MAX_CONTAINER_WIDTH
- `lib/supabase/client.ts` — browser client (createBrowserClient)
- `lib/supabase/server.ts` — server client (async createClient, awaits cookies())
- `proxy.ts` — Auth routing (Next.js 16 middleware replacement)
- `public/manifest.json` — PWA manifest

## Routes
- `app/(auth)/login/page.tsx` — login
- `app/(auth)/register/page.tsx` — register
- `app/(dashboard)/layout.tsx` — dashboard shell (fetches session + profile server-side)
- `app/(dashboard)/provider/page.tsx` — provider home placeholder
- `app/(dashboard)/patient/page.tsx` — patient home placeholder

## Key facts
- Next.js 16: middleware is now `proxy.ts` (named export `proxy`, not `middleware`)
- Tailwind v4: `@theme inline {}` in globals.css, no tailwind.config.js
- `params`/`searchParams` props are async in Next.js 16
- `cookies()` from next/headers is async
- Viewport metadata must use separate `export const viewport: Viewport` export
- TypeScript strict mode, zero errors confirmed
