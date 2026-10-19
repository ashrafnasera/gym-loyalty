import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  cookieNameForGym,
  signMemberSession,
  verifyMemberSession,
  MEMBER_SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";
import { calculateVisitPoints, getLocalDateString } from "@/lib/points";
import { updateStreakAndMaybeAwardBonus } from "@/lib/streak";
import { getMemberPointsBalance } from "@/lib/balance";
import { checkinBodySchema, normalizeWhatsapp } from "@/lib/validation";
import { DEFAULT_GYM_SETTINGS } from "@/lib/types";
import type { GymSettings, Member } from "@/lib/types";

export const runtime = "nodejs";

function mergeSettings(raw: unknown): GymSettings {
  // الإعدادات المخزّنة في jsonb قد لا تحتوي كل الحقول إن عُدّلت جزئياً لاحقاً،
  // لذلك ندمجها فوق قيم افتراضية آمنة بدل الوثوق بها بالكامل.
  const fallback = DEFAULT_GYM_SETTINGS;
  const r = (raw ?? {}) as Partial<GymSettings>;
  return {
    timezone: r.timezone ?? fallback.timezone,
    points: { ...fallback.points, ...(r.points ?? {}) },
    peakHours: r.peakHours?.length ? r.peakHours : fallback.peakHours,
    streak: { ...fallback.streak, ...(r.streak ?? {}) },
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = checkinBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
      { status: 400 }
    );
  }
  const { gymId, name, whatsapp, subscriptionEnd } = parsed.data;

  // 1) تأكد أن الجيم موجود واجلب إعداداته
  const { data: gym, error: gymError } = await supabaseAdmin
    .from("gyms")
    .select("id, name, settings")
    .eq("id", gymId)
    .single();

  if (gymError || !gym) {
    return NextResponse.json({ error: "الجيم غير موجود" }, { status: 404 });
  }

  const settings = mergeSettings(gym.settings);

  // 2) هل يوجد كوكي جلسة صالحة لهذا الجيم تحديداً؟
  const cookieStore = cookies();
  const cookieName = cookieNameForGym(gymId);
  const existingToken = cookieStore.get(cookieName)?.value;
  const sessionPayload = verifyMemberSession(existingToken);

  let member: Member | null = null;

  if (sessionPayload && sessionPayload.gymId === gymId) {
    const { data: existingMember } = await supabaseAdmin
      .from("members")
      .select("*")
      .eq("id", sessionPayload.memberId)
      .eq("gym_id", gymId)
      .maybeSingle();
    if (existingMember) {
      member = existingMember as Member;
    }
  }

  // 3) لا توجد جلسة صالحة → هذا أول تسجيل، نحتاج الاسم والواتساب
  if (!member) {
    if (!name || !whatsapp) {
      return NextResponse.json(
        { error: "الاسم ورقم الواتساب مطلوبان لأول تسجيل", requiresRegistration: true },
        { status: 400 }
      );
    }

    const normalizedWhatsapp = normalizeWhatsapp(whatsapp);

    // ابحث عن عضو موجود بنفس الرقم في هذا الجيم (تفادي التكرار)
    const { data: byPhone } = await supabaseAdmin
      .from("members")
      .select("*")
      .eq("gym_id", gymId)
      .eq("whatsapp_number", normalizedWhatsapp)
      .maybeSingle();

    if (byPhone) {
      member = byPhone as Member;
    } else {
      const { data: created, error: createError } = await supabaseAdmin
        .from("members")
        .insert({
          gym_id: gymId,
          name,
          whatsapp_number: normalizedWhatsapp,
          subscription_end: subscriptionEnd ?? null,
        })
        .select("*")
        .single();

      if (createError || !created) {
        return NextResponse.json(
          { error: `تعذّر إنشاء العضو: ${createError?.message ?? "خطأ غير معروف"}` },
          { status: 500 }
        );
      }
      member = created as Member;
    }
  }

  // 4) اضبط/جدّد كوكي الجلسة دائماً بعد التعرف على العضو
  const token = signMemberSession({
    memberId: member.id,
    gymId,
    issuedAt: Date.now(),
  });
  cookieStore.set({
    name: cookieName,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MEMBER_SESSION_MAX_AGE_SECONDS,
  });

  // 5) امنع أكثر من check-in محسوب لنفس العضو في نفس اليوم (بتوقيت الجيم)
  const now = new Date();
  const todayLocal = getLocalDateString(now, settings.timezone);

  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentVisits } = await supabaseAdmin
    .from("visits")
    .select("id, checked_in_at")
    .eq("member_id", member.id)
    .gte("checked_in_at", windowStart)
    .order("checked_in_at", { ascending: false });

  const alreadyToday = (recentVisits ?? []).some(
    (v) => getLocalDateString(new Date(v.checked_in_at), settings.timezone) === todayLocal
  );

  if (alreadyToday) {
    const pointsBalance = await getMemberPointsBalance(supabaseAdmin, member.id);
    return NextResponse.json({
      success: true,
      alreadyCheckedIn: true,
      member: { name: member.name },
      gymName: gym.name,
      pointsEarned: 0,
      pointsBalance,
      message: "تم تسجيل حضورك اليوم مسبقاً. عد غداً لتكسب نقاطاً جديدة!",
    });
  }

  // 6) سجّل الزيارة + نقاطها
  const { points, visitType } = calculateVisitPoints(now, settings);

  const { data: visit, error: visitError } = await supabaseAdmin
    .from("visits")
    .insert({
      member_id: member.id,
      gym_id: gymId,
      checked_in_at: now.toISOString(),
      points_earned: points,
      visit_type: visitType,
    })
    .select("*")
    .single();

  if (visitError || !visit) {
    return NextResponse.json(
      { error: `تعذّر تسجيل الزيارة: ${visitError?.message ?? "خطأ غير معروف"}` },
      { status: 500 }
    );
  }

  const { error: txError } = await supabaseAdmin.from("points_transactions").insert({
    member_id: member.id,
    gym_id: gymId,
    amount: points,
    reason: `visit:${visitType}`,
    visit_id: visit.id,
  });

  if (txError) {
    return NextResponse.json(
      { error: `تعذّر تسجيل معاملة النقاط: ${txError.message}` },
      { status: 500 }
    );
  }

  // 7) حدّث الـ streak، وامنح مكافأة تلقائياً إذا تحقق الهدف الأسبوعي
  let bonusAwarded = false;
  let bonusPoints = 0;
  try {
    const streakResult = await updateStreakAndMaybeAwardBonus(
      supabaseAdmin,
      member,
      settings,
      now,
      visit.id
    );
    bonusAwarded = streakResult.bonusAwarded;
    bonusPoints = streakResult.bonusPoints;
  } catch (e) {
    // لا نفشل عملية الـ check-in كلها بسبب خطأ في حساب الـ streak —
    // النقاط الأساسية للزيارة سُجّلت بالفعل بأمان.
    console.error("streak update failed:", e);
  }

  const pointsBalance = await getMemberPointsBalance(supabaseAdmin, member.id);

  return NextResponse.json({
    success: true,
    alreadyCheckedIn: false,
    member: { name: member.name },
    gymName: gym.name,
    pointsEarned: points,
    visitType,
    bonusAwarded,
    bonusPoints,
    pointsBalance,
    message: bonusAwarded
      ? `تم تسجيل زيارتك! +${points} نقطة، وحصلت أيضاً على مكافأة الاستمرارية +${bonusPoints} نقطة 🎉`
      : `تم تسجيل زيارتك +${points} نقطة`,
  });
}
