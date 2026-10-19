import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cookieNameForGym, verifyMemberSession } from "@/lib/session";
import { getMemberPointsBalance } from "@/lib/balance";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get("gymId");

  if (!gymId) {
    return NextResponse.json({ error: "gymId مطلوب" }, { status: 400 });
  }

  const cookieStore = cookies();
  const token = cookieStore.get(cookieNameForGym(gymId))?.value;
  const session = verifyMemberSession(token);

  if (!session || session.gymId !== gymId) {
    return NextResponse.json({ error: "لا توجد جلسة" }, { status: 401 });
  }

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id, name, whatsapp_number, subscription_end")
    .eq("id", session.memberId)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 });
  }

  const [balance, rewardsRes, streakRes] = await Promise.all([
    getMemberPointsBalance(supabaseAdmin, member.id),
    supabaseAdmin
      .from("rewards")
      .select("id, name, description, points_cost")
      .eq("gym_id", gymId)
      .eq("active", true)
      .order("points_cost", { ascending: true }),
    supabaseAdmin
      .from("member_streaks")
      .select("visits_this_week, current_streak_weeks, longest_streak_weeks")
      .eq("member_id", member.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    member,
    pointsBalance: balance,
    rewards: rewardsRes.data ?? [],
    streak: streakRes.data ?? null,
  });
}
