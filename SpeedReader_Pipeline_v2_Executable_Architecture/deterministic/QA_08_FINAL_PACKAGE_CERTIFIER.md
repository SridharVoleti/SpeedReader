# Deterministic QA 8 — Final Package Independent Certifier

QA08 is the independent final certification gate for the immutable Role 8 `FINAL_PASSAGE_PACKAGE` candidate.

QA08 does not assemble, repair, rewrite or normalize package content.

## Inputs

- Exact final package bytes/hash from R08 WIP output.
- Canonical package ID/version/hash.
- QA-approved R01–R06 artifacts and exact hashes/certificates.
- Deterministic R07 executable/result/version evidence.
- Canonical final JSON schema and package-lock rules.
- Machine validation report for all mandatory structural checks.

## Mandatory checks

1. Final package hash identifies the exact bytes under review.
2. Every embedded/linked R01–R07 artifact matches the exact QA-approved source hash.
3. Every upstream QA certificate is bound to the exact artifact hash it approved.
4. No stale or superseded upstream artifact is present.
5. Canonical package/version/hash identity is valid and complete.
6. Strict UTF-8 JSON parses without duplicate keys.
7. Canonical JSON Schema validation passes.
8. All IDs, references and referential-integrity checks pass.
9. Registry coordinate, delivery-session and COUNT-100/token-position invariants pass.
10. Final package introduces no educational semantics absent from approved upstream artifacts.
11. Required acceptance-criteria machine tests have executable evidence.
12. Boundary/edge-case suite evidence required by the canonical gate is present and green.
13. Zero unresolved BLOCKER defects or canonical contradictions remain.
14. No missing/unexecuted mandatory check is represented as PASS.
15. Promotion target is the exact package hash reviewed by QA08.

## Applicable acceptance focus

At minimum: AC-01–AC-03 and AC-57–AC-59, plus every package-level schema/hash/referential requirement inherited from earlier gates.

## Result

- `QA_PASS`: every mandatory check executed and green for the exact package hash.
- `QA_FAIL`: any package, provenance, schema, fidelity or validation blocker exists.
- `QA_BLOCKED_NOT_EXECUTED`: a mandatory artifact/check/canonical authority is unavailable.

## Promotion rule

QA08 itself never promotes files. Only the orchestrator may atomically move the exact QA08-passed package from WIP to APPROVED. Any byte change after QA08 invalidates the certificate and requires fresh QA08 certification.

A missing check is a failure to certify, never a PASS.