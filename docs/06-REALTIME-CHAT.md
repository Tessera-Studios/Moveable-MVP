# Phase 6: Real-Time Communication

## Goals
- Implement one-on-one asynchronous chat between Patient and Provider
- Integrate Supabase Realtime for instant message delivery
- Display online/offline presence indicators
- Support typing indicators
- Allow multimedia file attachments in chat messages
- Show unread message badges

## Tech Stack
- Supabase Realtime (Postgres Changes, Broadcast, Presence)
- `@supabase/supabase-js` (client-side subscription management)
- Tailwind CSS (chat UI)

## Pages

### `/provider/chat/[patientId]` and `/patient/chat`
Dedicated chat interface accessible from the sidebar and from patient/profile screens.

**Components:**
- `ChatList` — for Provider: list of patient conversations with last message preview, unread count, timestamp
- `ChatWindow` — the active conversation
  - `MessageBubble` — sent vs received styling, timestamp, read status
  - `MessageList` — scrollable, auto-scrolls to bottom, loads older messages on scroll-to-top
  - `MessageInput` — text input + send button + attachment picker
- `TypingIndicator` — "Patient is typing..." message shown when Broadcast event received
- `PresenceDot` — green/gray circle indicating online/offline status
- `UnreadBadge` — number badge on chat list items and sidebar icon

## Supabase Realtime Integration

### Channel Setup
```typescript
// Inside a Client Component (useEffect)
const channel = supabase
  .channel(`chat:${conversationId}`, {
    config: { broadcast: { ack: true } },
  })
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `sender_id=eq.${userId},receiver_id=eq.${otherUserId}`, // OR combined
    },
    (payload) => {
      setMessages((prev) => [...prev, payload.new as Message]);
    }
  )
  .on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    setIsOnline(Object.keys(state).length > 0);
  })
  .on("presence", { event: "join" }, ({ key }) => {
    // User came online
  })
  .on("presence", { event: "leave" }, ({ key }) => {
    // User went offline
  })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ user_id: userId, online_at: new Date().toISOString() });
    }
  });

// Cleanup on unmount
return () => {
  channel.unsubscribe();
};
```

### Postgres Changes
- Subscribe to `INSERT` on `messages` table
- Filter to only messages involving the current user (sender or receiver)
- New messages appear instantly without polling

### Broadcast
- Used for typing indicators (ephemeral, no DB persistence)
- On keystroke in MessageInput, broadcast `{ type: "typing", userId }`
- On receive, show indicator for 2 seconds, reset on new typing event

### Presence
- Track user on channel subscribe
- `presenceState()` returns all online users in the conversation
- Update `PresenceDot` in real-time

## Message Sending Flow

```
User types message + optionally attaches file
  → "Send" clicked
  → If file: upload to Supabase Storage (reuse Phase 5 signed URL flow)
  → Insert into messages table via Server Action:
      INSERT INTO messages (sender_id, receiver_id, content, media_url)
  → Postgres Changes triggers INSERT event
  → Receiving client receives payload via WebSocket
  → MessageList appends new MessageBubble
  → ChatList updates last message preview
```

## Server Actions

```typescript
// src/lib/actions/messages.ts
export async function sendMessage(data: {
  receiverId: string;
  content: string;
  mediaFile?: File; // handled client-side with signed URL
}): Promise<Message> {
  // 1. Authenticate sender
  // 2. Validate receiver is linked provider/patient
  // 3. Insert into messages table
  // 4. Return the created message
}

export async function getConversations(): Promise<Conversation[]> {
  // For Provider: group messages by patient_id, get latest per patient
  // For Patient: single conversation with their provider
}

export async function getMessages(
  otherUserId: string,
  before?: string // cursor pagination
): Promise<Message[]> {
  // Fetch messages between current user and other user, ordered by created_at DESC
  // Support cursor-based pagination for infinite scroll
}

export async function getUnreadCount(): Promise<number> {
  // Count messages where receiver_id = current user and not yet read
}
```

## Chat UI States

- **Loading** — skeleton messages while initial batch loads
- **Empty** — "No messages yet. Say hello!" with the input focused
- **Error** — inline error on failed send with retry; toast on failed load
- **Optimistic sends** — sent message appears immediately with a "sending" indicator, confirmed on server response
- **Failed sends** — message shows error state with "Retry" button
- **Reconnecting** — banner: "Reconnecting..." when WebSocket disconnects
- **Typing** — "... is typing" indicator below the last message
- **Presence** — green dot when online, gray when offline

## Media Attachments in Chat

Reuse the Supabase Storage pipeline from Phase 5:

1. Attachment button opens file picker (camera roll / file system)
2. Selected file uploaded via signed URL to `chat-attachments` bucket
3. `media_url` in the message stores the storage path
4. Receiver sees image/video preview inline in the message bubble
5. File type icon for non-previewable attachments (PDF, etc.)

### Storage Bucket: `chat-attachments`
```
Name: chat-attachments
Public: false
RLS: enabled (same pattern as exercise-videos)
```

## Data Lifecycle

Chat media attachments are retained for **120 days** from the date of upload. After 120 days, the attachment file is purged from the `chat-attachments` Storage bucket. The message text record remains in the `messages` table indefinitely.

This retention policy is configured via a Supabase Edge Function or database trigger that runs daily, querying `messages.media_url` records older than 120 days and deleting the corresponding storage objects.

For MVP, this is a best-effort cleanup — no strict enforcement, but the mechanism is scaffolded for production hardening.

## Database Additions

Add an `is_read` column to `messages` for read receipts (MVP can skip or implement as optimistic):

```sql
ALTER TABLE public.messages ADD COLUMN is_read BOOLEAN DEFAULT false;
```

## Test Cases

### Integration: I3 — Real-time message delivery
Instantiate two authenticated client connections. Client A sends a message. Assert Client B receives it via WebSocket within 500ms.

### Unit: Conversation grouping
Seed messages involving Provider A with Patient A and Patient B. Assert `getConversations` returns 2 conversations for Provider A, 1 for each patient.

## Acceptance Criteria
- [ ] ChatList shows all conversations with last message preview and unread count
- [ ] ChatWindow displays messages in chronological order
- [ ] New messages appear in real-time without page refresh
- [ ] User can send text messages
- [ ] User can attach and send media files (images, videos)
- [ ] Typing indicator appears when the other party is typing
- [ ] Online/offline presence dot updates in real-time
- [ ] Unread message badge updates on sidebar and chat list
- [ ] Pagination loads older messages on scroll
- [ ] Error and reconnection states handled gracefully
