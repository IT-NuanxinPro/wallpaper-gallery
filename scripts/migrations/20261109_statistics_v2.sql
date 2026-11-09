-- 统计v2：先由prepare-statistics-migration生成身份与资源暂存表，再执行本文件。
-- 必需临时表：stats_asset_mapping(old_key,new_key,ambiguous), stats_asset_catalog(record jsonb)。
-- 迁移不删除历史计数，歧义累计保留旧键；只将可确认资源身份的关系迁移到新键。
SET LOCAL lock_timeout = '5s';

REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id,username,display_name,avatar_url,bio,primary_email,primary_provider,role,status,extra,created_at,updated_at)
  ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (username,display_name,avatar_url,bio,primary_email,primary_provider,extra)
  ON public.profiles TO authenticated;
-- 关系计数触发器以INSERT/DELETE为单位，不允许客户端UPDATE绕过计数。
REVOKE UPDATE ON public.user_wallpaper_likes,public.user_collection_items FROM PUBLIC,anon,authenticated;
REVOKE UPDATE(user_id,asset_key,created_at) ON public.user_wallpaper_likes FROM PUBLIC,anon,authenticated;
REVOKE UPDATE(collection_id,asset_key,note,added_at) ON public.user_collection_items FROM PUBLIC,anon,authenticated;

ALTER TABLE public.wallpaper_assets DROP CONSTRAINT IF EXISTS wallpaper_assets_check;
ALTER TABLE public.wallpaper_assets DROP CONSTRAINT IF EXISTS wallpaper_assets_series_filename_key;
ALTER TABLE public.user_wallpaper_likes DROP CONSTRAINT user_wallpaper_likes_asset_key_fkey;
ALTER TABLE public.user_wallpaper_likes ADD CONSTRAINT user_wallpaper_likes_asset_key_fkey
  FOREIGN KEY (asset_key) REFERENCES public.wallpaper_assets(asset_key) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.user_collection_items DROP CONSTRAINT user_collection_items_asset_key_fkey;
ALTER TABLE public.user_collection_items ADD CONSTRAINT user_collection_items_asset_key_fkey
  FOREIGN KEY (asset_key) REFERENCES public.wallpaper_assets(asset_key) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.user_download_history DROP CONSTRAINT user_download_history_asset_key_fkey;
ALTER TABLE public.user_download_history ADD CONSTRAINT user_download_history_asset_key_fkey
  FOREIGN KEY (asset_key) REFERENCES public.wallpaper_assets(asset_key) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.user_collections DROP CONSTRAINT user_collections_cover_asset_key_fkey;
ALTER TABLE public.user_collections ADD CONSTRAINT user_collections_cover_asset_key_fkey
  FOREIGN KEY (cover_asset_key) REFERENCES public.wallpaper_assets(asset_key) ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE public.wallpaper_assets a SET asset_key=m.new_key
FROM stats_asset_mapping m WHERE a.asset_key=m.old_key AND m.old_key<>m.new_key;

INSERT INTO public.wallpaper_assets
  (asset_key,series,filename,title,category,subcategory,source_path,preview_path,thumbnail_path,raw_url,
   width,height,format,file_size,cdn_tag,status,removed_at,source_updated_at,metadata,duration_seconds)
SELECT r.asset_key,r.series,r.filename,r.title,r.category,r.subcategory,r.source_path,r.preview_path,r.thumbnail_path,r.raw_url,
       r.width,r.height,r.format,r.file_size,r.cdn_tag,r.status,r.removed_at,r.source_updated_at,r.metadata,r.duration_seconds
FROM stats_asset_catalog c CROSS JOIN LATERAL jsonb_populate_record(NULL::public.wallpaper_assets,c.record) r
ON CONFLICT (asset_key) DO UPDATE SET
  title=EXCLUDED.title,category=EXCLUDED.category,subcategory=EXCLUDED.subcategory,source_path=EXCLUDED.source_path,
  preview_path=EXCLUDED.preview_path,thumbnail_path=EXCLUDED.thumbnail_path,raw_url=EXCLUDED.raw_url,
  width=EXCLUDED.width,height=EXCLUDED.height,format=EXCLUDED.format,file_size=EXCLUDED.file_size,
  cdn_tag=EXCLUDED.cdn_tag,status=EXCLUDED.status,removed_at=EXCLUDED.removed_at,
  source_updated_at=EXCLUDED.source_updated_at,metadata=EXCLUDED.metadata,duration_seconds=EXCLUDED.duration_seconds;

-- 阻止尚未更新的旧同步脚本重新插入文件名键，避免把新键误标removed。
ALTER TABLE public.wallpaper_assets ADD CONSTRAINT wallpaper_assets_identity_v2_check CHECK (
  (series='bing' AND asset_key=series||':'||filename)
  OR (series<>'bing' AND asset_key LIKE series||':path:/wallpaper/'||series||'/%')
);

ALTER TABLE public.image_stats ADD COLUMN legacy_ambiguous boolean NOT NULL DEFAULT false;
UPDATE public.image_stats s SET image_id=substr(m.new_key,length(s.series)+2)
FROM stats_asset_mapping m
WHERE s.series||':'||s.image_id=m.old_key AND NOT m.ambiguous AND m.old_key<>m.new_key;
UPDATE public.image_stats s SET legacy_ambiguous=true,total_likes=0,total_collects=0
FROM stats_asset_mapping m WHERE s.series||':'||s.image_id=m.old_key AND m.ambiguous;

-- UPDATE CASCADE不会触发既有INSERT/DELETE关系计数触发器，按关系事实生成新键的计数。
UPDATE public.image_stats SET total_likes=0,total_collects=0;
WITH counts AS (
  SELECT asset_key,count(*)::integer AS likes,0::integer AS collects FROM public.user_wallpaper_likes GROUP BY asset_key
  UNION ALL
  SELECT asset_key,0,count(*)::integer FROM public.user_collection_items GROUP BY asset_key
), merged AS (
  SELECT asset_key,sum(likes)::integer AS likes,sum(collects)::integer AS collects FROM counts GROUP BY asset_key
)
INSERT INTO public.image_stats(image_id,series,total_views,total_downloads,total_likes,total_collects)
SELECT substr(m.asset_key,length(a.series)+2),a.series,0,0,m.likes,m.collects
FROM merged m JOIN public.wallpaper_assets a ON a.asset_key=m.asset_key
ON CONFLICT (series,image_id) DO UPDATE SET total_likes=EXCLUDED.total_likes,total_collects=EXCLUDED.total_collects;

CREATE TABLE public.wallpaper_legacy_keys (
  legacy_key text NOT NULL,
  asset_key text NOT NULL REFERENCES public.wallpaper_assets(asset_key) ON UPDATE CASCADE ON DELETE CASCADE,
  ambiguous boolean NOT NULL DEFAULT false,
  PRIMARY KEY(legacy_key,asset_key)
);
INSERT INTO public.wallpaper_legacy_keys SELECT old_key,new_key,ambiguous FROM stats_asset_mapping;
ALTER TABLE public.wallpaper_legacy_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Legacy mappings are public readable" ON public.wallpaper_legacy_keys FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT ON public.wallpaper_legacy_keys TO anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.wallpaper_legacy_keys FROM PUBLIC,anon,authenticated;

CREATE TABLE public.wallpaper_stats_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  period_started_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.wallpaper_stats_config(singleton) VALUES(true);
ALTER TABLE public.wallpaper_stats_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallpaper_stats_config FROM PUBLIC,anon,authenticated;

CREATE TABLE public.wallpaper_stat_events (
  event_id uuid PRIMARY KEY,
  asset_key text NOT NULL REFERENCES public.wallpaper_assets(asset_key) ON UPDATE CASCADE ON DELETE CASCADE,
  event_type text NOT NULL CHECK(event_type IN ('view','download')),
  session_id uuid NOT NULL,
  user_id uuid,
  counted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallpaper_stat_events_session_recent ON public.wallpaper_stat_events(session_id,created_at DESC);
CREATE INDEX wallpaper_stat_events_view_dedupe ON public.wallpaper_stat_events(session_id,asset_key,created_at DESC) WHERE event_type='view';
ALTER TABLE public.wallpaper_stat_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallpaper_stat_events FROM PUBLIC,anon,authenticated;

CREATE TABLE public.wallpaper_daily_stats (
  asset_key text NOT NULL REFERENCES public.wallpaper_assets(asset_key) ON UPDATE CASCADE ON DELETE CASCADE,
  day date NOT NULL,
  views bigint NOT NULL DEFAULT 0 CHECK(views>=0),
  downloads bigint NOT NULL DEFAULT 0 CHECK(downloads>=0),
  PRIMARY KEY(asset_key,day)
);
CREATE INDEX wallpaper_daily_stats_day ON public.wallpaper_daily_stats(day,asset_key);
ALTER TABLE public.wallpaper_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Daily counts are public readable" ON public.wallpaper_daily_stats FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT ON public.wallpaper_daily_stats TO anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.wallpaper_daily_stats FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.record_wallpaper_event(p_event_id uuid,p_asset_key text,p_event_type text,p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  a public.wallpaper_assets%ROWTYPE;
  previous public.wallpaper_stat_events%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_uid uuid := auth.uid();
  v_views integer := CASE WHEN p_event_type='view' THEN 1 ELSE 0 END;
  v_downloads integer := CASE WHEN p_event_type='download' THEN 1 ELSE 0 END;
BEGIN
  IF p_event_id IS NULL OR p_session_id IS NULL OR p_asset_key IS NULL OR length(p_asset_key)>2048
     OR p_event_type IS NULL OR p_event_type NOT IN ('view','download') THEN
    RAISE EXCEPTION 'Invalid event' USING ERRCODE='22023';
  END IF;
  SELECT * INTO a FROM public.wallpaper_assets WHERE asset_key=p_asset_key AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown asset' USING ERRCODE='22023'; END IF;
  IF v_uid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_uid AND status='active') THEN
    RAISE EXCEPTION 'Inactive account' USING ERRCODE='42501';
  END IF;
  -- 相同事件和会话串行化，重试幂等与短窗口去重都由服务端保证。
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::text,1));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text,2));
  SELECT * INTO previous FROM public.wallpaper_stat_events WHERE event_id=p_event_id;
  IF FOUND THEN
    IF previous.asset_key<>p_asset_key OR previous.event_type<>p_event_type OR previous.session_id<>p_session_id THEN
      RAISE EXCEPTION 'Event identity conflict' USING ERRCODE='22023';
    END IF;
    RETURN jsonb_build_object('status','duplicate');
  END IF;
  IF (SELECT count(*) FROM public.wallpaper_stat_events WHERE session_id=p_session_id
      AND event_type=p_event_type AND created_at>v_now-interval '1 minute') >=
      (CASE WHEN p_event_type='view' THEN 120 ELSE 30 END) THEN
    RAISE EXCEPTION 'Too many events' USING ERRCODE='PT429';
  END IF;
  IF p_event_type='view' AND EXISTS(
    SELECT 1 FROM public.wallpaper_stat_events WHERE session_id=p_session_id AND asset_key=p_asset_key
      AND event_type='view' AND counted AND created_at>v_now-interval '10 minutes'
  ) THEN
    INSERT INTO public.wallpaper_stat_events(event_id,asset_key,event_type,session_id,user_id,created_at,counted)
    VALUES(p_event_id,p_asset_key,p_event_type,p_session_id,v_uid,v_now,false);
    RETURN jsonb_build_object('status','duplicate');
  END IF;
  INSERT INTO public.wallpaper_stat_events(event_id,asset_key,event_type,session_id,user_id,created_at)
  VALUES(p_event_id,p_asset_key,p_event_type,p_session_id,v_uid,v_now);
  INSERT INTO public.image_stats(image_id,series,category,total_views,total_downloads,last_viewed_at,last_downloaded_at,updated_at)
  VALUES(substr(a.asset_key,length(a.series)+2),a.series,a.category,v_views,v_downloads,
    CASE WHEN v_views=1 THEN v_now END,CASE WHEN v_downloads=1 THEN v_now END,v_now)
  ON CONFLICT(series,image_id) DO UPDATE SET
    total_views=coalesce(public.image_stats.total_views,0)+v_views,
    total_downloads=coalesce(public.image_stats.total_downloads,0)+v_downloads,
    last_viewed_at=CASE WHEN v_views=1 THEN v_now ELSE public.image_stats.last_viewed_at END,
    last_downloaded_at=CASE WHEN v_downloads=1 THEN v_now ELSE public.image_stats.last_downloaded_at END,
    updated_at=v_now;
  INSERT INTO public.wallpaper_daily_stats(asset_key,day,views,downloads)
  VALUES(a.asset_key,(v_now AT TIME ZONE 'Asia/Shanghai')::date,v_views,v_downloads)
  ON CONFLICT(asset_key,day) DO UPDATE SET views=public.wallpaper_daily_stats.views+v_views,
    downloads=public.wallpaper_daily_stats.downloads+v_downloads;
  IF v_downloads=1 AND v_uid IS NOT NULL THEN
    INSERT INTO public.user_download_history(user_id,asset_key,source,file_format,resolution_label,context,created_at)
    VALUES(v_uid,a.asset_key,'web',a.format,a.metadata->'resolution'->>'label',
      jsonb_build_object('event_id',p_event_id,'outcome','download-initiated','filename',a.filename),v_now);
  END IF;
  RETURN jsonb_build_object('status','accepted');
END;
$$;
REVOKE ALL ON FUNCTION public.record_wallpaper_event(uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_wallpaper_event(uuid,text,text,uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_stats_page(p_series text,p_after text DEFAULT '',p_limit integer DEFAULT 500)
RETURNS TABLE(asset_key text,image_id text,total_views bigint,total_downloads bigint,total_likes bigint,total_collects bigint,
  week_views bigint,week_downloads bigint,month_views bigint,month_downloads bigint,period_started_at timestamptz,legacy_ambiguous boolean,
  week_start date,month_start date,total_rows bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH periods AS (
    SELECT date_trunc('week',now() AT TIME ZONE 'Asia/Shanghai')::date AS week_start,
      date_trunc('month',now() AT TIME ZONE 'Asia/Shanghai')::date AS month_start
  ), daily AS (
    SELECT d.asset_key,
      sum(d.views) FILTER(WHERE d.day>=p.week_start) AS week_views,
      sum(d.downloads) FILTER(WHERE d.day>=p.week_start) AS week_downloads,
      sum(d.views) FILTER(WHERE d.day>=p.month_start) AS month_views,
      sum(d.downloads) FILTER(WHERE d.day>=p.month_start) AS month_downloads
    FROM public.wallpaper_daily_stats d CROSS JOIN periods p
    WHERE d.day>=least(p.week_start,p.month_start) GROUP BY d.asset_key
  ), combined AS (
    SELECT coalesce(a.asset_key,s.series||':'||s.image_id) AS asset_key,
      coalesce(s.image_id,substr(a.asset_key,length(a.series)+2)) AS image_id,
      coalesce(s.total_views,0)::bigint AS total_views,coalesce(s.total_downloads,0)::bigint AS total_downloads,
      coalesce(s.total_likes,0)::bigint AS total_likes,coalesce(s.total_collects,0)::bigint AS total_collects,
      coalesce(s.legacy_ambiguous,false) AS legacy_ambiguous
    FROM public.wallpaper_assets a FULL JOIN public.image_stats s ON a.asset_key=s.series||':'||s.image_id
    WHERE coalesce(a.series,s.series)=p_series
  ), counted AS (
    SELECT combined.*,count(*) OVER() AS total_rows FROM combined
  )
  SELECT c.asset_key,c.image_id,c.total_views,c.total_downloads,c.total_likes,c.total_collects,
    coalesce(d.week_views,0)::bigint,coalesce(d.week_downloads,0)::bigint,
    coalesce(d.month_views,0)::bigint,coalesce(d.month_downloads,0)::bigint,cfg.period_started_at,c.legacy_ambiguous,
    p.week_start,p.month_start,c.total_rows
  FROM counted c LEFT JOIN daily d ON d.asset_key=c.asset_key CROSS JOIN public.wallpaper_stats_config cfg CROSS JOIN periods p
  WHERE p_series IN ('desktop','mobile','avatar','video','bing') AND c.asset_key COLLATE "C">coalesce(p_after,'') COLLATE "C"
  ORDER BY c.asset_key COLLATE "C" LIMIT greatest(1,least(coalesce(p_limit,500),1000));
$$;
REVOKE ALL ON FUNCTION public.get_stats_page(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stats_page(text,text,integer) TO anon,authenticated;

-- 旧客户端暂时保留旧接口；它们只写累计值，不冒充可信期间事件。
CREATE OR REPLACE FUNCTION public.increment_view(img_id text,series_name text,cat text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_key text; v_image text;
BEGIN
  IF img_id IS NULL OR length(img_id)>2048 OR series_name NOT IN ('desktop','mobile','avatar','video','bing') THEN
    RAISE EXCEPTION 'Invalid asset' USING ERRCODE='22023';
  END IF;
  SELECT min(k.asset_key) INTO v_key FROM public.wallpaper_legacy_keys k WHERE k.legacy_key=series_name||':'||img_id AND NOT k.ambiguous;
  IF v_key IS NULL AND NOT EXISTS(SELECT 1 FROM public.wallpaper_assets WHERE asset_key=series_name||':'||img_id)
     AND NOT EXISTS(SELECT 1 FROM public.wallpaper_legacy_keys WHERE legacy_key=series_name||':'||img_id) THEN
    RAISE EXCEPTION 'Unknown asset' USING ERRCODE='22023';
  END IF;
  v_image:=CASE WHEN v_key IS NULL THEN img_id ELSE substr(v_key,length(series_name)+2) END;
  INSERT INTO public.image_stats(image_id,series,category,total_views,last_viewed_at,updated_at,legacy_ambiguous)
  VALUES(v_image,series_name,cat,1,now(),now(),v_key IS NULL AND EXISTS(SELECT 1 FROM public.wallpaper_legacy_keys WHERE legacy_key=series_name||':'||img_id AND ambiguous))
  ON CONFLICT(series,image_id) DO UPDATE SET total_views=coalesce(public.image_stats.total_views,0)+1,last_viewed_at=now(),updated_at=now();
END; $$;
CREATE OR REPLACE FUNCTION public.increment_download(img_id text,series_name text,cat text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_key text; v_image text;
BEGIN
  IF img_id IS NULL OR length(img_id)>2048 OR series_name NOT IN ('desktop','mobile','avatar','video','bing') THEN
    RAISE EXCEPTION 'Invalid asset' USING ERRCODE='22023';
  END IF;
  SELECT min(k.asset_key) INTO v_key FROM public.wallpaper_legacy_keys k WHERE k.legacy_key=series_name||':'||img_id AND NOT k.ambiguous;
  IF v_key IS NULL AND NOT EXISTS(SELECT 1 FROM public.wallpaper_assets WHERE asset_key=series_name||':'||img_id)
     AND NOT EXISTS(SELECT 1 FROM public.wallpaper_legacy_keys WHERE legacy_key=series_name||':'||img_id) THEN
    RAISE EXCEPTION 'Unknown asset' USING ERRCODE='22023';
  END IF;
  v_image:=CASE WHEN v_key IS NULL THEN img_id ELSE substr(v_key,length(series_name)+2) END;
  INSERT INTO public.image_stats(image_id,series,category,total_views,total_downloads,last_downloaded_at,updated_at,legacy_ambiguous)
  VALUES(v_image,series_name,cat,0,1,now(),now(),v_key IS NULL AND EXISTS(SELECT 1 FROM public.wallpaper_legacy_keys WHERE legacy_key=series_name||':'||img_id AND ambiguous))
  ON CONFLICT(series,image_id) DO UPDATE SET total_downloads=coalesce(public.image_stats.total_downloads,0)+1,last_downloaded_at=now(),updated_at=now();
END; $$;

CREATE OR REPLACE FUNCTION public.get_hot_stats(series_filter text,limit_count integer DEFAULT 500)
RETURNS TABLE(image_id text,total_views integer,total_downloads integer,total_likes integer,total_collects integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(a.filename,s.image_id),sum(s.total_views)::integer,sum(s.total_downloads)::integer,
    sum(s.total_likes)::integer,sum(s.total_collects)::integer
  FROM public.image_stats s LEFT JOIN public.wallpaper_assets a ON a.asset_key=s.series||':'||s.image_id
  WHERE s.series=series_filter GROUP BY coalesce(a.filename,s.image_id)
  ORDER BY sum(s.total_views) DESC,coalesce(a.filename,s.image_id)
  LIMIT greatest(1,least(coalesce(limit_count,500),1000));
$$;
-- 旧接口仅保留给维护服务，客户端统一走事件RPC，不能绕过幂等和去重。
REVOKE EXECUTE ON FUNCTION public.increment_view(text,text,text),public.increment_download(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.increment_view(text,text,text),public.increment_download(text,text,text) TO service_role;
ALTER VIEW public.image_stats_with_asset_key SET (security_invoker=true);
CREATE INDEX IF NOT EXISTS idx_user_download_history_asset_key ON public.user_download_history(asset_key);
CREATE INDEX IF NOT EXISTS idx_user_collections_cover_asset_key ON public.user_collections(cover_asset_key);
