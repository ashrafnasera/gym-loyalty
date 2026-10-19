"use client";

import { useEffect, useState } from "react";

type CheckinResult = {
  success: boolean;
  alreadyCheckedIn: boolean;
  message: string;
  pointsEarned: number;
  pointsBalance: number;
  bonusAwarded?: boolean;
  bonusPoints?: number;
  member: { name: string };
};

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
};

type Screen = "loading" | "register" | "result";

export function CheckinClient({
  gymId,
  gymName,
}: {
  gymId: string;
  gymName: string;
}) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [subscriptionEnd, setSubscriptionEnd] = useState("");

  async function attemptAutoCheckin() {
    setScreen("loading");
    setError(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
        setScreen("result");
        loadRewards();
      } else if (data.requiresRegistration) {
        setScreen("register");
      } else {
        setError(data.error ?? "حدث خطأ غير متوقع");
        setScreen("register");
      }
    } catch {
      setError("تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.");
      setScreen("register");
    }
  }

  async function loadRewards() {
    try {
      const res = await fetch(`/api/member/status?gymId=${gymId}`);
      if (res.ok) {
        const data = await res.json();
        setRewards(data.rewards ?? []);
      }
    } catch {
      // اختياري — لا نعطّل شاشة النجاح إن فشل هذا الجزء
    }
  }

  useEffect(() => {
    attemptAutoCheckin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          name,
          whatsapp,
          subscriptionEnd: subscriptionEnd || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
        setScreen("result");
        loadRewards();
      } else {
        setError(data.error ?? "حدث خطأ غير متوقع");
      }
    } catch {
      setError("تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRedeem(rewardId: string) {
    setRedeeming(rewardId);
    setRedeemMessage(null);
    try {
      const res = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, rewardId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRedeemMessage(data.message);
        setResult((prev) =>
          prev ? { ...prev, pointsBalance: data.pointsBalance } : prev
        );
      } else {
        setRedeemMessage(data.error ?? "تعذّر الاستبدال");
      }
    } catch {
      setRedeemMessage("تعذّر الاتصال بالخادم");
    } finally {
      setRedeeming(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-5">
      <header className="text-center">
        <div className="text-3xl">🏋️</div>
        <h1 className="mt-1 text-lg font-bold">{gymName}</h1>
      </header>

      {screen === "loading" && (
        <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm">جارٍ تسجيل حضورك...</p>
        </div>
      )}

      {screen === "register" && (
        <form
          onSubmit={handleRegisterSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-center text-base font-semibold">
            أول زيارة؟ سجّل بياناتك
          </h2>

          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">الاسم</label>
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-gray-300 p-3 text-base focus:border-brand-500 focus:outline-none"
              placeholder="اسمك الكامل"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">رقم واتساب</label>
            <input
              required
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="rounded-xl border border-gray-300 p-3 text-base focus:border-brand-500 focus:outline-none"
              placeholder="07XXXXXXXX"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">
              تاريخ انتهاء الاشتراك <span className="text-gray-400">(اختياري)</span>
            </label>
            <input
              type="date"
              value={subscriptionEnd}
              onChange={(e) => setSubscriptionEnd(e.target.value)}
              className="rounded-xl border border-gray-300 p-3 text-base focus:border-brand-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-xl bg-brand-600 p-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "جارٍ التسجيل..." : "تسجيل ودخول"}
          </button>
        </form>
      )}

      {screen === "result" && result && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
            <div className="text-4xl">{result.alreadyCheckedIn ? "👋" : "✅"}</div>
            <p className="text-base font-semibold text-brand-800">
              {result.message}
            </p>
            <p className="text-sm text-gray-500">
              أهلاً {result.member.name} — رصيدك الحالي:{" "}
              <span className="font-bold text-brand-700">
                {result.pointsBalance} نقطة
              </span>
            </p>
          </div>

          {rewards.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                الجوائز المتاحة
              </h3>
              <ul className="flex flex-col gap-2">
                {rewards.map((r) => {
                  const canAfford = result.pointsBalance >= r.points_cost;
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        {r.description && (
                          <p className="text-xs text-gray-500">{r.description}</p>
                        )}
                        <p className="text-xs text-brand-600">
                          {r.points_cost} نقطة
                        </p>
                      </div>
                      <button
                        disabled={!canAfford || redeeming === r.id}
                        onClick={() => handleRedeem(r.id)}
                        className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-300"
                      >
                        {redeeming === r.id ? "..." : "استبدال"}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {redeemMessage && (
                <p className="mt-2 rounded-lg bg-gray-50 p-2 text-center text-xs text-gray-600">
                  {redeemMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
