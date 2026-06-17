"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

type FormState = {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  loading: boolean;
  error: string | null;
};

export default function RegisterPage(): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    fullName: "",
    email: "",
    password: "",
    role: "patient",
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

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: state.email,
      password: state.password,
      options: {
        data: { full_name: state.fullName },
      },
    });

    if (signUpError) {
      setField("error", signUpError.message);
      setField("loading", false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        role: state.role,
        provider_id: null,
      });

      if (profileError) {
        setField("error", profileError.message);
        setField("loading", false);
        return;
      }
    }

    router.push("/login?registered=1");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-[400px] w-full mx-auto px-5 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-primary mb-1">
            Moveable
          </h1>
          <p className="text-muted text-base">Create your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="fullName"
              className="text-sm font-medium text-foreground"
            >
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={state.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              className="w-full h-12 rounded-card border border-border px-4 bg-card text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Jane Smith"
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={state.password}
              onChange={(e) => setField("password", e.target.value)}
              className="w-full h-12 rounded-card border border-border px-4 bg-card text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Min. 8 characters"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">I am a…</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="patient"
                  checked={state.role === "patient"}
                  onChange={() => setField("role", "patient")}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">Patient</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="provider"
                  checked={state.role === "provider"}
                  onChange={() => setField("role", "provider")}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">
                  Physical therapist
                </span>
              </label>
            </div>
          </div>

          {state.error && (
            <p className="text-red-500 text-sm">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={state.loading}
            className="w-full h-12 rounded-button bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {state.loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
