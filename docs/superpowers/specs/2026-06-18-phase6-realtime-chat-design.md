# Phase 6 — Realtime Chat: Design Spec

**Date:** 2026-06-18  
**Status:** Approved (rev 2 — post-review fixes applied)  
**Scope:** Text-only one-on-one chat between Provider and Patient with Supabase Realtime

---

## Scoping Decisions (Locked)

- **Text-only** — no file/media attachments in this phase
- **One-on-one only** — each patient has one provider; no group chat
- **Routes follow spec** (`/provider/chat`, `/patient/chat`), tab bar updated to match
- **Unread badge** in scope — requires `is_read` column
- **Typing indicator + presence** in scope via Supabase Broadcast and Presence
- **Optimistic sends** in scope — message appears immediately, confirmed on Postgres Changes event
- **Cursor-based pagination** for message history (30 per page, scroll-to-top loads older)
- **Redirect stubs** at old `/provider/messages` and `/patient/messages` paths — explicit `page.tsx` files calling `redirect()`

---

## Architecture

**Option A — Single channel, all-in-one `ChatWindow`.**

One Supabase Realtime channel per open conversation. The channel is opened inside `ChatWindow` on mount and cleaned up on unmount. It handles:
- **Postgres Changes** — unfiltered `INSERT` on `messages` (RLS gates visibility); filtered client-side to the current conversation
- **Broadcast** — typing events (ephemeral, not persisted)
- **Presence** — online/offline status of the other participant

Page shells are Server Components that fetch initial data; `ChatWindow` is fully client-side and takes over from there.

---

## Data Layer

### Migration

```sql
-- Add is_read column
ALTER TABLE public.messages
  ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

-- Enable Realtime for messages table (required for Postgres Changes subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Dedicated UPDATE policy so receiver can mark messages read.
-- The existing messages_access policy has WITH CHECK (sender_id = auth.uid()),
-- which blocks receivers from UPDATing — a separate policy is required.
CREATE POLICY messages_mark_read ON public.messages
  FOR UPDATE TO authenticated
  USING (receiver_id = (SELECT auth.uid()))
  WITH CHECK (receiver_id = (SELECT auth.uid()));

-- Partial index for fast unread count queries
CREATE INDEX idx_messages_unread ON public.messages(receiver_id, is_read)
  WHERE is_read = false;
```

### Types (`lib/types.ts`)

```typescript
// Add is_read to existing Message interface
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  is_read: boolean;          // added
}

// Client-side optimistic extension (not persisted to DB)
export type ClientMessage = Message & {
  _optimistic?: boolean;
  _status?: "sending" | "sent" | "failed";
};

// Conversation summary for ChatList
export interface ConversationRow {
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}
```

---

## Server Actions (`lib/actions/messages.ts`)

| Action | Description |
|---|---|
| `sendMessage(receiverId, content)` | Authenticate sender; validate receiver is the caller's linked provider/patient; insert into `messages`; return the new `Message` row. |
| `getMessages(otherUserId, before?)` | Fetch 30 messages between current user and `otherUserId`, `created_at DESC`, cursor-paginated via `before` ISO timestamp. Return in ascending order (reversed after fetch). Returns `{ error }` if caller is not linked to `otherUserId`. |
| `getConversations()` | Provider: group messages by other participant, return latest message per patient + unread count as `ConversationRow[]`. Patient: return single `ConversationRow` for their provider. |
| `markMessagesRead(otherUserId)` | Bulk `UPDATE is_read = true` where `receiver_id = current user` AND `sender_id = otherUserId`. Failures silently swallowed — never block message display. |
| `getUnreadCount()` | Count `messages` where `receiver_id = current user AND is_read = false`. Used by layout. |

---

## Routes & Pages

### Provider

| Path | File | Purpose |
|---|---|---|
| `/provider/chat` | `app/(dashboard)/provider/chat/page.tsx` | Server Component — fetches `getConversations()`, renders `ChatList` |
| `/provider/chat/[patientId]` | `app/(dashboard)/provider/chat/[patientId]/page.tsx` | Server Component — fetches `getMessages(patientId)` + patient profile, renders `ChatWindow` |
| `/provider/messages` | `app/(dashboard)/provider/messages/page.tsx` | `redirect('/provider/chat')` |

### Patient

| Path | File | Purpose |
|---|---|---|
| `/patient/chat` | `app/(dashboard)/patient/chat/page.tsx` | Server Component — looks up `provider_id`; if none, redirects to `/patient`. Fetches `getMessages(providerId)`, renders `ChatWindow` |
| `/patient/messages` | `app/(dashboard)/patient/messages/page.tsx` | `redirect('/patient/chat')` |

### Tab Bar

Update `BottomTabBar.tsx`:
- Provider Messages tab: `/provider/messages` → `/provider/chat`
- Patient Messages tab: `/patient/messages` → `/patient/chat`

---

## Components (`components/chat/`)

### `UnreadCountProvider.tsx` (Client Component)
- React context providing `{ unreadCount: number, setUnreadCount: (n: number) => void }`
- Accepts `initialCount` prop (server-fetched)
- Renders in `app/(dashboard)/layout.tsx` wrapping **both** `<main>{children}</main>` and `<BottomTabBar>` so both have context access

### `ChatList.tsx` (Client Component — Provider only)
- Accepts `conversations: ConversationRow[]` prop
- Renders each row: Avatar, patient name, last message preview (truncated to ~60 chars), relative timestamp, `UnreadBadge`
- Tapping navigates to `/provider/chat/[patientId]`

### `ChatWindow.tsx` (Client Component)
- Props: `initialMessages: Message[]`, `currentUserId: string`, `otherUser: { id: string; name: string }`
- On mount: opens Supabase Realtime channel `chat:${[currentUserId, otherUser.id].sort().join('-')}`
  - **Postgres Changes** — unfiltered `INSERT` on `messages`; client-side guard: `if (msg.sender_id === otherUser.id || msg.receiver_id === otherUser.id)` before appending
  - **Broadcast** `typing` → show `TypingIndicator` for 2s
  - **Presence** → update `PresenceDot`
- Calls `markMessagesRead(otherUser.id)` on open and on each incoming message; calls `setUnreadCount(0)` from context
- Renders: `PresenceDot` + name header, `MessageList`, `TypingIndicator`, `MessageInput`
- Shows "Reconnecting…" banner when channel status is not `SUBSCRIBED`
- Cleanup: `channel.unsubscribe()` on unmount

### `MessageList.tsx`
- Scrollable container, auto-scrolls to bottom on new message
- On scroll-to-top: saves scroll position before prepend, calls `getMessages` with cursor, prepends older messages, restores scroll offset to prevent viewport jump
- Hides load-more trigger when fewer than 30 messages returned (end of history)
- Renders `MessageBubble` per message; empty state: "No messages yet. Say hello!"

### `MessageBubble.tsx`
- Sent: right-aligned, teal background (`bg-primary text-white`)
- Received: left-aligned, card background
- Shows relative timestamp below bubble
- Reads `_status` from `ClientMessage`: shows "sending…" while optimistic; shows error state + "Retry" button on `"failed"`

### `MessageInput.tsx`
- Textarea (auto-resize) + Send button
- On keystroke: broadcasts `{ type: 'typing', userId }` (debounced 300ms; debounce timer cancelled on unmount to avoid setState after unmount)
- On submit: appends optimistic `ClientMessage` with `_status: "sending"`, calls `sendMessage`, updates status to `"sent"` or `"failed"`
- Send button disabled while empty or while a send is in-flight

### `TypingIndicator.tsx`
- Shows "Name is typing…" for 2 seconds after last broadcast event
- Uses a `useRef` timer; resets on each new typing event; cleared on unmount

### `PresenceDot.tsx`
- Green (`bg-green-500`) when online, gray (`bg-gray-400`) when offline
- Updated from Presence `sync`/`join`/`leave` events in `ChatWindow`

### `UnreadBadge.tsx`
- Small red circle with count number
- Reads `unreadCount` from `UnreadCountProvider` context
- Rendered in `BottomTabBar` next to Messages icon; hidden when count is 0

---

## Error Handling

| Scenario | Handling |
|---|---|
| `sendMessage` fails | `ClientMessage._status` → `"failed"`; bubble shows "Retry" button |
| WebSocket disconnects | Channel status non-`SUBSCRIBED`; show "Reconnecting…" banner. Supabase client retries automatically. |
| `markMessagesRead` fails | Silently swallowed — never blocks message display |
| Patient has no provider | `/patient/chat` redirects to `/patient` dashboard |
| Provider accesses non-patient | `getMessages` validates linked relationship; page shows `EmptyState` |
| Empty conversation | `MessageList` empty state: "No messages yet. Say hello!" |
| End of message history | Load-more trigger hidden when `< 30` messages returned |

---

## Acceptance Criteria

- [ ] Provider sees conversation list with last message preview and unread count
- [ ] Patient lands directly in their single conversation with their provider
- [ ] New messages appear in real-time without page refresh
- [ ] User can send text messages
- [ ] Typing indicator appears when the other party is typing
- [ ] Online/offline presence dot updates in real-time
- [ ] Unread message badge updates on the tab bar
- [ ] Pagination loads older messages on scroll to top without viewport jumping
- [ ] Send failure shows error state with retry
- [ ] Reconnecting banner shown on WebSocket disconnect
- [ ] Patient with no provider is redirected to dashboard
- [ ] `/provider/messages` and `/patient/messages` redirect to new chat routes
