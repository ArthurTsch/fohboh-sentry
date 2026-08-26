export type BankCatalogEntry = {
  formatKey: string;
  key: string;
  name: string;
  supported: boolean;
};

const BANKS: BankCatalogEntry[] = [
  {
    formatKey: "prosperity-bank-statement-v1",
    key: "prosperity",
    name: "Prosperity Bank",
    supported: true,
  },
];

export const DEFAULT_BANK_KEY = "prosperity";

export function getBankCatalog() {
  return BANKS;
}

export function resolveBankCatalogEntry(value?: string | null) {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") || DEFAULT_BANK_KEY;
  return BANKS.find((bank) => bank.key === normalized || bank.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalized) ?? null;
}
