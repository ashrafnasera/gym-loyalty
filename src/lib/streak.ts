import type { SupabaseClient } from "@supabase/supabase-js";
import { getWeekStartDateString } from "@/lib/points";
import type { GymSettings, Member, MemberStreak } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type StreakUpdateResult = {
  streak: MemberStreak;
  bonusAwarded: boolean;
  bonusPoints: number;
};

/**
 * يُستدعى بعد تسجيل كل زيارة محسوبة (visit جديد). يحدّث عداد الأسبوع،
 * ويمنح مكافأة نقاط تلقائياً عند الوصول إلى هدف الزيارات الأسبوعية،
 * مرة واحدة فقط لكل أسبوع.
 */
export async function updateStreakAndMaybeAwardBonus(
  admin: SupabaseClient,
  member: Member,
  settings: GymSettings,
  now: Date,
  visitId: string
): Promise<StreakUpdateResult> {
  const currentWeekStart = getWeekStartDateString(now, settings.timezone);
  const target = settings.streak.visitsPerWeekTarget;

  const { data: existing } = await admin
    .from("member_streaks")
    .select("*")
    .eq("member_id", member.id)
    .maybeSingle();

  let visitsThisWeek: number;
  let currentStreakWeeks: number;
  let longestStreakWeeks: number;
  let lastBonusWeek: string | null;

  if (!existing) {
    visitsThisWeek = 1;
    currentStreakWeeks = 0;
    longestStreakWeeks = 0;
    lastBonusWeek = null;
  } else if (existing.week_start === currentWeekStart) {
    visitsThisWeek = existing.visits_this_week + 1;
    currentStreakWeeks = existing.current_streak_weeks;
    longestStreakWeeks = existing.longest_streak_weeks;
    lastBonusWeek = existing.last_bonus_week;
  } else {
    // أسبوع جديد. هل الأسبوع السابق حقق الهدف مباشرة قبل هذا الأسبوع؟
    const prevWeekAchievedBonus = existing.last_bonus_week === existing.week_start;
    const prevWeekStartMs = Date.parse(`${existing.week_start}T00:00:00Z`);
    const currentWeekStartMs = Date.parse(`${currentWeekStart}T00:00:00Z`);
    const isImmediatelyConsecutive =
      Math.round((currentWeekStartMs - prevWeekStartMs) / DAY_MS) === 7;

    visitsThisWeek = 1;
    currentStreakWeeks =
      prevWeekAchievedBonus && isImmediatelyConsecutive
        ? existing.current_streak_weeks
        : 0;
    longestStreakWeeks = existing.longest_streak_weeks;
    lastBonusWeek = existing.last_bonus_week;
  }

  let bonusAwarded = false;
  const bonusPoints = settings.points.streakBonus;

  if (visitsThisWeek >= target && lastBonusWeek !== currentWeekStart) {
    bonusAwarded = true;
    currentStreakWeeks += 1;
    lastBonusWeek = currentWeekStart;
    longestStreakWeeks = Math.max(longestStreakWeeks, currentStreakWeeks);
  }

  const { data: saved, error } = await admin
    .from("member_streaks")
    .upsert(
      {
        member_id: member.id,
        gym_id: member.gym_id,
        week_start: currentWeekStart,
        visits_this_week: visitsThisWeek,
        current_streak_weeks: currentStreakWeeks,
        longest_streak_weeks: longestStreakWeeks,
        last_bonus_week: lastBonusWeek,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" }
    )
    .select("*")
    .single();

  if (error || !saved) {
    throw new Error(`تعذّر تحديث streak: ${error?.message ?? "unknown error"}`);
  }

  if (bonusAwarded) {
    const { error: txError } = await admin.from("points_transactions").insert({
      member_id: member.id,
      gym_id: member.gym_id,
      amount: bonusPoints,
      reason: `streak_bonus:${currentWeekStart}`,
      visit_id: visitId,
    });
    if (txError) {
      throw new Error(`تعذّر تسجيل مكافأة streak: ${txError.message}`);
    }
  }

  return { streak: saved as MemberStreak, bonusAwarded, bonusPoints };
}
