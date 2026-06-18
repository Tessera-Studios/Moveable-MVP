import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Profile } from "@/lib/types";

const PUBLIC_ROUTES = new Set(["/login", "/register", "/"]);

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const { createServerClient } = await import("@supabase/ssr");
  const pathname = request.nextUrl.pathname;

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicRoute && pathname !== "/") {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single<Pick<Profile, "role">>();

    const destination =
      profile?.role === "provider" ? "/provider" : "/patient";
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = destination;
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
