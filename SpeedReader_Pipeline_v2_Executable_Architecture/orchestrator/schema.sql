PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS production_units (
  production_unit_id TEXT PRIMARY KEY,
  canonical_package_id TEXT NOT NULL,
  canonical_package_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  production_unit_id TEXT NOT NULL REFERENCES production_units(production_unit_id),
  role_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  state TEXT NOT NULL,
  path TEXT,
  content_hash TEXT,
  input_hashes_json TEXT NOT NULL DEFAULT '{}',
  creator_attempt_no INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  invalidated_at TEXT,
  invalidated_reason TEXT,
  UNIQUE(production_unit_id, role_id, version)
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id INTEGER PRIMARY KEY AUTOINCREMENT,
  production_unit_id TEXT NOT NULL REFERENCES production_units(production_unit_id),
  role_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK(job_type IN ('CREATOR','QA','DETERMINISTIC')),
  artifact_id TEXT,
  state TEXT NOT NULL,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  upstream_caused INTEGER NOT NULL DEFAULT 0,
  payload_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qa_certificates (
  certificate_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  qa_role_id TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK(verdict IN ('PASS','FAIL','BLOCKED_NOT_EXECUTED')),
  candidate_hash TEXT NOT NULL,
  certificate_hash TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS defects (
  defect_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  production_unit_id TEXT NOT NULL REFERENCES production_units(production_unit_id),
  detected_by_role TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  source_artifact_id TEXT,
  source_hash TEXT,
  violated_rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('BLOCKER','NON_BLOCKING')),
  expected TEXT,
  actual TEXT,
  evidence_locator TEXT,
  routing_state TEXT NOT NULL CHECK(routing_state IN ('PENDING','DELIVERED','ACKNOWLEDGED','CLOSED','ESCALATED')),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS artifact_dependencies (
  artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  upstream_role_id TEXT NOT NULL,
  upstream_artifact_id TEXT NOT NULL,
  upstream_hash TEXT NOT NULL,
  PRIMARY KEY(artifact_id, upstream_role_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state, job_type, role_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_unit_role_state ON artifacts(production_unit_id, role_id, state);
CREATE INDEX IF NOT EXISTS idx_defects_unit_state ON defects(production_unit_id, routing_state);
