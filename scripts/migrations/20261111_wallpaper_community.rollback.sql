-- 社区停用回滚：执行前确认。保留全部已有内容、公开设置和关注数据。
-- 回退前端到社区上线前版本后执行；不会删除表、关系或用户记录。
-- 不恢复旧的 public visibility 直读策略，以免重新公开用户已关闭的主页。
begin;

revoke execute on function public.get_public_profile(uuid), public.get_public_profiles(integer,integer), public.get_public_wallpapers(uuid,text,integer,integer,uuid), public.get_profile_connections(uuid,text,integer,integer), public.get_related_public_collections(text,integer) from public, anon, authenticated;
revoke execute on function public.set_profile_follow(uuid,boolean,uuid), public.get_my_public_settings(), public.set_my_public_settings(boolean,boolean,uuid), public.get_my_collection_visibility(integer,integer), public.set_my_collection_visibility(uuid,text,uuid) from public, anon, authenticated;

alter policy "Collections are readable by owner or public" on public.user_collections using (auth.uid() = user_id);
alter policy "Collection items are readable by owner or public collection" on public.user_collection_items
  using (exists(select 1 from public.user_collections c where c.id=collection_id and c.user_id=auth.uid()));

notify pgrst, 'reload schema';
commit;
