import { supabaseAdmin } from "@/lib/supabase/admin";
import { CheckinClient } from "./CheckinClient";

export const dynamic = "force-dynamic";

export default async function CheckinPage({
  params,
}: {
  params: { gymId: string };
}) {
  const { gymId } = params;

  const { data: gym } = await supabaseAdmin
    .from("gyms")
    .select("id, name")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-lg font-bold">رابط غير صحيح</h1>
        <p className="text-sm text-gray-600">
          لم يتم العثور على جيم بهذا الرابط. تأكد من مسح QR الصحيح.
        </p>
      </main>
    );
  }

  return <CheckinClient gymId={gym.id} gymName={gym.name} />;
}
