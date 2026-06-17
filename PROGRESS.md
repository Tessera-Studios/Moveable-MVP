# Project Progress

This file tracks what has been built. Read it before starting any work so you know the current state of the codebase and don't duplicate or contradict existing implementations.

---

## Phase 1 — Foundation (Complete)

**Completed:** 2026-06-17  
**Spec:** `docs/01-FOUNDATION.md`

### What was built

**Design System**
- `app/globals.css` — Tailwind v4 `@theme inline` with all DESIGN.md tokens: 14 color variables, 3 shadow tokens, 3 border-radius tokens, Inter font stack as `--font-sans`. Light-only (no dark mode). Safe-area and hide-scrollbar utilities included.

**TypeScript Types & Constants**
- `lib/types.ts` — `UserRole`, `Profile`, `SessionTemplate`, `Exercise`, `SessionExecution`, `Video`, `Message`
- `lib/constants.ts` — `APP_NAME`, `APP_DESCRIPTION`, `MAX_CONTAINER_WIDTH`, `ROUTES`

**Supabase Clients**
- `lib/supabase/client.ts` — Browser client via `createBrowserClient` (`"use client"`)
- `lib/supabase/server.ts` — Server client via `createServerClient`, `await cookies()` (Next.js 16 async API)
- Env vars: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`)

**Auth Routing**
- `proxy.ts` — Next.js 16 auth proxy (replaces `middleware.ts`). Redirects unauthenticated users to `/login`; redirects authenticated users on `/login`/`/register` to their role-specific dashboard. Gracefully bypasses if env vars are not set.

**UI Primitives** (`components/ui/`)
- `Button` — 4 variants (primary, secondary, ghost, danger), 3 sizes, loading spinner, disabled state
- `Card` — with `Card.Header`, `Card.Body`, `Card.Footer` sub-components
- `Input` — label, error, hint slots; accessible via `useId`
- `Badge` — 5 variants (default, success, warning, error, info)
- `Avatar` — image → initials → SVG fallback, 3 sizes
- `LoadingSpinner` — 3 sizes, optional full-page overlay
- `EmptyState` — icon, title, description, action slots
- `Modal` — Escape + overlay close, focus management, ARIA dialog, 3 sizes
- `Toast` + `useToast` hook — context-based queue, slide-up animation, 3s auto-dismiss
- `index.ts` — barrel export for all primitives

**App Shell & Routes**
- `app/layout.tsx` — Inter font via `next/font`, `ToastProvider`, PWA metadata, separate `viewport` export (Next.js 16)
- `app/page.tsx` — immediate `redirect("/login")`
- `app/(auth)/login/page.tsx` — Supabase `signInWithPassword`, `router.refresh()` on success (proxy handles role routing)
- `app/(auth)/register/page.tsx` — `signUp` + profile upsert with role selection
- `app/(dashboard)/layout.tsx` — server-side `getUser()` + profile fetch, renders `BottomTabBar`
- `app/(dashboard)/provider/page.tsx` — placeholder
- `app/(dashboard)/patient/page.tsx` — placeholder
- `components/shared/BottomTabBar.tsx` — role-aware (provider/patient), 4 tabs each, `usePathname` for active state, inline SVGs, safe-area padding
- `public/manifest.json` — PWA manifest

### Known gaps / next steps
- No `hooks/` directory yet (add as hooks are needed)
- Dashboard pages are placeholders — Phase 2 (Authentication) and Phase 3+ build on top of them
- No icon set installed — current components use inline SVGs
- Supabase `profiles` table schema not yet created in the database (needed for role-based routing to work)

---

## Phases Remaining

| Phase | Spec | Status |
|---|---|---|
| 2 — Authentication | `docs/02-AUTHENTICATION.md` | Not started |
| 3 — Provider Interface | `docs/03-PROVIDER-INTERFACE.md` | Not started |
| 4 — Patient Interface | `docs/04-PATIENT-INTERFACE.md` | Not started |
| 5 — Multimedia | `docs/05-MULTIMEDIA.md` | Not started |
| 6 — Realtime Chat | `docs/06-REALTIME-CHAT.md` | Not started |
| 7 — Document Export | `docs/07-DOCUMENT-EXPORT.md` | Not started |
