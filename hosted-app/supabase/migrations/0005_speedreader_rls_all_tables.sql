-- 0005: server-only access boundary for every SpeedReader runtime/evidence table (issue #19).
-- RLS is enabled with no client policies, so anon/authenticated reach nothing; the service role (server path)
-- bypasses RLS. V3 stays server-mediated. Idempotent: enabling RLS twice is a no-op.
alter table sr_structured_response   enable row level security;
alter table sr_spoken_evidence       enable row level security;
alter table sr_progression_decision  enable row level security;
alter table sr_practice_event        enable row level security;
alter table sr_news_reader_attempt   enable row level security;
alter table sr_readiness_stream      enable row level security;
alter table sr_readiness_attempt     enable row level security;
alter table sr_calibration_version   enable row level security;
alter table sr_content_package       enable row level security;
