-- Spaced memory checks (24h/7d/30d) on stories already read: their own evidence namespace, never progression.
-- Rows are projected from the learner state's retentionLog inside the same transaction that commits the state
-- (trigger), so a check is never in one place and missing from the other. Append-only; replays are no-ops.
-- NOT yet applied to a live Supabase project (no credentials in this repo).

create table if not exists sr_retention_check (
  learner_id     text not null references sr_learner_state(learner_id),
  attempt_id     text not null,
  passage_id     text not null,
  check_number   integer not null check (check_number >= 1),
  correct        integer not null check (correct >= 0),
  total          integer not null check (total >= 1 and correct <= total),
  remembered     boolean not null,
  delay_seconds  double precision not null check (delay_seconds >= 0),
  delay_bucket   text,
  immediate_score double precision,
  session_id     text,
  policy_version text not null,
  checked_at     timestamptz not null,
  primary key (learner_id, attempt_id)
);

create or replace function sr_project_retention() returns trigger language plpgsql as $$
begin
  insert into sr_retention_check(learner_id, attempt_id, passage_id, check_number, correct, total, remembered,
                                 delay_seconds, delay_bucket, immediate_score, session_id, policy_version, checked_at)
  select new.learner_id, r->>'attemptId', r->>'passageId', (r->>'checkNumber')::integer, (r->>'correct')::integer,
         (r->>'total')::integer, (r->>'remembered')::boolean, (r->>'delaySeconds')::double precision, r->>'delayBucket',
         (r->>'immediateScore')::double precision, r->>'sessionId', r->>'policyVersion', (r->>'at')::timestamptz
    from jsonb_array_elements(coalesce(new.state->'retentionLog', '[]'::jsonb)) r
  on conflict (learner_id, attempt_id) do nothing;
  return new;
end $$;

drop trigger if exists sr_learner_state_retention on sr_learner_state;
create trigger sr_learner_state_retention after insert or update of state on sr_learner_state
  for each row execute function sr_project_retention();

drop trigger if exists sr_retention_check_immutable on sr_retention_check;
create trigger sr_retention_check_immutable before update or delete on sr_retention_check
  for each row execute function sr_append_only();

alter table sr_retention_check enable row level security;
