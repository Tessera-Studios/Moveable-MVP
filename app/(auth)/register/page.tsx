"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { registerProvider, registerPatient } from "@/lib/actions/auth";

// ─── Provider signup form ────────────────────────────────────────────────────

function ProviderSignup(): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerProvider(email, password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="max-w-[400px] w-full mx-auto px-5 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-primary mb-1">Moveable</h1>
        <p className="text-muted text-base">Create your provider account.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@clinic.com"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Min. 8 characters"
          />
        </Field>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <SubmitButton loading={isPending} label="Create provider account" />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ─── Patient signup form ─────────────────────────────────────────────────────

function PatientSignup({ initialCode }: { initialCode: string }): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerPatient(email, password, code);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="max-w-[400px] w-full mx-auto px-5 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-primary mb-1">Moveable</h1>
        <p className="text-muted text-base">Join your care team.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Invitation code" htmlFor="code">
          <input
            id="code"
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="XXXXXXXXXXXX"
            spellCheck={false}
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Min. 8 characters"
          />
        </Field>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <SubmitButton loading={isPending} label="Create patient account" />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ─── Role picker (default landing) ───────────────────────────────────────────

function RolePicker(): React.JSX.Element {
  return (
    <div className="max-w-[400px] w-full mx-auto px-5 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-primary mb-1">Moveable</h1>
        <p className="text-muted text-base">I am a…</p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/register?role=provider"
          className="w-full h-14 rounded-button bg-primary text-white font-medium flex items-center justify-center hover:bg-primary-hover transition-colors"
        >
          Physical therapist / Provider
        </Link>
        <Link
          href="/register?role=patient"
          className="w-full h-14 rounded-button border border-border bg-card text-foreground font-medium flex items-center justify-center hover:bg-background transition-colors"
        >
          Patient
        </Link>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ─── Router ──────────────────────────────────────────────────────────────────

function RegisterContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const role = searchParams.get("role");
  const code = searchParams.get("code");

  if (code) {
    return <PatientSignup initialCode={code} />;
  }

  if (role === "provider") {
    return <ProviderSignup />;
  }

  if (role === "patient") {
    return <PatientSignup initialCode="" />;
  }

  return <RolePicker />;
}

export default function RegisterPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Suspense>
        <RegisterContent />
      </Suspense>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const inputClass =
  "w-full h-12 rounded-card border border-border px-4 bg-card text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function SubmitButton({
  loading,
  label,
}: {
  loading: boolean;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-12 rounded-button bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
    >
      {loading ? "Please wait…" : label}
    </button>
  );
}
