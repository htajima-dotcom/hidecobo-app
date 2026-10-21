import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** サーバー側の Supabase クライアント。ログイン中の人の権限（RLS）で動く */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component から呼ばれたときは書けない。middleware が更新する
        }
      },
    },
  });
}
