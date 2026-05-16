import { createServerClient as createSSClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createServerClient = async () => {
  const cookieStore = await cookies();
  const host = (await headers()).get("host") || "";
  const isProd = host.endsWith("cencori.com");

  return createSSClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, {
              ...options,
              domain: isProd ? ".cencori.com" : options.domain,
            });
          } catch (_error) {
            // The `set` method was called from a Server Component.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, "", { 
              ...options, 
              domain: isProd ? ".cencori.com" : options.domain,
              maxAge: -1 
            });
          } catch (_error) {
            // The `remove` method was called from a Server Component.
          }
        },
      },
      cookieOptions: {
        domain: isProd ? ".cencori.com" : undefined,
        path: '/',
      },
    },
  );
};