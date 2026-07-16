import { createHash } from "crypto";
import { getExpectedHeaders, getExpectedKind, normalizeHeader } from "./definitions";
import { extractPdfDocument, extractPdfMetrics } from "./pdf";

type UploadMetrics = {
  basisAmount?: number;
  depositAmount?: number;
  feeAmount?: number;
  orderCount?: number;
  payoutAmount?: number;
  transactionCount?: number;
};

export type PersistedUploadValidation = {
  expectedColumns?: number;
  fields: boolean;
  fileName: string;
  hash: boolean;
  hashValue: string;
  matchedColumns?: number;
  matchPct?: number;
  metrics?: UploadMetrics;
  pageCount?: number;
  rows?: number;
  schema: boolean;
  sizeBytes: number;
  unmatchedHeaders?: string[];
  updatedAt: string;
  uploaded: boolean;
  vendorKey?: string;
  vendorName?: string;
  parseWarnings?: string[];
};

export async function validateUploadArtifact({
  artifactKey,
  buffer,
  contentType,
  expectedHeadersOverride,
  fileName,
  vendorKey,
  vendorName,
}: {
  artifactKey: string;
  buffer: Buffer;
  contentType: string;
  expectedHeadersOverride?: string[] | null;
  fileName: string;
  vendorKey?: string | null;
  vendorName?: string | null;
}): Promise<PersistedUploadValidation> {
  const expectedKind = getExpectedKind(artifactKey);
  const hashValue = createHash("sha256").update(buffer).digest("hex");
  const updatedAt = new Date().toISOString();
  const isPdfLike =
    contentType.includes("pdf") ||
    fileName.toLowerCase().endsWith(".pdf") ||
    buffer.subarray(0, 4).toString("utf8") === "%PDF";

  if (expectedKind === "pdf" || (expectedKind === "csv_or_pdf" && isPdfLike)) {
    const validPdf = isPdfLike;
    const extractedPdf = validPdf ? await extractPdfDocument(buffer) : null;
    const pageCount = extractedPdf?.pageCount ?? estimatePdfPageCount(buffer);
    const pdfText = extractedPdf?.text ?? "";
    const pdfExtraction = validPdf ? extractPdfMetrics(artifactKey, pdfText) : { warnings: [] };
    const metrics = pdfExtraction.metrics;
    const fields = validPdf && resolvePdfFieldReadiness(artifactKey, metrics);
    const parseWarnings = pdfExtraction.warnings.length > 0 ? pdfExtraction.warnings : undefined;

    return {
      fields,
      fileName,
      hash: true,
      hashValue,
      metrics,
      pageCount,
      schema: validPdf,
      sizeBytes: buffer.byteLength,
      updatedAt,
      uploaded: true,
      vendorKey: vendorKey ?? undefined,
      vendorName: vendorName ?? undefined,
      parseWarnings,
    };
  }

  const text = buffer.toString("utf8");
  const csvLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = (csvLines[0] ?? "")
    .split(",")
    .map((header) => normalizeHeader(header))
    .filter(Boolean);
  const rows = Math.max(csvLines.length - 1, 0);
  const dataRows = csvLines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
  const expectedHeaders =
    expectedHeadersOverride && expectedHeadersOverride.length > 0
      ? expectedHeadersOverride
      : getExpectedHeaders(artifactKey, vendorKey);
  const normalizedExpectedHeaders = expectedHeaders.map(normalizeHeader);
  const matchedColumns = normalizedExpectedHeaders.filter((header) => headers.includes(header));
  const unmatchedHeaders = normalizedExpectedHeaders.filter((header) => !headers.includes(header));
  const matchPct = normalizedExpectedHeaders.length
    ? Math.round((matchedColumns.length / normalizedExpectedHeaders.length) * 100)
    : headers.length > 0
      ? 100
      : 0;
  const schema = headers.length > 0 && (normalizedExpectedHeaders.length === 0 || matchPct >= 60);
  const fields = schema && rows > 0;

  return {
    expectedColumns: normalizedExpectedHeaders.length || undefined,
    fields,
    fileName,
    hash: true,
    hashValue,
    matchedColumns: matchedColumns.length || undefined,
    matchPct,
    metrics: extractUploadMetrics(artifactKey, headers, dataRows),
    rows,
    schema,
    sizeBytes: buffer.byteLength,
    unmatchedHeaders: unmatchedHeaders.length > 0 ? unmatchedHeaders : undefined,
    updatedAt,
    uploaded: true,
    vendorKey: vendorKey ?? undefined,
    vendorName: vendorName ?? undefined,
  };
}

function resolvePdfFieldReadiness(
  artifactKey: string,
  metrics:
    | {
        basisAmount?: number;
        depositAmount?: number;
        feeAmount?: number;
        orderCount?: number;
        payoutAmount?: number;
        transactionCount?: number;
      }
    | undefined,
) {
  if (artifactKey.includes("agreement")) {
    return true;
  }

  if (artifactKey.includes("bank")) {
    return Boolean(metrics?.depositAmount && metrics.depositAmount > 0);
  }

  if (artifactKey.includes("processor")) {
    return Boolean(
      (metrics?.basisAmount && metrics.basisAmount > 0) ||
        (metrics?.payoutAmount && metrics.payoutAmount > 0),
    );
  }

  return true;
}

function estimatePdfPageCount(buffer: Buffer) {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length || 1;
}

function extractUploadMetrics(artifactKey: string, headers: string[], rows: string[][]): UploadMetrics {
  const metrics: Required<UploadMetrics> = {
    basisAmount: 0,
    depositAmount: 0,
    feeAmount: 0,
    orderCount: 0,
    payoutAmount: 0,
    transactionCount: 0,
  };

  for (const row of rows) {
    const valueFor = (...names: string[]) =>
      names
        .map((name) => headers.indexOf(normalizeHeader(name)))
        .find((index) => index >= 0) ?? -1;

    const read = (...names: string[]) => {
      const index = valueFor(...names);
      return index >= 0 ? parseNumber(row[index]) : 0;
    };

    metrics.basisAmount += read(
      "trans_amount",
      "gross_amount",
      "amount",
      "txn_amount",
      "transaction_amount",
      "platform_gross_sales",
      "order_subtotal",
      "restaurant_food_sales",
      "gross_sales",
      "channel_sales",
      "pos_merchant_sales",
      "pos_net_sales",
    );
    metrics.feeAmount += read(
      "fee_amount",
      "processing_fees",
      "fee",
      "disc_amount",
      "interchange_fee",
      "commission_charged",
      "dd_commission_amount",
      "grubhub_commission",
      "slice_commission",
      "transaction_fees",
      "commission_variance",
    );
    metrics.payoutAmount += read(
      "payout_amount",
      "net_payout",
      "platform_net_sales",
      "bank_deposit_amount",
    );
    metrics.depositAmount += read(
      "bank_deposit_amount",
      "total_dsp_deposits",
      "deposit_amount",
      "net_payout",
      "payout_amount",
    );
  }

  metrics.transactionCount =
    round(sumColumn(headers, rows, ["transaction_count"])) || rows.length;
  metrics.orderCount = round(sumColumn(headers, rows, ["order_count", "menu_item_count"])) || rows.length;

  if (artifactKey.includes("bank")) {
    metrics.basisAmount = 0;
    metrics.feeAmount = 0;
    metrics.payoutAmount = metrics.depositAmount;
  }

  if (artifactKey.includes("pos")) {
    metrics.payoutAmount = 0;
    metrics.depositAmount = 0;
  }

  return metrics;
}

function sumColumn(headers: string[], rows: string[][], names: string[]) {
  const normalizedNames = names.map(normalizeHeader);
  const index = headers.findIndex((header) => normalizedNames.includes(header));
  if (index === -1) return 0;
  return rows.reduce((sum, row) => sum + parseNumber(row[index]), 0);
}

function parseNumber(value: string | number | undefined | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number) {
  return Math.round(value);
}
