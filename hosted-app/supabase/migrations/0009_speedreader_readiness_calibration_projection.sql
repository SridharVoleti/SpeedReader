-- 0009: readiness streams/attempts and calibration versions get a production writer path (issue #20).
-- Same pattern as 0004/0006/0008: projected by triggers inside the transaction that commits the learner state / attempt.

-- Readiness: the stream row mirrors the committed phase (mutable by design); attempts are immutable, one per attempt id,
-- and a form can never be reused within a stream (table constraint). A violation rolls the commit back.
create or replace function sr_project_readiness() returns trigger language plpgsql as $$
begin
  insert into sr_readiness_stream(learner_id, stream_id, phase, cycle, pending_replacement, confirmed_at, revalidation_trigger)
  select new.learner_id, s->>'streamId', s->>'phase', coalesce((s->>'cycle')::integer, 1), s->>'pendingReplacement',
         (s->>'confirmedAt')::timestamptz, s->>'revalidationTrigger'
    from jsonb_array_elements(coalesce(new.state->'readinessStreams', '[]'::jsonb)) s
  on conflict (learner_id, stream_id) do update
    set phase = excluded.phase, cycle = excluded.cycle, pending_replacement = excluded.pending_replacement,
        confirmed_at = excluded.confirmed_at, revalidation_trigger = excluded.revalidation_trigger;

  insert into sr_readiness_attempt(learner_id, stream_id, attempt_id, registry_passage_id, form_family_id, assessment_form_id,
                                   delivery_event_id, role, replaces_role, outcome, attempted_at)
  select new.learner_id, s->>'streamId', h->>'attemptId', h->>'registryPassageId', h->>'formFamilyId', h->>'assessmentFormId',
         h->>'deliveryEventId', h->>'role', h->>'replacesRole', h->>'outcome', (h->>'at')::timestamptz
    from jsonb_array_elements(coalesce(new.state->'readinessStreams', '[]'::jsonb)) s,
         jsonb_array_elements(coalesce(s->'history', '[]'::jsonb)) h
  on conflict (learner_id, attempt_id) do nothing;
  return new;
end $$;

drop trigger if exists sr_learner_state_readiness on sr_learner_state;
create trigger sr_learner_state_readiness after insert or update of state on sr_learner_state
  for each row execute function sr_project_readiness();

-- Calibration: the version an attempt used is published once (append-only), so historical attempts keep resolving it.
create or replace function sr_project_calibration() returns trigger language plpgsql as $$
declare c jsonb := new.record->'calibration';
begin
  if c is not null and jsonb_typeof(c) = 'object' then
    insert into sr_calibration_version(version, status, parameters, audit)
    values (c->>'version', c->>'status', coalesce(c->'parameters', '{}'::jsonb),
            jsonb_build_object('firstSeenInAttempt', new.attempt_id, 'learnerId', new.learner_id))
    on conflict (version) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists sr_attempt_calibration on sr_attempt;
create trigger sr_attempt_calibration after insert on sr_attempt
  for each row execute function sr_project_calibration();
