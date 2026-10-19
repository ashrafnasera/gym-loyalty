"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function StaffLoginPage({
  params,
}: {
  params: { gymId: string };
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("بيانات الدخول غير صحيحة");
      return;
    }

    router.push(`/dashboard/${params.gymId}`);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-5">
      <header className="text-center">
        <div className="text-3xl">🔐</div>
        <h1 className="mt-1 text-lg font-bold">دخول الموظفين</h1>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">البريد الإلكتروني</label>
          <input
            required
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-gray-300 p-3 text-base focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">كلمة المرور</label>
          <input
            required
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-gray-300 p-3 text-base focus:border-brand-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-brand-600 p-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400">
        حسابات الموظفين تُنشأ حالياً من لوحة Supabase مباشرة. راجع README.
      </p>
    </main>
  );
}
