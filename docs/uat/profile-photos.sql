-- UAT only: private account photos and explicit school-approved publication.
alter table public.profiles add column if not exists avatar_path text;
alter table public.sports_players add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.sports_players add column if not exists photo_path text;
create unique index if not exists sports_players_user_id_unique on public.sports_players(user_id) where user_id is not null;
update public.sports_players p set user_id=u.id from auth.users u where u.raw_app_meta_data->>'uat_synthetic'='true' and u.raw_app_meta_data->>'sports_player_id'=p.id::text and p.user_id is null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',false,3145728,array['image/webp']) on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/webp'];
