# MVP Issue Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all six pre-launch ISSUES.md items: auth form UX, password reveal, profile screens, blank session edit page, exercise persistence, and patient exercise visibility.

**Architecture:** Three parallel work streams (A, B, C) that touch disjoint files — they can be executed concurrently. Stream D (exercise visibility) is a side-effect of Stream C and requires no additional work. Each stream commits independently.

**Tech Stack:** Next.js 16 (async params/cookies), React 18, Supabase, Tailwind v4, TypeScript strict, Vitest

## Global Constraints

- No new npm dependencies
- No new database migrations or RLS changes
- Follow existing Tailwind token names (`text-primary`, `text-muted`, `text-placeholder`, `bg-card`, `rounded-card`, `shadow-card`, `border-border`)
- All new pages are Server Components unless they need client state (`"use client"`)
- Read `PROGRESS.md` before touching any file — do not duplicate existing components
- Inline SVG icons only — no icon library

---

## STREAM A — Auth Form UX (Issues 1 + 2)

**Files exclusively owned by this stream:**
- Modify: `app/(auth)/register/page.tsx`
- Modify: `app/(auth)/login/page.tsx`

---

### Task A-1: Reorder invitation code field and fix label

**Files:**
- Modify: `app/(auth)/register/page.tsx`

**Interfaces:**
- Produces: `PatientSignup` with order email → password → confirm → invitation code (optional)

- [ ] **Step 1: Reorder the four `<Field>` blocks in `PatientSignup`**

In `app/(auth)/register/page.tsx`, locate the `PatientSignup` function (starts around line 97). The `<form>` currently contains four `<Field>` blocks in this order: invitation code, email, password, confirm password.

Replace the entire `<form>` body with the fields reordered and the label updated:

```tsx
<form onSubmit={handleSubmit} className="flex flex-col gap-4">
  <Field label="Email" htmlFor="email">
    <input
      id="email"
      type="email"
      autoComplete="email"
      required
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className={inputClass}
      placeholder="you@example.com"
    />
  </Field>

  <Field label="Password" htmlFor="password-patient">
    <input
      id="password-patient"
      type="password"
      autoComplete="new-password"
      required
      minLength={8}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className={inputClass}
      placeholder="Min. 8 characters"
    />
  </Field>

  <Field label="Confirm password" htmlFor="confirm-password-patient">
    <input
      id="confirm-password-patient"
      type="password"
      autoComplete="new-password"
      required
      minLength={8}
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      className={inputClass}
      placeholder="Re-enter your password"
    />
  </Field>

  <Field label="Invitation code (optional)" htmlFor="code">
    <input
      id="code"
      type="text"
      value={code}
      onChange={(e) => setCode(e.target.value.toUpperCase())}
      className={inputClass}
      placeholder="XXXXXXXXXXXX"
      spellCheck={false}
      autoCapitalize="characters"
    />
  </Field>

  {error && <p className="text-red-500 text-sm">{error}</p>}

  <SubmitButton loading={isPending} label="Create patient account" />
</form>
```

- [ ] **Step 2: Verify manually**

Run `npm run dev` and navigate to `/register?role=patient`. Confirm the field order is Email → Password → Confirm password → Invitation code (optional).

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/register/page.tsx
git commit -m "fix: move invitation code to last field and mark optional"
```

---

### Task A-2: Password show/hide in register page

**Files:**
- Modify: `app/(auth)/register/page.tsx`

**Interfaces:**
- Produces: `PasswordField` local component (file-private) used for all 4 password inputs across `ProviderSignup` and `PatientSignup`

- [ ] **Step 1: Add `PasswordField` component at the bottom of the file**

Append this to `app/(auth)/register/page.tsx` after the existing `SubmitButton` function:

```tsx
function PasswordField({
  id,
  autoComplete,
  minLength,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  autoComplete?: string;
  minLength?: number;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}): React.JSX.Element {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-16`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Replace password `<input>` elements in `ProviderSignup` with `<PasswordField>`**

In `ProviderSignup`, replace the two password field children:

```tsx
<Field label="Password" htmlFor="password">
  <PasswordField
    id="password"
    autoComplete="new-password"
    minLength={8}
    value={password}
    onChange={setPassword}
    placeholder="Min. 8 characters"
  />
</Field>

<Field label="Confirm password" htmlFor="confirm-password">
  <PasswordField
    id="confirm-password"
    autoComplete="new-password"
    minLength={8}
    value={confirmPassword}
    onChange={setConfirmPassword}
    placeholder="Re-enter your password"
  />
</Field>
```

- [ ] **Step 3: Replace password `<input>` elements in `PatientSignup` with `<PasswordField>`**

In `PatientSignup` (after the Task A-1 reorder), replace the two password field children:

```tsx
<Field label="Password" htmlFor="password-patient">
  <PasswordField
    id="password-patient"
    autoComplete="new-password"
    minLength={8}
    value={password}
    onChange={setPassword}
    placeholder="Min. 8 characters"
  />
</Field>

<Field label="Confirm password" htmlFor="confirm-password-patient">
  <PasswordField
    id="confirm-password-patient"
    autoComplete="new-password"
    minLength={8}
    value={confirmPassword}
    onChange={setConfirmPassword}
    placeholder="Re-enter your password"
  />
</Field>
```

- [ ] **Step 4: Verify manually**

Navigate to `/register?role=provider` and `/register?role=patient`. Each password field should have a "Show" button on the right. Clicking "Show" reveals the password and changes the button to "Hide".

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/register/page.tsx
git commit -m "feat: add password show/hide toggle to register page"
```

---

### Task A-3: Password show/hide in login page

**Files:**
- Modify: `app/(auth)/login/page.tsx`

**Interfaces:**
- Produces: login page password field with show/hide toggle

- [ ] **Step 1: Add `showPassword` state to `LoginPage`**

In `app/(auth)/login/page.tsx`, after the existing `const [state, setState] = useState<FormState>(...)` line, add:

```tsx
const [showPassword, setShowPassword] = useState(false);
```

`useState` is already imported from React.

- [ ] **Step 2: Replace the password `<div>` with a relative container including toggle**

Find the password field block (the `<div className="flex flex-col gap-1.5">` that contains `id="password"`) and replace it:

```tsx
<div className="flex flex-col gap-1.5">
  <label
    htmlFor="password"
    className="text-sm font-medium text-foreground"
  >
    Password
  </label>
  <div className="relative">
    <input
      id="password"
      type={showPassword ? "text" : "password"}
      autoComplete="current-password"
      required
      value={state.password}
      onChange={(e) => setField("password", e.target.value)}
      className="w-full h-12 rounded-card border border-border px-4 pr-16 bg-card text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
      placeholder="••••••••"
    />
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium"
    >
      {showPassword ? "Hide" : "Show"}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Verify manually**

Navigate to `/login`. The password field should have a "Show" button. Clicking it reveals the typed password.

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/login/page.tsx
git commit -m "feat: add password show/hide toggle to login page"
```

---

## STREAM B — Profile Screens & Navigation (Issue 3)

**Files exclusively owned by this stream:**
- Modify: `components/shared/BottomTabBar.tsx`
- Modify: `app/(dashboard)/provider/page.tsx`
- Create: `app/(dashboard)/provider/profile/page.tsx`
- Modify: `app/(dashboard)/patient/page.tsx`
- Modify: `app/(dashboard)/patient/profile/page.tsx`
- Modify: `app/(dashboard)/patient/exercises/page.tsx`

---

### Task B-1: Update BottomTabBar — add Profile tab, reroute Exercises

**Files:**
- Modify: `components/shared/BottomTabBar.tsx`

**Interfaces:**
- Produces: updated `PROVIDER_TABS` (Home, Patients, Templates, Profile) and `PATIENT_TABS` (Home, Exercises→/patient/exercises, Progress, Profile→/patient/profile)

- [ ] **Step 1: Add `IconUser` SVG function after the existing icon functions**

In `components/shared/BottomTabBar.tsx`, add this function after `IconMessageCircle`:

```tsx
function IconUser(): React.JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
```

- [ ] **Step 2: Replace `PROVIDER_TABS`**

Replace the existing `PROVIDER_TABS` constant:

```tsx
const PROVIDER_TABS: Tab[] = [
  { label: "Home", path: "/provider", icon: <IconHome /> },
  { label: "Patients", path: "/provider/patients", icon: <IconUsers /> },
  { label: "Templates", path: "/provider/templates", icon: <IconClipboard /> },
  { label: "Profile", path: "/provider/profile", icon: <IconUser /> },
];
```

- [ ] **Step 3: Replace `PATIENT_TABS`**

Replace the existing `PATIENT_TABS` constant:

```tsx
const PATIENT_TABS: Tab[] = [
  { label: "Home", path: "/patient", icon: <IconHome /> },
  { label: "Exercises", path: "/patient/exercises", icon: <IconActivity /> },
  { label: "Progress", path: "/patient/progress", icon: <IconTrendingUp /> },
  { label: "Profile", path: "/patient/profile", icon: <IconUser /> },
];
```

- [ ] **Step 4: Verify manually**

Run the app and log in as a provider — confirm 4 tabs with Profile replacing Messages. Log in as a patient — confirm Exercises tab goes to `/patient/exercises` and Profile tab appears.

- [ ] **Step 5: Commit**

```bash
git add components/shared/BottomTabBar.tsx
git commit -m "feat: replace Messages tab with Profile tab in bottom nav for both roles"
```

---

### Task B-2: Create provider profile page

**Files:**
- Create: `app/(dashboard)/provider/profile/page.tsx`

**Interfaces:**
- Consumes: `LogoutButton` from `components/shared/LogoutButton`, `DeleteAccountButton` from `components/shared/DeleteAccountButton`, `deleteProviderAccount` from `lib/actions/account`
- Produces: `/provider/profile` route with email, role, sign out, danger zone

- [ ] **Step 1: Create the file**

Create `app/(dashboard)/provider/profile/page.tsx`:

```tsx
import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/shared/LogoutButton";
import DeleteAccountButton from "@/components/shared/DeleteAccountButton";
import { deleteProviderAccount } from "@/lib/actions/account";

export default async function ProviderProfilePage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, created_at")
    .eq("id", user.id)
    .single();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  const nameFromEmail = user.email?.split("@")[0] ?? "Provider";

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-6">
      <div className="bg-card rounded-card shadow-card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center shrink-0">
            <span className="text-primary text-2xl font-bold uppercase">
              {nameFromEmail.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {nameFromEmail}
            </h1>
            <p className="text-sm text-placeholder">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-placeholder mt-0.5">
                Member since {memberSince}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-placeholder">Role</span>
            <span className="text-foreground font-medium capitalize">
              Provider
            </span>
          </div>
        </div>
      </div>

      <LogoutButton />

      <div className="bg-card rounded-card shadow-card p-5">
        <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-1">
          Danger Zone
        </p>
        <p className="text-sm text-placeholder mb-4">
          You must remove all patients before deleting your account.
        </p>
        <DeleteAccountButton
          action={deleteProviderAccount}
          confirmationMessage="This will permanently delete your account. Your patients' session history will be kept. This cannot be undone."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

Navigate to `/provider/profile`. Confirm it shows the provider's avatar initial, email, member-since date, role = "Provider", a Sign out button, and the danger zone.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/provider/profile/page.tsx"
git commit -m "feat: add provider profile page with email, role, sign out, danger zone"
```

---

### Task B-3: Update provider home — message icon + remove logout/danger zone

**Files:**
- Modify: `app/(dashboard)/provider/page.tsx`

**Interfaces:**
- Consumes: `UnreadBadge` from `components/chat/UnreadBadge`, `Link` from `next/link` (already imported)
- Produces: message icon in greeting row; no `LogoutButton` or danger zone on this page

- [ ] **Step 1: Add `UnreadBadge` import**

At the top of `app/(dashboard)/provider/page.tsx`, add:

```tsx
import { UnreadBadge } from "@/components/chat/UnreadBadge";
```

- [ ] **Step 2: Replace the greeting `<div>` with a flex row including message icon**

Find this block (near the top of the return statement):

```tsx
<div>
  <h1 className="text-2xl font-semibold text-foreground">{greeting}</h1>
  <p className="text-sm text-muted mt-0.5">
    Here's your practice at a glance.
  </p>
</div>
```

Replace it with:

```tsx
<div className="flex items-start justify-between">
  <div>
    <h1 className="text-2xl font-semibold text-foreground">{greeting}</h1>
    <p className="text-sm text-muted mt-0.5">
      Here's your practice at a glance.
    </p>
  </div>
  <Link
    href="/provider/chat"
    aria-label="Messages"
    className="relative p-1 text-foreground -mr-1"
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
    <UnreadBadge />
  </Link>
</div>
```

- [ ] **Step 3: Remove `LogoutButton` and the danger zone block**

Delete the `<LogoutButton />` line and the entire danger zone `<div>` (the block with `"Danger Zone"` heading, the paragraph, and `<DeleteAccountButton>`). Also remove the now-unused imports: `LogoutButton`, `DeleteAccountButton`, `deleteProviderAccount`.

- [ ] **Step 4: Verify manually**

The provider home should show a chat icon (with unread badge when applicable) next to the greeting. No sign-out or delete buttons visible.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/provider/page.tsx"
git commit -m "feat: add message icon to provider home, move account controls to profile page"
```

---

### Task B-4: Convert patient exercises page from redirect to real page

**Files:**
- Modify: `app/(dashboard)/patient/exercises/page.tsx`

**Interfaces:**
- Produces: `/patient/exercises` — exercises-only list (no account controls)

- [ ] **Step 1: Replace the redirect with a Server Component**

Replace the entire contents of `app/(dashboard)/patient/exercises/page.tsx`:

```tsx
import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Exercise, SessionTemplate } from "@/lib/types";
import { EmptyState } from "@/components/ui";

export default async function PatientExercisesPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessionsRaw } = await supabase
    .from("sessions_template")
    .select("id, name, patient_id, provider_id, created_at")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  const sessions = (sessionsRaw ?? []) as SessionTemplate[];
  const sessionIds = sessions.map((s) => s.id);

  let exercises: Exercise[] = [];
  if (sessionIds.length > 0) {
    const { data: exData } = await supabase
      .from("exercises")
      .select(
        "id, session_template_id, name, sets, reps, patient_notes, sort_order"
      )
      .in("session_template_id", sessionIds)
      .order("sort_order", { ascending: true });
    exercises = (exData ?? []) as Exercise[];
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-6">
      <h1 className="text-xl font-semibold text-foreground">Your Exercises</h1>

      <div className="bg-card rounded-card shadow-card p-5">
        {exercises.length === 0 ? (
          <EmptyState
            title="No exercises assigned yet"
            description="Your physical therapist will assign exercises once you're connected."
          />
        ) : (
          <div>
            {exercises.map((ex, i) => (
              <div
                key={ex.id}
                className={`flex items-center gap-3 py-3 ${
                  i < exercises.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-muted">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ex.name}
                  </p>
                  <p className="text-xs text-placeholder">
                    {ex.sets} sets · {ex.reps} reps
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

Navigate to `/patient/exercises` (or tap the Exercises tab as a patient). Should show exercise list or empty state — no logout or account controls.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/patient/exercises/page.tsx"
git commit -m "feat: convert patient exercises page from redirect to real exercises list"
```

---

### Task B-5: Strip exercise list from patient profile page

**Files:**
- Modify: `app/(dashboard)/patient/profile/page.tsx`

**Interfaces:**
- Produces: `/patient/profile` showing only account controls (no exercise list)

- [ ] **Step 1: Remove sessions + exercises data fetching**

In `app/(dashboard)/patient/profile/page.tsx`, find the `Promise.all` call that fetches `profileResult` and `sessionsResult`, then the subsequent exercise fetch block. Replace the entire data-fetching section with just the profile fetch:

```tsx
const { data: profileData } = await supabase
  .from("users")
  .select("id, role, provider_id, created_at")
  .eq("id", user.id)
  .single();

const profile = profileData;
```

Remove the `sessionsResult` variable, the `sessions` variable, the `sessionIds` variable, the `exercises` array, and the subsequent `if (sessionIds.length > 0)` block entirely.

Also remove the unused imports: `type Exercise` and `type SessionTemplate`.

- [ ] **Step 2: Remove the "Your Exercises" card from the JSX**

Delete the entire exercises card block:

```tsx
{/* Exercise list */}
<div className="bg-card rounded-card shadow-card p-5">
  <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-3">
    Your Exercises
  </p>
  {/* ... */}
</div>
```

Keep the profile header card, provider info / ConnectProviderWidget, LogoutButton, and danger zone card.

- [ ] **Step 3: Verify manually**

Navigate to `/patient/profile`. Should show avatar, email, member since, role, provider info (or ConnectProviderWidget if unlinked), sign out, and danger zone — no exercise list.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/patient/profile/page.tsx"
git commit -m "feat: strip exercise list from patient profile page (exercises moved to /patient/exercises)"
```

---

### Task B-6: Add message icon to patient home page

**Files:**
- Modify: `app/(dashboard)/patient/page.tsx`

**Interfaces:**
- Consumes: `UnreadBadge` from `components/chat/UnreadBadge`, `Link` from `next/link`
- Produces: message icon above StreakBanner linking to `/patient/chat`

- [ ] **Step 1: Add imports**

In `app/(dashboard)/patient/page.tsx`, add these imports:

```tsx
import Link from "next/link";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
```

- [ ] **Step 2: Add message icon row above StreakBanner**

In `DashboardContent`, find the return statement. Wrap the existing `<>` fragment children with a container that adds the icon row above the streak banner:

```tsx
return (
  <>
    <div className="flex justify-end px-5 pt-4">
      <Link
        href="/patient/chat"
        aria-label="Messages"
        className="relative p-1 text-foreground"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <UnreadBadge />
      </Link>
    </div>

    <StreakBanner streak={stats.streak} totalCompleted={stats.totalCompleted} />

    <div className="flex flex-col gap-4 py-4">
      {session ? (
        <ActiveSessionCard session={session} exercises={exercises} />
      ) : (
        <div className="mx-5">
          <EmptyState
            title="No session assigned yet"
            description="Your physical therapist will assign a session once you're connected."
          />
        </div>
      )}

      <ProgressPreview recentCompletions={stats.recentCompletions} />
    </div>
  </>
);
```

- [ ] **Step 3: Verify manually**

Patient home page shows a chat icon in the top-right before the streak banner. Tapping it navigates to `/patient/chat`.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/patient/page.tsx"
git commit -m "feat: add message icon to patient home page above streak banner"
```

---

## STREAM C — Session Editing (Issues 4, 5, and 6)

**Files exclusively owned by this stream:**
- Modify: `app/(dashboard)/provider/sessions/SessionForm.tsx`
- Modify: `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx`

Tasks in this stream must run **sequentially** (C-1 → C-2 → C-3).

---

### Task C-1: Fix blank edit page with dynamic import and error boundary

**Files:**
- Modify: `app/(dashboard)/provider/sessions/SessionForm.tsx`
- Modify: `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx`

**Interfaces:**
- Produces: `ExerciseList` loaded via `next/dynamic` with `ssr: false`; error boundary wrapping `SessionForm` in edit page

- [ ] **Step 1: Add `dynamic` import for `ExerciseList` in `SessionForm.tsx`**

In `app/(dashboard)/provider/sessions/SessionForm.tsx`, replace the existing static `ExerciseList` import:

```tsx
// Remove this line:
import { ExerciseList, type ExerciseFormItem } from "./ExerciseList";
```

With:

```tsx
import dynamic from "next/dynamic";
import type { ExerciseFormItem } from "./ExerciseList";

const ExerciseList = dynamic(
  () => import("./ExerciseList").then((m) => ({ default: m.ExerciseList })),
  {
    ssr: false,
    loading: () => (
      <div className="py-4 text-sm text-muted text-center">
        Loading exercises…
      </div>
    ),
  }
);
```

- [ ] **Step 2: Add an `ErrorBoundary` class to the edit page**

In `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx`, add this class above the `EditSessionPage` export. Also add `"use client"` is NOT needed here — `ErrorBoundary` must be in a client component. So create a small wrapper:

Create `app/(dashboard)/provider/sessions/[sessionId]/EditErrorBoundary.tsx`:

```tsx
"use client";

import React from "react";

interface State {
  error: Error | null;
}

export class EditErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="px-5 pt-10 pb-6">
          <p className="text-sm text-error">
            Failed to load the session editor. Please refresh and try again.
          </p>
          <p className="text-xs text-muted mt-1">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 3: Wrap `SessionForm` with `EditErrorBoundary` in the edit page**

In `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx`, add the import:

```tsx
import { EditErrorBoundary } from "./EditErrorBoundary";
```

And wrap the `<SessionForm>` in the return:

```tsx
return (
  <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
    <Link href="/provider/templates" className="text-sm text-primary">
      ← Templates
    </Link>
    <h1 className="text-2xl font-semibold text-foreground">Edit session</h1>
    <EditErrorBoundary>
      <SessionForm
        mode="edit"
        sessionId={session.id}
        patients={patients}
        initialData={{
          name: session.name,
          patient_id: session.patient_id,
          provider_notes: session.provider_notes ?? "",
          exercises,
        }}
      />
    </EditErrorBoundary>
  </div>
);
```

- [ ] **Step 4: Verify manually**

Navigate to `/provider/templates`, click Edit on any template. The page should render the session form with exercises loaded. If the error boundary fires, the error message from the boundary appears rather than a blank page.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/provider/sessions/SessionForm.tsx" \
        "app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx" \
        "app/(dashboard)/provider/sessions/[sessionId]/EditErrorBoundary.tsx"
git commit -m "fix: load ExerciseList dynamically (ssr:false) to fix blank edit page; add error boundary"
```

---

### Task C-2: Fix edit-mode `handleSubmit` — ID-prefix sentinel + error checking

**Files:**
- Modify: `app/(dashboard)/provider/sessions/SessionForm.tsx`

**Interfaces:**
- Produces: corrected exercise categorization in edit mode; surfaced errors from `Promise.all`

- [ ] **Step 1: Replace the exercise categorization block in `handleSubmit`**

In `SessionForm.tsx`, locate the edit-mode branch inside `handleSubmit` (the `else if (mode === "edit" && sessionId)` block). Find these lines:

```tsx
const originalIds = new Set(
  (initialData?.exercises ?? []).map((e) => e.id)
);
const toDelete = [...originalIds].filter(
  (id) => !exercises.some((e) => e.id === id)
);
const toAdd = exercises.filter((e) => e.isNew);
const toUpdate = exercises.filter(
  (e) => !e.isNew && originalIds.has(e.id)
);

await Promise.all([
  ...toDelete.map((id) => deleteExercise(id)),
  ...toAdd.map((ex) =>
    addExercise(sessionId, {
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      patient_notes: ex.patient_notes || null,
      sort_order: ex.sort_order,
    })
  ),
  ...toUpdate.map((ex) =>
    updateExercise(ex.id, {
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      patient_notes: ex.patient_notes || null,
      sort_order: ex.sort_order,
    })
  ),
]);

const existingToReorder = exercises
  .filter((e) => !e.isNew)
  .map((e) => ({ id: e.id, sort_order: e.sort_order }));
if (existingToReorder.length > 0) {
  await reorderExercises(existingToReorder);
}
```

Replace with:

```tsx
const originalIds = new Set(
  (initialData?.exercises ?? []).map((e) => e.id)
);
// Exercises with a "new-" prefix have never been persisted to the DB.
// All real UUIDs (whether loaded at page open or immediately-saved this
// session) go through updateExercise so edits are not lost.
const toDelete = [...originalIds].filter(
  (id) => !exercises.some((e) => e.id === id)
);
const toAdd = exercises.filter((e) => e.id.startsWith("new-"));
const toUpdate = exercises.filter((e) => !e.id.startsWith("new-"));

const results = await Promise.all([
  ...toDelete.map((id) => deleteExercise(id)),
  ...toAdd.map((ex) =>
    addExercise(sessionId, {
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      patient_notes: ex.patient_notes || null,
      sort_order: ex.sort_order,
    })
  ),
  ...toUpdate.map((ex) =>
    updateExercise(ex.id, {
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      patient_notes: ex.patient_notes || null,
      sort_order: ex.sort_order,
    })
  ),
]);

const firstError = results.find((r) => r && "error" in r);
if (firstError && "error" in firstError) {
  setError(firstError.error);
  return;
}

const toReorder = exercises
  .filter((e) => !e.id.startsWith("new-"))
  .map((e) => ({ id: e.id, sort_order: e.sort_order }));
if (toReorder.length > 0) {
  await reorderExercises(toReorder);
}
```

- [ ] **Step 2: Verify manually**

In edit mode, add a new exercise with a blank name and try to save — an error message should appear ("Exercise name is required."). Edit an existing exercise name, save — the updated name persists. Delete an exercise, save — it disappears from the patient's view.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/provider/sessions/SessionForm.tsx"
git commit -m "fix: use ID-prefix sentinel in edit-mode save; surface exercise action errors"
```

---

### Task C-3: Immediately persist new exercises in edit mode

**Files:**
- Modify: `app/(dashboard)/provider/sessions/SessionForm.tsx`

**Interfaces:**
- Consumes: `addExercise` (returns `{ id: string } | { error: string }`) from `lib/actions/exercises`
- Produces: `addNewExercise` that calls `addExercise` immediately in edit mode, replacing temp ID with real UUID so `ExerciseVideoAttacher` can attach videos without a full save

- [ ] **Step 1: Convert `addNewExercise` to handle edit mode differently**

In `SessionForm.tsx`, find the `addNewExercise` function:

```tsx
function addNewExercise(): void {
  setExercises((prev) => [...prev, newExercise(prev.length)]);
}
```

Replace it with:

```tsx
async function addNewExercise(): Promise<void> {
  if (mode === "edit" && sessionId) {
    const sortOrder = exercises.length;
    const tempId = `new-${Date.now()}-${Math.random()}`;
    // Add optimistically so the row appears immediately
    setExercises((prev) => [
      ...prev,
      {
        id: tempId,
        name: "New exercise",
        sets: 3,
        reps: 10,
        patient_notes: "",
        sort_order: sortOrder,
        video_id: null,
        video_storage_path: null,
      },
    ]);
    const result = await addExercise(sessionId, {
      name: "New exercise",
      sets: 3,
      reps: 10,
      patient_notes: null,
      sort_order: sortOrder,
    });
    if ("error" in result) {
      setExercises((prev) => prev.filter((e) => e.id !== tempId));
      setError(result.error);
    } else {
      // Swap temp ID for the real DB UUID — video attachment now works
      setExercises((prev) =>
        prev.map((e) => (e.id === tempId ? { ...e, id: result.id } : e))
      );
    }
  } else {
    setExercises((prev) => [...prev, newExercise(prev.length)]);
  }
}
```

- [ ] **Step 2: Update the call sites to handle the async function**

The two call sites are:
1. The `+ Add exercise` button: `onClick={addNewExercise}`
2. The "Tap to add the first exercise" button: `onClick={addNewExercise}`

Both are `type="button"` so they do not trigger form submission. The `onClick` handlers accept `() => void` — since `async` functions return a Promise (which is truthy but not awaited), the handler signatures still work. No change needed to the JSX.

- [ ] **Step 3: Verify manually**

Go to edit mode for a session. Click "+ Add exercise". A "New exercise" row should appear immediately. The `ExerciseVideoAttacher` on that row should show the camera button (not the "Save first" message). Change the exercise name. Save the session. Confirm the renamed exercise persists when you return to edit.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/provider/sessions/SessionForm.tsx"
git commit -m "feat: immediately persist new exercises in edit mode to enable instant video attachment"
```

---

## STREAM D — Patient Exercise Visibility (Issue 6)

No additional tasks. Issue 6 is fully resolved by Stream C:
- Task C-2 adds error checking to `handleSubmit`, surfacing silent exercise-save failures
- Task C-3 ensures exercises added in edit mode have real DB IDs that persist correctly

After Stream C is merged, verify issue 6 by:
1. Provider creates a session template and adds exercises (in create mode)
2. Patient logs in → Home shows the session with exercises in `ActiveSessionCard`
3. Patient taps "Start session" → session page shows all exercises

---

## ISSUES.md Checklist (mark off after each stream merges)

```
- [ ] UI: The invitation code should be more obvious that it's optional, by making it the last field for the sign up form, and the optional tag should be in the label, not the placeholder.
- [ ] UI: The password field should have a "Show" button that reveals the password.
- [ ] UI: There should be a Profile screen, where the user's email, role, connect with provider, sign out, and danger zone are, as opposed to being on the exercises page for the Patient page. And similarly for the Provider.
- [ ] UI: Editing a session is a blank page.
- [ ] UI: There's no way to save an exercise without saving the session.
- [ ] UI: When a session is saved, editing doesn't work, but the patient can see the session, but not the exercises themselves.
```
