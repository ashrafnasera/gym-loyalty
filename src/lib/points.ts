import type { GymSettings, PeakHourRule, VisitType } from "@/lib/types";

const WEEKDAY_MAP: Record<string, PeakHourRule["day"]> = {
  Monday: "mon",
  Tuesday: "tue",
  Wednesday: "wed",
  Thursday: "thu",
  Friday: "fri",
  Saturday: "sat",
  Sunday: "sun",
};

/**
 * يرجع الأجزاء المحلية (سنة/شهر/يوم/ساعة/دقيقة/اسم اليوم) لتاريخ معيّن
 * بحسب المنطقة الزمنية للجيم، بدون أي مكتبة خارجية.
 */
function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    weekday: get("weekday"),
  };
}

/** "YYYY-MM-DD" بحسب المنطقة الزمنية للجيم — يُستخدم لمنع أكثر من check-in في نفس اليوم. */
export function getLocalDateString(date: Date, timeZone: string): string {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

/** بداية الأسبوع (الاثنين) كـ "YYYY-MM-DD" بحسب المنطقة الزمنية للجيم. */
export function getWeekStartDateString(date: Date, timeZone: string): string {
  const { year, month, day, weekday } = getZonedParts(date, timeZone);
  const localMidnightUTC = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  );

  const weekdayIndex: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };

  const offset = weekdayIndex[weekday] ?? 0;
  localMidnightUTC.setUTCDate(localMidnightUTC.getUTCDate() - offset);

  const y = localMidnightUTC.getUTCFullYear();
  const m = String(localMidnightUTC.getUTCMonth() + 1).padStart(2, "0");
  const d = String(localMidnightUTC.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** هل الوقت المحدد يقع ضمن ساعات الذروة المعرّفة في إعدادات الجيم؟ */
export function isPeakTime(date: Date, settings: GymSettings): boolean {
  const { hour, minute, weekday } = getZonedParts(date, settings.timezone);
  const nowMinutes = Number(hour) * 60 + Number(minute);
  const todayKey = WEEKDAY_MAP[weekday];

  return settings.peakHours.some((rule) => {
    if (rule.day !== "all" && rule.day !== todayKey) return false;
    const start = timeStringToMinutes(rule.start);
    const end = timeStringToMinutes(rule.end);
    if (start <= end) {
      return nowMinutes >= start && nowMinutes < end;
    }
    // نطاق يعبر منتصف الليل، مثال: 22:00 -> 02:00
    return nowMinutes >= start || nowMinutes < end;
  });
}

/**
 * تقدير لحظة "منتصف الليل" المحلي (بداية اليوم) لمنطقة زمنية معيّنة،
 * كطابع UTC. يعتمد على فرق التوقيت الحالي بين المنطقة و UTC؛ كافٍ لعرض
 * لوحة تحكم بسيطة، وقد يخطئ بدقيقة أو اثنتين أثناء لحظة انتقال التوقيت
 * الصيفي/الشتوي نفسها (نادر جداً وغير حرج هنا).
 */
export function getStartOfLocalDayUTC(date: Date, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";

  const zonedAsUTC = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    get("hour") === "24" ? 0 : Number(get("hour")),
    Number(get("minute")),
    Number(get("second"))
  );
  const offsetMs = zonedAsUTC - date.getTime();

  const localMidnightAsUTC = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    0,
    0,
    0
  );

  return new Date(localMidnightAsUTC - offsetMs);
}

export function calculateVisitPoints(
  date: Date,
  settings: GymSettings
): { points: number; visitType: VisitType } {
  const peak = isPeakTime(date, settings);
  return {
    points: peak ? settings.points.peak : settings.points.offPeak,
    visitType: peak ? "peak" : "off_peak",
  };
}
