import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cookieNameForGym, verifyMemberSession } from "@/lib/session";
import { getMemberPointsBalance } from "@/lib/balance";
import { redeemBodySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = redeemBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
      { status: 400 }
    );
  }
  const { gymId, rewardId } = parsed.data;

  const cookieStore = cookies();
  const token = cookieStore.get(cookieNameForGym(gymId))?.value;
  const session = verifyMemberSession(token);

  if (!session || session.gymId !== gymId) {
    return NextResponse.json(
      { error: "الجلسة غير صالحة. سجّل حضورك أولاً عبر QR الجيم." },
      { status: 401 }
    );
  }

  const { data: reward, error: rewardError } = await supabaseAdmin
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("gym_id", gymId)
    .eq("active", true)
    .single();

  if (rewardError || !reward) {
    return NextResponse.json({ error: "الجائزة غير متاحة" }, { status: 404 });
  }

  const balance = await getMemberPointsBalance(supabaseAdmin, session.memberId);

  if (balance < reward.points_cost) {
    return NextResponse.json(
      {
        error: `رصيدك غير كافٍ. رصيدك الحالي ${balance} نقطة وتحتاج ${reward.points_cost}.`,
      },
      { status: 400 }
    );
  }

  const { data: redemption, error: redemptionError } = await supabaseAdmin
    .from("reward_redemptions")
    .insert({
      member_id: session.memberId,
      gym_id: gymId,
      reward_id: rewardId,
      points_spent: reward.points_cost,
    })
    .select("*")
    .single();

  if (redemptionError || !redemption) {
    return NextResponse.json(
      { error: `تعذّر تسجيل الاستبدال: ${redemptionError?.message ?? "خطأ"}` },
      { status: 500 }
    );
  }

  const { error: txError } = await supabaseAdmin.from("points_transactions").insert({
    member_id: session.memberId,
    gym_id: gymId,
    amount: -reward.points_cost,
    reason: `reward_redeem:${reward.name}`,
  });

  if (txError) {
    return NextResponse.json(
      { error: `تعذّر خصم النقاط: ${txError.message}` },
      { status: 500 }
    );
  }

  const newBalance = await getMemberPointsBalance(supabaseAdmin, session.memberId);

  return NextResponse.json({
    success: true,
    reward: { name: reward.name, pointsCost: reward.points_cost },
    pointsBalance: newBalance,
    message: `تم استبدال "${reward.name}" بنجاح. أظهر هذه الشاشة للموظف.`,
  });
}
