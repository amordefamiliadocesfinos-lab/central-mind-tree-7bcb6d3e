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

-- Synthetic published program replicates only the referential/structural
-- prerequisites of F22's hardcoded retrospective assertion.
INSERT INTO public.health_exercises(id,code,name,movement_pattern)
 VALUES('eeeeeeee-0000-4000-8000-000000000001','LAB_PRESS','Synthetic bench',
 'horizontal_press');
INSERT INTO public.health_programs(id,athlete_id,name,status,source,created_by_auth_user_id)
 VALUES('eeeeeeee-1000-4000-8000-000000000001',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic F22 baseline',
 'active','manual','22222222-2222-4222-8222-222222222222');
INSERT INTO public.health_program_versions(id,program_id,athlete_id,version_number,
 status,title,published_at,created_by_auth_user_id)
 VALUES('eeeeeeee-2000-4000-8000-000000000001',
 'eeeeeeee-1000-4000-8000-000000000001',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'published',
 'Synthetic F22 published version',now(),
 '22222222-2222-4222-8222-222222222222');
INSERT INTO public.health_session_templates(id,program_version_id,athlete_id,
 code,name,sequence_order,status)
 VALUES('eeeeeeee-3000-4000-8000-000000000001',
 'eeeeeeee-2000-4000-8000-000000000001',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','A1','Synthetic session',1,'active');
INSERT INTO public.health_session_template_exercises(
 session_template_id,athlete_id,exercise_id,sequence_order,planned_sets_min,
 planned_sets_max,reps_min,reps_max,rir_target,rest_seconds)
 VALUES('eeeeeeee-3000-4000-8000-000000000001',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'eeeeeeee-0000-4000-8000-000000000001',1,3,3,8,12,2,180);
