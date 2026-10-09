-- 0008: the content package consumed by an attempt is recoverable historically (issue #23, APP-DB-010).
-- Extends the 0006 attempt projection: package identity (id, version, immutable hash, tokenizer) is stored once per
-- package version, in the same transaction as the attempt. Rows are append-only (sr_content_package_immutable), so a
-- later package update can never rewrite what an earlier attempt consumed; the attempt record keeps the exact reference.
create or replace function sr_project_content_package() returns trigger language plpgsql as $$
declare r jsonb := new.record;
begin
  if r->'contentPackage' is not null and jsonb_typeof(r->'contentPackage') = 'object' then
    insert into sr_content_package(package_id, version, sha256, tokenizer)
    values (r->'contentPackage'->>'packageId', r->'contentPackage'->>'packageVersion', r->'contentPackage'->>'contentHash',
            coalesce(r->'ruleVersions'->>'tokenizer', 'unknown'))
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists sr_attempt_content_package on sr_attempt;
create trigger sr_attempt_content_package after insert on sr_attempt
  for each row execute function sr_project_content_package();
