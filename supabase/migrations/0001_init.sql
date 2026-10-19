-- ============================================================================
-- Gym Loyalty MVP — Initial schema
-- طبقة ولاء مستقلة فوق نظام إدارة الاشتراكات الحالي للجيم.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1) gyms
-- ----------------------------------------------------------------------------
create table if not exists public.gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- إعدادات قابلة للتعديل: أوقات الذروة + قواعد النقاط + المنطقة الزمنية
  -- مثال القيمة الافتراضية أدناه.
  settings    jsonb not null default '{
    "timezone": "Asia/Amman",
    "points": { "offPeak": 10, "peak": 5, "streakBonus": 20 },
    "peakHours": [
      { "day": "all", "start": "17:00", "end": "21:00" }
    ],
    "streak": { "visitsPerWeekTarget": 4 }
  }'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.gyms is 'صالة رياضية واحدة تستخدم نظام الولاء. مستقلة عن نظام الاشتراكات الحالي لديهم.';

-- ----------------------------------------------------------------------------
-- 2) gym_staff — يربط موظف الجيم (Supabase Auth user) بالجيم الذي يديره.
--    هذا هو أساس الـ RLS للوحة التحكم.
-- ----------------------------------------------------------------------------
create table if not exists public.gym_staff (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'staff' check (role in ('owner', 'staff')),
  created_at  timestamptz not null default now(),
  unique (gym_id, user_id)
);

create index if not exists idx_gym_staff_user on public.gym_staff(user_id);
create index if not exists idx_gym_staff_gym on public.gym_staff(gym_id);

-- ----------------------------------------------------------------------------
-- 3) members
--    لا تُستخدم Supabase Auth للأعضاء في الـ MVP. هوية العضو تُدار عبر
--    كوكي جلسة موقّعة على السيرفر (انظر src/lib/session.ts)، بحيث يسهل
--    لاحقاً استبدالها بـ OTP عبر WhatsApp دون تغيير شكل الجدول.
-- ----------------------------------------------------------------------------
create table if not exists public.members (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references public.gyms(id) on delete cascade,
  name                text not null,
  whatsapp_number     text not null,
  subscription_end    date,              -- اختياري، أدخله العضو بنفسه وغير موثوق كحقيقة رسمية
  created_at          timestamptz not null default now(),
  -- نفس رقم الواتساب يمكن أن يسجّل في أكثر من جيم، لكن مرة واحدة فقط لكل جيم
  unique (gym_id, whatsapp_number)
);

create index if not exists idx_members_gym on public.members(gym_id);
create index if not exists idx_members_whatsapp on public.members(gym_id, whatsapp_number);

-- ----------------------------------------------------------------------------
-- 4) visits
-- ----------------------------------------------------------------------------
create table if not exists public.visits (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.members(id) on delete cascade,
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  checked_in_at   timestamptz not null default now(),
  points_earned   integer not null default 0,
  visit_type      text not null check (visit_type in ('peak', 'off_peak')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_visits_member on public.visits(member_id);
create index if not exists idx_visits_gym on public.visits(gym_id);
create index if not exists idx_visits_gym_time on public.visits(gym_id, checked_in_at desc);

-- ----------------------------------------------------------------------------
-- 5) points_transactions — سجل كامل، الرصيد يُحسب دائماً من هذا الجدول
--    ولا يُخزَّن كحقل مستقل حتى لا يفقد المصدر الواحد للحقيقة.
-- ----------------------------------------------------------------------------
create table if not exists public.points_transactions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  amount      integer not null,          -- موجب = إضافة، سالب = خصم (استبدال جائزة)
  reason      text not null,             -- مثال: 'visit:off_peak', 'streak_bonus', 'reward_redeem:<name>'
  visit_id    uuid references public.visits(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_points_tx_member on public.points_transactions(member_id);
create index if not exists idx_points_tx_gym on public.points_transactions(gym_id);

-- ----------------------------------------------------------------------------
-- 6) member_streaks — حالة الـ streak محسوبة مسبقاً لتسريع لوحة التحكم.
--    week_start = يوم الاثنين من الأسبوع الحالي (بمنطقة زمنية الجيم).
-- ----------------------------------------------------------------------------
create table if not exists public.member_streaks (
  member_id             uuid primary key references public.members(id) on delete cascade,
  gym_id                uuid not null references public.gyms(id) on delete cascade,
  week_start            date not null,
  visits_this_week      integer not null default 0,
  current_streak_weeks  integer not null default 0,   -- عدد الأسابيع المتتالية التي حقق فيها الهدف
  longest_streak_weeks  integer not null default 0,
  last_bonus_week       date,                          -- آخر أسبوع مُنحت عنه مكافأة الـ streak (لمنع التكرار)
  updated_at            timestamptz not null default now()
);

create index if not exists idx_streaks_gym on public.member_streaks(gym_id);

-- ----------------------------------------------------------------------------
-- 7) rewards
-- ----------------------------------------------------------------------------
create table if not exists public.rewards (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  name          text not null,
  description   text,
  points_cost   integer not null check (points_cost > 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_rewards_gym on public.rewards(gym_id, active);

-- ----------------------------------------------------------------------------
-- 8) reward_redemptions
-- ----------------------------------------------------------------------------
create table if not exists public.reward_redemptions (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members(id) on delete cascade,
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  reward_id     uuid not null references public.rewards(id) on delete cascade,
  points_spent  integer not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_redemptions_member on public.reward_redemptions(member_id);
create index if not exists idx_redemptions_gym on public.reward_redemptions(gym_id);

-- ============================================================================
-- Row Level Security
--
-- استراتيجية الوصول:
-- - جميع كتابات "العضو" (تسجيل، check-in، استبدال جائزة) تمر عبر Next.js
--   API routes تستخدم الـ service role key على السيرفر فقط، فتتجاوز RLS
--   عن قصد بعد أن يتحقق الكود من صحة الطلب. هذا المفتاح لا يصل إطلاقاً
--   إلى المتصفح.
-- - قراءات لوحة تحكم الموظف تمر بجلسة Supabase Auth حقيقية للمتصفح
--   (anon key + auth.uid())، وتُفرض عليها RLS الكاملة أدناه بحيث
--   كل جيم يرى بياناته فقط.
-- ============================================================================

alter table public.gyms enable row level security;
alter table public.gym_staff enable row level security;
alter table public.members enable row level security;
alter table public.visits enable row level security;
alter table public.points_transactions enable row level security;
alter table public.member_streaks enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;

-- Helper: هل المستخدم الحالي موظف في هذا الجيم؟
create or replace function public.is_gym_staff(target_gym_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.gym_staff
    where gym_staff.gym_id = target_gym_id
      and gym_staff.user_id = auth.uid()
  );
$$;

-- gyms: الموظف يرى فقط الجيم الذي يعمل به
create policy "staff can view own gym"
  on public.gyms for select
  using (public.is_gym_staff(id));

create policy "staff can update own gym settings"
  on public.gyms for update
  using (public.is_gym_staff(id));

-- gym_staff: الموظف يرى صفوف جيمه فقط (لعرض الفريق إن لزم لاحقاً)
create policy "staff can view own gym_staff rows"
  on public.gym_staff for select
  using (public.is_gym_staff(gym_id));

-- members
create policy "staff can view own gym members"
  on public.members for select
  using (public.is_gym_staff(gym_id));

-- visits
create policy "staff can view own gym visits"
  on public.visits for select
  using (public.is_gym_staff(gym_id));

-- points_transactions
create policy "staff can view own gym points_transactions"
  on public.points_transactions for select
  using (public.is_gym_staff(gym_id));

-- member_streaks
create policy "staff can view own gym streaks"
  on public.member_streaks for select
  using (public.is_gym_staff(gym_id));

-- rewards: القراءة للموظفين كاملة، والتعديل (CRUD) أيضاً للموظفين
create policy "staff can view own gym rewards"
  on public.rewards for select
  using (public.is_gym_staff(gym_id));

create policy "staff can manage own gym rewards"
  on public.rewards for insert
  with check (public.is_gym_staff(gym_id));

create policy "staff can update own gym rewards"
  on public.rewards for update
  using (public.is_gym_staff(gym_id));

create policy "staff can delete own gym rewards"
  on public.rewards for delete
  using (public.is_gym_staff(gym_id));

-- reward_redemptions
create policy "staff can view own gym redemptions"
  on public.reward_redemptions for select
  using (public.is_gym_staff(gym_id));

-- ----------------------------------------------------------------------------
-- View مساعد: رصيد كل عضو محسوب من points_transactions.
-- security_invoker = true يضمن أن الـ RLS تُطبَّق بهوية المستخدم الذي
-- يستعلم (موظف الجيم عبر anon key)، وليس بصلاحيات مالك الـ view.
-- ----------------------------------------------------------------------------
create or replace view public.member_balances
  with (security_invoker = true)
as
select
  member_id,
  gym_id,
  sum(amount)::integer as balance
from public.points_transactions
group by member_id, gym_id;

-- ملاحظة: لا توجد سياسات INSERT/UPDATE للأعضاء (members/visits/points_transactions
-- /reward_redemptions/member_streaks) لأن كل الكتابة لهذه الجداول تتم حصرياً
-- عبر API routes بالـ service role key، والتي تتجاوز RLS بتصميم مقصود.
-- عدم وجود سياسة INSERT يعني أن anon/authenticated لا يمكنهم الكتابة مباشرة
-- من المتصفح إطلاقاً — وهذا هو السلوك المطلوب.
