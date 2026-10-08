# Deterministic Role 8 — Final Assembler and Machine Validator

Role 8 is code, not an LLM.

## Inputs

Current QA-approved artifacts for Roles 1–6, deterministic Role 7 output, their exact hashes/certificates, canonical final schema and package-lock rules.

## Responsibilities

1. Assemble without adding educational semantics.
2. Serialize strict UTF-8 JSON.
3. Reject duplicate keys.
4. Validate with canonical JSON Schema using AJV (or the frozen approved validator implementation).
5. Validate all references/IDs.
6. Byte/semantic fidelity-check every upstream section against the approved source artifact.
7. Validate exact version/hash lock.
8. Require executable evidence for every mandatory check.
9. Atomically promote only after all checks pass.

A missing/unexecuted mandatory check is a FAIL, never PASS.
