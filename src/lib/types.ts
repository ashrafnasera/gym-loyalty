export type PeakHourRule = {
  day: "all" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  start: string; // "HH:MM" 24h, in gym timezone
  end: string; // "HH:MM" 24h, in gym timezone
};

export type GymSettings = {
  timezone: string;
  points: {
    offPeak: number;
    peak: number;
    streakBonus: number;
  };
  peakHours: PeakHourRule[];
  streak: {
    visitsPerWeekTarget: number;
  };
};

export const DEFAULT_GYM_SETTINGS: GymSettings = {
  timezone: "Asia/Amman",
  points: { offPeak: 10, peak: 5, streakBonus: 20 },
  peakHours: [{ day: "all", start: "17:00", end: "21:00" }],
  streak: { visitsPerWeekTarget: 4 },
};

export type Gym = {
  id: string;
  name: string;
  settings: GymSettings;
  created_at: string;
};

export type Member = {
  id: string;
  gym_id: string;
  name: string;
  whatsapp_number: string;
  subscription_end: string | null;
  created_at: string;
};

export type VisitType = "peak" | "off_peak";

export type Visit = {
  id: string;
  member_id: string;
  gym_id: string;
  checked_in_at: string;
  points_earned: number;
  visit_type: VisitType;
  created_at: string;
};

export type PointsTransaction = {
  id: string;
  member_id: string;
  gym_id: string;
  amount: number;
  reason: string;
  visit_id: string | null;
  created_at: string;
};

export type MemberStreak = {
  member_id: string;
  gym_id: string;
  week_start: string;
  visits_this_week: number;
  current_streak_weeks: number;
  longest_streak_weeks: number;
  last_bonus_week: string | null;
  updated_at: string;
};

export type Reward = {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  points_cost: number;
  active: boolean;
  created_at: string;
};
