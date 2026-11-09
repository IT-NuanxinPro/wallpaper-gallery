import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { buildWallpaperAssetKey } from '../src/utils/wallpaper/identity.js'
import { buildLegacyAssetMappings, collectWallpaperAssets } from './sync-wallpaper-assets.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const evidence = path.resolve(process.argv[3] || path.join(root, 'output/stats-fix-20261109'))
const existing = JSON.parse(fs.readFileSync(path.join(evidence, 'assets-before.json'), 'utf8'))
const dataDir = process.argv[2] || path.join(root, 'output/cloudflare-hk-assessment-20261109/release-deploy/data')
const catalog = collectWallpaperAssets(dataDir)
const groups = buildLegacyAssetMappings(catalog)
const ambiguous = new Set(groups.filter(group => group.ambiguous).map(group => group.legacyKey))
const mapping = existing.map(asset => ({ old_key: asset.asset_key, new_key: buildWallpaperAssetKey(asset, asset.series), ambiguous: ambiguous.has(asset.asset_key) }))
if (mapping.some(row => !row.new_key) || new Set(mapping.map(row => row.new_key)).size !== mapping.length)
  throw new Error('现有资源无法唯一映射，停止生成迁移')
const known = new Set(mapping.map(row => row.new_key))
const missing = catalog.filter(asset => !known.has(asset.asset_key))
const quote = value => `'${String(value).replaceAll('\'', '\'\'')}'`
const fingerprint = createHash('md5').update([...existing].sort((a, b) => Buffer.compare(Buffer.from(a.asset_key), Buffer.from(b.asset_key)))
  .map(asset => `${asset.asset_key}\t${asset.source_path || ''}\t${asset.status || ''}`).join('\n')).digest('hex')

// PostgreSQL字节编码与encodeURIComponent一致；真实路径全部在本地逐条对账。
const prefix = `SET LOCAL lock_timeout = '5s';
LOCK TABLE public.wallpaper_assets IN SHARE ROW EXCLUSIVE MODE;
DO $inventory$ BEGIN
 IF (SELECT md5(string_agg(asset_key||E'\\t'||coalesce(source_path,'')||E'\\t'||coalesce(status,''),E'\\n' ORDER BY asset_key COLLATE "C")) FROM public.wallpaper_assets)<>${quote(fingerprint)} THEN
  RAISE EXCEPTION 'Asset paths changed; regenerate migration';
 END IF;
END; $inventory$;
LOCK TABLE public.image_stats,public.user_wallpaper_likes,public.user_collection_items,public.user_download_history,public.user_collections IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA stats_backup_20261109;
REVOKE ALL ON SCHEMA stats_backup_20261109 FROM PUBLIC,anon,authenticated;
CREATE TABLE stats_backup_20261109.wallpaper_assets AS TABLE public.wallpaper_assets;
CREATE TABLE stats_backup_20261109.image_stats AS TABLE public.image_stats;
CREATE TABLE stats_backup_20261109.user_wallpaper_likes AS TABLE public.user_wallpaper_likes;
CREATE TABLE stats_backup_20261109.user_collection_items AS TABLE public.user_collection_items;
CREATE TABLE stats_backup_20261109.user_download_history AS TABLE public.user_download_history;
CREATE TABLE stats_backup_20261109.user_collections AS TABLE public.user_collections;
REVOKE ALL ON ALL TABLES IN SCHEMA stats_backup_20261109 FROM PUBLIC,anon,authenticated;
CREATE TEMP TABLE stats_asset_mapping(old_key text PRIMARY KEY,new_key text UNIQUE NOT NULL,ambiguous boolean NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE stats_asset_catalog(record jsonb NOT NULL) ON COMMIT DROP;
CREATE FUNCTION pg_temp.encode_asset_path(input text) RETURNS text LANGUAGE plpgsql AS $path$
DECLARE segment text; decoded text; bytes bytea; code integer; i integer; part text; result text := ''; j integer;
BEGIN
  FOREACH segment IN ARRAY string_to_array(input,'/') LOOP
    IF segment='' THEN result:=result||'/'; CONTINUE; END IF;
    bytes:=''::bytea; i:=1;
    WHILE i<=length(segment) LOOP
      IF substr(segment,i,3) ~ '^%[0-9a-fA-F]{2}$' THEN
        bytes:=bytes||decode(substr(segment,i+1,2),'hex'); i:=i+3;
      ELSE bytes:=bytes||convert_to(substr(segment,i,1),'UTF8'); i:=i+1; END IF;
    END LOOP;
    BEGIN decoded:=convert_from(bytes,'UTF8'); EXCEPTION WHEN character_not_in_repertoire THEN decoded:=segment; END;
    bytes:=convert_to(decoded,'UTF8'); part:='';
    FOR j IN 0..length(bytes)-1 LOOP
      code:=get_byte(bytes,j);
      IF (code BETWEEN 65 AND 90) OR (code BETWEEN 97 AND 122) OR (code BETWEEN 48 AND 57)
        OR code IN (45,95,46,33,126,42,39,40,41) THEN part:=part||chr(code);
      ELSE part:=part||'%'||upper(lpad(to_hex(code),2,'0')); END IF;
    END LOOP;
    result:=result||part||'/';
  END LOOP;
  RETURN rtrim(result,'/');
END; $path$;
INSERT INTO stats_asset_mapping
SELECT asset_key,CASE WHEN series='bing' THEN asset_key ELSE series||':path:'||pg_temp.encode_asset_path(source_path) END,
 asset_key=ANY(ARRAY[${[...ambiguous].map(quote).join(',')}]::text[])
FROM public.wallpaper_assets;
DO $guard$ BEGIN
 IF (SELECT count(*) FROM stats_asset_mapping)<>${existing.length} THEN RAISE EXCEPTION 'Asset inventory changed; regenerate migration'; END IF;
END; $guard$;
INSERT INTO stats_asset_catalog(record) SELECT value FROM jsonb_array_elements(${quote(JSON.stringify(missing))}::jsonb);
`
const body = fs.readFileSync(path.join(root, 'scripts/migrations/20261109_statistics_v2.sql'), 'utf8')
fs.writeFileSync(path.join(evidence, 'migration-ready.sql'), `${prefix}\n${body}`)
fs.writeFileSync(path.join(evidence, 'migration-manifest.json'), JSON.stringify({ existingAssets: existing.length, missingAssets: missing.length, ambiguousGroups: [...ambiguous], mapping }, null, 2))
console.log(`迁移已生成：${existing.length}项身份迁移，${missing.length}项补齐，${ambiguous.size}组历史混合统计保留`)
