#!/usr/bin/env python3
"""SpeedReader v2 local orchestration scaffold.

Standard library only. No model API. It stores state in SQLite and supports manual job-packet handoff.
"""
from __future__ import annotations
import argparse, sqlite3, json, hashlib, uuid
from pathlib import Path
from datetime import datetime, timezone

MAX_ATTEMPTS = 3
ROLE_DAG = {
    "1": ["2", "3", "8"],
    "2": ["3", "4", "5", "8"],
    "3": ["6", "8"],
    "4": ["5", "6", "8"],
    "5": ["8"],
    "6": ["7", "8"],
    "7": ["8"],
    "8": [],
}
LLM_ROLES = {"2", "3", "4", "5", "6S"}

def now(): return datetime.now(timezone.utc).isoformat()
def sha256_bytes(b: bytes): return hashlib.sha256(b).hexdigest()
def connect(db):
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con

def init_db(db: str, schema: str):
    Path(db).parent.mkdir(parents=True, exist_ok=True)
    con = connect(db)
    con.executescript(Path(schema).read_text(encoding="utf-8"))
    con.commit(); con.close()

def canonical_hash(manifest_path: str) -> str:
    data = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    missing = [a["path"] for a in data.get("artifacts",[]) if a.get("normative") and not a.get("present")]
    if missing:
        raise SystemExit("Canonical package incomplete; fail closed. Missing: " + ", ".join(missing))
    return sha256_bytes(json.dumps(data, sort_keys=True, separators=(",",":")).encode())

def register_unit(db, unit, canonical_id, canonical_hash_value):
    con=connect(db); t=now()
    con.execute("INSERT OR IGNORE INTO production_units VALUES (?,?,?,?,?,?)", (unit,canonical_id,canonical_hash_value,"ACTIVE",t,t))
    con.commit(); con.close()

def queue_job(db, unit, role, kind, attempt=1, artifact_id=None, upstream_caused=0):
    if kind in {"CREATOR","QA"} and role not in LLM_ROLES: raise SystemExit("LLM job role must be one of 2,3,4,5,6S")
    if attempt > MAX_ATTEMPTS and not upstream_caused:
        raise SystemExit("Retry cap exceeded; escalate human review")
    con=connect(db); t=now()
    cur=con.execute("INSERT INTO jobs(production_unit_id,role_id,job_type,artifact_id,state,attempt_no,upstream_caused,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)", (unit,role,kind,artifact_id,"READY",attempt,upstream_caused,t,t))
    jid=cur.lastrowid; con.commit(); con.close(); return jid

def next_job(db):
    con=connect(db)
    row=con.execute("SELECT * FROM jobs WHERE state='READY' ORDER BY job_id LIMIT 1").fetchone()
    con.close(); return dict(row) if row else None

def export_job(db, job_id, out):
    con=connect(db)
    job=con.execute("SELECT j.*, p.canonical_package_id, p.canonical_package_hash FROM jobs j JOIN production_units p USING(production_unit_id) WHERE job_id=?",(job_id,)).fetchone()
    if not job: raise SystemExit("job not found")
    packet={
      "job_id":job["job_id"],"production_unit_id":job["production_unit_id"],"role_id":job["role_id"],"job_type":job["job_type"],"attempt_no":job["attempt_no"],
      "canonical_package_id":job["canonical_package_id"],"canonical_package_hash":job["canonical_package_hash"],
      "applicable_acceptance_criteria_ids":[],"approved_upstream_artifacts":[],"candidate_artifact":None,"machine_check_evidence":[],"open_defect_context":[]
    }
    Path(out).parent.mkdir(parents=True,exist_ok=True); Path(out).write_text(json.dumps(packet,indent=2),encoding="utf-8")
    con.execute("UPDATE jobs SET state='RUNNING',payload_path=?,updated_at=? WHERE job_id=?",(str(out),now(),job_id)); con.commit(); con.close()

def descendants(role: str):
    role = "6" if role == "6S" else role
    seen=set(); stack=[role]
    while stack:
        x=stack.pop()
        for y in ROLE_DAG.get(x,[]):
            if y not in seen: seen.add(y); stack.append(y)
    return sorted(seen, key=lambda x:int(x))

def defect_fingerprint(d):
    raw="|".join(str(d.get(k,"")) for k in ["production_unit_id","owner_role","source_hash","violated_rule_id","actual"])
    return hashlib.sha256(raw.encode()).hexdigest()

def route_defect(con, d):
    fp=defect_fingerprint(d); t=now(); did=d.get("defect_id") or "D-"+fp[:16]
    existing=con.execute("SELECT * FROM defects WHERE fingerprint=? AND routing_state!='CLOSED'",(fp,)).fetchone()
    if existing:
        count=existing["occurrence_count"]+1
        state="ESCALATED" if count>=2 else existing["routing_state"]
        con.execute("UPDATE defects SET occurrence_count=?,routing_state=?,updated_at=? WHERE defect_id=?",(count,state,t,existing["defect_id"]))
        return existing["defect_id"], state
    con.execute("INSERT INTO defects(defect_id,fingerprint,production_unit_id,detected_by_role,owner_role,source_artifact_id,source_hash,violated_rule_id,severity,expected,actual,evidence_locator,routing_state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
       (did,fp,d["production_unit_id"],d.get("detected_by_role","?"),d.get("owner_role","CANONICAL_OWNER"),d.get("source_artifact_id"),d.get("source_hash"),d.get("violated_rule_id","UNSPECIFIED"),d.get("severity","BLOCKER"),d.get("expected"),d.get("actual"),d.get("evidence_locator"),"DELIVERED",t,t))
    return did,"DELIVERED"

def invalidate_descendants(con, unit, owner_role, reason):
    for r in descendants(owner_role):
        con.execute("UPDATE artifacts SET state='INVALIDATED',invalidated_at=?,invalidated_reason=? WHERE production_unit_id=? AND role_id IN (?,?) AND state='APPROVED'", (now(),reason,unit,r, "6S" if r=="6" else r))

def import_result(db, job_id, result_path):
    result=json.loads(Path(result_path).read_text(encoding="utf-8")); con=connect(db); t=now()
    job=con.execute("SELECT * FROM jobs WHERE job_id=?",(job_id,)).fetchone()
    if not job: raise SystemExit("job not found")
    if str(result.get("job_id")) != str(job_id): raise SystemExit("result job_id mismatch")
    state=result.get("state")
    if state in {"BLOCKED_UPSTREAM","BLOCKED_CANONICAL","ESCALATED","QA_FAIL"}:
        for d in result.get("blocking_defects",[]):
            d.setdefault("production_unit_id",job["production_unit_id"]); d.setdefault("detected_by_role",job["role_id"])
            did,route_state=route_defect(con,d)
            if d.get("severity","BLOCKER")=="BLOCKER": invalidate_descendants(con,job["production_unit_id"],d.get("owner_role",job["role_id"]),f"defect {did}")
        newstate="ESCALATED_HUMAN_REVIEW" if state=="ESCALATED" else "DONE"
    else: newstate="DONE"
    con.execute("UPDATE jobs SET state=?,updated_at=? WHERE job_id=?",(newstate,t,job_id)); con.commit(); con.close()

def list_rows(db, table):
    if table not in {"jobs","defects","artifacts","production_units","qa_certificates"}: raise SystemExit("bad table")
    con=connect(db); rows=[dict(r) for r in con.execute(f"SELECT * FROM {table} ORDER BY rowid DESC LIMIT 100")]; con.close(); print(json.dumps(rows,indent=2))

def main():
    ap=argparse.ArgumentParser(description="SpeedReader v2 local orchestrator — no model API")
    ap.add_argument("--db",default="speedreader.db")
    sp=ap.add_subparsers(dest="cmd",required=True)
    p=sp.add_parser("init"); p.add_argument("--schema",default=str(Path(__file__).with_name("schema.sql")))
    p=sp.add_parser("register-unit"); p.add_argument("--unit",required=True); p.add_argument("--canonical-id",required=True); p.add_argument("--canonical-hash",required=True)
    p=sp.add_parser("queue"); p.add_argument("--unit",required=True); p.add_argument("--role",required=True); p.add_argument("--kind",choices=["CREATOR","QA","DETERMINISTIC"],required=True); p.add_argument("--attempt",type=int,default=1); p.add_argument("--artifact-id"); p.add_argument("--upstream-caused",action="store_true")
    sp.add_parser("next")
    p=sp.add_parser("export-job"); p.add_argument("--job",type=int,required=True); p.add_argument("--out",required=True)
    p=sp.add_parser("import-result"); p.add_argument("--job",type=int,required=True); p.add_argument("--file",required=True)
    p=sp.add_parser("list"); p.add_argument("table",choices=["jobs","defects","artifacts","production_units","qa_certificates"])
    args=ap.parse_args()
    if args.cmd=="init": init_db(args.db,args.schema)
    elif args.cmd=="register-unit": register_unit(args.db,args.unit,args.canonical_id,args.canonical_hash)
    elif args.cmd=="queue": print(queue_job(args.db,args.unit,args.role,args.kind,args.attempt,args.artifact_id,int(args.upstream_caused)))
    elif args.cmd=="next": print(json.dumps(next_job(args.db),indent=2))
    elif args.cmd=="export-job": export_job(args.db,args.job,args.out)
    elif args.cmd=="import-result": import_result(args.db,args.job,args.file)
    elif args.cmd=="list": list_rows(args.db,args.table)

if __name__=="__main__": main()
