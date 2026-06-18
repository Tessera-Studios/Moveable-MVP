# Phase 6 — Realtime Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one-on-one text chat between Provider and Patient with Supabase Realtime (Postgres Changes, Broadcast, Presence), unread badges, typing indicators, and presence dots.

**Architecture:** Single Supabase Realtime channel per open conversation, managed inside `ChatWindow` (Client Component). Page shells are Server Components that fetch initial data and pass it as props. Context (`UnreadCountProvider`) bridges the server-fetched unread count to the fixed `BottomTabBar`.

**Tech Stack:** Next.js 16.2.9, React 19.2.4, `@supabase/supabase-js` 2.108.2, `@supabase/ssr` 0.12.0, Tailwind CSS v4

## Global Constraints

- No new npm dependencies — everything needed is already installed
- Supabase browser client: `createClient()` from `@/lib/supabase/client` (returns `SupabaseClient` via `createBrowserClient`)
- Supabase server client: `await createClient()` from `@/lib/supabase/server`
- All Server Actions: `"use server"` directive at top of file
- All Client Components: `"use client"` directive at top of file
- Return type pattern for actions: `T | { error: string }` — never throw
- No test framework configured — verify with `npx tsc --noEmit` and manual browser checks
- DB migration must be applied manually in the Supabase Dashboard SQL Editor
- Tab bar height is `56px` (min-h on tab items); use `calc(100dvh-56px)` for full-height chat views
- Colors: `bg-primary text-white` for sent messages; `bg-card text-foreground` for received; `bg-error` for unread badge/failed

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/20260618000000_phase6_chat.sql` | Create | is_read column, Realtime publication, mark-read policy, unread index |
| `lib/types.ts` | Modify | Add `is_read` to Message; add `ClientMessage`, `ConversationRow` |
| `lib/actions/messages.ts` | Create | sendMessage, getMessages, getConversations, markMessagesRead, getUnreadCount |
| `components/chat/UnreadCountProvider.tsx` | Create | React context for unread count shared between layout and ChatWindow |
| `app/(dashboard)/layout.tsx` | Modify | Fetch unread count; wrap children+BottomTabBar in UnreadCountProvider |
| `components/shared/BottomTabBar.tsx` | Modify | Update /messages → /chat routes; add UnreadBadge to Messages tab |
| `components/chat/UnreadBadge.tsx` | Create | Red circle badge reading from UnreadCountProvider context |
| `components/chat/PresenceDot.tsx` | Create | Green/gray dot for online status |
| `components/chat/TypingIndicator.tsx` | Create | "Name is typing…" display |
| `components/chat/MessageBubble.tsx` | Create | Sent/received bubble with optimistic status |
| `components/chat/MessageInput.tsx` | Create | Textarea + send button + typing broadcast |
| `components/chat/MessageList.tsx` | Create | Scrollable message list with pagination |
| `components/chat/ChatWindow.tsx` | Create | Core realtime component; manages channel lifecycle |
| `components/chat/ChatList.tsx` | Create | Provider conversation list |
| `app/(dashboard)/provider/chat/page.tsx` | Create | Provider conversation list page |
| `app/(dashboard)/provider/chat/[patientId]/page.tsx` | Create | Provider ↔ patient active chat page |
| `app/(dashboard)/provider/messages/page.tsx` | Create | Redirect to /provider/chat |
| `app/(dashboard)/patient/chat/page.tsx` | Create | Patient ↔ provider active chat page |
| `app/(dashboard)/patient/messages/page.tsx` | Create | Redirect to /patient/chat |
| `PROGRESS.md` | Modify | Record Phase 6 completion |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260618000000_phase6_chat.sql`

**Interfaces:**
- Produces: `messages.is_read` column; `messages_mark_read` RLS policy; `idx_messages_unread` index; Realtime publication entry

- [ ] **Step 1: Write the migration file**

```sql
-- Phase 6: Realtime Chat additions

-- 1. is_read column (DEFAULT false so existing rows are treated as unread-legacy)
ALTER TABLE public.messages
  ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

-- 2. Enable Postgres Changes subscriptions on messages
--    Without this ALTER PUBLICATION, channel.on('postgres_changes', ...) fires nothing.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 3. Allow the receiver to mark messages as read.
--    The existing messages_access policy has WITH CHECK (sender_id = auth.uid()),
--    which blocks any UPDATE by the receiver. A dedicated policy is required.
CREATE POLICY messages_mark_read ON public.messages
  FOR UPDATE TO authenticated
  USING (receiver_id = (SELECT auth.uid()))
  WITH CHECK (receiver_id = (SELECT auth.uid()));

-- 4. Partial index for fast unread-count queries
--    (receiver_id, is_read) WHERE is_read = false avoids full-table scans.
CREATE INDEX idx_messages_unread ON public.messages(receiver_id, is_read)
  WHERE is_read = false;
```

- [ ] **Step 2: Apply the migration manually**

Open the Supabase Dashboard → SQL Editor → paste the migration → Run.

Verify in Table Editor:
- `messages` table has an `is_read` column (boolean, not null, default false)
- Policies on `messages` show `messages_mark_read` alongside `messages_access`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260618000000_phase6_chat.sql
git commit -m "feat(chat): add is_read column, realtime publication, mark-read policy"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: updated `Message` interface; new `ClientMessage` type; new `ConversationRow` interface — used by every subsequent task

- [ ] **Step 1: Add `is_read` to `Message`, and add the two new types**

Open `lib/types.ts`. Make these three changes:

**Change 1** — add `is_read` to `Message` (after `media_url`):
```typescript
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  is_read: boolean;
}
```

**Change 2** — add `ClientMessage` after the `Message` interface:
```typescript
export type ClientMessage = Message & {
  _optimistic?: boolean;
  _status?: "sending" | "sent" | "failed";
};
```

**Change 3** — add `ConversationRow` after `ClientMessage`:
```typescript
export interface ConversationRow {
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. (The `is_read` addition may cause type errors in existing code if `Message` objects are constructed anywhere — scan the output and fix any "missing is_read" errors by adding `is_read: false` to the relevant object literals.)

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(chat): add is_read to Message, ClientMessage and ConversationRow types"
```

---

## Task 3: Server Actions

**Files:**
- Create: `lib/actions/messages.ts`

**Interfaces:**
- Consumes: `Message`, `ClientMessage`, `ConversationRow` from `@/lib/types`; `createClient` from `@/lib/supabase/server`
- Produces:
  - `sendMessage(receiverId: string, content: string): Promise<Message | { error: string }>`
  - `getMessages(otherUserId: string, before?: string): Promise<Message[] | { error: string }>`
  - `getConversations(): Promise<ConversationRow[] | { error: string }>`
  - `markMessagesRead(otherUserId: string): Promise<void>`
  - `getUnreadCount(): Promise<number>`

- [ ] **Step 1: Create `lib/actions/messages.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import type { Message, ConversationRow } from "@/lib/types";

export async function sendMessage(
  receiverId: string,
  content: string
): Promise<Message | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: sender } = await supabase
    .from("users")
    .select("role, provider_id")
    .eq("id", user.id)
    .single<{ role: string; provider_id: string | null }>();

  if (!sender) return { error: "User profile not found." };

  let allowed = false;
  if (sender.role === "patient") {
    allowed = sender.provider_id === receiverId;
  } else if (sender.role === "provider") {
    const { data: receiver } = await supabase
      .from("users")
      .select("provider_id")
      .eq("id", receiverId)
      .single<{ provider_id: string | null }>();
    allowed = receiver?.provider_id === user.id;
  }

  if (!allowed) return { error: "Cannot message this user." };

  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: user.id, receiver_id: receiverId, content })
    .select()
    .single<Message>();

  if (error || !data) return { error: error?.message ?? "Failed to send." };
  return data;
}

export async function getMessages(
  otherUserId: string,
  before?: string
): Promise<Message[] | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  let query = supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  return ((data ?? []) as Message[]).reverse();
}

export async function getConversations(): Promise<
  ConversationRow[] | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: messages, error } = await supabase
    .from("messages")
    .select("sender_id, receiver_id, content, created_at, is_read")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const convMap = new Map<
    string,
    { lastMessage: string; lastMessageAt: string; unreadCount: number }
  >();

  for (const msg of messages ?? []) {
    const otherId =
      (msg.sender_id as string) === user.id
        ? (msg.receiver_id as string)
        : (msg.sender_id as string);

    if (!convMap.has(otherId)) {
      convMap.set(otherId, {
        lastMessage: msg.content as string,
        lastMessageAt: msg.created_at as string,
        unreadCount: 0,
      });
    }
    if ((msg.receiver_id as string) === user.id && msg.is_read === false) {
      convMap.get(otherId)!.unreadCount++;
    }
  }

  if (convMap.size === 0) return [];

  const otherIds = Array.from(convMap.keys());
  const { data: otherUsers } = await supabase
    .from("users")
    .select("id, email")
    .in("id", otherIds);

  const emailMap = new Map(
    (otherUsers ?? []).map((u) => [u.id as string, u.email as string])
  );

  return otherIds.map((id) => ({
    otherUserId: id,
    otherUserName: emailMap.get(id) ?? id,
    ...convMap.get(id)!,
  }));
}

export async function markMessagesRead(otherUserId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Silently swallow errors — never block the user from reading messages.
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("receiver_id", user.id)
    .eq("sender_id", otherUserId)
    .eq("is_read", false);
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("is_read", false);

  return count ?? 0;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/messages.ts
git commit -m "feat(chat): add message server actions (send, get, conversations, unread)"
```

---

## Task 4: UnreadCountProvider Context

**Files:**
- Create: `components/chat/UnreadCountProvider.tsx`

**Interfaces:**
- Produces:
  - `UnreadCountProvider({ children, initialCount })` — wraps subtree with context
  - `useUnreadCount(): { unreadCount: number; setUnreadCount: (n: number) => void }` — consumed by BottomTabBar (via UnreadBadge) and ChatWindow

- [ ] **Step 1: Create `components/chat/UnreadCountProvider.tsx`**

```typescript
"use client";

import React, { createContext, useContext, useState } from "react";

interface UnreadCountContextValue {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
}

const UnreadCountContext = createContext<UnreadCountContextValue | null>(null);

export function UnreadCountProvider({
  children,
  initialCount,
}: {
  children: React.ReactNode;
  initialCount: number;
}): React.JSX.Element {
  const [unreadCount, setUnreadCount] = useState(initialCount);
  return (
    <UnreadCountContext.Provider value={{ unreadCount, setUnreadCount }}>
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount(): UnreadCountContextValue {
  const ctx = useContext(UnreadCountContext);
  if (!ctx)
    throw new Error("useUnreadCount must be used within UnreadCountProvider");
  return ctx;
}
```

- [ ] **Step 2: Update `app/(dashboard)/layout.tsx`**

Replace the entire file with:

```typescript
import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/actions/messages";
import BottomTabBar from "@/components/shared/BottomTabBar";
import { UnreadCountProvider } from "@/components/chat/UnreadCountProvider";
import type { Profile } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, unreadCount] = await Promise.all([
    supabase
      .from("users")
      .select("id, role, provider_id, created_at")
      .eq("id", user.id)
      .single<Profile>(),
    getUnreadCount(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <UnreadCountProvider initialCount={unreadCount}>
        <main className="max-w-[512px] mx-auto pb-20">{children}</main>
        <BottomTabBar role={profile?.role ?? "patient"} />
      </UnreadCountProvider>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/chat/UnreadCountProvider.tsx app/(dashboard)/layout.tsx
git commit -m "feat(chat): add UnreadCountProvider context and wire into layout"
```

---

## Task 5: UnreadBadge + BottomTabBar Update

**Files:**
- Create: `components/chat/UnreadBadge.tsx`
- Modify: `components/shared/BottomTabBar.tsx`

**Interfaces:**
- Consumes: `useUnreadCount()` from `@/components/chat/UnreadCountProvider`
- Produces: `UnreadBadge` component; updated tab routes; badge on Messages tab

- [ ] **Step 1: Create `components/chat/UnreadBadge.tsx`**

```typescript
"use client";

import React from "react";
import { useUnreadCount } from "./UnreadCountProvider";

export function UnreadBadge(): React.JSX.Element | null {
  const { unreadCount } = useUnreadCount();
  if (unreadCount === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-error text-white text-[9px] font-bold leading-none">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );
}
```

- [ ] **Step 2: Update `components/shared/BottomTabBar.tsx`**

Make three targeted changes:

**Change 1** — Add `showBadge` to the `Tab` interface:
```typescript
interface Tab {
  label: string;
  path: string;
  icon: React.JSX.Element;
  showBadge?: boolean;
}
```

**Change 2** — Update `PROVIDER_TABS` and `PATIENT_TABS` (change `/messages` → `/chat` and mark the Messages tab with `showBadge: true`):
```typescript
const PROVIDER_TABS: Tab[] = [
  { label: "Home", path: "/provider", icon: <IconHome /> },
  { label: "Patients", path: "/provider/patients", icon: <IconUsers /> },
  { label: "Templates", path: "/provider/templates", icon: <IconClipboard /> },
  { label: "Messages", path: "/provider/chat", icon: <IconMessageCircle />, showBadge: true },
];

const PATIENT_TABS: Tab[] = [
  { label: "Home", path: "/patient", icon: <IconHome /> },
  { label: "Exercises", path: "/patient/profile", icon: <IconActivity /> },
  { label: "Progress", path: "/patient/progress", icon: <IconTrendingUp /> },
  { label: "Messages", path: "/patient/chat", icon: <IconMessageCircle />, showBadge: true },
];
```

**Change 3** — Add `import { UnreadBadge }` at the top (after existing imports) and update the icon `<span>` in the render to show the badge:

Add import:
```typescript
import { UnreadBadge } from "@/components/chat/UnreadBadge";
```

Update the icon span in the JSX (inside the `tabs.map` return):
```typescript
<span className="min-w-[44px] min-h-[44px] flex items-center justify-center relative">
  {tab.icon}
  {tab.showBadge && <UnreadBadge />}
</span>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/chat/UnreadBadge.tsx components/shared/BottomTabBar.tsx
git commit -m "feat(chat): add UnreadBadge and update tab routes to /chat"
```

---

## Task 6: PresenceDot + TypingIndicator

**Files:**
- Create: `components/chat/PresenceDot.tsx`
- Create: `components/chat/TypingIndicator.tsx`

**Interfaces:**
- Produces:
  - `PresenceDot({ online: boolean }): JSX.Element`
  - `TypingIndicator({ name: string }): JSX.Element`

- [ ] **Step 1: Create `components/chat/PresenceDot.tsx`**

```typescript
"use client";

import React from "react";

export function PresenceDot({
  online,
}: {
  online: boolean;
}): React.JSX.Element {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        online ? "bg-green-500" : "bg-gray-400"
      }`}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}
```

- [ ] **Step 2: Create `components/chat/TypingIndicator.tsx`**

```typescript
"use client";

import React from "react";

export function TypingIndicator({
  name,
}: {
  name: string;
}): React.JSX.Element {
  return (
    <div className="px-4 py-1 text-sm text-placeholder italic">
      {name} is typing…
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/chat/PresenceDot.tsx components/chat/TypingIndicator.tsx
git commit -m "feat(chat): add PresenceDot and TypingIndicator components"
```

---

## Task 7: MessageBubble

**Files:**
- Create: `components/chat/MessageBubble.tsx`

**Interfaces:**
- Consumes: `ClientMessage` from `@/lib/types`
- Produces: `MessageBubble({ message: ClientMessage; isSent: boolean; onRetry?: (msg: ClientMessage) => void }): JSX.Element`

- [ ] **Step 1: Create `components/chat/MessageBubble.tsx`**

```typescript
"use client";

import React from "react";
import type { ClientMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ClientMessage;
  isSent: boolean;
  onRetry?: (message: ClientMessage) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  message,
  isSent,
  onRetry,
}: MessageBubbleProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col mb-2 ${isSent ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isSent
            ? "bg-primary text-white rounded-br-sm"
            : "bg-card text-foreground rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-placeholder">
        <span>{formatTime(message.created_at)}</span>
        {isSent && message._status === "sending" && <span>Sending…</span>}
        {isSent && message._status === "failed" && (
          <>
            <span className="text-error">Failed</span>
            {onRetry && (
              <button
                onClick={() => onRetry(message)}
                className="text-primary underline"
                type="button"
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/chat/MessageBubble.tsx
git commit -m "feat(chat): add MessageBubble component"
```

---

## Task 8: MessageInput

**Files:**
- Create: `components/chat/MessageInput.tsx`

**Interfaces:**
- Consumes: `RealtimeChannel` from `@supabase/supabase-js`
- Produces: `MessageInput({ channelRef: React.RefObject<RealtimeChannel | null>; currentUserId: string; onSend: (content: string) => void; isSending: boolean }): JSX.Element`

- [ ] **Step 1: Create `components/chat/MessageInput.tsx`**

```typescript
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface MessageInputProps {
  channelRef: React.RefObject<RealtimeChannel | null>;
  currentUserId: string;
  onSend: (content: string) => void;
  isSending: boolean;
}

export function MessageInput({
  channelRef,
  currentUserId,
  onSend,
  isSending,
}: MessageInputProps): React.JSX.Element {
  const [content, setContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const broadcastTyping = useCallback(() => {
    if (!channelRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId },
      });
    }, 300);
  }, [channelRef, currentUserId]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setContent(e.target.value);
    broadcastTyping();
  }

  function submit(): void {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setContent("");
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 border-t border-border p-3 bg-background"
    >
      <textarea
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Message…"
        rows={1}
        className="flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
      />
      <button
        type="submit"
        disabled={!content.trim() || isSending}
        className="flex-shrink-0 rounded-full bg-primary text-white w-9 h-9 flex items-center justify-center disabled:opacity-40 transition-opacity"
        aria-label="Send"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/chat/MessageInput.tsx
git commit -m "feat(chat): add MessageInput with debounced typing broadcast"
```

---

## Task 9: MessageList

**Files:**
- Create: `components/chat/MessageList.tsx`

**Interfaces:**
- Consumes:
  - `ClientMessage` from `@/lib/types`
  - `MessageBubble({ message, isSent, onRetry })` from `./MessageBubble`
  - `getMessages(otherUserId, before?)` from `@/lib/actions/messages`
- Produces: `MessageList({ messages: ClientMessage[]; currentUserId: string; otherUserId: string; onRetry: (msg: ClientMessage) => void; onPrepend: (msgs: ClientMessage[]) => void }): JSX.Element`

- [ ] **Step 1: Create `components/chat/MessageList.tsx`**

```typescript
"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ClientMessage } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { getMessages } from "@/lib/actions/messages";

interface MessageListProps {
  messages: ClientMessage[];
  currentUserId: string;
  otherUserId: string;
  onRetry: (message: ClientMessage) => void;
  onPrepend: (messages: ClientMessage[]) => void;
}

export function MessageList({
  messages,
  currentUserId,
  otherUserId,
  onRetry,
  onPrepend,
}: MessageListProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Auto-scroll to bottom whenever a new message arrives
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  async function loadOlder(): Promise<void> {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldest = messages[0].created_at;
    const el = containerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    const result = await getMessages(otherUserId, oldest);
    if (!("error" in result)) {
      if (result.length < 30) setHasMore(false);
      const older = result.map((m) => ({ ...m, _status: "sent" as const }));
      onPrepend(older);
      // Restore scroll position so viewport doesn't jump
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        }
      });
    }

    setLoadingMore(false);
  }

  function handleScroll(): void {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop === 0 && hasMore && !loadingMore) {
      void loadOlder();
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-placeholder text-sm px-6 text-center">
        No messages yet. Say hello!
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4 flex flex-col"
    >
      {loadingMore && (
        <div className="text-center text-placeholder text-xs py-2">
          Loading…
        </div>
      )}
      {!hasMore && messages.length >= 30 && (
        <div className="text-center text-placeholder text-xs py-2">
          Beginning of conversation
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isSent={msg.sender_id === currentUserId}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/chat/MessageList.tsx
git commit -m "feat(chat): add MessageList with scroll-to-bottom and cursor pagination"
```

---

## Task 10: ChatWindow

**Files:**
- Create: `components/chat/ChatWindow.tsx`

**Interfaces:**
- Consumes:
  - `createClient()` from `@/lib/supabase/client` (browser client — not server)
  - `sendMessage(receiverId, content)` from `@/lib/actions/messages`
  - `markMessagesRead(otherUserId)` from `@/lib/actions/messages`
  - `useUnreadCount()` from `./UnreadCountProvider`
  - `MessageList`, `MessageInput`, `TypingIndicator`, `PresenceDot` from `./`
  - `Message`, `ClientMessage` from `@/lib/types`
- Produces: `ChatWindow({ initialMessages: Message[]; currentUserId: string; otherUser: { id: string; name: string } }): JSX.Element`

- [ ] **Step 1: Create `components/chat/ChatWindow.tsx`**

```typescript
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markMessagesRead } from "@/lib/actions/messages";
import { useUnreadCount } from "./UnreadCountProvider";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { PresenceDot } from "./PresenceDot";
import type { Message, ClientMessage } from "@/lib/types";

interface ChatWindowProps {
  initialMessages: Message[];
  currentUserId: string;
  otherUser: { id: string; name: string };
}

export function ChatWindow({
  initialMessages,
  currentUserId,
  otherUser,
}: ChatWindowProps): React.JSX.Element {
  const [messages, setMessages] = useState<ClientMessage[]>(
    initialMessages.map((m) => ({ ...m, _status: "sent" as const }))
  );
  const [isOnline, setIsOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [channelStatus, setChannelStatus] = useState<string>("CONNECTING");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { setUnreadCount } = useUnreadCount();

  // Mark conversation as read on open
  useEffect(() => {
    void markMessagesRead(otherUser.id);
    setUnreadCount(0);
  }, [otherUser.id, setUnreadCount]);

  // Set up Realtime channel
  useEffect(() => {
    const supabase = createClient();
    const channelId = `chat:${[currentUserId, otherUser.id].sort().join("-")}`;

    const channel = supabase
      .channel(channelId, { config: { broadcast: { ack: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          // Filter to only messages in this conversation
          const inConversation =
            (msg.sender_id === currentUserId && msg.receiver_id === otherUser.id) ||
            (msg.sender_id === otherUser.id && msg.receiver_id === currentUserId);
          if (!inConversation) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, { ...msg, _status: "sent" }];
          });

          if (msg.receiver_id === currentUserId) {
            void markMessagesRead(otherUser.id);
          }
        }
      )
      .on("broadcast", { event: "typing" }, () => {
        setIsTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 2000);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        const others = Object.values(state)
          .flat()
          .filter((p) => p.user_id !== currentUserId);
        setIsOnline(others.length > 0);
      })
      .subscribe(async (status) => {
        setChannelStatus(status);
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUser.id]);

  const handleSend = useCallback(
    async (content: string): Promise<void> => {
      const tempId = `optimistic-${Date.now()}`;
      const optimistic: ClientMessage = {
        id: tempId,
        sender_id: currentUserId,
        receiver_id: otherUser.id,
        content,
        media_url: null,
        is_read: false,
        created_at: new Date().toISOString(),
        _optimistic: true,
        _status: "sending",
      };

      setMessages((prev) => [...prev, optimistic]);
      setIsSending(true);

      const result = await sendMessage(otherUser.id, content);
      setIsSending(false);

      if ("error" in result) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, _status: "failed" } : m
          )
        );
      } else {
        // Replace optimistic with confirmed message; Postgres Changes may also
        // fire — the duplicate guard in the handler prevents double-append.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...result, _status: "sent" } : m
          )
        );
      }
    },
    [currentUserId, otherUser.id]
  );

  function handleRetry(message: ClientMessage): void {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    void handleSend(message.content);
  }

  function handlePrepend(older: ClientMessage[]): void {
    setMessages((prev) => [...older, ...prev]);
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <PresenceDot online={isOnline} />
        <span className="font-medium text-sm truncate">{otherUser.name}</span>
      </div>

      {/* Reconnecting banner — shown after initial connect attempt fails */}
      {channelStatus !== "SUBSCRIBED" && channelStatus !== "CONNECTING" && (
        <div className="flex-shrink-0 bg-amber-50 text-amber-700 text-xs text-center py-1 border-b border-amber-200">
          Reconnecting…
        </div>
      )}

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        otherUserId={otherUser.id}
        onRetry={handleRetry}
        onPrepend={handlePrepend}
      />

      {isTyping && <TypingIndicator name={otherUser.name} />}

      <MessageInput
        channelRef={channelRef}
        currentUserId={currentUserId}
        onSend={(content) => void handleSend(content)}
        isSending={isSending}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "feat(chat): add ChatWindow with Realtime channel, presence, typing, optimistic sends"
```

---

## Task 11: ChatList

**Files:**
- Create: `components/chat/ChatList.tsx`

**Interfaces:**
- Consumes: `ConversationRow` from `@/lib/types`; `Avatar` from `@/components/ui/Avatar`
- Produces: `ChatList({ conversations: ConversationRow[] }): JSX.Element`

- [ ] **Step 1: Create `components/chat/ChatList.tsx`**

```typescript
"use client";

import React from "react";
import Link from "next/link";
import type { ConversationRow } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ChatList({
  conversations,
}: {
  conversations: ConversationRow[];
}): React.JSX.Element {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-placeholder text-sm text-center px-6">
        <p>No conversations yet.</p>
        <p className="mt-1">Your patients can message you from their app.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {conversations.map((conv) => (
        <li key={conv.otherUserId}>
          <Link
            href={`/provider/chat/${conv.otherUserId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-card/60 transition-colors"
          >
            <Avatar name={conv.otherUserName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm truncate ${
                    conv.unreadCount > 0
                      ? "font-semibold text-foreground"
                      : "font-medium text-foreground"
                  }`}
                >
                  {conv.otherUserName}
                </span>
                <span className="text-[10px] text-placeholder flex-shrink-0">
                  {formatRelativeTime(conv.lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-xs text-placeholder truncate">
                  {conv.lastMessage.slice(0, 60)}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-error text-white text-[10px] font-bold">
                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/chat/ChatList.tsx
git commit -m "feat(chat): add ChatList component for provider conversation view"
```

---

## Task 12: Provider Chat Pages + Redirect

**Files:**
- Create: `app/(dashboard)/provider/chat/page.tsx`
- Create: `app/(dashboard)/provider/chat/[patientId]/page.tsx`
- Create: `app/(dashboard)/provider/messages/page.tsx`

**Interfaces:**
- Consumes:
  - `getConversations()` returning `ConversationRow[] | { error: string }`
  - `getMessages(patientId)` returning `Message[] | { error: string }`
  - `ChatList({ conversations })` from `@/components/chat/ChatList`
  - `ChatWindow({ initialMessages, currentUserId, otherUser })` from `@/components/chat/ChatWindow`
  - Server-side `createClient()` from `@/lib/supabase/server`

- [ ] **Step 1: Create `app/(dashboard)/provider/chat/page.tsx`**

```typescript
import React from "react";
import { getConversations } from "@/lib/actions/messages";
import { ChatList } from "@/components/chat/ChatList";
import type { ConversationRow } from "@/lib/types";

export default async function ProviderChatPage(): Promise<React.JSX.Element> {
  const result = await getConversations();
  const conversations: ConversationRow[] =
    "error" in result ? [] : result;

  return (
    <div className="pt-4">
      <h1 className="px-4 text-lg font-semibold mb-3">Messages</h1>
      <ChatList conversations={conversations} />
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/provider/chat/[patientId]/page.tsx`**

```typescript
import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/actions/messages";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { Message } from "@/lib/types";

export default async function ProviderPatientChatPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<React.JSX.Element> {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: patient } = await supabase
    .from("users")
    .select("id, email, provider_id")
    .eq("id", patientId)
    .single<{ id: string; email: string; provider_id: string | null }>();

  if (!patient || patient.provider_id !== user.id) notFound();

  const result = await getMessages(patientId);
  const initialMessages: Message[] = "error" in result ? [] : result;

  return (
    <ChatWindow
      initialMessages={initialMessages}
      currentUserId={user.id}
      otherUser={{ id: patient.id, name: patient.email }}
    />
  );
}
```

- [ ] **Step 3: Create `app/(dashboard)/provider/messages/page.tsx`**

```typescript
import { redirect } from "next/navigation";

export default function ProviderMessagesRedirect(): never {
  redirect("/provider/chat");
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/provider/chat/page.tsx \
        "app/(dashboard)/provider/chat/[patientId]/page.tsx" \
        app/(dashboard)/provider/messages/page.tsx
git commit -m "feat(chat): add provider chat list, conversation, and redirect pages"
```

---

## Task 13: Patient Chat Page + Redirect + PROGRESS.md

**Files:**
- Create: `app/(dashboard)/patient/chat/page.tsx`
- Create: `app/(dashboard)/patient/messages/page.tsx`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes:
  - `getMessages(providerId)` returning `Message[] | { error: string }`
  - `ChatWindow({ initialMessages, currentUserId, otherUser })` from `@/components/chat/ChatWindow`
  - `Profile` from `@/lib/types`

- [ ] **Step 1: Create `app/(dashboard)/patient/chat/page.tsx`**

```typescript
import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/actions/messages";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { Message, Profile } from "@/lib/types";

export default async function PatientChatPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, provider_id, created_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile?.provider_id) {
    redirect("/patient");
  }

  const [{ data: provider }, result] = await Promise.all([
    supabase
      .from("users")
      .select("id, email")
      .eq("id", profile.provider_id)
      .single<{ id: string; email: string }>(),
    getMessages(profile.provider_id),
  ]);

  const initialMessages: Message[] = "error" in result ? [] : result;

  return (
    <ChatWindow
      initialMessages={initialMessages}
      currentUserId={user.id}
      otherUser={{
        id: profile.provider_id,
        name: provider?.email ?? profile.provider_id,
      }}
    />
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/patient/messages/page.tsx`**

```typescript
import { redirect } from "next/navigation";

export default function PatientMessagesRedirect(): never {
  redirect("/patient/chat");
}
```

- [ ] **Step 3: Final build check**

```bash
npx tsc --noEmit && npm run build
```

Expected: 0 TypeScript errors, successful Next.js build. Fix any type or import errors before committing.

- [ ] **Step 4: Update `PROGRESS.md`**

Add the following section after the Phase 5 entry and before the "Phases Remaining" table:

```markdown
---

## Phase 6 — Realtime Chat (Complete)

**Completed:** 2026-06-18
**Spec:** `docs/06-REALTIME-CHAT.md`
**Design:** `docs/superpowers/specs/2026-06-18-phase6-realtime-chat-design.md`
**Plan:** `docs/superpowers/plans/2026-06-18-phase6-realtime-chat.md`

### Scoping decisions (locked)
- Text-only — no media attachments
- Routes: `/provider/chat` and `/patient/chat`; old `/messages` paths redirect
- Unread badge in scope; typing indicator + presence in scope
- Media attachments deferred to a future phase

### What was built

**Database**
- `supabase/migrations/20260618000000_phase6_chat.sql` — `is_read BOOLEAN NOT NULL DEFAULT false` column on `messages`; `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages`; `messages_mark_read` UPDATE policy for receivers; `idx_messages_unread` partial index

**Server Actions**
- `lib/actions/messages.ts` — `sendMessage`, `getMessages` (cursor-paginated), `getConversations` (groups by other participant), `markMessagesRead` (silently swallowed), `getUnreadCount`

**Context**
- `components/chat/UnreadCountProvider.tsx` — React context bridging server-fetched unread count to the fixed BottomTabBar and ChatWindow

**Layout**
- `app/(dashboard)/layout.tsx` — fetches unread count in parallel with profile; wraps both `<main>` and `<BottomTabBar>` in `UnreadCountProvider`

**Components** (`components/chat/`)
- `UnreadBadge.tsx` — reads from context; red dot on Messages tab
- `PresenceDot.tsx` — green/gray online indicator
- `TypingIndicator.tsx` — "Name is typing…" with 2s timeout
- `MessageBubble.tsx` — sent/received styling, optimistic status, retry button
- `MessageInput.tsx` — textarea + send, 300ms debounced typing broadcast, timer cleanup on unmount
- `MessageList.tsx` — auto-scroll, scroll-position-preserving pagination, end-of-history marker
- `ChatWindow.tsx` — Supabase Realtime channel (Postgres Changes + Broadcast + Presence), optimistic sends, reconnecting banner
- `ChatList.tsx` — provider conversation list with unread counts

**Tab Bar**
- `components/shared/BottomTabBar.tsx` — routes updated to `/provider/chat` and `/patient/chat`; Messages tab shows `UnreadBadge`

**Pages**
- `app/(dashboard)/provider/chat/page.tsx` — conversation list
- `app/(dashboard)/provider/chat/[patientId]/page.tsx` — active chat
- `app/(dashboard)/patient/chat/page.tsx` — patient's single conversation
- `app/(dashboard)/provider/messages/page.tsx` — redirect
- `app/(dashboard)/patient/messages/page.tsx` — redirect

### Known gaps
- DB migration must be applied manually
- `messages.is_read` defaults to `false` for all pre-existing rows (treated as unread-legacy)
- Display name is patient/provider email (no separate name column in `users`)
- No automated tests for Realtime delivery (requires two live WebSocket clients)
- Media attachments not implemented
```

Update the "Phases Remaining" table to mark Phase 6 complete:

```markdown
| Phase | Spec | Status |
|---|---|---|
| 6 — Realtime Chat | `docs/06-REALTIME-CHAT.md` | Complete |
| 7 — Document Export | `docs/07-DOCUMENT-EXPORT.md` | Not started |
```

- [ ] **Step 5: Commit everything**

```bash
git add app/(dashboard)/patient/chat/page.tsx \
        app/(dashboard)/patient/messages/page.tsx \
        PROGRESS.md
git commit -m "feat(chat): add patient chat page, redirect stubs, update PROGRESS.md"
```

---

## Manual Verification Checklist

After all tasks are committed, verify in a browser:

**Provider flow:**
1. Log in as a provider → Messages tab shows `/provider/chat`
2. If no messages exist, see empty state in ChatList
3. Navigate to `/provider/messages` → should redirect to `/provider/chat`
4. Open a patient conversation → ChatWindow renders with presence dot and input
5. Send a message → appears immediately (optimistic), confirmed shortly after
6. Unread badge on Messages tab disappears on conversation open

**Patient flow:**
1. Log in as a patient → Messages tab shows `/patient/chat`
2. Patient with no provider → redirects to `/patient`
3. Patient with provider → ChatWindow opens directly
4. Navigate to `/patient/messages` → redirects to `/patient/chat`

**Realtime (requires two browser windows):**
1. Open provider chat in window A, patient chat in window B
2. Send from A → appears in B within ~1s without refresh
3. Type in A → "typing…" appears in B for ~2s
4. Presence dot in A turns green when B is connected
