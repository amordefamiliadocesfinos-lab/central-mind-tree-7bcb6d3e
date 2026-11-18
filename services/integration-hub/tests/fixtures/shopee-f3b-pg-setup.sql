-- F3-B disposable PostgreSQL test fixture. NEVER run on production.
create schema if not exists auth;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
alter role service_role bypassrls;
create table auth.users(id uuid primary key);
create table public.digital_platforms (
 id uuid primary key, name text, is_active boolean, group_type text, parent_id uuid
);
create table public.channel_accounts (
 id uuid primary key, platform_id uuid references public.digital_platforms(id), is_active boolean
);
create table public.app_users (
 auth_user_id uuid, is_active boolean
);
grant select on public.digital_platforms, public.channel_accounts, public.app_users to service_role;

insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.digital_platforms values
 ('33333333-3333-4333-8333-333333333333','Shopee',true,'marketplace',null),
 ('44444444-4444-4444-8444-444444444444','Other',true,'marketplace',null);
insert into public.channel_accounts values
 ('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',true),
 ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444',true);
insert into public.app_users values ('11111111-1111-4111-8111-111111111111',true);
