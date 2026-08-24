import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";

const runId = Date.now();
let customerId = 0;
let lineageLocationId = 0;
let lineageManagerId = 0;
let contractId = 0;
let certRunId = 0;

describe("WEB-006 database foreign-key integrity", () => {
  beforeAll(async () => {
    const manager = await prisma.managers.create({
      data: {
        email: `fk-lineage-${runId}@test.invalid`,
        password_hash: "test-only",
        role: "Manager",
      },
    });
    lineageManagerId = manager.id;
    const customer = await prisma.customers.create({
      data: { account_id: `test-fk-${runId}`, name: "TEST FK Customer" },
    });
    customerId = customer.id;
    const location = await prisma.locations_v2.create({
      data: { customer_id: customer.id, external_id: `TEST-FK-LOC-${runId}`, name: "TEST FK Location" },
    });
    lineageLocationId = location.id;
    const contract = await prisma.contract_configs_v2.create({
      data: {
        location_id: location.id,
        module: "M01",
        sealed_by: manager.id,
        sha256: "a".repeat(64),
        terms: {},
        vendor: "test",
        version: 1,
      },
    });
    contractId = contract.id;
    const certRun = await prisma.cert_runs_v2.create({
      data: {
        contract_config_id: contract.id,
        location_id: location.id,
        module: "M01",
        period: "2099-01",
        rule_set_version: "test",
        schema_registry_ids: [],
        triggered_by: manager.id,
        upload_ids: [],
      },
    });
    certRunId = certRun.id;
  });

  afterAll(async () => {
    await prisma.caar_artifacts_v2.deleteMany({ where: { caars_v2: { cert_run_id: certRunId } } }).catch(() => null);
    await prisma.caars_v2.deleteMany({ where: { cert_run_id: certRunId } }).catch(() => null);
    await prisma.rule_citations_v2.deleteMany({ where: { cert_run_id: certRunId } }).catch(() => null);
    await prisma.mq6_scores_v2.deleteMany({ where: { cert_run_id: certRunId } }).catch(() => null);
    await prisma.cert_runs_v2.deleteMany({ where: { id: certRunId } }).catch(() => null);
    await prisma.contract_configs_v2.deleteMany({ where: { id: contractId } }).catch(() => null);
    await prisma.locations_v2.deleteMany({ where: { id: lineageLocationId } }).catch(() => null);
    await prisma.customers.deleteMany({ where: { id: customerId } }).catch(() => null);
    await prisma.managers.deleteMany({ where: { id: lineageManagerId } }).catch(() => null);
    await prisma.$disconnect();
  });

  it("rejects a child row whose required parent does not exist", async () => {
    await expect(prisma.uploads_v2.create({
      data: {
        artifact_key: "test",
        byte_count: BigInt(1),
        file_name: "test.csv",
        file_purpose: "test",
        location_id: 2_147_483_000,
        module: "M01",
        s3_key: `test/fk/${runId}`,
        sha256: "b".repeat(64),
        uploaded_by: lineageManagerId,
      },
    })).rejects.toMatchObject({ code: "P2003" });
  });

  it("restricts deletion of immutable certification lineage parents", async () => {
    await expect(prisma.locations_v2.delete({ where: { id: lineageLocationId } }))
      .rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.contract_configs_v2.delete({ where: { id: contractId } }))
      .rejects.toMatchObject({ code: "P2003" });
  });

  it("cascades true owned CAAR artifacts", async () => {
    const caar = await prisma.caars_v2.create({
      data: {
        caar_external_id: `TEST-FK-CAAR-${runId}`,
        canonical_payload_s3_key: `test/fk/${runId}.json`,
        cert_run_id: certRunId,
        finding_class: "test",
        location_id: lineageLocationId,
        module: "M01",
        period: "2099-01",
        recoverable_variance_cents: BigInt(0),
        sha256: "c".repeat(64),
        status: "test",
        trust_score: 100,
      },
    });
    const artifact = await prisma.caar_artifacts_v2.create({
      data: {
        byte_count: BigInt(1),
        caar_id: caar.id,
        artifact_type: "test",
        name: "test.txt",
        s3_key: `test/fk/${runId}.txt`,
        seq: 1,
        sha256: "d".repeat(64),
      },
    });
    await prisma.caars_v2.delete({ where: { id: caar.id } });
    await expect(prisma.caar_artifacts_v2.findUnique({ where: { id: artifact.id } })).resolves.toBeNull();
  });

  it("cascades restaurant-owned state and location assignments", async () => {
    const member = await prisma.managers.create({
      data: { email: `fk-member-${runId}@test.invalid`, password_hash: "test-only", role: "Manager" },
    });
    const restaurant = await prisma.restaurants.create({
      data: { name: "TEST FK Restaurant", unit_id: `TEST-FK-REST-${runId}` },
    });
    const state = await prisma.restaurant_sentry_state.create({
      data: {
        account_id: `test-fk-${runId}`,
        location_id: `TEST-FK-REST-${runId}`,
        restaurant_id: restaurant.id,
      },
    });
    const membership = await prisma.account_memberships_v2.create({
      data: { account_id: `test-fk-${runId}`, manager_id: member.id, team_role: "Location Manager" },
    });
    const assignment = await prisma.account_member_locations_v2.create({
      data: { membership_id: membership.id, restaurant_id: restaurant.id },
    });

    await prisma.restaurants.delete({ where: { id: restaurant.id } });
    await expect(prisma.restaurant_sentry_state.findUnique({ where: { id: state.id } })).resolves.toBeNull();
    await expect(prisma.account_member_locations_v2.findUnique({ where: { id: assignment.id } })).resolves.toBeNull();
    await prisma.managers.delete({ where: { id: member.id } });
    await expect(prisma.account_memberships_v2.findUnique({ where: { id: membership.id } })).resolves.toBeNull();
  });

  it("preserves audit history while nulling a deleted actor", async () => {
    const actor = await prisma.managers.create({
      data: { email: `fk-actor-${runId}@test.invalid`, password_hash: "test-only", role: "Viewer" },
    });
    const audit = await prisma.audit_log_v2.create({
      data: {
        action: "test",
        actor_user_id: actor.id,
        entity_id: "test",
        entity_type: "test",
        summary: "TEST FK audit",
      },
    });
    await prisma.managers.delete({ where: { id: actor.id } });
    await expect(prisma.audit_log_v2.findUniqueOrThrow({ where: { id: audit.id } }))
      .resolves.toMatchObject({ actor_user_id: null });
    await prisma.audit_log_v2.delete({ where: { id: audit.id } });
  });
});
