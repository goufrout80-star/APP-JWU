begin;

insert into public.managed_pages (
  slug,
  name,
  domain,
  description,
  active,
  enabled_modules,
  accent_color,
  notification_email,
  updated_at
)
values (
  'todayfilmmakers',
  'Today Film Makers',
  'todayfilmmakers.com',
  'Brand partnership inquiries for the Today Film Makers filmmaking community.',
  true,
  array['contacts']::text[],
  '#F5C900',
  'hello@todayfilmmakers.com',
  now()
)
on conflict (slug) do update set
  name = excluded.name,
  domain = excluded.domain,
  description = excluded.description,
  active = true,
  enabled_modules = excluded.enabled_modules,
  accent_color = excluded.accent_color,
  notification_email = excluded.notification_email,
  updated_at = now();

insert into public.managed_pages (
  slug,
  name,
  domain,
  description,
  active,
  enabled_modules,
  accent_color,
  notification_email,
  updated_at
)
values (
  'thephotoshopguide',
  'The Photoshop Guide',
  'thephotoshopguideweb.vercel.app',
  'Sponsorship and creative-tool partnership inquiries for The Photoshop Guide.',
  true,
  array['contacts']::text[],
  '#34D3FF',
  'hello@thephotoshopguide.com',
  now()
)
on conflict (slug) do update set
  name = excluded.name,
  domain = excluded.domain,
  description = excluded.description,
  active = true,
  enabled_modules = excluded.enabled_modules,
  accent_color = excluded.accent_color,
  notification_email = excluded.notification_email,
  updated_at = now();

update public.page_contacts
set page_id = (select id from public.managed_pages where slug = 'todayfilmmakers')
where page_id is null and site = 'todayfilmmakers';

update public.page_contacts
set page_id = (select id from public.managed_pages where slug = 'thephotoshopguide')
where page_id is null and site in ('thephotoshopguide', 'thephotoshopguideweb');

alter table public.page_contacts
  alter column page_id set not null;

create index if not exists page_contacts_page_created_idx
  on public.page_contacts (page_id, created_at desc);

commit;
