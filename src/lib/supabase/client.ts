"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * عميل Supabase للمتصفح — يستخدم anon key فقط، ويخضع دائماً لـ RLS.
 * يُستخدم حصراً لتسجيل دخول موظف الجيم (Supabase Auth)، وليس لأي كتابة
 * تخص بيانات الأعضاء.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
