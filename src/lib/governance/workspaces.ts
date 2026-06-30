import { createHash } from "crypto";
import type { ContractField, SchemaField, SchemaWorkspace } from "@/components/sentry/types";

type SchemaRecordShape = {
  fields: unknown;
  sealed_at: Date | null;
  sha256: string;
  status?: string | null;
  version: number;
};

type ContractRecordShape = {
  sealed_at: Date | null;
  sha256: string;
  status?: string | null;
  terms: unknown;
  version: number;
};

export function computeWorkspaceHash(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function toContractManualValues(workspace: SchemaWorkspace) {
  if (workspace.module === "M01") {
    const pricingModel = findContractValue(workspace.contract, "Pricing Model");
    const markup = findContractValue(workspace.contract, "Processor Markup");
    const txnFee = findContractValue(workspace.contract, "Per Transaction Fee");
    const effectiveDate = findContractValue(workspace.contract, "Effective Date");

    return {
      __entry_mode: "manual",
      contract_type: pricingModel,
      effective_date: effectiveDate,
      markup_bps: extractNumber(markup),
      pricing_model: pricingModel,
      processor_name: workspace.vendor,
      txn_fee: extractCurrency(txnFee),
    };
  }

  const commissionBase = findContractValue(workspace.contract, "Commission Base");
  const commissionRate = extractNumber(findContractValue(workspace.contract, "Commission Rate"));
  const effectiveDate = findContractValue(workspace.contract, "Effective Date");
  const storeId = findContractValue(workspace.contract, "Restaurant UUID");

  return {
    __entry_mode: "manual",
    commission_base: commissionBase,
    delivery_active: "true",
    effective_date: effectiveDate,
    rate_catering: commissionRate,
    rate_delivery: commissionRate,
    rate_member: commissionRate,
    rate_pickup: commissionRate,
    rate_sponsored: commissionRate,
    store_id: storeId,
  };
}

export function workspaceToSchemaPayload(workspace: SchemaWorkspace) {
  return {
    account: workspace.account,
    accountId: workspace.accountId,
    fields: workspace.fields,
    locationId: workspace.locationId ?? null,
    locationName: workspace.locationName ?? null,
    status: workspace.status ?? "draft",
  };
}

export function workspaceToContractPayload(workspace: SchemaWorkspace) {
  return {
    account: workspace.account,
    accountId: workspace.accountId,
    contract: workspace.contract,
    locationId: workspace.locationId ?? null,
    locationName: workspace.locationName ?? null,
    manualValues: toContractManualValues(workspace),
    status: workspace.status ?? "draft",
  };
}

export function normalizeWorkspaceFromRecords({
  account,
  accountId,
  contractRecord,
  locationId,
  locationName,
  module,
  schemaRecord,
  vendor,
}: {
  account: string;
  accountId: string;
  contractRecord?: ContractRecordShape | null;
  locationId: string;
  locationName: string;
  module: "M01" | "M02";
  schemaRecord?: SchemaRecordShape | null;
  vendor: string;
}): SchemaWorkspace | null {
  const schemaPayload = extractObject(schemaRecord?.fields);
  const contractPayload = extractObject(contractRecord?.terms);
  const fields = Array.isArray(schemaPayload?.fields) ? (schemaPayload.fields as SchemaField[]) : null;
  const contract = Array.isArray(contractPayload?.contract) ? (contractPayload.contract as ContractField[]) : null;

  if (!fields || !contract) {
    return null;
  }

  const latestVersion = Math.max(schemaRecord?.version ?? 0, contractRecord?.version ?? 0);
  const hash = contractRecord?.sha256 ?? schemaRecord?.sha256 ?? "pending";
  const sealedAt = contractRecord?.sealed_at ?? schemaRecord?.sealed_at;
  const status = (contractRecord?.status ?? schemaRecord?.status ?? "draft") as "draft" | "sealed";

  return {
    account,
    accountId,
    contract,
    fields,
    locationId,
    locationName,
    module,
    status,
    vendor,
    vault: {
      hash: hash ? `sha256:${hash.slice(0, 12)}` : "pending",
      sealedAt: sealedAt ? formatVaultDate(sealedAt) : "Pending",
      sealedBy:
        typeof contractPayload?.sealedBy === "string"
          ? contractPayload.sealedBy
          : typeof schemaPayload?.sealedBy === "string"
            ? schemaPayload.sealedBy
            : "system",
      state: status,
      version: `${module.toLowerCase()}-v${String(latestVersion).padStart(2, "0")}`,
    },
  };
}

function findContractValue(contract: ContractField[], label: string) {
  return contract.find((field) => field.label === label)?.value?.trim() ?? "";
}

function extractNumber(value: string) {
  return value.replace(/[^0-9.-]/g, "");
}

function extractCurrency(value: string) {
  return value.replace(/[^0-9.-]/g, "");
}

function extractObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function formatVaultDate(value: Date) {
  return value.toISOString().slice(0, 16).replace("T", " ");
}
