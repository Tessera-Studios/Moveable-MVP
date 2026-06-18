# Phase 6 — Realtime Chat: Design Spec

**Date:** 2026-06-18  
**Status:** Approved  
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
- **Redirect stubs** at old `/provider/messages` and `/patient/messages` paths

---

## Architecture

**Option A — Single channel, all-in-one `ChatWindow`.**

One Supabase Realtime channel per open conversation. The channel is opened inside `ChatWindow` on mount and cleaned up on unmount. It handles:
- **Postgres Changes** — `INSERT` on `messages` filtered to the conversation
- **Broadcast** — typing events (ephemeral, not persisted)
- **Presence** — online/offline status of the other participant

Page shells are Server Components that fetch initial data; `ChatWindow` is fully client-side and takes over from there.

---

## Data Layer

### Migration

```sql
-- Add is_read to messages
ALTER TABLE public.messages
  ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

-- Allow receiver to mark messages read (existing policy is FOR ALL,
-- which covers UPDATE — this is already handled by messages_access policy)
-- No additional policy needed: receiver_id = auth.uid() satisfies USING clause.
```

> The existing `messages_access` RLS policy (`USING sender_id = uid OR receiver_id = uid`, `WITH CHECK sender_id = uid`) already permits the receiver to UPDATE rows they received. No new policy required.

### Types (`lib/types.ts`)

Add `is_read: boolean` to the existing `Message` interface.

---

## Server Actions (`lib/actions/messages.ts`)

| Action | Description |
|---|---|
| `sendMessage(receiverId, content)` | Authenticate sender; validate receiver is the caller's linked provider/patient; insert into `messages`; return the new `Message` row. |
| `getMessages(otherUserId, before?)` | Fetch 30 messages between current user and `otherUserId`, `created_at DESC`, cursor-paginated via `before` ISO timestamp. Return in ascending order (reversed after fetch). |
| `getConversations()` | Provider: group messages by other participant, return latest message per patient + unread count. Patient: return single conversation with their provider. |
| `markMessagesRead(otherUserId)` | Bulk `UPDATE is_read = true` where `receiver_id = current user` AND `sender_id = otherUserId`. |

---

## Routes & Pages

### Provider

| Path | Type | Purpose |
|---|---|---|
| `/provider/chat` | Server Component | Conversation list — fetches `getConversations()`, renders `ChatList` |
| `/provider/chat/[patientId]` | Server Component | Active conversation — fetches `getMessages(patientId)` + patient profile, renders `ChatWindow` |
| `/provider/messages` | Redirect | `redirect('/provider/chat')` |

### Patient

| Path | Type | Purpose |
|---|---|---|
| `/patient/chat` | Server Component | Looks up `provider_id` from own user row; if none, redirects to `/patient` with toast. Fetches `getMessages(providerId)`, renders `ChatWindow` directly |
| `/patient/messages` | Redirect | `redirect('/patient/chat')` |

### Tab Bar

Update `BottomTabBar.tsx`:
- Provider Messages tab: `/provider/messages` → `/provider/chat`
- Patient Messages tab: `/patient/messages` → `/patient/chat`

---

## Components (`components/chat/`)

### `ChatList.tsx` (Provider only, Client Component)
- Renders each conversation row: Avatar, patient name, last message preview (truncated to ~60 chars), relative timestamp, `UnreadBadge`
- Tapping navigates to `/provider/chat/[patientId]`
- Accepts `conversations: ConversationRow[]` prop (populated server-side)

### `ChatWindow.tsx` (Client Component)
- Props: `initialMessages: Message[]`, `currentUserId: string`, `otherUser: { id, name }`
- On mount: opens Supabase Realtime channel `chat:${[currentUserId, otherUserId].sort().join('-')}`
  - Postgres Changes → append new message to state
  - Broadcast `typing` → show `TypingIndicator` for 2s
  - Presence → update `PresenceDot`
- Calls `markMessagesRead(otherUserId)` on open and on each incoming message
- Renders: `PresenceDot` + name header, `MessageList`, `TypingIndicator`, `MessageInput`
- Cleanup: `channel.unsubscribe()` on unmount

### `MessageList.tsx`
- Scrollable container, auto-scrolls to bottom on new message
- On scroll-to-top: calls `getMessages` with cursor, prepends older messages
- Hides load-more trigger when fewer than 30 messages returned (end of history)
- Empty state: "No messages yet. Say hello!" with input focused

### `MessageBubble.tsx`
- Sent: right-aligned, teal background (`bg-primary text-white`)
- Received: left-aligned, card background
- Shows relative timestamp below bubble
- Sent messages show a subtle "sending…" label while optimistic; removed once Postgres Changes confirms

### `MessageInput.tsx`
- Textarea (auto-resize) + Send button
- On keystroke: broadcasts `{ type: 'typing', userId }` (debounced 300ms)
- On submit: calls `sendMessage`, appends optimistic message, clears input
- Send button disabled while empty or while a send is in-flight

### `TypingIndicator.tsx`
- Shows "Name is typing…" for 2 seconds after last broadcast event
- Resets timer on each new typing event
- Renders below the last message bubble

### `PresenceDot.tsx`
- Green (`bg-green-500`) when online, gray (`bg-gray-400`) when offline
- Updated from Presence sync/join/leave events in `ChatWindow`

### `UnreadBadge.tsx`
- Small red circle with count number
- Rendered in `BottomTabBar` next to Messages icon
- Server-fetched count passed as prop from `(dashboard)/layout.tsx`; incremented client-side on new message receipt via a shared context or prop drilling from `ChatWindow`

---

## Error Handling

| Scenario | Handling |
|---|---|
| `sendMessage` fails | Optimistic message shows error state + "Retry" button |
| WebSocket disconnects | `channel.subscribe` callback fires non-`SUBSCRIBED`; show "Reconnecting…" banner. Supabase client retries automatically. |
| Patient has no provider | `/patient/chat` redirects to `/patient` dashboard |
| Provider accesses non-patient | `getMessages` validates linked relationship; page shows `EmptyState` |
| Empty conversation | `MessageList` empty state: "No messages yet. Say hello!" |
| End of message history | Load-more trigger hidden when `< 30` messages returned |

---

## Unread Badge in Layout

`app/(dashboard)/layout.tsx` fetches the unread count (messages where `receiver_id = current user AND is_read = false`) alongside the profile fetch. Passes count as a prop to `BottomTabBar`. `ChatWindow` receives an `onUnreadClear` callback that zeroes the count client-side when a conversation is opened (avoiding a full page refresh for the badge).

---

## Acceptance Criteria

- [ ] Provider sees conversation list with last message preview and unread count
- [ ] Patient lands directly in their single conversation with their provider
- [ ] New messages appear in real-time without page refresh
- [ ] User can send text messages
- [ ] Typing indicator appears when the other party is typing
- [ ] Online/offline presence dot updates in real-time
- [ ] Unread message badge updates on sidebar
- [ ] Pagination loads older messages on scroll to top
- [ ] Send failure shows error state with retry
- [ ] Reconnecting banner shown on WebSocket disconnect
- [ ] Patient with no provider sees a toast and is redirected
