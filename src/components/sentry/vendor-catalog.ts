export type VendorModuleId = "M01" | "M02";

export type VendorCatalogEntry = {
  base?: string;
  key: string;
  name: string;
  schema?: string;
};

const M01_VENDORS: VendorCatalogEntry[] = [
  { key: "heartland", name: "Heartland", schema: "v1.0", base: "trans_amount" },
  { key: "toast", name: "Toast", schema: "v1.0", base: "gross_amount" },
  { key: "square", name: "Square", schema: "v1.0", base: "amount" },
  { key: "worldpay", name: "Worldpay", schema: "v1.0", base: "txn_amount" },
  { key: "chase", name: "Chase Paymentech", schema: "v1.0", base: "transaction_amount" },
  { key: "other", name: "Other" },
];

const M02_VENDORS: VendorCatalogEntry[] = [
  { key: "doordash", name: "DoorDash", schema: "v1.0", base: "order_subtotal" },
  { key: "ubereats", name: "Uber Eats", schema: "v1.0", base: "platform_gross_sales" },
  { key: "grubhub", name: "Grubhub", schema: "v1.0", base: "restaurant_food_sales" },
  { key: "slice", name: "Slice", schema: "v1.0", base: "order_subtotal" },
  { key: "other", name: "Other" },
];

function normalizeVendorToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function getVendorCatalog(moduleId: VendorModuleId) {
  return moduleId === "M01" ? M01_VENDORS : M02_VENDORS;
}

export function resolveVendorCatalogEntry(moduleId: VendorModuleId, value: string) {
  const normalized = normalizeVendorToken(value);
  const catalog = getVendorCatalog(moduleId);

  return (
    catalog.find(
      (entry) =>
        entry.key === normalized || normalizeVendorToken(entry.name) === normalized,
    ) ?? null
  );
}

export function resolveVendorKey(moduleId: VendorModuleId, value: string) {
  return resolveVendorCatalogEntry(moduleId, value)?.key ?? normalizeVendorToken(value);
}

export function resolveVendorName(moduleId: VendorModuleId, value: string) {
  return resolveVendorCatalogEntry(moduleId, value)?.name ?? value.trim();
}

export function resolveVendorSelections(moduleId: VendorModuleId, values: string[]) {
  const unique = new Map<string, VendorCatalogEntry>();

  for (const value of values) {
    const entry = resolveVendorCatalogEntry(moduleId, value);
    if (entry) {
      unique.set(entry.key, entry);
      continue;
    }

    const fallbackKey = resolveVendorKey(moduleId, value);
    unique.set(fallbackKey, { key: fallbackKey, name: value.trim() || fallbackKey });
  }

  return [...unique.values()];
}
