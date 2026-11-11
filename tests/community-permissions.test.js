import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const runtime = process.env.PGLITE_MODULE
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const PUBLIC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PRIVATE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe.skipIf(!runtime)('本地Postgres公开社区权限', () => {
  let db
  const scalar = async sql => (await db.query(sql)).rows[0]?.result
  async function actor(id = '', role = id ? 'authenticated' : 'anon') {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${id}', false); set role ${role};`)
  }
  beforeAll(async () => {
    const { PGlite } = await import(/* @vite-ignore */ runtime)
    db = new PGlite()
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      create table public.profiles(id uuid primary key, username text, display_name text, avatar_url text, bio text, primary_email text, role text default 'user', status text default 'active');
      create table public.wallpaper_assets(asset_key text primary key, status text default 'active');
      create table public.user_collections(id uuid primary key, user_id uuid references profiles(id), name text, description text, visibility text default 'private', updated_at timestamptz default now());
      create table public.user_collection_items(collection_id uuid references user_collections(id), asset_key text references wallpaper_assets(asset_key), added_at timestamptz default now(), primary key(collection_id, asset_key));
      create table public.user_wallpaper_likes(user_id uuid references profiles(id), asset_key text references wallpaper_assets(asset_key), created_at timestamptz default now(), primary key(user_id, asset_key));
      alter table profiles enable row level security;
      alter table user_collections enable row level security;
      alter table user_collection_items enable row level security;
      alter table user_wallpaper_likes enable row level security;
      create policy "Profiles are readable by owner" on profiles for select using (auth.uid()=id);
      create policy "Likes are managed by owner" on user_wallpaper_likes for all using (auth.uid()=user_id);
      create policy "Collections are managed by owner" on user_collections for all using (auth.uid()=user_id);
      create policy "Collections are readable by owner or public" on user_collections for select using (auth.uid()=user_id or visibility='public');
      create policy "Collection items are readable by owner or public collection" on user_collection_items for select using (exists(select 1 from user_collections c where c.id=collection_id and (c.user_id=auth.uid() or c.visibility='public')));
      grant select on all tables in schema public to anon, authenticated;
      insert into profiles(id, display_name, primary_email, status) values ('${A}', '甲', 'private-a@example.test', 'active'), ('${B}', '乙', 'private-b@example.test', 'active'), ('${C}', '停用', 'private-c@example.test', 'suspended');
      insert into wallpaper_assets values ('desktop:path:/wallpaper/desktop/a.jpg', 'active'), ('mobile:path:/wallpaper/mobile/b.jpg', 'active'), ('desktop:path:/wallpaper/desktop/removed.jpg', 'removed');
      insert into user_collections(id,user_id,name,visibility) values ('${PUBLIC}','${A}','公开选集','public'), ('${PRIVATE}','${A}','私密选集','private');
      insert into user_collection_items(collection_id,asset_key) values ('${PUBLIC}','desktop:path:/wallpaper/desktop/a.jpg'), ('${PUBLIC}','desktop:path:/wallpaper/desktop/removed.jpg'), ('${PRIVATE}','mobile:path:/wallpaper/mobile/b.jpg');
      insert into user_wallpaper_likes(user_id,asset_key) values ('${A}','mobile:path:/wallpaper/mobile/b.jpg');
    `)
    await db.exec(await readFile(new URL('../scripts/migrations/20261111_wallpaper_community.sql', import.meta.url), 'utf8'))
  }, 30000)
  afterAll(async () => db?.close())

  it('默认不公开，匿名不能直读profiles/likes/集合绕过主页开关', async () => {
    await actor()
    expect(await scalar(`select get_public_profile('${A}') as result`)).toBeNull()
    expect(await scalar('select count(*)::int as result from profiles')).toBe(0)
    expect(await scalar('select count(*)::int as result from user_wallpaper_likes')).toBe(0)
    expect(await scalar('select count(*)::int as result from user_collections')).toBe(0)
    expect(await scalar('select count(*)::int as result from user_collection_items')).toBe(0)
    await expect(db.query(`select set_my_public_settings(true,true,'${A}')`)).rejects.toThrow()
  })

  it('本人显式公开后只暴露安全字段、公开集合与active资源，喜欢仍需独立同意', async () => {
    await actor(A)
    await db.query(`select set_my_public_settings(true,false,'${A}')`)
    await actor()
    const profile = await scalar(`select get_public_profile('${A}') as result`)
    expect(profile).toMatchObject({ id: A, display_name: '甲', collection_count: 1, likes_count: null, show_likes: false })
    expect(JSON.stringify(profile)).not.toMatch(/private-a|primary_email|suspended|"role"/)
    expect(await scalar('select count(*)::int as result from user_collections')).toBe(1)
    const collections = await scalar(`select get_public_wallpapers('${A}','collections',24,0,null) as result`)
    expect(collections.items).toHaveLength(1)
    expect(collections.items[0]).toMatchObject({ id: PUBLIC, item_count: 1 })
    expect((await scalar(`select get_public_wallpapers('${A}','likes',24,0,null) as result`)).hidden).toBe(true)
    expect((await scalar(`select get_public_wallpapers('${A}','collection',24,0,'${PRIVATE}') as result`)).items).toEqual([])
  })

  it('本人开关喜欢；他人不可变更集合；未公开及停用账号不出现在公开结果', async () => {
    await actor(A)
    await db.query(`select set_my_public_settings(true,true,'${A}')`)
    await actor(B)
    await expect(db.query(`select set_my_collection_visibility('${PRIVATE}','public','${B}')`)).rejects.toThrow()
    await db.query(`select set_my_public_settings(true,false,'${B}')`)
    await expect(db.query(`select set_my_public_settings(false,false,'${A}')`)).rejects.toThrow()
    await expect(db.query(`select set_profile_follow('${A}',true,'${A}')`)).rejects.toThrow()
    await actor()
    expect((await scalar(`select get_public_wallpapers('${A}','likes',24,0,null) as result`)).items).toEqual([{ asset_key: 'mobile:path:/wallpaper/mobile/b.jpg' }])
    expect(await scalar(`select get_public_profile('${C}') as result`)).toBeNull()
    expect((await scalar('select get_public_profiles(1,0) as result')).has_more).toBe(true)
  })

  it('匿名仅能执行公开RPC，内部投影不可调用；固定search_path且分页有上限', async () => {
    await actor()
    await expect(db.query(`select community_profile_projection('${A}')`)).rejects.toThrow()
    await expect(db.query(`select community_collection_projection('${PUBLIC}')`)).rejects.toThrow()
    await expect(db.query(`select set_my_public_settings(false,false,'${A}')`)).rejects.toThrow()
    await expect(db.query(`select get_public_wallpapers('${A}','private',24,0,null)`)).rejects.toThrow()
    await db.exec('reset role')
    const unsafe = await db.query(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not ('search_path=""'=any(p.proconfig))`)
    expect(unsafe.rows).toEqual([])
    await db.exec(`insert into profiles(id,display_name) select ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,'分页测试' from generate_series(1,55) i;
      insert into profile_public_settings(user_id,enabled) select id,true from profiles where display_name='分页测试';`)
    await actor()
    const list = await scalar('select get_public_profiles(999,-12) as result')
    expect(list.items).toHaveLength(48)
    expect(list.has_more).toBe(true)
    expect((await scalar('select get_public_profiles(24,48) as result')).items).toHaveLength(9)
  })

  it('关注幂等、拒绝自己/匿名/停用账号，返回真实公开计数', async () => {
    await actor(B)
    await db.query(`select set_profile_follow('${A}',true,'${B}')`)
    const result = await scalar(`select set_profile_follow('${A}',true,'${B}') as result`)
    expect(result).toMatchObject({ following: true, followers_count: 1 })
    await expect(db.query(`select set_profile_follow('${B}',true,'${B}')`)).rejects.toThrow()
    await expect(db.query(`insert into user_follows(follower_id,following_id) values ('${B}','${C}')`)).rejects.toThrow()
    await actor(C)
    await expect(db.query(`select set_profile_follow('${A}',true,'${C}')`)).rejects.toThrow()
    await actor()
    await expect(db.query(`select set_profile_follow('${A}',true,'${B}')`)).rejects.toThrow()
    const list = await scalar(`select get_profile_connections('${A}','followers',24,0) as result`)
    expect(list.items.map(item => item.id)).toEqual([B])
  })

  it('取消公开后主页/喜欢/相关收藏/直查全部关闭，仍能重复取消关注', async () => {
    await actor(A)
    await db.query(`select set_my_public_settings(false,true,'${A}')`)
    await actor()
    expect(await scalar(`select get_public_profile('${A}') as result`)).toBeNull()
    expect((await scalar(`select get_public_wallpapers('${A}','likes',24,0,null) as result`)).items).toEqual([])
    expect(await scalar(`select get_related_public_collections('desktop:path:/wallpaper/desktop/a.jpg',6) as result`)).toEqual([])
    expect(await scalar('select count(*)::int as result from user_collections')).toBe(0)
    expect(await scalar('select count(*)::int as result from user_collection_items')).toBe(0)
    await actor(B)
    await db.query(`select set_profile_follow('${A}',false,'${B}')`)
    expect(await scalar(`select set_profile_follow('${A}',false,'${B}') as result`)).toMatchObject({ following: false })
    await actor(A)
    expect((await scalar('select get_my_collection_visibility(24,0) as result')).items).toHaveLength(2)
  })

  it('停用回滚保留收藏和关注数据，撤销公开访问与写入接口', async () => {
    await db.exec('reset role')
    await db.exec(await readFile(new URL('../scripts/migrations/20261111_wallpaper_community.rollback.sql', import.meta.url), 'utf8'))
    expect(await scalar('select count(*)::int as result from profile_public_settings')).toBe(57)
    expect(await scalar('select count(*)::int as result from user_collections')).toBe(2)
    await actor()
    await expect(db.query('select get_public_profiles(24,0)')).rejects.toThrow()
    expect(await scalar('select count(*)::int as result from user_collections')).toBe(0)
    await actor(A)
    expect(await scalar('select count(*)::int as result from user_collections')).toBe(2)
    await expect(db.query(`select set_my_public_settings(true,true,'${A}')`)).rejects.toThrow()
  })
})
