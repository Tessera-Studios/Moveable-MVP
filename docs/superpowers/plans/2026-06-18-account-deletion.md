# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow patients and providers to delete their accounts — purging patient videos and auth credentials while preserving all historical data rows for FK integrity.

**Architecture:** Two server actions (`deletePatientAccount`, `deleteProviderAccount`) in a new `lib/actions/account.ts` use the admin client to delete auth credentials and (for patients) purge videos. A single `DeleteAccountButton` client component parameterised by action and copy is wired into the patient profile page and provider dashboard. The `public.users` row survives deletion (no CASCADE) so all referencing tables remain intact.

**Tech Stack:** Next.js App Router, Supabase admin client, React `useTransition`, existing `Modal` component from `components/ui`.

## Global Constraints

- Admin client (`createAdminClient()` from `lib/supabase/admin.ts`) is required for `auth.admin.deleteUser` and all storage operations.
- `requireRole(role)` from `lib/actions/auth.ts` returns `{ supabase, userId }` on success or `{ error: string }` — always check with `if ("error" in auth)`.
- No new npm dependencies.
- `Modal` component API: `<Modal open={boolean} onClose={() => void} title={string} size?="sm"|"md"|"lg">`.

## DB prerequisite

> **Apply migration before testing.**
> File: `supabase/migrations/20260618000001_account_deletion.sql`
> Run in Supabase Dashboard SQL Editor. This removes the `ON DELETE CASCADE` from `public.users → auth.users` so the `public.users` row survives after the auth account is deleted.

---

## File Map

| File | Action |
|---|---|
| `lib/actions/account.ts` | Create — `deletePatientAccount`, `deleteProviderAccount` |
| `components/shared/DeleteAccountButton.tsx` | Create — shared confirmation modal + delete trigger |
| `app/(dashboard)/patient/profile/page.tsx` | Modify — render `DeleteAccountButton` at bottom |
| `app/(dashboard)/provider/page.tsx` | Modify — render `DeleteAccountButton` in Danger Zone section |

---

## Task 1: `deletePatientAccount` Server Action

**Files:**
- Create: `lib/actions/account.ts`

**Interfaces:**
- Produces: `deletePatientAccount(): Promise<{ error: string } | never>`
  - Returns `{ error }` on failure
  - Calls `redirect("/login")` on success (throws, hence `| never`)

- [ ] **Step 1: Create `lib/actions/account.ts` with `deletePatientAccount`**

```ts
"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deletePatientAccount(): Promise<{ error: string } | never> {
  const auth = await requireRole("patient");
  if ("error" in auth) return auth;

  const adminSupabase = createAdminClient();

  // Delete form-check videos from storage and DB
  const { data: videos } = await adminSupabase
    .from("videos")
    .select("storage_path")
    .eq("uploader_id", auth.userId);

  if (videos && videos.length > 0) {
    const paths = videos.map((v: { storage_path: string }) => v.storage_path);
    await adminSupabase.storage.from("exercise-videos").remove(paths);
    await adminSupabase.from("videos").delete().eq("uploader_id", auth.userId);
  }

  // Unlink from provider so they no longer appear in the provider's roster
  await adminSupabase
    .from("users")
    .update({ provider_id: null })
    .eq("id", auth.userId);

  // Delete auth account — public.users row stays (no CASCADE after migration)
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
    auth.userId
  );
  if (deleteError) return { error: deleteError.message };

  redirect("/login");
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/account.ts
git commit -m "feat: add deletePatientAccount server action"
```

---

## Task 2: `deleteProviderAccount` Server Action

**Files:**
- Modify: `lib/actions/account.ts`

**Interfaces:**
- Produces: `deleteProviderAccount(): Promise<{ error: string } | never>`
  - Returns `{ error: "Remove all your patients before deleting your account." }` if patient count > 0
  - Returns `{ error }` on other failures
  - Calls `redirect("/login")` on success

- [ ] **Step 1: Append `deleteProviderAccount` to `lib/actions/account.ts`**

```ts
export async function deleteProviderAccount(): Promise<{ error: string } | never> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const adminSupabase = createAdminClient();

  // Block deletion if any patients are still linked
  const { count } = await adminSupabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("provider_id", auth.userId);

  if (count && count > 0) {
    return { error: "Remove all your patients before deleting your account." };
  }

  // Delete auth account — all other data is preserved
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
    auth.userId
  );
  if (deleteError) return { error: deleteError.message };

  redirect("/login");
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/account.ts
git commit -m "feat: add deleteProviderAccount server action"
```

---

## Task 3: `DeleteAccountButton` Component + Page Wiring

**Files:**
- Create: `components/shared/DeleteAccountButton.tsx`
- Modify: `app/(dashboard)/patient/profile/page.tsx`
- Modify: `app/(dashboard)/provider/page.tsx`

**Interfaces:**
- Consumes: `deletePatientAccount` and `deleteProviderAccount` from `lib/actions/account.ts` (Tasks 1–2)
- `Modal` from `@/components/ui` — props: `open: boolean`, `onClose: () => void`, `title: string`, `size?: "sm" | "md" | "lg"`

```ts
type DeleteAccountButtonProps = {
  action: () => Promise<{ error: string } | never>;
  confirmationMessage: string;
};
```

- [ ] **Step 1: Create `components/shared/DeleteAccountButton.tsx`**

```tsx
"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui";

type Props = {
  action: () => Promise<{ error: string } | never>;
  confirmationMessage: string;
};

export default function DeleteAccountButton({
  action,
  confirmationMessage,
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(): void {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <>
      {error && (
        <p className="text-sm text-red-500 text-center mb-2">{error}</p>
      )}
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="w-full h-12 rounded-button bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
      >
        Delete Account
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete Account" size="sm">
        <p className="text-sm text-foreground mb-6">{confirmationMessage}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 h-12 rounded-button border border-border text-foreground font-medium hover:bg-background transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 h-12 rounded-button bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Wire into patient profile page**

In `app/(dashboard)/patient/profile/page.tsx`, add the import:

```tsx
import DeleteAccountButton from "@/components/shared/DeleteAccountButton";
import { deletePatientAccount } from "@/lib/actions/account";
```

Add before the closing `</div>` of the page (after `<LogoutButton />`):

```tsx
      {/* Danger zone */}
      <div className="bg-card rounded-card shadow-card p-5">
        <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-4">
          Danger Zone
        </p>
        <DeleteAccountButton
          action={deletePatientAccount}
          confirmationMessage="This will permanently delete your account and your recorded videos. Your session history will be kept. This cannot be undone."
        />
      </div>
```

- [ ] **Step 3: Wire into provider dashboard page**

In `app/(dashboard)/provider/page.tsx`, add the import at the top:

```tsx
import DeleteAccountButton from "@/components/shared/DeleteAccountButton";
import { deleteProviderAccount } from "@/lib/actions/account";
```

Add at the very bottom of the page's JSX (after all existing sections):

```tsx
      {/* Danger zone */}
      <div className="bg-card rounded-card shadow-card p-5 mb-6">
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
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/shared/DeleteAccountButton.tsx "app/(dashboard)/patient/profile/page.tsx" "app/(dashboard)/provider/page.tsx"
git commit -m "feat: add DeleteAccountButton and wire up to patient profile and provider dashboard"
```
