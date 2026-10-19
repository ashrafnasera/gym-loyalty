import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * عميل Supabase بصلاحيات service role الكاملة.
 *
 * ⚠️ يُستخدم فقط داخل:
 *   - Route Handlers تحت src/app/api/**  (تعمل حصراً على السيرفر)
 *   - React Server Components (لا تُرسل هذا الملف أو الكائن إلى المتصفح أبداً)
 *
 * لا تستورد هذا الملف داخل أي ملف يحمل توجيه "use client".
 * حزمة "server-only" أعلاه تمنع ذلك فعلياً عبر رمي خطأ عند البناء
 * إن حدث استيراد خاطئ من كود يعمل في المتصفح.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client: SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير مضبوطة في env."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabaseAdmin = getAdminClient();
