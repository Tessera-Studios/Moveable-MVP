"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type FormState = {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
};

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    email: "",
    password: "",
    loading: false,
    error: null,
  });

  function setField<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ): void {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    setField("loading", true);
    setField("error", null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: state.email,
      password: state.password,
    });

    if (error) {
      setField("error", error.message);
      setField("loading", false);
      return;
    }

    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-[400px] w-full mx-auto px-5 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-primary mb-1">
            Move Able
          </h1>
          <p className="text-muted text-base">Track your recovery.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={state.email}
              onChange={(e) => setField("email", e.target.value)}
              className="w-full h-12 rounded-card border border-border px-4 bg-card text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={state.password}
              onChange={(e) => setField("password", e.target.value)}
              className="w-full h-12 rounded-card border border-border px-4 bg-card text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          {state.error && (
            <p className="text-red-500 text-sm">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={state.loading}
            className="w-full h-12 rounded-button bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {state.loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
