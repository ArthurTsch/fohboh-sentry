import { createHash } from "crypto";
import type { ContractField, PosSchemaGovernance, SchemaField, SchemaWorkspace } from "@/components/sentry/types";

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
    .update(stableStringify(payload))
    .digest("hex");
}

export function toContractManualValues(workspace: SchemaWorkspace) {
  if (workspace.module === "M01") {
    const pricingModel = findContractValue(workspace.contract, "Pricing Model");
    const markup = findContractValue(workspace.contract, ["Processor Markup", "Processor Markup (basis pts)"]);
    const txnFee = findContractValue(workspace.contract, ["Per Transaction Fee", "Per-Transaction Fee", "Per Transaction Fee ($)"]);
    const monthlyFee = findContractValue(workspace.contract, ["Monthly Statement Fee", "Monthly Statement Fee ($)", "Monthly Fee"]);
    const chargebackFee = findContractValue(workspace.contract, ["Chargeback Fee", "Chargeback Fee ($)"]);
    const effectiveDate = findContractValue(workspace.contract, ["Effective Date", "Contract Effective Date"]);

    return {
      __entry_mode: "manual",
      chargeback_fee: extractCurrency(chargebackFee),
      contract_type: pricingModel,
      effective_date: effectiveDate,
      markup_bps: extractNumber(markup),
      monthly_fee: extractCurrency(monthlyFee),
      pricing_model: pricingModel,
      processor_name: workspace.vendor,
      txn_fee: extractCurrency(txnFee),
    };
  }

  const commissionBase = findContractValue(workspace.contract, "Commission Base");
  const deliveryRate = extractNumber(
    findContractValue(workspace.contract, ["Delivery Commission Rate (%)", "Commission Rate"]),
  );
  const pickupRate = extractNumber(
    findContractValue(workspace.contract, ["Pickup / Carryout Rate (%)", "Commission Rate"]),
  );
  const memberRate = extractNumber(
    findContractValue(workspace.contract, ["Member / DashPass Rate (%)", "Commission Rate"]),
  );
  const cateringRate = extractNumber(
    findContractValue(workspace.contract, ["Catering / Group Orders Rate (%)", "Commission Rate"]),
  );
  const sponsoredRate = extractNumber(
    findContractValue(workspace.contract, ["In-App Sponsored Listing Rate (%)", "Commission Rate"]),
  );
  const effectiveDate = findContractValue(workspace.contract, "Effective Date");
  const storeId = findContractValue(workspace.contract, "Restaurant UUID");

  return {
    __entry_mode: "manual",
    commission_base: commissionBase,
    delivery_active: "true",
    effective_date: effectiveDate,
    rate_catering: cateringRate,
    rate_delivery: deliveryRate,
    rate_member: memberRate,
    rate_pickup: pickupRate,
    rate_sponsored: sponsoredRate,
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
    posSchema: workspace.posSchema ?? createEmptyPosSchemaGovernance(),
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
  const rawContract = Array.isArray(contractPayload?.contract) ? (contractPayload.contract as ContractField[]) : null;
  const contract = rawContract && module === "M02" ? normalizeM02ContractFields(rawContract) : rawContract;
  const posSchema = normalizePosSchemaGovernance(schemaPayload?.posSchema);

  if (!fields || !contract) {
    return null;
  }

  const latestVersion = Math.max(schemaRecord?.version ?? 0, contractRecord?.version ?? 0);
  const hash = contractRecord?.sha256 ?? schemaRecord?.sha256 ?? "pending";
  const sealedAt = contractRecord?.sealed_at ?? schemaRecord?.sealed_at;
  const status = normalizeWorkspaceStatus(contractRecord?.status ?? schemaRecord?.status ?? "draft");

  return {
    account,
    accountId,
    contract,
    fields,
    locationId,
    locationName,
    module,
    posSchema,
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

function normalizeM02ContractFields(contract: ContractField[]) {
  const hasDeliveryRate = contract.some((field) => field.label === "Delivery Commission Rate (%)");
  const hasPickupRate = contract.some((field) => field.label === "Pickup / Carryout Rate (%)");
  const legacyRate = contract.find((field) => field.label === "Commission Rate");
  if ((!legacyRate || (hasDeliveryRate && hasPickupRate))) return contract;

  const normalized: ContractField[] = [];
  for (const field of contract) {
    if (field.label !== "Commission Rate") {
      normalized.push(field);
      continue;
    }
    if (!hasDeliveryRate) {
      normalized.push({ ...field, label: "Delivery Commission Rate (%)" });
    }
    if (!hasPickupRate) {
      normalized.push({ ...field, label: "Pickup / Carryout Rate (%)" });
    }
  }
  return normalized;
}

function findContractValue(contract: ContractField[], labels: string | string[]) {
  const candidates = Array.isArray(labels) ? labels : [labels];
  for (const label of candidates) {
    const value = contract.find((field) => field.label === label)?.value?.trim();
    if (value) {
      return value;
    }
  }
  return "";
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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function normalizeHeaderBindings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const source = extractObject(entry);
      if (!source) return null;
      const appField = typeof source.appField === "string" ? source.appField.trim() : "";
      const sourceHeader = typeof source.sourceHeader === "string" ? source.sourceHeader.trim() : "";
      if (!appField || !sourceHeader) return null;
      return {
        appField,
        sourceHeader,
      };
    })
    .filter(Boolean) as NonNullable<PosSchemaGovernance["headerBindings"]>;
}

function normalizePosSchemaGovernance(value: unknown): PosSchemaGovernance {
  const source = extractObject(value);

  return {
    extractedAt:
      source && typeof source.extractedAt === "string" && source.extractedAt.trim().length > 0
        ? source.extractedAt
        : undefined,
    extractedHeaders: normalizeStringArray(source?.extractedHeaders),
    headerBindings: normalizeHeaderBindings(source?.headerBindings),
    manualHeaders: normalizeStringArray(source?.manualHeaders),
    sourceFileName:
      source && typeof source.sourceFileName === "string" && source.sourceFileName.trim().length > 0
        ? source.sourceFileName
        : undefined,
    status:
      source?.status === "validated" || source?.status === "draft" || source?.status === "missing"
        ? source.status
        : "missing",
    validatedHeaders: normalizeStringArray(source?.validatedHeaders),
  };
}

function createEmptyPosSchemaGovernance(): PosSchemaGovernance {
  return {
    extractedHeaders: [],
    headerBindings: [],
    manualHeaders: [],
    status: "missing",
    validatedHeaders: [],
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function formatVaultDate(value: Date) {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function normalizeWorkspaceStatus(value: string | null | undefined): "draft" | "sealed" {
  return value === "sealed" || value === "seal" ? "sealed" : "draft";
}
