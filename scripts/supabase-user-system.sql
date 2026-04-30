-- ============================================================
-- Supabase Auth + 用户业务系统初始化脚本
-- 适用场景：
-- 1. 基于 Supabase Auth 增加 GitHub / Google / Linux.do / Email 登录
-- 2. 增加 profiles / preferences / likes / collections / download history
-- 3. 修复现有 image_stats 仅以 image_id 唯一导致的跨系列冲突
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 通用函数
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.normalize_linuxdo_avatar_url(
  avatar_template text,
  fallback_origin text default 'https://linux.do',
  avatar_size text default '240'
)
returns text
language sql
immutable
as $$
  select
    case
      when avatar_template is null or btrim(avatar_template) = '' then null
      when left(btrim(avatar_template), 2) = '//' then 'https:' || replace(btrim(avatar_template), '{size}', avatar_size)
      when btrim(avatar_template) ~ '^https?://' then replace(btrim(avatar_template), '{size}', avatar_size)
      when left(btrim(avatar_template), 1) = '/' then fallback_origin || replace(btrim(avatar_template), '{size}', avatar_size)
      else fallback_origin || '/' || replace(btrim(avatar_template), '{size}', avatar_size)
    end;
$$;

-- ============================================================
-- 壁纸主表
-- 说明：
-- - asset_key 统一使用 series:filename
-- - 后续 likes / collections / download_history 全部关联它
-- ============================================================

create table if not exists public.wallpaper_assets (
  asset_key text primary key,
  series text not null check (series in ('desktop', 'mobile', 'avatar', 'video', 'bing')),
  filename text not null check (btrim(filename) <> ''),
  title text,
  category text,
  subcategory text,
  source_path text,
  preview_path text,
  thumbnail_path text,
  raw_url text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  format text,
  file_size bigint check (file_size is null or file_size >= 0),
  duration_seconds double precision check (duration_seconds is null or duration_seconds >= 0),
  cdn_tag text,
  status text not null default 'active' check (status in ('active', 'removed')),
  removed_at timestamptz,
  source_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (series, filename),
  check (asset_key = series || ':' || filename)
);

alter table public.wallpaper_assets
  add column if not exists duration_seconds double precision
  check (duration_seconds is null or duration_seconds >= 0);

create index if not exists idx_wallpaper_assets_series
  on public.wallpaper_assets(series);

create index if not exists idx_wallpaper_assets_status
  on public.wallpaper_assets(status);

create index if not exists idx_wallpaper_assets_series_category
  on public.wallpaper_assets(series, category);

create index if not exists idx_wallpaper_assets_series_subcategory
  on public.wallpaper_assets(series, subcategory);

drop trigger if exists trg_wallpaper_assets_updated_at on public.wallpaper_assets;
create trigger trg_wallpaper_assets_updated_at
before update on public.wallpaper_assets
for each row execute function public.set_updated_at();

comment on table public.wallpaper_assets is
'壁纸统一主表，使用 asset_key=series:filename 作为全站稳定业务主键。';

-- ============================================================
-- 用户资料与偏好
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  primary_email text,
  primary_provider text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

comment on table public.profiles is
'业务层用户资料表。auth.users 是身份源，public.profiles 是应用层用户信息。';

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_series text check (default_series is null or default_series in ('desktop', 'mobile', 'avatar', 'video', 'bing')),
  theme_mode text not null default 'system' check (theme_mode in ('light', 'dark', 'system', 'timed')),
  view_mode_desktop text not null default 'grid' check (view_mode_desktop in ('grid', 'list', 'waterfall')),
  view_mode_mobile text not null default 'grid' check (view_mode_mobile in ('grid', 'list')),
  sort_mode text not null default 'newest',
  sync_local_preferences boolean not null default true,
  email_updates boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_user_preferences_updated_at on public.user_preferences;
create trigger trg_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

comment on table public.user_preferences is
'用户跨设备同步偏好。';

-- ============================================================
-- 喜欢 / 收藏夹 / 下载历史
-- ============================================================

create table if not exists public.user_wallpaper_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_key text not null references public.wallpaper_assets(asset_key) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, asset_key)
);

create index if not exists idx_user_wallpaper_likes_asset_key
  on public.user_wallpaper_likes(asset_key);

comment on table public.user_wallpaper_likes is
'爱心喜欢关系表，一人一图一条记录。';

create table if not exists public.user_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  slug text,
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  collection_type text not null default 'manual' check (collection_type in ('manual', 'system')),
  is_default boolean not null default false,
  cover_asset_key text references public.wallpaper_assets(asset_key) on delete set null,
  item_count integer not null default 0 check (item_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_collections_default_per_user
  on public.user_collections(user_id)
  where is_default;

create unique index if not exists user_collections_slug_per_user
  on public.user_collections(user_id, lower(slug))
  where slug is not null;

create index if not exists idx_user_collections_user_id
  on public.user_collections(user_id, updated_at desc);

drop trigger if exists trg_user_collections_updated_at on public.user_collections;
create trigger trg_user_collections_updated_at
before update on public.user_collections
for each row execute function public.set_updated_at();

comment on table public.user_collections is
'收藏夹元数据表，支持默认收藏夹、公开收藏夹等扩展。';

create table if not exists public.user_collection_items (
  collection_id uuid not null references public.user_collections(id) on delete cascade,
  asset_key text not null references public.wallpaper_assets(asset_key) on delete cascade,
  note text,
  added_at timestamptz not null default timezone('utc', now()),
  primary key (collection_id, asset_key)
);

create index if not exists idx_user_collection_items_asset_key
  on public.user_collection_items(asset_key);

comment on table public.user_collection_items is
'收藏夹中的壁纸明细。';

create table if not exists public.user_download_history (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_key text not null references public.wallpaper_assets(asset_key) on delete cascade,
  source text not null default 'web',
  file_format text,
  resolution_label text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_user_download_history_user_created_at
  on public.user_download_history(user_id, created_at desc);

create index if not exists idx_user_download_history_user_asset_created_at
  on public.user_download_history(user_id, asset_key, created_at desc);

comment on table public.user_download_history is
'下载历史事件表，只追加不覆盖。';

-- ============================================================
-- 收藏夹计数触发器
-- ============================================================

create or replace function public.sync_collection_item_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.user_collections
    set item_count = item_count + 1,
        updated_at = timezone('utc', now())
    where id = new.collection_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.user_collections
    set item_count = greatest(item_count - 1, 0),
        updated_at = timezone('utc', now())
    where id = old.collection_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_collection_item_count_insert on public.user_collection_items;
create trigger trg_sync_collection_item_count_insert
after insert on public.user_collection_items
for each row execute function public.sync_collection_item_count();

drop trigger if exists trg_sync_collection_item_count_delete on public.user_collection_items;
create trigger trg_sync_collection_item_count_delete
after delete on public.user_collection_items
for each row execute function public.sync_collection_item_count();

-- ============================================================
-- 新用户初始化触发器
-- 说明：
-- - 自动创建 profiles
-- - 自动创建 user_preferences
-- - 自动创建一个默认收藏夹
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fallback_name text;
  fallback_username text;
begin
  fallback_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    new.raw_user_meta_data ->> 'username',
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '用户'
  );

  fallback_username := nullif(
    lower(
      regexp_replace(
        coalesce(
          new.raw_user_meta_data ->> 'username',
          new.raw_user_meta_data ->> 'user_name',
          new.raw_user_meta_data ->> 'preferred_username',
          ''
        ),
        '[^a-zA-Z0-9_-]',
        '',
        'g'
      )
    ),
    ''
  );

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    primary_email,
    primary_provider
  )
  values (
    new.id,
    fallback_username,
    fallback_name,
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      public.normalize_linuxdo_avatar_url(new.raw_user_meta_data ->> 'avatar_template')
    ),
    new.email,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_collections (
    user_id,
    name,
    visibility,
    collection_type,
    is_default
  )
  values (
    new.id,
    '默认收藏夹',
    'private',
    'system',
    true
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- RLS
-- ============================================================

alter table public.wallpaper_assets enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_wallpaper_likes enable row level security;
alter table public.user_collections enable row level security;
alter table public.user_collection_items enable row level security;
alter table public.user_download_history enable row level security;

drop policy if exists "Assets are public readable" on public.wallpaper_assets;
create policy "Assets are public readable"
  on public.wallpaper_assets
  for select
  using (true);

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Preferences are managed by owner" on public.user_preferences;
create policy "Preferences are managed by owner"
  on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Likes are managed by owner" on public.user_wallpaper_likes;
create policy "Likes are managed by owner"
  on public.user_wallpaper_likes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Collections are readable by owner or public" on public.user_collections;
create policy "Collections are readable by owner or public"
  on public.user_collections
  for select
  using (auth.uid() = user_id or visibility = 'public');

drop policy if exists "Collections are managed by owner" on public.user_collections;
create policy "Collections are managed by owner"
  on public.user_collections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Collection items are readable by owner or public collection" on public.user_collection_items;
create policy "Collection items are readable by owner or public collection"
  on public.user_collection_items
  for select
  using (
    exists (
      select 1
      from public.user_collections c
      where c.id = collection_id
        and (c.user_id = auth.uid() or c.visibility = 'public')
    )
  );

drop policy if exists "Collection items are managed by collection owner" on public.user_collection_items;
create policy "Collection items are managed by collection owner"
  on public.user_collection_items
  for all
  using (
    exists (
      select 1
      from public.user_collections c
      where c.id = collection_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.user_collections c
      where c.id = collection_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Download history is managed by owner" on public.user_download_history;
create policy "Download history is managed by owner"
  on public.user_download_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 修复现有 image_stats 的唯一键问题
-- 说明：
-- 当前项目真实数据中已存在 desktop/avatar 同名文件，
-- 例如“阿尼亚.jpg”，所以不能继续只按 image_id 唯一。
-- ============================================================

alter table public.image_stats
  drop constraint if exists image_stats_image_id_key;

create unique index if not exists image_stats_series_image_id_key
  on public.image_stats(series, image_id);

create or replace function public.increment_view(
  img_id text,
  series_name text,
  cat text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.image_stats (
    image_id,
    series,
    category,
    total_views,
    last_viewed_at,
    updated_at
  )
  values (
    img_id,
    series_name,
    cat,
    1,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (series, image_id) do update
  set total_views = public.image_stats.total_views + 1,
      last_viewed_at = timezone('utc', now()),
      updated_at = timezone('utc', now());
end;
$$;

create or replace function public.increment_download(
  img_id text,
  series_name text,
  cat text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.image_stats (
    image_id,
    series,
    category,
    total_views,
    total_downloads,
    last_downloaded_at,
    updated_at
  )
  values (
    img_id,
    series_name,
    cat,
    0,
    1,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (series, image_id) do update
  set total_downloads = public.image_stats.total_downloads + 1,
      last_downloaded_at = timezone('utc', now()),
      updated_at = timezone('utc', now());
end;
$$;

create or replace view public.image_stats_with_asset_key as
select
  series || ':' || image_id as asset_key,
  image_id,
  series,
  category,
  total_views,
  total_downloads,
  last_viewed_at,
  last_downloaded_at,
  created_at,
  updated_at
from public.image_stats;

comment on view public.image_stats_with_asset_key is
'给现有匿名统计增加统一 asset_key，方便未来与 wallpaper_assets / 用户行为表联动。';
