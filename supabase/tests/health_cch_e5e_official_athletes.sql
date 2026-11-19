-- Synthetic athlete placeholders for F22's owner-confirmed seed rows, isolated only.
-- Must run only AFTER original M0 but BEFORE original F22 DML seed.
INSERT INTO public.health_athletes(id,auth_user_id,display_name,
 owner_auth_user_id,created_by_auth_user_id)
 VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111','Synthetic A',
 '11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '22222222-2222-4222-8222-222222222222','Synthetic B',
 '22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
