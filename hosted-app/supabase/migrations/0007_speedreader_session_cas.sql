-- 0007: atomic, versioned session-document writes (issue #21).
-- Two serverless instances can read the same session document; only the writer holding the current version may
-- replace it, so one active session / weekly cap / monotonic ordinal / REVIEW-by-ordinal hold under concurrency.
-- Existing rows start at version 1 (they were written once before versioning); a learner with no row is version 0.
alter table sr_session_state add column if not exists version integer not null default 1;

create or replace function sr_save_sessions(p_learner_id text, p_expected_version integer, p_records jsonb)
returns jsonb language plpgsql as $$
declare v_version integer;
begin
  if p_expected_version = 0 then
    insert into sr_session_state(learner_id, records, version) values (p_learner_id, p_records, 1)
    on conflict (learner_id) do nothing
    returning version into v_version;
  else
    update sr_session_state set records = p_records, version = version + 1, updated_at = now()
     where learner_id = p_learner_id and version = p_expected_version
    returning version into v_version;
  end if;
  if v_version is null then return jsonb_build_object('ok', false, 'reason', 'VERSION_CONFLICT'); end if;
  return jsonb_build_object('ok', true, 'version', v_version);
end $$;
