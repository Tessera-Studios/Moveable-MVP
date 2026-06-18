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

export async function markMessagesRead(
  otherUserId: string
): Promise<void | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("receiver_id", user.id)
    .eq("sender_id", otherUserId)
    .eq("is_read", false);

  if (error) return { error: error.message };
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
