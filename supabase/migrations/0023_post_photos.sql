-- Post photos: a public storage bucket for board photos (Marketplace first).
-- Kept apart from 0022 so a storage problem can't hold up Posts itself.
--
-- Each spark uploads only into their own folder: post-photos/<user id>/...
-- The app shrinks photos on the phone before upload (about 150 KB, longest
-- side 1280px), and the bucket refuses anything over 1 MB or not an image.
-- The bucket is public so photos load without a signed link; a hidden post
-- stops listing its photos, but a copied photo link keeps working until the
-- poster deletes the post.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sparks upload post photos to their own folder" on storage.objects;
create policy "sparks upload post photos to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Removing a file needs select and delete on it.
drop policy if exists "sparks see their own post photos" on storage.objects;
create policy "sparks see their own post photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "sparks delete their own post photos" on storage.objects;
create policy "sparks delete their own post photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- A post only lists photos from its author's own folder.
create or replace function posts_photos_guard()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from unnest(new.photos) as p
    where p !~ ('^' || new.author_user_id::text || '/[A-Za-z0-9._-]{1,80}$')
  ) then
    raise exception 'Photos must be ones you uploaded.';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_photos_guard on posts;
create trigger posts_photos_guard before insert or update of photos on posts
  for each row execute function posts_photos_guard();
