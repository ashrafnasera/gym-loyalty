"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "member" | "staff";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const COPY: Record<
  Mode,
  { tab: string; title: string; help: string; button: string }
> = {
  member: {
    tab: "أنا عضو",
    title: "افتح بطاقتك",
    help: "أسهل طريقة: امسح رمز QR الموجود في الجيم بكاميرا هاتفك. وإن لم يتوفر، أدخل رمز الجيم هنا.",
    button: "فتح بطاقتي",
  },
  staff: {
    tab: "صاحب جيم أو موظف",
    title: "لوحة التحكم",
    help: "أدخل رمز الجيم ثم سجّل الدخول بالبريد وكلمة المرور.",
    button: "متابعة إلى تسجيل الدخول",
  },
};

export default function EntryTabs() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("member");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const copy = COPY[mode];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // يقبل الرمز مباشرة أو رابطاً كاملاً منسوخاً من QR
    const match = value.match(UUID_RE);
    if (!match) {
      setError("الرمز غير صحيح. انسخه كما هو من رابط الـ QR أو اطلبه من الاستقبال.");
      return;
    }
    const gymId = match[0].toLowerCase();
    router.push(
      mode === "member"
        ? `/g/${gymId}/checkin`
        : `/dashboard/${gymId}/login`
    );
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div
        role="tablist"
        aria-label="نوع الدخول"
        className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
      >
        {(Object.keys(COPY) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`tab-${m}`}
            aria-selected={mode === m}
            aria-controls="entry-panel"
            onClick={() => switchMode(m)}
            className={
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 " +
              (mode === m
                ? "bg-white text-brand-800 shadow-sm"
                : "text-gray-500 hover:text-gray-800")
            }
          >
            {COPY[m].tab}
          </button>
        ))}
      </div>

      <form
        id="entry-panel"
        role="tabpanel"
        aria-labelledby={`tab-${mode}`}
        onSubmit={onSubmit}
        className="mt-5 space-y-4"
      >
        <div>
          <h2 className="text-lg font-bold">{copy.title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">{copy.help}</p>
        </div>

        <div>
          <label htmlFor="gym-code" className="mb-1.5 block text-sm font-medium">
            رمز الجيم
          </label>
          <input
            id="gym-code"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            placeholder="00000000-0000-0000-0000-000000000000"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "gym-code-error" : undefined}
            className={
              "w-full rounded-xl border bg-white px-3 py-3 text-left text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 " +
              (error
                ? "border-red-400 focus:ring-red-300"
                : "border-gray-300 focus:border-brand-500 focus:ring-brand-200")
            }
          />
          {error && (
            <p id="gym-code-error" role="alert" className="mt-1.5 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {copy.button}
        </button>
      </form>
    </section>
  );
}
