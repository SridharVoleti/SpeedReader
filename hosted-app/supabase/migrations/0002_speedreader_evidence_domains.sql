-- APP-DB-001..010: remaining normalized SpeedReader domains (exact names may differ; domain separation must not).
-- NOT yet applied to or tested against a live Supabase project (no credentials in this repo).
-- Evidence tables are append-only: corrections are new rows linked to what they supersede (APP-DATA-003).

create or replace function sr_append_only() returns trigger language plpgsql as $$
begin
  raise exception '% rows are immutable (append-only evidence)', tg_table_name;
end $$;

-- APP-DB-003: structured, item-level responses.
create table if not exists sr_structured_response (
  learner_id text not null,
  attempt_id text not null,
  item_id    text not null,
  p_level    integer check (p_level between 1 and 10),
  score      numeric not null check (score between 0 and 1),
  response   jsonb,
  primary key (learner_id, attempt_id, item_id),
  foreign key (learner_id, attempt_id) references sr_attempt(learner_id, attempt_id)
);

-- APP-DB-004: spoken evidence; raw and learner-confirmed transcripts are separate columns (APP-COMP-010).
create table if not exists sr_spoken_evidence (
  learner_id            text not null,
  attempt_id            text not null,
  status                text not null check (status in ('SCORED','UNRESOLVED_TECHNICAL','AWAITING')),
  technical_reason      text,
  asr_confidence        numeric check (asr_confidence between 0 and 1),
  raw_transcript        text,
  confirmed_transcript  text,
  edit_history          jsonb not null default '[]'::jsonb,
  primary key (learner_id, attempt_id),
  foreign key (learner_id, attempt_id) references sr_attempt(learner_id, attempt_id),
  check (confirmed_transcript is null or raw_transcript is not null)
);

-- APP-DB-005 / APP-DATA-005: progression decisions, independent from raw attempts.
create table if not exists sr_progression_decision (
  learner_id         text not null references sr_learner_state(learner_id),
  decision_id        text not null,
  decision_type      text not null check (decision_type in ('LEVEL_UP','HOLD','LEVEL_UP_DEFERRED')),
  reason_code        text not null,
  input_evidence_ids text[] not null check (cardinality(input_evidence_ids) > 0),
  wpm_before         integer not null,
  wpm_after          integer not null check (wpm_after >= wpm_before),  -- earned WPM is never removed
  rule_versions      jsonb not null,
  decided_at         timestamptz not null,
  primary key (learner_id, decision_id)
);

-- APP-DB-006: familiar-practice selection/history (never progression evidence).
create table if not exists sr_practice_event (
  learner_id   text not null references sr_learner_state(learner_id),
  attempt_id   text not null,
  passage_id   text not null,
  served_wpm   integer not null,
  selected_by  text not null,
  recorded_at  timestamptz not null default now(),
  primary key (learner_id, attempt_id)
);

-- APP-DB-007: News Reader attempts live in their own table (separate namespace, APP-NR-004).
create table if not exists sr_news_reader_attempt (
  learner_id  text not null references sr_learner_state(learner_id),
  attempt_id  text not null,
  passage_id  text not null,
  read_number integer not null check (read_number in (1,2)),
  metrics     jsonb,
  microphone_available boolean not null,
  recorded_at timestamptz not null default now(),
  primary key (learner_id, attempt_id)
);

-- APP-DB-008 / APP-READY-002: readiness cycles and forms with separate identities.
create table if not exists sr_readiness_stream (
  learner_id text not null references sr_learner_state(learner_id),
  stream_id  text not null,
  phase      text not null,
  cycle      integer not null default 1,
  pending_replacement text,
  confirmed_at timestamptz,
  revalidation_trigger text,
  primary key (learner_id, stream_id)
);
create table if not exists sr_readiness_attempt (
  learner_id           text not null,
  stream_id            text not null,
  attempt_id           text not null,
  registry_passage_id  text not null,
  form_family_id       text not null,
  assessment_form_id   text not null,
  delivery_event_id    text not null,
  role                 text not null check (role in ('PRIMARY','NEW_CYCLE_PRIMARY','CONFIRMATION','NEW_CYCLE_CONFIRMATION','TECHNICAL_REPLACEMENT','REVALIDATION')),
  replaces_role        text,
  outcome              text not null check (outcome in ('PASS','FAIL','TECHNICAL_INVALID','INSUFFICIENT_EVIDENCE','INVALID_FORM')),
  attempted_at         timestamptz not null,
  primary key (learner_id, attempt_id),
  unique (learner_id, stream_id, assessment_form_id),            -- a form is never reused within a stream
  foreign key (learner_id, stream_id) references sr_readiness_stream(learner_id, stream_id)
);

-- APP-DB-009: calibration versions; history is never rewritten.
create table if not exists sr_calibration_version (
  version    text primary key,
  status     text not null check (status in ('PROVISIONAL_PILOT','CALIBRATION_REVIEW','PRODUCTION_APPROVED','SUSPENDED_RECALIBRATE','SUPERSEDED')),
  parameters jsonb not null,
  audit      jsonb not null,
  created_at timestamptz not null default now()
);

-- APP-DB-010: content package identity consumed by an attempt.
create table if not exists sr_content_package (
  package_id   text not null,
  version      text not null,
  sha256       text not null,
  tokenizer    text not null,
  approved_at  timestamptz,
  primary key (package_id, version)
);

-- Append-only guards.
do $$
declare t text;
begin
  foreach t in array array['sr_structured_response','sr_spoken_evidence','sr_progression_decision','sr_practice_event','sr_news_reader_attempt','sr_readiness_attempt','sr_calibration_version','sr_content_package']
  loop
    execute format('drop trigger if exists %I on %I', t || '_immutable', t);
    execute format('create trigger %I before update or delete on %I for each row execute function sr_append_only()', t || '_immutable', t);
  end loop;
end $$;
