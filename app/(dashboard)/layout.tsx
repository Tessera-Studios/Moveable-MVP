import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/actions/messages";
import BottomTabBar from "@/components/shared/BottomTabBar";
import TimezoneSync from "@/components/shared/TimezoneSync";
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
        <TimezoneSync />
        <main className="max-w-[512px] mx-auto pb-20">{children}</main>
        <BottomTabBar role={profile?.role ?? "patient"} />
      </UnreadCountProvider>
    </div>
  );
}
