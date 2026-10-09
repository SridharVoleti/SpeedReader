-- APP-DATA-010 / APP-DB-001..005: SpeedReader learner state on Supabase (Singapore region).
-- Account auth and billing stay with the Babysteps platform; learner_id is the platform learner id.
-- NOT yet applied to or tested against a live Supabase project (no credentials in this repo).
create table if not exists sr_learner_state (
  learner_id        text primary key,
  baseline_wpm      integer not null check (baseline_wpm between 1 and 150),
  current_wpm       integer not null check (current_wpm between 1 and 150),
  canonical_pointer integer not null check (canonical_pointer between 1 and 1501),
  state             jsonb   not null,              -- full LearnerAggregate snapshot
  version           integer not null default 1,    -- optimistic concurrency
  updated_at        timestamptz not null default now()
);

-- Applied events: the idempotency record. A replayed key is a no-op (APP-DATA-008).
create table if not exists sr_applied_event (
  learner_id        text not null references sr_learner_state(learner_id),
  idempotency_key   text not null,
  resulting_version integer not null,
  applied_at        timestamptz not null default now(),
  primary key (learner_id, idempotency_key)
);

-- Immutable attempt ledger (APP-DATA-003/005). Rows are append-only.
create table if not exists sr_attempt (
  learner_id   text not null references sr_learner_state(learner_id),
  attempt_id   text not null,
  attempt_type text not null,
  record       jsonb not null,
  recorded_at  timestamptz not null default now(),
  primary key (learner_id, attempt_id)
);

create or replace function sr_attempt_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'sr_attempt rows are immutable';
end $$;

drop trigger if exists sr_attempt_no_update on sr_attempt;
create trigger sr_attempt_no_update before update or delete on sr_attempt
  for each row execute function sr_attempt_immutable();

-- Atomic, idempotent, versioned commit: state + ledger row + applied event in ONE transaction.
create or replace function sr_commit_learner(
  p_learner_id text, p_expected_version integer, p_idempotency_key text,
  p_state jsonb, p_current_wpm integer, p_pointer integer, p_attempt jsonb
) returns jsonb language plpgsql as $$
declare v_version integer;
begin
  if exists (select 1 from sr_applied_event where learner_id = p_learner_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;
  update sr_learner_state
     set state = p_state, current_wpm = p_current_wpm, canonical_pointer = p_pointer,
         version = version + 1, updated_at = now()
   where learner_id = p_learner_id and version = p_expected_version
  returning version into v_version;
  if v_version is null then
    return jsonb_build_object('ok', false, 'reason', 'VERSION_CONFLICT');
  end if;
  if p_attempt is not null then
    insert into sr_attempt(learner_id, attempt_id, attempt_type, record)
    values (p_learner_id, p_attempt->>'attemptId', p_attempt->>'attemptType', p_attempt);
  end if;
  insert into sr_applied_event(learner_id, idempotency_key, resulting_version)
  values (p_learner_id, p_idempotency_key, v_version);
  return jsonb_build_object('ok', true, 'replayed', false, 'version', v_version);
end $$;
