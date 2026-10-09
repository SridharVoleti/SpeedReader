-- APP-DATA-009/010: per-learner JSON documents used by the server (assessment progress, platform session records).
-- NOT yet applied to or tested against a live Supabase project (no credentials in this repo).
-- Access is server-side only (service-role key); row-level security is enabled with no public policies.

create table if not exists sr_assessment_state (
  learner_id text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists sr_session_state (
  learner_id text primary key,
  records    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table sr_learner_state     enable row level security;
alter table sr_applied_event     enable row level security;
alter table sr_attempt           enable row level security;
alter table sr_assessment_state  enable row level security;
alter table sr_session_state     enable row level security;
