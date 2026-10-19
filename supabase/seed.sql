-- Seed اختياري للتجربة المحلية فقط. لا يُشغَّل تلقائياً في Production.
-- بعد إنشاء مستخدم Auth للموظف من Supabase Dashboard، اربطه بالجيم كالتالي:
--
--   insert into public.gym_staff (gym_id, user_id, role)
--   values ('<GYM_ID>', '<AUTH_USER_ID>', 'owner');

insert into public.gyms (id, name)
values ('00000000-0000-0000-0000-000000000001', 'جيم تجريبي')
on conflict (id) do nothing;

insert into public.rewards (gym_id, name, description, points_cost, active)
values
  ('00000000-0000-0000-0000-000000000001', 'مشروب بروتين مجاني', 'اطلبه من الكاونتر', 100, true),
  ('00000000-0000-0000-0000-000000000001', 'حصة تدريب شخصي مجانية', 'حجز مسبق مطلوب', 500, true),
  ('00000000-0000-0000-0000-000000000001', 'خصم 10% على الشهر القادم', 'يُطبَّق يدوياً من الموظف', 300, true)
on conflict do nothing;
