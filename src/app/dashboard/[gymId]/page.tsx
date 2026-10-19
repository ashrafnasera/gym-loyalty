import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_GYM_SETTINGS, type GymSettings } from "@/lib/types";
import { getStartOfLocalDayUTC } from "@/lib/points";
import { QrCode } from "./QrCode";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

function mergeSettings(raw: unknown): GymSettings {
  const fallback = DEFAULT_GYM_SETTINGS;
  const r = (raw ?? {}) as Partial<GymSettings>;
  return {
    timezone: r.timezone ?? fallback.timezone,
    points: { ...fallback.points, ...(r.points ?? {}) },
    peakHours: r.peakHours?.length ? r.peakHours : fallback.peakHours,
    streak: { ...fallback.streak, ...(r.streak ?? {}) },
  };
}

export default async function DashboardPage({
  params,
}: {
  params: { gymId: string };
}) {
  const { gymId } = params;
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/dashboard/${gymId}/login`);
  }

  const { data: gym } = await supabase
    .from("gyms")
    .select("id, name, settings")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-lg font-semibold">لا تملك صلاحية الوصول لهذا الجيم</p>
        <p className="mt-2 text-sm text-gray-500">
          تأكد أن حسابك مرتبط بهذا الجيم عبر جدول gym_staff في Supabase.
        </p>
      </main>
    );
  }

  const settings = mergeSettings(gym.settings);
  const now = new Date();
  const startOfToday = getStartOfLocalDayUTC(now, settings.timezone);
  const checkinUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/g/${gymId}/checkin`;
  const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const soonDateStr = soonThreshold.toISOString().slice(0, 10);
  const todayDateStr = now.toISOString().slice(0, 10);

  const [
    membersCountRes,
    visitsTodayRes,
    recentVisitsRes,
    topBalancesRes,
    rewardsRes,
    expiringRes,
  ] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", gymId),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .gte("checked_in_at", startOfToday.toISOString()),
    supabase
      .from("visits")
      .select("id, checked_in_at, points_earned, visit_type, members(name)")
      .eq("gym_id", gymId)
      .order("checked_in_at", { ascending: false })
      .limit(10),
    supabase
      .from("member_balances")
      .select("member_id, balance")
      .eq("gym_id", gymId)
      .order("balance", { ascending: false })
      .limit(10),
    supabase
      .from("rewards")
      .select("id, name, points_cost, active")
      .eq("gym_id", gymId)
      .order("points_cost", { ascending: true }),
    supabase
      .from("members")
      .select("id, name, whatsapp_number, subscription_end")
      .eq("gym_id", gymId)
      .not("subscription_end", "is", null)
      .lte("subscription_end", soonDateStr)
      .order("subscription_end", { ascending: true }),
  ]);

  const topBalances = topBalancesRes.data ?? [];
  const topMemberIds = topBalances.map((b) => b.member_id);
  let topMembersById: Record<string, { name: string }> = {};
  if (topMemberIds.length > 0) {
    const { data: topMembers } = await supabase
      .from("members")
      .select("id, name")
      .in("id", topMemberIds);
    topMembersById = Object.fromEntries((topMembers ?? []).map((m) => [m.id, m]));
  }

  const expiringSoon = (expiringRes.data ?? []).filter(
    (m) => m.subscription_end && m.subscription_end >= todayDateStr
  );
  const alreadyExpired = (expiringRes.data ?? []).filter(
    (m) => m.subscription_end && m.subscription_end < todayDateStr
  );

  return (
    <main className="mx-auto max-w-3xl p-4 pb-16 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{gym.name}</h1>
          <p className="text-xs text-gray-400">لوحة تحكم الولاء</p>
        </div>
        <SignOutButton />
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="عدد الأعضاء" value={membersCountRes.count ?? 0} />
        <StatCard label="زيارات اليوم" value={visitsTodayRes.count ?? 0} />
        <StatCard label="جوائز نشطة" value={rewardsRes.data?.filter((r) => r.active).length ?? 0} />
        <StatCard label="اشتراكات قريبة الانتهاء" value={expiringSoon.length} />
      </section>

      <section className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-center md:flex-row md:justify-between md:text-right">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            رابط / QR تسجيل الحضور
          </h2>
          <p className="mt-1 break-all text-xs text-gray-400" dir="ltr">
            {checkinUrl}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            اطبع هذا الكود وضعه عند مدخل الجيم — نفس الكود لكل الزيارات.
          </p>
        </div>
        <QrCode value={checkinUrl} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">آخر الزيارات</h2>
          {recentVisitsRes.data && recentVisitsRes.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {recentVisitsRes.data.map((v: any) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                  <span>{v.members?.name ?? "—"}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(v.checked_in_at).toLocaleString("ar", {
                      timeZone: settings.timezone,
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  <span className="text-xs font-medium text-brand-600">
                    +{v.points_earned}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="لا توجد زيارات بعد" />
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            أعلى الأعضاء بالنقاط
          </h2>
          {topBalances.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {topBalances.map((b, i) => (
                <li key={b.member_id} className="flex items-center justify-between text-sm">
                  <span>
                    {i + 1}. {topMembersById[b.member_id]?.name ?? "—"}
                  </span>
                  <span className="font-medium text-brand-600">{b.balance} نقطة</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="لا يوجد رصيد نقاط بعد" />
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">الجوائز</h2>
          {rewardsRes.data && rewardsRes.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {rewardsRes.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className={r.active ? "" : "text-gray-400 line-through"}>
                    {r.name}
                  </span>
                  <span className="text-xs text-gray-400">{r.points_cost} نقطة</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="لم تُضَف جوائز بعد (أضفها من Supabase Table Editor مؤقتاً)" />
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            اشتراكات أدخلها الأعضاء وتقترب من الانتهاء
          </h2>
          <p className="mb-2 text-xs text-gray-400">
            هذه المعلومة أدخلها العضو بنفسه وليست مصدراً رسمياً — استخدمها كتنبيه فقط.
          </p>
          {expiringSoon.length > 0 || alreadyExpired.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {[...alreadyExpired, ...expiringSoon].map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.name}</span>
                  <span
                    className={
                      m.subscription_end && m.subscription_end < todayDateStr
                        ? "text-xs font-medium text-red-500"
                        : "text-xs font-medium text-amber-600"
                    }
                  >
                    {m.subscription_end}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="لا توجد اشتراكات قريبة من الانتهاء" />
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold text-brand-700">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-4 text-center text-xs text-gray-400">{text}</p>;
}
