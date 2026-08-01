update public.managed_pages
set domain = 'thephotoshopguide.com',
    updated_at = now()
where slug = 'thephotoshopguide';
