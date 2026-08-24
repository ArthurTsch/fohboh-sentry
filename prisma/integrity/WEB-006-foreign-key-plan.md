# WEB-006 foreign-key integrity plan

## Policy

- `RESTRICT`: immutable governance, upload, certification, CAAR, citation, score, and billing-statement lineage. Parent deletion must be explicit and ordered.
- `CASCADE`: true owned rows only: restaurant state, CAAR artifacts, membership/invitation location joins, manager membership, and payment methods owned by a billing account.
- `SET NULL`: optional actor, reviewer, diagnostic CAAR, audit, support-agent, legacy-report, and supersession references. Historical rows remain readable after identity cleanup.

Account-string relationships target `customers.account_id`. The migration creates a minimal customer parent for canonical account IDs already used by account-scoped tables. Support `location_id` and legacy CAAR `location_id` remain unconstrained because they store legacy external identifiers, not `locations_v2.id`. JSON arrays (`cert_runs_v2.schema_registry_ids`, `cert_runs_v2.upload_ids`, and `system_health_events_v2.cert_run_ids`) cannot be represented as relational foreign keys; application validation remains required until those fields are normalized into join tables.

## Preflight and repair

Run `prisma/integrity/WEB-006-orphan-audit.sql` against a restored production-like database before deployment. Required certification/CAAR/governance orphan counts must be zero. Legacy restaurant-state and upload-location findings may proceed only when the documented external-ID mapping is unambiguous. The migration repairs only relationships where recovery is unambiguous:

- insert missing `customers` parents for existing non-empty account IDs;
- reassign normalized locations to the canonical account identified by legacy state;
- reconstruct missing inactive restaurant parents for preserved legacy workflow state;
- remap legacy upload restaurant IDs to unique normalized location IDs;
- null optional references whose parent no longer exists;
- delete orphaned membership/invitation location join rows.

It never deletes uploads, certifications, CAARs, citations, scores, or governance records. Constraint validation stops deployment if required lineage is orphaned.

## Deployment and recovery

1. Back up the target database and test restore access.
2. Run the orphan audit and archive its output.
3. Apply the migration before deploying dependent application code.
4. Run the audit again, integration tests, and deletion smoke tests.

Rollback requires a reviewed forward migration that drops the named `fk_*` constraints; do not edit an applied migration. Dropping constraints does not reverse safe parent backfills, `SET NULL` repairs, or orphan-join cleanup. Restore the pre-migration backup if those data repairs must be reversed exactly.
