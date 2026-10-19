# نظام ولاء الجيم — Gym Loyalty MVP

طبقة **ولاء مستقلة** تعمل فوق نظام إدارة الاشتراكات الحالي لديك (Excel أو أي نظام آخر). لا تستبدله ولا تحتاج نقل بياناته. الأعضاء يسجّلون حضورهم عبر QR واحد لكل جيم، ويكسبون نقاطاً يستبدلونها بجوائز.

## Tech Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Row Level Security)
- جاهز للنشر على Vercel

---

## 1) الإعداد المحلي

```bash
npm install
cp .env.example .env.local
# املأ القيم في .env.local (انظر القسم التالي)
npm run dev
```

يفتح على `http://localhost:3000`.

---

## 2) إعداد Supabase (المطلوب منك)

### أ) أنشئ مشروع Supabase
من [supabase.com](https://supabase.com) أنشئ مشروعاً جديداً، ثم من **Project Settings → API** انسخ:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **سري تماماً، لا تضعه في أي كود frontend أو Git**

### ب) شغّل الـ migration
من **SQL Editor** في لوحة Supabase، انسخ محتوى `supabase/migrations/0001_init.sql` بالكامل ونفّذه (Run). هذا ينشئ كل الجداول + RLS.

اختياري للتجربة: نفّذ أيضاً `supabase/seed.sql` لإنشاء جيم تجريبي وبعض الجوائز.

### ج) ولّد SESSION_SECRET
```bash
openssl rand -base64 32
```
ضع الناتج في `SESSION_SECRET` داخل `.env.local` (ولاحقاً في Vercel).

### د) أنشئ أول جيم حقيقي
من **Table Editor → gyms** أضف صفاً جديداً (name فقط، الـ settings لها قيمة افتراضية جاهزة). انسخ الـ `id` الذي تولّد — هذا هو `gymId` الذي سيظهر في روابط QR ولوحة التحكم.

يمكنك لاحقاً تعديل عمود `settings` (JSON) لتغيير أوقات الذروة وقيم النقاط، مثال:
```json
{
  "timezone": "Asia/Amman",
  "points": { "offPeak": 10, "peak": 5, "streakBonus": 20 },
  "peakHours": [{ "day": "all", "start": "17:00", "end": "21:00" }],
  "streak": { "visitsPerWeekTarget": 4 }
}
```

### هـ) أنشئ حساب موظف الجيم (للوصول للوحة التحكم)
1. من **Authentication → Users → Add user** أنشئ مستخدماً بإيميل وكلمة مرور (فعّل "Auto Confirm").
2. انسخ الـ `User UID` الخاص به.
3. من **Table Editor → gym_staff** أضف صفاً يربط: `gym_id` (من الخطوة د) + `user_id` (الـ UID) + `role = owner`.

الآن يمكن لهذا الموظف الدخول من `/dashboard/[gymId]/login`.

### و) أضف الجوائز (اختياري)
من **Table Editor → rewards** أضف الجوائز يدوياً في الـ MVP (اسم، وصف، تكلفة بالنقاط، active=true). لم أبنِ واجهة إدارة جوائز في الداشبورد بعد — هذا أول شيء منطقي لإضافته في النسخة القادمة.

---

## 3) النشر على Vercel

1. ادفع المشروع إلى GitHub.
2. من Vercel، Import Project، واختر الـ repo.
3. في **Environment Variables** أضف نفس متغيرات `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
   - `NEXT_PUBLIC_SITE_URL` = رابط الدومين بعد النشر (مثال: `https://yourgym.vercel.app`) — يُستخدم لبناء رابط QR الصحيح في لوحة التحكم.
4. Deploy.

بعد النشر، رابط الـ QR لكل جيم هو:
```
https://yourdomain.com/g/<gymId>/checkin
```
اطبعه أو حوّله لصورة QR وضعه عند مدخل الجيم — لوحة التحكم تعرض نفس الكود جاهزاً للطباعة.

---

## 4) كيف يعمل النظام (ملخص المنطق)

- **أول زيارة**: العضو يمسح QR → يدخل الاسم ورقم الواتساب (تاريخ الاشتراك اختياري) → يُسجَّل تلقائياً كـ check-in أول، ويُمنح كوكي جلسة موقّعة (HMAC، httpOnly).
- **الزيارات التالية**: نفس QR، بدون أي إدخال — الكوكي يتعرف عليه ويسجّل الحضور مباشرة.
- **نقطة واحدة لكل يوم**: لا يُحتسب أكثر من check-in واحد بنفس اليوم (بتوقيت الجيم المحدد في `settings.timezone`).
- **النقاط**: زيارة خارج وقت الذروة = نقاط أكثر، وقت الذروة = أقل، حسب `settings.points` و`settings.peakHours` — قابلة للتعديل من قاعدة البيانات مباشرة دون تعديل كود.
- **كل نقطة = transaction**: الرصيد ليس عموداً مخزَّناً، بل مجموع `points_transactions` دائماً — لضمان تتبّع كامل وقابل للتدقيق.
- **Streak**: عند الوصول لعدد الزيارات الأسبوعي المستهدف (`streak.visitsPerWeekTarget`, افتراضياً 4) يُمنح bonus تلقائي مرة واحدة فقط لكل أسبوع.
- **الجوائز**: العضو يرى الجوائز المتاحة بعد كل check-in، ويستبدلها إن كان رصيده كافياً (خصم فوري عبر transaction سالبة).
- **اشتراك الجيم**: `subscription_end` حقل اختياري يدخله العضو بنفسه — يُعرض كتنبيه في لوحة التحكم فقط، ولا يُستخدم كحقيقة موثوقة ولا يُعطّل أي وظيفة أساسية. لا يُرسل أي WhatsApp تلقائي في هذه المرحلة.

---

## 5) الأمان

- `service_role key` يُستخدم فقط داخل `src/app/api/**` (Route Handlers تعمل على السيرفر حصراً)، عبر `src/lib/supabase/admin.ts` المحمي بـ `import "server-only"` الذي يمنع استيراده الخاطئ من كود frontend عند البناء.
- لوحة تحكم الموظف تستخدم Supabase Auth (anon key + جلسة حقيقية) وتخضع بالكامل لـ Row Level Security — كل جيم يرى بيانات جيمه فقط عبر ربط `gym_staff`.
- هوية العضو لا تعتمد على `localStorage`، بل على كوكي `httpOnly` موقّعة بـ HMAC (`src/lib/session.ts`) — مصممة لتُستبدل لاحقاً بتدفق WhatsApp OTP دون تغيير شكل الجداول: يكفي إصدار نفس نوع الكوكي بعد التحقق من الـ OTP بدل الاعتماد المباشر على النموذج.

---

## 6) البنية

```
src/
  app/
    page.tsx                          صفحة رئيسية بسيطة
    g/[gymId]/checkin/                صفحة check-in العامة (QR)
    dashboard/[gymId]/login/          دخول الموظفين
    dashboard/[gymId]/                لوحة التحكم
    api/checkin/                      تسجيل + check-in
    api/rewards/redeem/               استبدال جائزة
    api/member/status/                رصيد العضو + الجوائز (بعد الدخول)
  lib/
    supabase/admin.ts                 عميل service role (سيرفر فقط)
    supabase/server.ts                عميل RLS-aware للوحة التحكم
    supabase/client.ts                عميل المتصفح لتسجيل دخول الموظف
    session.ts                        جلسة العضو الموقّعة
    points.ts                         حساب النقاط + المنطقة الزمنية
    streak.ts                         منطق الـ streak والمكافأة الأسبوعية
    balance.ts                        حساب الرصيد من transactions
    validation.ts                     Zod schemas
    types.ts                          أنواع مشتركة
supabase/
  migrations/0001_init.sql            كل الجداول + RLS
  seed.sql                            بيانات تجريبية اختيارية
```

---

## 7) ما لم يُبنَ بعد (تعمّدت عدم تعقيد الـ MVP)

- لا توجد واجهة لإدارة الجوائز من لوحة التحكم (تُدار من Supabase Table Editor حالياً).
- لا توجد واجهة لإنشاء حسابات موظفين جدد من داخل النظام (تُدار من Supabase Dashboard).
- لا إرسال WhatsApp تلقائي (تنبيهات الاشتراك تظهر فقط داخل لوحة التحكم).
- OTP عبر WhatsApp لهوية العضو غير مُفعّل، لكن تصميم الجلسة يسمح بإضافته لاحقاً دون تعديل جذري.

هذه نقاط منطقية للنسخة التالية، وليست ناقصة عن طريق الخطأ.
