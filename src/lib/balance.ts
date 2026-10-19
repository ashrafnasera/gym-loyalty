import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * الرصيد ليس عموداً مخزَّناً — يُحسب دائماً بجمع points_transactions.
 * هذا يضمن أن كل تعديل على النقاط قابل للتتبع والتدقيق.
 */
export async function getMemberPointsBalance(
  admin: SupabaseClient,
  memberId: string
): Promise<number> {
  const { data, error } = await admin
    .from("points_transactions")
    .select("amount")
    .eq("member_id", memberId);

  if (error) {
    throw new Error(`تعذّر حساب رصيد النقاط: ${error.message}`);
  }

  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}
