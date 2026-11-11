-- 公开社区：仅新增显式同意，不自动公开已有账号、喜欢或私人收藏。
-- 执行前必须确认；本文件不包含线上执行命令。使用一个事务保证整体生效。
begin;

create table public.profile_public_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  show_likes boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_not_self check (follower_id <> following_id)
);
create index user_follows_following_idx on public.user_follows(following_id, created_at desc, follower_id);
create index profile_public_settings_discovery_idx on public.profile_public_settings(updated_at desc, user_id) where enabled;
create index if not exists user_collection_items_asset_collection_idx on public.user_collection_items(asset_key, collection_id);

alter table public.profile_public_settings enable row level security;
alter table public.user_follows enable row level security;
revoke all on public.profile_public_settings, public.user_follows from public, anon, authenticated;
grant select on public.profile_public_settings, public.user_follows to authenticated;
create policy "Public settings are readable by owner" on public.profile_public_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "Following is readable by owner" on public.user_follows for select to authenticated using (follower_id = (select auth.uid()));

-- 布尔检查供现有集合RLS使用，不返回原始profiles字段。
create function public.community_is_public(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profile_public_settings s join public.profiles p on p.id=s.user_id where s.user_id=p_user_id and s.enabled and p.status='active');
$$;
revoke all on function public.community_is_public(uuid) from public;
grant execute on function public.community_is_public(uuid) to anon, authenticated;

-- 关闭主页同时阻止通过原集合REST接口绕过公开开关；保留原owner策略。
alter policy "Collections are readable by owner or public" on public.user_collections
  using (auth.uid() = user_id or (visibility='public' and public.community_is_public(user_id)));
alter policy "Collection items are readable by owner or public collection" on public.user_collection_items
  using (exists(select 1 from public.user_collections c where c.id=collection_id and
    (c.user_id=auth.uid() or (c.visibility='public' and public.community_is_public(c.user_id)))));

-- 内部安全投影：不得授予匿名/登录角色直接执行。
create function public.community_profile_projection(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'bio', p.bio,
    'show_likes', s.show_likes,
    'collection_count', (select count(*) from public.user_collections c where c.user_id=p.id and c.visibility='public'),
    'likes_count', case when s.show_likes then (select count(*) from public.user_wallpaper_likes l join public.wallpaper_assets a on a.asset_key=l.asset_key and a.status='active' where l.user_id=p.id) else null end,
    'following_count', (select count(*) from public.user_follows f where f.follower_id=p.id and public.community_is_public(f.following_id)),
    'followers_count', (select count(*) from public.user_follows f where f.following_id=p.id and public.community_is_public(f.follower_id)),
    'is_following', exists(select 1 from public.user_follows f where f.follower_id=auth.uid() and f.following_id=p.id)
  ) from public.profiles p join public.profile_public_settings s on s.user_id=p.id
  where p.id=p_user_id and p.status='active' and s.enabled;
$$;
revoke all on function public.community_profile_projection(uuid) from public, anon, authenticated;

create function public.community_collection_projection(p_collection_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'user_id', c.user_id, 'name', c.name, 'description', c.description,
    'item_count', (select count(*) from public.user_collection_items i join public.wallpaper_assets a on a.asset_key=i.asset_key and a.status='active' where i.collection_id=c.id),
    'asset_keys', coalesce((select jsonb_agg(x.asset_key order by x.added_at desc, x.asset_key) from
      (select i.asset_key,i.added_at from public.user_collection_items i join public.wallpaper_assets a on a.asset_key=i.asset_key and a.status='active'
       where i.collection_id=c.id order by i.added_at desc,i.asset_key limit 4) x), '[]'::jsonb)
  ) from public.user_collections c where c.id=p_collection_id and c.visibility='public' and public.community_is_public(c.user_id);
$$;
revoke all on function public.community_collection_projection(uuid) from public, anon, authenticated;

create function public.get_public_profile(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.community_profile_projection(p_user_id);
$$;

create function public.get_public_profiles(p_limit integer default 24, p_offset integer default 0) returns jsonb
language sql stable security definer set search_path = '' as $$
  with candidates as (
    select s.user_id,s.updated_at from public.profile_public_settings s join public.profiles p on p.id=s.user_id
    where s.enabled and p.status='active' order by s.updated_at desc,s.user_id
    limit least(48,greatest(1,coalesce(p_limit,24))) + 1 offset least(100000,greatest(0,coalesce(p_offset,0)))
  ), page as (select * from candidates order by updated_at desc,user_id limit least(48,greatest(1,coalesce(p_limit,24))))
  select jsonb_build_object('items',coalesce((select jsonb_agg(public.community_profile_projection(user_id) order by updated_at desc,user_id) from page),'[]'::jsonb),
    'has_more',(select count(*) > least(48,greatest(1,coalesce(p_limit,24))) from candidates));
$$;

create function public.get_public_wallpapers(p_user_id uuid, p_kind text default 'collections', p_limit integer default 24, p_offset integer default 0, p_collection_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit integer := least(48,greatest(1,coalesce(p_limit,24)));
  v_offset integer := least(100000,greatest(0,coalesce(p_offset,0)));
  v_rows jsonb;
begin
  if p_kind not in ('collections','collection','likes') or p_kind is null then raise exception 'Invalid content kind' using errcode='22023'; end if;
  if not public.community_is_public(p_user_id) then return jsonb_build_object('items','[]'::jsonb,'has_more',false,'hidden',true); end if;
  if p_kind='likes' and not exists(select 1 from public.profile_public_settings where user_id=p_user_id and show_likes) then
    return jsonb_build_object('items','[]'::jsonb,'has_more',false,'hidden',true);
  end if;
  if p_kind='collections' then
    select coalesce(jsonb_agg(public.community_collection_projection(c.id) order by c.updated_at desc,c.id),'[]'::jsonb) into v_rows from
      (select id,updated_at from public.user_collections where user_id=p_user_id and visibility='public' order by updated_at desc,id limit v_limit+1 offset v_offset) c;
  elsif p_kind='likes' then
    select coalesce(jsonb_agg(jsonb_build_object('asset_key',x.asset_key) order by x.created_at desc,x.asset_key),'[]'::jsonb) into v_rows from
      (select l.asset_key,l.created_at from public.user_wallpaper_likes l join public.wallpaper_assets a on a.asset_key=l.asset_key and a.status='active'
       where l.user_id=p_user_id order by l.created_at desc,l.asset_key limit v_limit+1 offset v_offset) x;
  else
    select coalesce(jsonb_agg(jsonb_build_object('asset_key',x.asset_key) order by x.added_at desc,x.asset_key),'[]'::jsonb) into v_rows from
      (select i.asset_key,i.added_at from public.user_collection_items i join public.user_collections c on c.id=i.collection_id
       join public.wallpaper_assets a on a.asset_key=i.asset_key and a.status='active'
       where c.id=p_collection_id and c.user_id=p_user_id and c.visibility='public' order by i.added_at desc,i.asset_key limit v_limit+1 offset v_offset) x;
  end if;
  return jsonb_build_object('items',case when jsonb_array_length(v_rows)>v_limit then v_rows-v_limit else v_rows end,'has_more',jsonb_array_length(v_rows)>v_limit,'hidden',false);
end;
$$;

create function public.get_profile_connections(p_user_id uuid, p_kind text default 'following', p_limit integer default 24, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit integer := least(48,greatest(1,coalesce(p_limit,24)));
  v_rows jsonb;
begin
  if p_kind not in ('following','followers') or p_kind is null then raise exception 'Invalid connection kind' using errcode='22023'; end if;
  if not public.community_is_public(p_user_id) then return jsonb_build_object('items','[]'::jsonb,'has_more',false); end if;
  select coalesce(jsonb_agg(public.community_profile_projection(x.user_id) order by x.created_at desc,x.user_id),'[]'::jsonb) into v_rows from (
    select case when p_kind='following' then f.following_id else f.follower_id end as user_id,f.created_at from public.user_follows f
    where ((p_kind='following' and f.follower_id=p_user_id and public.community_is_public(f.following_id)) or
      (p_kind='followers' and f.following_id=p_user_id and public.community_is_public(f.follower_id)))
    order by f.created_at desc,user_id limit v_limit+1 offset least(100000,greatest(0,coalesce(p_offset,0)))
  ) x;
  return jsonb_build_object('items',case when jsonb_array_length(v_rows)>v_limit then v_rows-v_limit else v_rows end,'has_more',jsonb_array_length(v_rows)>v_limit);
end;
$$;

create function public.get_related_public_collections(p_asset_key text, p_limit integer default 6) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.community_collection_projection(c.id) || jsonb_build_object('profile',public.community_profile_projection(c.user_id)) order by c.updated_at desc,c.id),'[]'::jsonb)
  from (select c.id,c.user_id,c.updated_at from public.user_collections c
    join public.user_collection_items i on i.collection_id=c.id
    join public.wallpaper_assets a on a.asset_key=i.asset_key and a.status='active'
    where i.asset_key=p_asset_key and c.visibility='public' and public.community_is_public(c.user_id)
    order by c.updated_at desc,c.id limit least(12,greatest(1,coalesce(p_limit,6)))) c;
$$;

create function public.set_profile_follow(p_user_id uuid, p_following boolean, p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_profile jsonb;
begin
  if v_actor is null or p_actor_id is distinct from v_actor or not exists(select 1 from public.profiles where id=v_actor and status='active') then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_user_id is null or p_following is null or p_user_id=v_actor then raise exception 'Invalid follow target' using errcode='22023'; end if;
  if p_following then
    if not public.community_is_public(p_user_id) then raise exception 'Profile unavailable' using errcode='42501'; end if;
    insert into public.user_follows(follower_id,following_id) values(v_actor,p_user_id) on conflict do nothing;
  else
    delete from public.user_follows where follower_id=v_actor and following_id=p_user_id;
  end if;
  v_profile := public.community_profile_projection(p_user_id);
  return jsonb_build_object('following',p_following,'followers_count',v_profile->'followers_count','following_count',v_profile->'following_count');
end;
$$;

create function public.get_my_public_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and status='active') then raise exception 'Authentication required' using errcode='42501'; end if;
  select jsonb_build_object('enabled',enabled,'show_likes',show_likes) into v_result from public.profile_public_settings where user_id=v_actor;
  return coalesce(v_result,jsonb_build_object('enabled',false,'show_likes',false));
end;
$$;

create function public.set_my_public_settings(p_enabled boolean, p_show_likes boolean, p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or p_actor_id is distinct from v_actor or not exists(select 1 from public.profiles where id=v_actor and status='active') then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_enabled is null or p_show_likes is null then raise exception 'Invalid public settings' using errcode='22023'; end if;
  insert into public.profile_public_settings(user_id,enabled,show_likes) values(v_actor,p_enabled,p_show_likes)
    on conflict(user_id) do update set enabled=excluded.enabled,show_likes=excluded.show_likes,updated_at=now();
  return jsonb_build_object('enabled',p_enabled,'show_likes',p_show_likes);
end;
$$;

create function public.get_my_collection_visibility(p_limit integer default 24, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_rows jsonb; v_limit integer := least(48,greatest(1,coalesce(p_limit,24)));
begin
  if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and status='active') then raise exception 'Authentication required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'visibility',c.visibility) order by c.updated_at desc,c.id),'[]'::jsonb) into v_rows from
    (select id,name,visibility,updated_at from public.user_collections where user_id=v_actor order by updated_at desc,id limit v_limit+1 offset least(100000,greatest(0,coalesce(p_offset,0)))) c;
  return jsonb_build_object('items',case when jsonb_array_length(v_rows)>v_limit then v_rows-v_limit else v_rows end,'has_more',jsonb_array_length(v_rows)>v_limit);
end;
$$;

create function public.set_my_collection_visibility(p_collection_id uuid, p_visibility text, p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null or p_actor_id is distinct from v_actor or not exists(select 1 from public.profiles where id=v_actor and status='active') then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_visibility not in ('private','unlisted','public') or p_visibility is null then raise exception 'Invalid visibility' using errcode='22023'; end if;
  update public.user_collections set visibility=p_visibility where id=p_collection_id and user_id=v_actor
    returning jsonb_build_object('id',id,'name',name,'visibility',visibility) into v_result;
  if v_result is null then raise exception 'Collection unavailable' using errcode='42501'; end if;
  return v_result;
end;
$$;

-- PostgreSQL默认允许PUBLIC执行新函数，必须逐一收回。
revoke all on function public.get_public_profile(uuid), public.get_public_profiles(integer,integer), public.get_public_wallpapers(uuid,text,integer,integer,uuid), public.get_profile_connections(uuid,text,integer,integer), public.get_related_public_collections(text,integer) from public;
grant execute on function public.get_public_profile(uuid), public.get_public_profiles(integer,integer), public.get_public_wallpapers(uuid,text,integer,integer,uuid), public.get_profile_connections(uuid,text,integer,integer), public.get_related_public_collections(text,integer) to anon, authenticated;
revoke all on function public.set_profile_follow(uuid,boolean,uuid), public.get_my_public_settings(), public.set_my_public_settings(boolean,boolean,uuid), public.get_my_collection_visibility(integer,integer), public.set_my_collection_visibility(uuid,text,uuid) from public, anon;
grant execute on function public.set_profile_follow(uuid,boolean,uuid), public.get_my_public_settings(), public.set_my_public_settings(boolean,boolean,uuid), public.get_my_collection_visibility(integer,integer), public.set_my_collection_visibility(uuid,text,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
