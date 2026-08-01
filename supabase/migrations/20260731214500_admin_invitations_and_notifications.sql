begin;

-- Team mutations now flow through protected server endpoints so every action
-- produces consistent email notifications and audit records.
revoke insert, update, delete, truncate, references, trigger on table public.admins from authenticated;
grant select on table public.admins to authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.activity_log from authenticated;
grant select on table public.activity_log to authenticated;
revoke all on function public.add_existing_admin(text, text) from public, anon, authenticated;
revoke all on function public.set_admin_page_access(uuid, uuid, text) from public, anon, authenticated;

create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  role text not null check (role in ('admin', 'super_admin')),
  requested_page_access jsonb not null default '{}'::jsonb
    check (jsonb_typeof(requested_page_access) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired', 'failed')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_by_email text not null,
  expires_at timestamptz not null,
  sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  failed_at timestamptz,
  sent_count integer not null default 0 check (sent_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_invites_unresolved_email_idx
  on public.admin_invites ((lower(email)))
  where status in ('pending', 'failed');

create index if not exists admin_invites_status_expires_idx
  on public.admin_invites (status, expires_at desc);

create index if not exists admin_invites_auth_user_idx
  on public.admin_invites (auth_user_id, created_at desc);

alter table public.admin_invites enable row level security;

revoke all on table public.admin_invites from anon, authenticated;
grant select on table public.admin_invites to authenticated;

drop policy if exists "mfa super admins can read admin invites" on public.admin_invites;
create policy "mfa super admins can read admin invites"
on public.admin_invites
for select
to authenticated
using (
  coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  and private.is_super_admin()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_recipient_idx
  on public.admin_notifications (recipient_user_id, created_at desc);

create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (recipient_user_id, created_at desc)
  where read_at is null;

alter table public.admin_notifications enable row level security;

revoke all on table public.admin_notifications from anon, authenticated;
grant select on table public.admin_notifications to authenticated;

drop policy if exists "mfa admins can read own notifications" on public.admin_notifications;
create policy "mfa admins can read own notifications"
on public.admin_notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  and private.is_admin()
);

create or replace function public.mark_admin_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' or not private.is_admin() then
    raise exception 'Verified admin access required.' using errcode = '42501';
  end if;

  update public.admin_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_user_id = auth.uid();
end;
$$;

revoke all on function public.mark_admin_notification_read(uuid) from public, anon;
grant execute on function public.mark_admin_notification_read(uuid) to authenticated;

create or replace function public.mark_all_admin_notifications_read()
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' or not private.is_admin() then
    raise exception 'Verified admin access required.' using errcode = '42501';
  end if;

  update public.admin_notifications
  set read_at = now()
  where recipient_user_id = auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_all_admin_notifications_read() from public, anon;
grant execute on function public.mark_all_admin_notifications_read() to authenticated;

commit;
