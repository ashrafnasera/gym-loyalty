import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * عميل Supabase يعمل على السيرفر لكن بهوية موظف الجيم المسجّل دخوله
 * (anon key + جلسة Supabase Auth عبر الكوكيز). كل القراءات هنا تمر
 * عبر RLS كاملة — هذا هو المسار الوحيد لعرض بيانات لوحة التحكم.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // يحدث عند الاستدعاء من Server Component وليس Route Handler/Action —
            // آمن التجاهل طالما middleware يُحدّث الجلسة عند الحاجة.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // انظر التعليق أعلاه.
          }
        },
      },
    }
  );
}
