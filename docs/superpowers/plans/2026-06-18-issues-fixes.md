# Issues Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix app name ("Moveable" → "Move Able") across all UI surfaces, make the patient invitation code optional at registration, and add a post-signup code-claim flow from the patient profile page.

**Architecture:** App name is a pure text replacement across 6 files. Codeless registration splits `registerPatient` into two paths (code present vs. absent) and adds a new `claimInvitationCode` server action. A new `ConnectProviderWidget` client component on the patient profile page calls that action when `provider_id` is null.

**Tech Stack:** Next.js App Router, Supabase (regular + admin clients), React `useTransition`, TypeScript.

## Global Constraints

- All UI text must read "Move Able" (two words, capital M, capital A) — never "Moveable", "moveable", or "move able".
- Server actions live under `lib/actions/` and use `"use server"` at the file level.
- Admin client (`createAdminClient()` from `lib/supabase/admin.ts`) is required whenever bypassing RLS or calling `auth.admin.*`.
- `requireRole(role)` from `lib/actions/auth.ts` returns `{ supabase, userId }` on success or `{ error: string }` — always check with `if ("error" in auth)`.
- No new npm dependencies.

## DB prerequisite

> **Apply migration before testing Task 3 or Task 4.**
> File: `supabase/migrations/20260618000001_account_deletion.sql`
> Run in Supabase Dashboard SQL Editor. This drops `check_patient_has_provider` which blocks `provider_id: null` inserts.

---

## File Map

| File | Action |
|---|---|
| `lib/constants.ts` | Modify — rename `APP_NAME` |
| `app/layout.tsx` | Modify — rename title + appleWebApp title |
| `app/(auth)/login/page.tsx` | Modify — rename heading |
| `app/(auth)/register/page.tsx` | Modify — rename headings + make code field optional |
| `public/manifest.json` | Modify — rename `name` + `short_name` |
| `lib/actions/auth.ts` | Modify — update `registerPatient` to handle empty code |
| `lib/actions/invitation.ts` | Modify — add `claimInvitationCode` |
| `components/patient/ConnectProviderWidget.tsx` | Create — code-claim form for unlinked patients |
| `app/(dashboard)/patient/profile/page.tsx` | Modify — render `ConnectProviderWidget` when no provider |

---

## Task 1: App Name Rename

**Files:**
- Modify: `lib/constants.ts`
- Modify: `app/layout.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/register/page.tsx`
- Modify: `public/manifest.json`

**Interfaces:**
- Produces: `APP_NAME = "Move Able"` consumed by any future component importing constants

- [ ] **Step 1: Update `lib/constants.ts`**

```ts
export const APP_NAME: string = "Move Able";
```

- [ ] **Step 2: Update `app/layout.tsx`**

Replace both occurrences:
```ts
export const metadata: Metadata = {
  title: "Move Able",
  description: "Physical therapy, tracked and connected.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Move Able" },
};
```

- [ ] **Step 3: Update `app/(auth)/login/page.tsx` line 58**

Change the heading text from `Moveable` to `Move Able`. (It is inside an `<h1>` element.)

- [ ] **Step 4: Update `app/(auth)/register/page.tsx`**

Three `<h1>` headings (lines 34, 121, 202) each read `Moveable` — change all to `Move Able`.

- [ ] **Step 5: Update `public/manifest.json`**

```json
{
  "name": "Move Able",
  "short_name": "Move Able",
  "description": "Physical therapy, tracked and connected.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F9FAFB",
  "theme_color": "#1E88E5",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 6: Verify no remaining occurrences**

```bash
grep -rn "Moveable" app lib public --include="*.tsx" --include="*.ts" --include="*.json"
```

Expected: zero results (the PDF export at `app/api/export/patient-stats/route.ts` already says "Move Able" — do not touch it).

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/constants.ts app/layout.tsx "app/(auth)/login/page.tsx" "app/(auth)/register/page.tsx" public/manifest.json
git commit -m "fix: rename app to Move Able across all UI surfaces"
```

---

## Task 2: Optional Invitation Code at Registration

**Files:**
- Modify: `lib/actions/auth.ts` — update `registerPatient`
- Modify: `app/(auth)/register/page.tsx` — remove `required`, update placeholder

**Interfaces:**
- `registerPatient(email: string, password: string, code: string): Promise<{ error: string } | never>` — signature unchanged; empty `code` now skips validation

- [ ] **Step 1: Rewrite `registerPatient` in `lib/actions/auth.ts`**

Replace the entire `registerPatient` function body:

```ts
export async function registerPatient(
  email: string,
  password: string,
  code: string
): Promise<{ error: string } | never> {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  let providerId: string | null = null;

  if (code.trim() !== "") {
    const { data: invite, error: lookupError } = await adminSupabase
      .from("invitation_codes")
      .select("provider_id, is_consumed, expires_at")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (lookupError || !invite) {
      return { error: "Invalid invitation code." };
    }
    if (invite.is_consumed) {
      return { error: "This invitation code has already been used." };
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { error: "This invitation code has expired." };
    }

    providerId = invite.provider_id as string;
  }

  const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) return { error: signUpError.message };
  if (!data.user) return { error: "Sign-up succeeded but no user was returned." };

  const { error: insertError } = await adminSupabase.from("users").insert({
    id: data.user.id,
    email,
    role: "patient",
    provider_id: providerId,
  });

  if (insertError) return { error: insertError.message };

  if (providerId) {
    await adminSupabase
      .from("invitation_codes")
      .update({ is_consumed: true })
      .eq("code", code.trim().toUpperCase());
  }

  redirect("/patient");
}
```

- [ ] **Step 2: Make the code field optional in `app/(auth)/register/page.tsx`**

In the `PatientSignup` component, find the invitation code `<input>` and:
- Remove the `required` attribute
- Change `placeholder` to `"XXXXXXXXXXXX (optional)"`

```tsx
<input
  id="code"
  type="text"
  value={code}
  onChange={(e) => setCode(e.target.value.toUpperCase())}
  className={inputClass}
  placeholder="XXXXXXXXXXXX (optional)"
  spellCheck={false}
  autoCapitalize="characters"
/>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/auth.ts "app/(auth)/register/page.tsx"
git commit -m "feat: make patient invitation code optional at registration"
```

---

## Task 3: `claimInvitationCode` Server Action

> **DB prerequisite:** `supabase/migrations/20260618000001_account_deletion.sql` must be applied before this action will succeed — it drops the `check_patient_has_provider` constraint that would otherwise block rows with `provider_id: null`.

**Files:**
- Modify: `lib/actions/invitation.ts`

**Interfaces:**
- Produces: `claimInvitationCode(code: string): Promise<{ error: string } | void>`
  - Returns `{ error }` on any failure
  - Returns `void` on success (server revalidates `/patient/profile`; component unmounts)

- [ ] **Step 1: Add imports to `lib/actions/invitation.ts`**

The file already has `"use server"` and imports `requireRole`. Add:

```ts
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
```

- [ ] **Step 2: Add `claimInvitationCode` to `lib/actions/invitation.ts`**

Append after `generateInvitationCode`:

```ts
export async function claimInvitationCode(
  code: string
): Promise<{ error: string } | void> {
  const auth = await requireRole("patient");
  if ("error" in auth) return auth;

  const adminSupabase = createAdminClient();

  const { data: patient } = await adminSupabase
    .from("users")
    .select("provider_id")
    .eq("id", auth.userId)
    .single<{ provider_id: string | null }>();

  if (patient?.provider_id) {
    return { error: "You are already linked to a provider." };
  }

  const { data: invite, error: lookupError } = await adminSupabase
    .from("invitation_codes")
    .select("provider_id, is_consumed, expires_at")
    .eq("code", code.trim().toUpperCase())
    .single();

  if (lookupError || !invite) return { error: "Invalid invitation code." };
  if (invite.is_consumed) return { error: "This invitation code has already been used." };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { error: "This invitation code has expired." };
  }

  const { error: updateError } = await adminSupabase
    .from("users")
    .update({ provider_id: invite.provider_id })
    .eq("id", auth.userId);

  if (updateError) return { error: updateError.message };

  await adminSupabase
    .from("invitation_codes")
    .update({ is_consumed: true })
    .eq("code", code.trim().toUpperCase());

  revalidatePath("/patient/profile");
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/invitation.ts
git commit -m "feat: add claimInvitationCode server action for post-signup provider linking"
```

---

## Task 4: `ConnectProviderWidget` + Profile Page Wiring

**Files:**
- Create: `components/patient/ConnectProviderWidget.tsx`
- Modify: `app/(dashboard)/patient/profile/page.tsx`

**Interfaces:**
- Consumes: `claimInvitationCode` from `lib/actions/invitation.ts` (Task 3)
- `ConnectProviderWidget` takes no props; rendered only when `!profile?.provider_id`
- On success the server action calls `revalidatePath("/patient/profile")` which re-renders the page and unmounts this widget automatically

- [ ] **Step 1: Create `components/patient/ConnectProviderWidget.tsx`**

```tsx
"use client";

import React, { useState, useTransition } from "react";
import { claimInvitationCode } from "@/lib/actions/invitation";

const inputClass =
  "w-full h-12 rounded-card border border-border px-4 bg-card text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary";

export default function ConnectProviderWidget(): React.JSX.Element {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await claimInvitationCode(code);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="bg-card rounded-card shadow-card p-5">
      <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-3">
        Connect with your provider
      </p>
      <p className="text-sm text-placeholder mb-4">
        Enter the invitation code from your physical therapist to link your account.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXXXXXXXXX"
          spellCheck={false}
          autoCapitalize="characters"
          className={inputClass}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending || code.trim().length === 0}
          className="w-full h-12 rounded-button bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Wire `ConnectProviderWidget` into the patient profile page**

In `app/(dashboard)/patient/profile/page.tsx`:

Add the import after the existing imports:
```tsx
import ConnectProviderWidget from "@/components/patient/ConnectProviderWidget";
```

Add the widget after the provider info card section (the block that renders when `profile?.provider_id` is set). Insert it before `<LogoutButton />`:

```tsx
      {/* Connect provider widget — only when unlinked */}
      {!profile?.provider_id && <ConnectProviderWidget />}

      <LogoutButton />
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/patient/ConnectProviderWidget.tsx "app/(dashboard)/patient/profile/page.tsx"
git commit -m "feat: add ConnectProviderWidget for post-signup provider code claim"
```
