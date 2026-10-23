import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export async function POST(request: NextRequest) {
  let refreshToken = "";
  try {
    const body = await request.json();
    refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : "";
  } catch {
    // Handled by the validation below.
  }
  if (!refreshToken || refreshToken.length > 4096) {
    return NextResponse.json(
      { error: "The Tensor session is invalid." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  // Only a refusal of the grant itself ends the session. An outage, a timeout or a rate limit is
  // answered as unavailable instead: the app reads "expired" as a sign-out, and signing someone
  // out over a blip upstream costs them their place for nothing.
  const grantRefused =
    !error || error.status === 400 || error.status === 401 || error.status === 403;
  if (error && !grantRefused) {
    console.error("[Tensor Auth] Session refresh unavailable", error.status, error.code);
    return NextResponse.json(
      { error: "Cencori could not refresh your session right now. Try again in a moment." },
      { headers: noStoreHeaders(), status: 503 },
    );
  }
  if (error || !data.session || !data.user) {
    return NextResponse.json(
      { error: "Your Cencori session expired. Sign in again." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }

  return NextResponse.json(
    {
      access_token: data.session.access_token,
      expires_in: data.session.expires_in,
      refresh_token: data.session.refresh_token,
      user: data.user,
    },
    { headers: noStoreHeaders() },
  );
}
