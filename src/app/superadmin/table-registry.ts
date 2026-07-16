import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

export const SUPERADMIN_TABLES = [
  { name: "managers", label: "Managers", description: "Login-capable manager and superadmin accounts.", allowDelete: true },
  { name: "account_memberships_v2", label: "Account Memberships", description: "Shared-account team roster with team role, status, and access scope.", allowDelete: true },
  { name: "account_member_locations_v2", label: "Member Location Access", description: "Per-member location assignments for selected-location team access.", allowDelete: true },
  { name: "team_invitations_v2", label: "Team Invitations", description: "Pending and cancelled teammate invites before acceptance is implemented.", allowDelete: true },
  { name: "team_invitation_locations_v2", label: "Invite Location Access", description: "Per-invite location assignments for scoped pending invites.", allowDelete: true },
  { name: "restaurants", label: "Restaurants", description: "Restaurant/location records used by Sentry.", allowDelete: true },
  { name: "restaurant_sentry_state", label: "Restaurant Sentry State", description: "Per-location workflow state, Trust Scores, and onboarding persistence.", allowDelete: true },
  { name: "caar_reports", label: "CAAR Reports", description: "Persisted CAAR summaries rendered in the application UI.", allowDelete: true },
  { name: "customers", label: "Customers", description: "Normalized customer accounts used by activity log and location sync.", allowDelete: true },
  { name: "locations_v2", label: "Locations v2", description: "Normalized persisted locations created from restaurant records.", allowDelete: true },
  { name: "contract_configs_v2", label: "Contract Configs", description: "Sealed contract configurations per module and vendor.", allowDelete: true },
  { name: "schema_registry_v2", label: "Schema Registry", description: "Sealed schema registry workspaces per location.", allowDelete: true },
  { name: "uploads_v2", label: "Uploads", description: "Uploaded source artifacts and validation metadata.", allowDelete: true },
  { name: "cert_runs_v2", label: "Certification Runs", description: "Deterministic persisted certification runs.", allowDelete: true },
  { name: "caars_v2", label: "CAARs v2", description: "Canonical sealed CAAR records and exportpack references.", allowDelete: true },
  { name: "caar_artifacts_v2", label: "CAAR Artifacts", description: "Persisted exhibits and derived CAAR artifacts.", allowDelete: true },
  { name: "rule_citations_v2", label: "Rule Citations", description: "Rule-level findings produced during certification.", allowDelete: true },
  { name: "mq6_scores_v2", label: "MQ6 Scores", description: "Dimension-level Trust Score evidence per run.", allowDelete: true },
  { name: "loop_b_findings_v2", label: "Loop B Findings", description: "Persisted historical pattern-analysis findings promoted from the 13-week Loop B window.", allowDelete: true },
  { name: "system_health_events_v2", label: "System Health Events", description: "Persisted R186-R198 self-diagnostic and certification-period health events.", allowDelete: true },
  { name: "billing_accounts_v2", label: "Billing Accounts", description: "Account-level subscription and CAAR transaction fee configuration.", allowDelete: true },
  { name: "payment_methods_v2", label: "Payment Methods", description: "Future tokenized card and ACH method references for account billing.", allowDelete: true },
  { name: "billing_statements_v2", label: "Billing Statements", description: "Monthly billing statements for subscription and certified CAAR transaction fees.", allowDelete: true },
  { name: "audit_log_v2", label: "Audit Log", description: "Immutable operational audit trail.", allowDelete: true },
  { name: "support_tickets_v2", label: "Support Tickets", description: "Persisted support tickets created from the support workflows.", allowDelete: true },
  { name: "access_requests_v2", label: "Access Requests", description: "Persisted request-access submissions and review status.", allowDelete: true },
] as const;

export type SuperAdminTableName = (typeof SUPERADMIN_TABLES)[number]["name"];

type ColumnInfo = {
  column_name: string;
  data_type: string;
};

type CountRow = {
  count: bigint | number;
};

function assertTableName(tableName: string): asserts tableName is SuperAdminTableName {
  if (!SUPERADMIN_TABLES.some((table) => table.name === tableName)) {
    throw new Error(`Unsupported superadmin table: ${tableName}`);
  }
}

export function getSuperAdminTableDefinition(tableName?: string | null) {
  return SUPERADMIN_TABLES.find((table) => table.name === tableName) ?? SUPERADMIN_TABLES[0];
}

export async function listSuperAdminTableCounts() {
  return Promise.all(
    SUPERADMIN_TABLES.map(async (table) => {
      try {
        const rows = await prisma.$queryRawUnsafe<CountRow[]>(
          `SELECT COUNT(*)::bigint AS count FROM public.${table.name}`,
        );

        return {
          ...table,
          count: Number(rows[0]?.count ?? 0),
          available: true,
        };
      } catch {
        return {
          ...table,
          count: 0,
          available: false,
        };
      }
    }),
  );
}

export async function getSuperAdminTableColumns(tableName: string) {
  assertTableName(tableName);

  return prisma.$queryRaw<ColumnInfo[]>(Prisma.sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `);
}

function pickOrderColumn(columns: ColumnInfo[]) {
  const available = new Set(columns.map((column) => column.column_name));
  if (available.has("updated_at")) return "updated_at";
  if (available.has("created_at")) return "created_at";
  if (available.has("sealed_at")) return "sealed_at";
  if (available.has("uploaded_at")) return "uploaded_at";
  if (available.has("id")) return "id";
  return columns[0]?.column_name ?? "id";
}

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export async function getSuperAdminTableRows(tableName: string, limit = 100) {
  assertTableName(tableName);

  const columns = await getSuperAdminTableColumns(tableName);
  if (!columns.length) {
    return [];
  }

  const orderColumn = pickOrderColumn(columns);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM public.${tableName} ORDER BY ${orderColumn} DESC NULLS LAST LIMIT ${Math.max(
      1,
      Math.min(limit, 250),
    )}`,
  );

  return rows.map((row, index) => ({
    __rowKey:
      normalizeCellValue(row.id) ||
      normalizeCellValue(row.external_id) ||
      normalizeCellValue(row.caar_id) ||
      normalizeCellValue(row.caar_external_id) ||
      `${tableName}-${index}`,
    ...row,
  }));
}

export async function getSuperAdminTableSnapshot(tableName?: string | null) {
  const definition = getSuperAdminTableDefinition(tableName);
  const columns = await getSuperAdminTableColumns(definition.name);
  const rows = await getSuperAdminTableRows(definition.name);
  const hasNumericId = columns.some(
    (column) =>
      column.column_name === "id" &&
      ["integer", "bigint", "smallint"].includes(column.data_type),
  );

  return {
    columns,
    definition,
    hasNumericId,
    missingTable: columns.length === 0,
    rows,
  };
}

export function normalizeSuperAdminValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  const stringValue = String(value);
  return stringValue.length ? stringValue : "—";
}
