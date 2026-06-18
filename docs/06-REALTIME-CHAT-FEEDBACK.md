# Phase 6 — Realtime Chat: Design Review Feedback

**Review Date:** 2026-06-18  
**Spec Reviewed:** `docs/superpowers/specs/2026-06-18-phase6-realtime-chat-design.md`

---

## CRITICAL

### 1. RLS Policy Blocks `is_read` Updates

**Spec claim (line 49):** *"The existing `messages_access` RLS policy already permits the receiver to UPDATE rows they received. No new policy required."*

**This is incorrect.** The existing policy:

```sql
CREATE POLICY messages_access ON public.messages
  FOR ALL TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
```

For an `UPDATE` by the **receiver**, Postgres evaluates:
- `USING` → `receiver_id = auth.uid()` — passes (row is visible)
- `WITH CHECK` → `sender_id = auth.uid()` — **fails** (receiver is not the sender)

The `WITH CHECK` clause validates the resulting row after update. Since `sender_id` doesn't change, Postgres compares the original `sender_id` against `auth.uid()` of the receiver — which never matches. The `markMessagesRead` action will silently update zero rows.

**Fix:** Add a dedicated UPDATE policy:

```sql
CREATE POLICY messages_mark_read ON public.messages
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());
```

---

## MODERATE

### 2. Missing: Realtime Publication Setup

The spec omits enabling Realtime for the `messages` table. Without this, Postgres Changes subscriptions never fire — no real-time message delivery.

**Required:** Add `messages` to the Supabase Realtime publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

### 3. Postgres Changes Subscription — Ambiguous Filter

**Spec (line 27):** *"Postgres Changes — INSERT on messages filtered to the conversation"*

Postgres Changes supports only single-column equality filters (`column=eq.value`). It cannot express `(sender_id=X AND receiver_id=Y) OR (sender_id=Y AND receiver_id=X)`.

**Recommended approach:** Subscribe to all INSERTs on `messages` (RLS gates visibility to participant messages), then filter client-side to the current conversation. For a provider with multiple patients, irrelevant INSERT events are received but ignored — negligible overhead.

```typescript
channel.on(
  { event: 'INSERT', schema: 'public', table: 'messages' },
  (payload) => {
    const msg = payload.new as Message;
    if (msg.sender_id === otherUserId || msg.receiver_id === otherUserId) {
      appendMessage(msg);
    }
  },
);
```

### 4. Layout / Provider Boundary — Unread Badge

**Spec (line 159):** Layout "wraps children in `<UnreadCountProvider>`". But `BottomTabBar` is rendered **outside** `{children}` in the current layout (`app/(dashboard)/layout.tsx:30-31`). The provider must wrap both:

```tsx
<UnreadCountProvider initialCount={unreadCount}>
  <main className="max-w-[512px] mx-auto pb-20">{children}</main>
  <BottomTabBar role={profile?.role ?? "patient"} />
</UnreadCountProvider>
```

---

## MINOR

### 5. Missing Index for Unread Count Queries

The query `SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = false` won't use the existing composite index `idx_messages_participants(sender_id, receiver_id)`. Consider:

```sql
CREATE INDEX idx_messages_unread ON public.messages(receiver_id, is_read)
  WHERE is_read = false;
```

### 6. Missing Type Definition

`ConversationRow[]` is referenced as a prop (line 98) but never defined. Should be added to `lib/types.ts` alongside the `Message.is_read` update:

```typescript
export interface ConversationRow {
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
```

### 7. Optimistic Message Client State

Optimistic messages need a client-only status field not present in the DB `Message` type. Document this:

```typescript
export type ClientMessage = Message & {
  _optimistic?: boolean;
  _status?: "sending" | "sent" | "failed";
};
```

### 8. Scroll Position on Prepend

Prepending older messages (line 112) requires maintaining scroll position — the viewport must be adjusted by the height of newly inserted elements to prevent jumping. This is a non-trivial UX concern not addressed in the spec.

### 9. `markMessagesRead` Failure — Silent Handling

Not mentioned. Network or RLS failures should be silently swallowed — never block the user from reading/seeing messages. Action failures on a non-critical UX feature should degrade gracefully.

### 10. Redirect Stub Pages

Spec says old `/provider/messages` and `/patient/messages` should redirect (line 76-77, 83). These paths need actual `page.tsx` files calling `redirect()`. The spec implies this but doesn't list creating these files as deliverables.

### 11. Debounce Cleanup on Unmount

The 300ms debounced typing broadcast (line 124) should cancel its pending timer on component unmount to avoid `setState` on an unmounted component.

---

## Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| **Critical** | 1 | RLS `WITH CHECK` blocks `markMessagesRead` |
| **Moderate** | 3 | Realtime publication, Postgres Changes filter, Layout provider boundary |
| **Minor** | 7 | Index, types, scroll position, error handling, redirect pages, cleanup |

The spec is well-structured and covers the feature comprehensively. The one critical issue would cause a silent production failure (`markMessagesRead` appearing to succeed but doing nothing). Moderate issues would cause confusing behavior (messages not appearing in real-time, unread badge not working). With these fixes, the spec is ready for implementation.
