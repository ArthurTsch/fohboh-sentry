import { createHash } from "crypto";
import { getExpectedHeaders, getExpectedKind, normalizeHeader } from "./definitions";
import { extractPdfDocument, extractPdfMetrics } from "./pdf";

type UploadMetrics = {
  adjustmentAmount?: number;
  basisAmount?: number;
  chargebackCount?: number;
  commissionRateAppliedAvg?: number;
  depositAmount?: number;
  depositReferenceRows?: UploadReferenceRow[];
  deliveryFeeAmount?: number;
  deliveryOrderCount?: number;
  duplicateOrderCount?: number;
  duplicateTransactionCount?: number;
  errorChargeAmount?: number;
  feeAmount?: number;
  interchangeFeeAmount?: number;
  marketingFeeAmount?: number;
  mcCreditAmount?: number;
  mcCreditFeeAmount?: number;
  mcDebitAmount?: number;
  mcDebitFeeAmount?: number;
  memberOrderCount?: number;
  otherFeeAmount?: number;
  orderCount?: number;
  payoutAmount?: number;
  payoutReferenceRows?: UploadReferenceRow[];
  pickupOrderCount?: number;
  promoOrderCount?: number;
  refundCount?: number;
  serviceFeeAmount?: number;
  settlementLagDaysAvg?: number;
  taxRemittedAmount?: number;
  tipAmount?: number;
  transactionCount?: number;
  voidCount?: number;
  visaCreditAmount?: number;
  visaCreditFeeAmount?: number;
  visaDebitAmount?: number;
  visaDebitFeeAmount?: number;
};

type UploadReferenceRow = {
  amount: number;
  externalRefId: string;
  rowNumber?: number;
  settledDate?: string;
  type?: string;
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
    adjustmentAmount: 0,
    basisAmount: 0,
    chargebackCount: 0,
    commissionRateAppliedAvg: 0,
    depositAmount: 0,
    depositReferenceRows: [],
    deliveryFeeAmount: 0,
    deliveryOrderCount: 0,
    duplicateOrderCount: 0,
    duplicateTransactionCount: 0,
    errorChargeAmount: 0,
    feeAmount: 0,
    interchangeFeeAmount: 0,
    marketingFeeAmount: 0,
    mcCreditAmount: 0,
    mcCreditFeeAmount: 0,
    mcDebitAmount: 0,
    mcDebitFeeAmount: 0,
    memberOrderCount: 0,
    otherFeeAmount: 0,
    orderCount: 0,
    payoutAmount: 0,
    payoutReferenceRows: [],
    pickupOrderCount: 0,
    promoOrderCount: 0,
    refundCount: 0,
    serviceFeeAmount: 0,
    settlementLagDaysAvg: 0,
    taxRemittedAmount: 0,
    tipAmount: 0,
    transactionCount: 0,
    voidCount: 0,
    visaCreditAmount: 0,
    visaCreditFeeAmount: 0,
    visaDebitAmount: 0,
    visaDebitFeeAmount: 0,
  };
  let commissionRateSampleCount = 0;
  let settlementLagSampleCount = 0;
  let settlementLagDaysTotal = 0;
  const seenOrderIds = new Map<string, number>();
  const seenTransactionIds = new Map<string, number>();

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
      "payments",
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
      "fees",
    );
    metrics.interchangeFeeAmount += read("interchange_fee", "interchange_amount");
    metrics.serviceFeeAmount += read("service_fee", "processing_fees", "transaction_fees", "fees");
    metrics.otherFeeAmount += read("other_merchant_fees", "assessment", "withholdings", "external");
    metrics.marketingFeeAmount += read("marketing_fee", "marketing_contribution");
    metrics.taxRemittedAmount += read("tax_remitted", "tax");
    metrics.tipAmount += read("tip");
    metrics.adjustmentAmount += read("adjustment_amount", "adjustment", "external");
    metrics.errorChargeAmount += read("error_charge");
    metrics.deliveryFeeAmount += read("delivery_fee", "consumer_fee");
    const payoutAmount = read(
      "payout_amount",
      "net_payout",
      "platform_net_sales",
      "bank_deposit_amount",
      "payout",
    );
    metrics.payoutAmount += payoutAmount;
    metrics.depositAmount += read(
      "bank_deposit_amount",
      "total_dsp_deposits",
      "deposit_amount",
      "net_payout",
      "payout_amount",
      "payout",
    );

    const externalRefIdIndex = valueFor("external_ref_id", "external ref. id", "reference_id");
    const typeIndex = valueFor("type");
    const settledDateIndex = valueFor("settled_date", "settled date", "settlement_date");
    const externalRefId =
      externalRefIdIndex >= 0 ? normalizeReferenceId(String(row[externalRefIdIndex] ?? "")) : "";
    const rowType = typeIndex >= 0 ? String(row[typeIndex] ?? "").trim().toUpperCase() : "";
    const settledDate = settledDateIndex >= 0 ? String(row[settledDateIndex] ?? "").trim() : "";

    if (artifactKey === "m01-pos" && externalRefId && payoutAmount > 0) {
      metrics.payoutReferenceRows.push({
        amount: roundTo2(payoutAmount),
        externalRefId,
        rowNumber: metrics.payoutReferenceRows.length + 1,
        settledDate,
        type: rowType || "PAYOUT",
      });
    }

    const commissionRateApplied = read("commission_rate_applied", "dd_commission_rate");
    if (commissionRateApplied > 0) {
      metrics.commissionRateAppliedAvg += commissionRateApplied;
      commissionRateSampleCount += 1;
    }

    const orderTypeIndex = valueFor("order_type", "channel");
    const orderType = orderTypeIndex >= 0 ? String(row[orderTypeIndex] ?? "").toLowerCase() : "";
    if (orderType.includes("pickup")) metrics.pickupOrderCount += 1;
    if (orderType.includes("delivery")) metrics.deliveryOrderCount += 1;
    if (orderType.includes("dashpass") || orderType.includes("member") || orderType.includes("uber one")) {
      metrics.memberOrderCount += 1;
    }

    if (read("marketing_fee", "marketing_contribution") > 0) {
      metrics.promoOrderCount += 1;
    }

    const orderStatusIndex = valueFor("order_status", "trans_type", "description");
    const orderStatus = orderStatusIndex >= 0 ? String(row[orderStatusIndex] ?? "").toLowerCase() : "";
    if (orderStatus.includes("refund")) metrics.refundCount += 1;
    if (orderStatus.includes("void")) metrics.voidCount += 1;

    if (read("refunds") > 0) metrics.refundCount += 1;
    if (read("chargebacks") > 0) metrics.chargebackCount += 1;

    const disputeIndex = valueFor("dispute_id");
    if (disputeIndex >= 0 && String(row[disputeIndex] ?? "").trim()) {
      metrics.chargebackCount += 1;
    }
    const refundIdIndex = valueFor("refund_id");
    if (refundIdIndex >= 0 && String(row[refundIdIndex] ?? "").trim()) {
      metrics.refundCount += 1;
    }

    const orderIdIndex = valueFor("order_id");
    if (orderIdIndex >= 0) {
      const orderId = String(row[orderIdIndex] ?? "").trim();
      if (orderId) {
        seenOrderIds.set(orderId, (seenOrderIds.get(orderId) ?? 0) + 1);
      }
    }

    const transactionIdIndex = valueFor("transaction_id", "trans_id", "txn_id");
    if (transactionIdIndex >= 0) {
      const transactionId = String(row[transactionIdIndex] ?? "").trim();
      if (transactionId) {
        seenTransactionIds.set(transactionId, (seenTransactionIds.get(transactionId) ?? 0) + 1);
      }
    }

    const sourceDate = readDateValue(
      row,
      valueFor("date", "order_date", "trans_date", "txn_date", "transaction_date"),
    );
    const settlementDate = readDateValue(
      row,
      valueFor("settlement_date", "batch_date"),
    );
    if (sourceDate && settlementDate) {
      const lagDays = Math.max(0, (settlementDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24));
      settlementLagDaysTotal += lagDays;
      settlementLagSampleCount += 1;
    }

    const cardTypeIndex = valueFor("card_type", "card_brand");
    if (cardTypeIndex >= 0) {
      const cardType = String(row[cardTypeIndex] ?? "").toLowerCase();
      const amount = read("trans_amount", "amount", "txn_amount", "transaction_amount");
      const fee = read("fee_amount", "fee", "disc_amount", "interchange_amount", "interchange_fee");
      if (cardType.includes("visa") && cardType.includes("debit")) {
        metrics.visaDebitAmount += amount;
        metrics.visaDebitFeeAmount += fee;
      } else if (cardType.includes("visa")) {
        metrics.visaCreditAmount += amount;
        metrics.visaCreditFeeAmount += fee;
      } else if ((cardType.includes("master") || cardType.includes("mc")) && cardType.includes("debit")) {
        metrics.mcDebitAmount += amount;
        metrics.mcDebitFeeAmount += fee;
      } else if (cardType.includes("master") || cardType.includes("mc")) {
        metrics.mcCreditAmount += amount;
        metrics.mcCreditFeeAmount += fee;
      }
    }
  }

  metrics.duplicateOrderCount = [...seenOrderIds.values()].reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0,
  );
  metrics.duplicateTransactionCount = [...seenTransactionIds.values()].reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0,
  );

  if (commissionRateSampleCount > 0) {
    metrics.commissionRateAppliedAvg = round(metrics.commissionRateAppliedAvg / commissionRateSampleCount);
  }
  if (settlementLagSampleCount > 0) {
    metrics.settlementLagDaysAvg = roundTo2(settlementLagDaysTotal / settlementLagSampleCount);
  }

  metrics.transactionCount =
    round(sumColumn(headers, rows, ["transaction_count", "#_txns", "# txns"])) || rows.length;
  metrics.orderCount = round(sumColumn(headers, rows, ["order_count", "menu_item_count"])) || rows.length;

  if (artifactKey.includes("bank")) {
    metrics.basisAmount = 0;
    metrics.feeAmount = 0;
    metrics.payoutAmount = metrics.depositAmount;
  }

  if (artifactKey === "m02-pos" || artifactKey === "m03-pos") {
    metrics.payoutAmount = 0;
    metrics.depositAmount = 0;
  }

  return metrics;
}

function readDateValue(row: string[], index: number) {
  if (index < 0) return null;
  const raw = String(row[index] ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function normalizeReferenceId(value: string) {
  const normalized = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return normalized.replace(/^0+/, "");
}

function round(value: number) {
  return Math.round(value);
}

function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}
