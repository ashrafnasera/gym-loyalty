import EntryTabs from "./EntryTabs";

// أيام الأسبوع بدءاً من السبت
const DAYS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
const DONE = 5; // عدد الأيام المكتملة في مثال البطاقة

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 px-5 py-10">
      <header className="space-y-4">
        <p className="text-sm font-medium text-brand-700">نظام ولاء الجيم</p>
        <h1 className="text-3xl font-bold leading-snug text-gray-900">
          كل زيارة للجيم تُحسب لك
        </h1>
        <p className="leading-7 text-gray-600">
          اجمع نقاطاً مع كل حضور، حافظ على سلسلة أيامك، واستبدلها بجوائز من جيمك.
        </p>
      </header>

      {/* بطاقة الأختام: العنصر المميّز في الصفحة */}
      <section
        aria-label="مثال على بطاقة العضو"
        className="rounded-2xl bg-brand-900 p-5 text-white"
      >
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-brand-100">بطاقة هذا الأسبوع</span>
          <span className="text-sm font-bold text-brand-200">
            سلسلة {DONE} أيام
          </span>
        </div>

        <ol className="mt-5 grid grid-cols-7 gap-2">
          {DAYS.map((d, i) => {
            const done = i < DONE;
            const today = i === DONE;
            return (
              <li key={d} className="flex flex-col items-center gap-1.5">
                <span
                  className={
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold " +
                    (done
                      ? "bg-brand-400 text-brand-900"
                      : today
                        ? "border-2 border-brand-300 text-brand-200"
                        : "border border-dashed border-brand-700 text-brand-700")
                  }
                >
                  {done ? "✓" : ""}
                </span>
                <span className="text-xs text-brand-200">{d}</span>
              </li>
            );
          })}
        </ol>

        <p className="mt-5 text-sm text-brand-100">
          زر الجيم اليوم لتكمل السلسلة وتحصل على نقاط إضافية.
        </p>
      </section>

      <EntryTabs />
    </main>
  );
}