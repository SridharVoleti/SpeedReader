-- 0006: wire the normalized evidence domains from 0002 into the production write path (issue #20).
-- Same pattern as sr_retention_check: rows are projected by triggers INSIDE the transaction that commits the
-- learner state / attempt (sr_commit_learner), so state and required evidence can never split. A projection
-- failure raises and rolls the whole commit back. Replays never reach the triggers (sr_applied_event short
-- circuit) and every insert is ON CONFLICT DO NOTHING, so nothing is ever duplicated. Domains stay separate.

-- Per attempt record: structured items, spoken evidence, progression decision.
create or replace function sr_project_attempt_evidence() returns trigger language plpgsql as $$
declare
  r jsonb := new.record;
  v_event text := r->'levelUpAfter'->>'event';
  v_type text;
begin
  insert into sr_structured_response(learner_id, attempt_id, item_id, score)
  select new.learner_id, new.attempt_id, i->>'itemId', (i->>'score')::numeric
    from jsonb_array_elements(coalesce(r->'structured'->'items', '[]'::jsonb)) i
  on conflict do nothing;

  if coalesce(r->>'spokenStatus', 'NOT_APPLICABLE') <> 'NOT_APPLICABLE' then
    insert into sr_spoken_evidence(learner_id, attempt_id, status, technical_reason, raw_transcript, confirmed_transcript)
    values (new.learner_id, new.attempt_id, r->>'spokenStatus', r->>'spokenReason', r->>'rawTranscript', r->>'confirmedTranscript')
    on conflict do nothing;
  end if;

  -- Level-Up / HOLD / deferred decisions: auditable with their input evidence id and rule versions.
  if new.attempt_type = 'NEW_PROGRESSION' and r->>'comprehensionScore' is not null then
    v_type := case v_event when 'LEVEL_UP' then 'LEVEL_UP' when 'LEVEL_UP_DEFERRED_BY_LENGTH_STEP' then 'LEVEL_UP_DEFERRED' when 'HOLD_AFTER_FIVE' then 'HOLD' else null end;
    if v_type is not null then
      insert into sr_progression_decision(learner_id, decision_id, decision_type, reason_code, input_evidence_ids, wpm_before, wpm_after, rule_versions, decided_at)
      values (new.learner_id, new.attempt_id, v_type, v_event, array[new.attempt_id],
              (r->'levelUpBefore'->>'wpm')::integer, (r->'levelUpAfter'->>'wpm')::integer, r->'ruleVersions', (r->>'recordedAt')::timestamptz)
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists sr_attempt_evidence on sr_attempt;
create trigger sr_attempt_evidence after insert on sr_attempt
  for each row execute function sr_project_attempt_evidence();

-- Per learner state: familiar practice and News Reader live in their own tables (separate evidence namespaces).
create or replace function sr_project_state_domains() returns trigger language plpgsql as $$
begin
  insert into sr_practice_event(learner_id, attempt_id, passage_id, served_wpm, selected_by, recorded_at)
  select new.learner_id, p->>'attemptId', p->>'passageId', (p->>'wpm')::integer, 'SCHEDULER', (p->>'recordedAt')::timestamptz
    from jsonb_array_elements(coalesce(new.state->'practiceLog', '[]'::jsonb)) p
  on conflict do nothing;

  insert into sr_news_reader_attempt(learner_id, attempt_id, passage_id, read_number, metrics, microphone_available, recorded_at)
  select new.learner_id, a->>'attemptId', a->>'passageId', (a->>'readNumber')::integer, a->'metrics',
         coalesce(a->>'technicalState', 'OK') <> 'MIC_UNAVAILABLE', (a->>'recordedAt')::timestamptz
    from jsonb_array_elements(coalesce(new.state->'newsReader'->'attempts', '[]'::jsonb)) a
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists sr_learner_state_domains on sr_learner_state;
create trigger sr_learner_state_domains after insert or update of state on sr_learner_state
  for each row execute function sr_project_state_domains();
