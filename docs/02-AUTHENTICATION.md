# Phase 2: Authentication & Data Layer

## Goals
- Implement dual-role authentication (Provider and Patient) using Supabase Auth
- Build Provider signup and Patient signup (with invitation code) flows
- Create invitation code generation and consumption system
- Configure Next.js Middleware for route protection
- Define and apply Row Level Security (RLS) policies
- Set up PostgreSQL database schema (all tables)

## Database Schema

### Table: `users`
Extends Supabase Auth with app-specific role and provider linkage.

```sql
CREATE TYPE user_role AS ENUM ('provider', 'patient');

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  provider_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Patients must have a provider_id
CREATE CONSTRAINT check_patient_has_provider
  CHECK (role != 'patient' OR provider_id IS NOT NULL);
```

### Table: `invitation_codes`
One-time tokens linking patients to providers.

```sql
CREATE TABLE public.invitation_codes (
  code TEXT PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.users(id),
  is_consumed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ -- nullable; if set, code cannot be used after expiry
);

CREATE INDEX idx_invitation_codes_provider ON public.invitation_codes(provider_id);
```

### Table: `sessions_template`
Provider-authored exercise blueprints assigned to a specific patient.

```sql
CREATE TABLE public.sessions_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.users(id),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  name TEXT NOT NULL,
  provider_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `exercises`
Individual movements within a session template.

```sql
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_template_id UUID NOT NULL REFERENCES public.sessions_template(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER NOT NULL CHECK (sets > 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  patient_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

### Table: `session_executions`
Daily completed instances of session templates.

```sql
CREATE TYPE execution_status AS ENUM ('pending', 'completed');

CREATE TABLE public.session_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_template_id UUID NOT NULL REFERENCES public.sessions_template(id),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  status execution_status DEFAULT 'pending',
  ease_score INTEGER CHECK (ease_score BETWEEN 1 AND 5),
  pain_score INTEGER CHECK (pain_score BETWEEN 1 AND 5),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `videos`
Metadata for media files stored in Supabase Storage.

```sql
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES public.users(id),
  exercise_id UUID REFERENCES public.exercises(id),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `messages`
Chat log for real-time messaging.

```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id),
  receiver_id UUID NOT NULL REFERENCES public.users(id),
  content TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_participants ON public.messages(sender_id, receiver_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
```

## Row Level Security (RLS) Policies

Every table enforces strict tenant isolation.

```sql
-- Users: users can read their own row; providers can read their patients
CREATE POLICY users_own ON public.users
  FOR ALL USING (id = auth.uid());

-- Sessions: providers see their authored; patients see their assigned
CREATE POLICY sessions_provider ON public.sessions_template
  FOR ALL USING (provider_id = auth.uid());
CREATE POLICY sessions_patient ON public.sessions_template
  FOR SELECT USING (patient_id = auth.uid());

-- Exercises: cascade from session RLS
CREATE POLICY exercises_provider ON public.exercises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sessions_template WHERE id = session_template_id AND provider_id = auth.uid())
  );
CREATE POLICY exercises_patient ON public.exercises
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sessions_template WHERE id = session_template_id AND patient_id = auth.uid())
  );

-- Provider notes: patients cannot read provider_notes column
-- Handled via column-level security or simply by omitting from SELECT in application

-- Videos: only linked participants (via exercise or session)
CREATE POLICY videos_access ON public.videos
  FOR ALL USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM exercises e
      JOIN sessions_template s ON e.session_template_id = s.id
      WHERE e.id = exercise_id AND (s.patient_id = auth.uid() OR s.provider_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM sessions_template s
      WHERE s.id = session_id AND (s.patient_id = auth.uid() OR s.provider_id = auth.uid())
    )
  );

-- Messages: only sender and receiver
CREATE POLICY messages_access ON public.messages
  FOR ALL USING (sender_id = auth.uid() OR receiver_id = auth.uid());
```

## Auth Flows

### Provider Signup (`/register?role=provider`)
1. User submits email + password
2. `supabase.auth.signUp()` creates auth user
3. After signup, call server action to insert row into `public.users` with role `provider`
4. Redirect to Provider Dashboard

### Provider: Generate Invitation Code
1. Authenticated Provider clicks "Generate Invitation Code" on their dashboard
2. Server action generates high-entropy alphanumeric code (e.g., 12 chars, using `crypto.randomBytes`)
3. Inserts into `invitation_codes` with `provider_id = auth.uid()`
4. Returns the code to display/share

### Patient Signup (`/register?code=INVITE123`)
1. User enters the invitation code + email + password
2. Server validates: code exists, not consumed, not expired
3. `supabase.auth.signUp()` creates auth user
4. Inserts into `public.users` with role `patient` and `provider_id` from the invitation code
5. Marks code as consumed
6. Redirect to Patient Dashboard

## Supabase Client Configuration

### Client Component Client
```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Server Component Client
```typescript
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );
}
```

### Middleware
```typescript
// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createServerClient(..., { cookies: ... });
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to /login
  if (!user && !req.nextUrl.pathname.startsWith("/login") && !req.nextUrl.pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect authenticated users away from auth pages
  if (user && (req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register"))) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role === "provider") return NextResponse.redirect(new URL("/provider", req.url));
    if (profile?.role === "patient") return NextResponse.redirect(new URL("/patient", req.url));
  }

  return res;
}
```

## Test Cases

### Integration: I2 — Invitation code consumption
Seed a valid, unexpired invitation code. Execute registration with that code. Assert patient user is created with correct `provider_id`. Assert the code is consumed (second use fails).

### Unit: U1 — Invitation code uniqueness
Generate 10,000 codes in a loop. Assert zero collisions, all match the expected format.

## Acceptance Criteria
- [ ] Provider can sign up with email/password
- [ ] Provider can generate an invitation code
- [ ] Patient can register using an invitation code and is linked to the correct provider
- [ ] Used/expired codes are rejected
- [ ] Middleware correctly routes authenticated users to their dashboard
- [ ] RLS policies prevent cross-tenant data access
