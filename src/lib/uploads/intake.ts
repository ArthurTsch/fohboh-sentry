import { createHash } from "crypto";
import {
  detectKnownSourceFormat,
  getExpectedHeaders,
  getExpectedKind,
  normalizeHeader,
} from "./definitions";
import { extractPdfDocument, extractPdfMetrics } from "./pdf";

type UploadMetrics = {
  adjustmentAmount?: number;
  basisAmount?: number;
  chargebackCount?: number;
  commissionRateAppliedAvg?: number;
  depositAmount?: number;
  depositReferenceRows?: UploadReferenceRow[];
  deliveryFeeAmount?: number;
  deliveryBasisAmount?: number;
  deliveryCommissionAmount?: number;
  deliveryOrderCount?: number;
  duplicateOrderCount?: number;
  duplicateTransactionCount?: number;
  errorChargeAmount?: number;
  feeAmount?: number;
  interchangeFeeAmount?: number;
  marketingFeeAmount?: number;
  monthlyMetrics?: Record<string, UploadMonthlyMetrics>;
  mcCreditAmount?: number;
  mcCreditFeeAmount?: number;
  mcDebitAmount?: number;
  mcDebitFeeAmount?: number;
  memberOrderCount?: number;
  otherFeeAmount?: number;
  orderCount?: number;
  payoutAmount?: number;
  payoutReferenceRows?: UploadReferenceRow[];
  pickupBasisAmount?: number;
  pickupCommissionAmount?: number;
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

type UploadMonthlyMetrics = {
  basisAmount: number;
  deliveryBasisAmount: number;
  deliveryCommissionAmount: number;
  deliveryOrderCount: number;
  feeAmount: number;
  orderCount: number;
  pickupBasisAmount: number;
  pickupCommissionAmount: number;
  pickupOrderCount: number;
  transactionCount: number;
};

type UploadReferenceRow = {
  amount: number;
  externalRefId: string;
  rowNumber?: number;
  settledDate?: string;
  postedDate?: string;
  type?: string;
};

export type PersistedUploadValidation = {
  detectedFormatKey?: string;
  detectedFormatName?: string;
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
  sourceSystemKey?: string;
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
    const pdfExtraction = validPdf ? extractPdfMetrics(artifactKey, pdfText, vendorKey) : { warnings: [] };
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
  const csvRows = parseCsv(text);
  const headers = (csvRows[0] ?? [])
    .map((header) => normalizeHeader(header))
    .filter(Boolean);
  const dataRows = csvRows.slice(1).filter((row) => row.some((cell) => cell.trim().length > 0));
  const rows = dataRows.length;
  const detectedFormat = detectKnownSourceFormat(artifactKey, headers);
  const expectedHeaders =
    expectedHeadersOverride && expectedHeadersOverride.length > 0
      ? expectedHeadersOverride
      : detectedFormat?.format.headers ?? getExpectedHeaders(artifactKey, vendorKey);
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
    detectedFormatKey: detectedFormat?.format.key,
    detectedFormatName: detectedFormat?.format.name,
    metrics: extractUploadMetrics(
      artifactKey,
      headers,
      selectMetricRows(artifactKey, vendorKey, headers, dataRows),
    ),
    rows,
    schema,
    sizeBytes: buffer.byteLength,
    sourceSystemKey: detectedFormat?.format.sourceSystemKey,
    unmatchedHeaders: unmatchedHeaders.length > 0 ? unmatchedHeaders : undefined,
    updatedAt,
    uploaded: true,
    vendorKey: vendorKey ?? undefined,
    vendorName: vendorName ?? undefined,
  };
}

function selectMetricRows(
  artifactKey: string,
  configuredVendorKey: string | null | undefined,
  headers: string[],
  rows: string[][],
) {
  if (artifactKey !== "m02-pos") return rows;

  const dateIndex = [
    "business_day",
    "business day",
    "date",
    "business_date",
    "order_date",
    "report_date",
    "sales_period_end",
    "sales period end",
    "batch_date",
  ]
    .map((name) => headers.indexOf(normalizeHeader(name)))
    .find((index) => index >= 0) ?? -1;
  const datedRows = dateIndex >= 0
    ? rows.filter((row) => Boolean(readMonthKey(row, dateIndex)))
    : rows;

  if (configuredVendorKey !== "ubereats") return datedRows;

  const sourceIndex = headers.indexOf(normalizeHeader("ORDER_SOURCE_NAME"));
  if (sourceIndex < 0) return datedRows;

  // Toast groups third-party marketplace orders under Orders API. This binding is
  // deterministic only while Uber Eats is the configured DSP for this upload slot.
  return datedRows.filter(
    (row) => String(row[sourceIndex] ?? "").trim().toLowerCase() === "orders api",
  );
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
    deliveryBasisAmount: 0,
    deliveryCommissionAmount: 0,
    deliveryOrderCount: 0,
    duplicateOrderCount: 0,
    duplicateTransactionCount: 0,
    errorChargeAmount: 0,
    feeAmount: 0,
    interchangeFeeAmount: 0,
    marketingFeeAmount: 0,
    monthlyMetrics: {},
    mcCreditAmount: 0,
    mcCreditFeeAmount: 0,
    mcDebitAmount: 0,
    mcDebitFeeAmount: 0,
    memberOrderCount: 0,
    otherFeeAmount: 0,
    orderCount: 0,
    payoutAmount: 0,
    payoutReferenceRows: [],
    pickupBasisAmount: 0,
    pickupCommissionAmount: 0,
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
  const monthlyMetrics: Record<string, UploadMonthlyMetrics> = {};

  for (const row of rows) {
    const valueFor = (...names: string[]) =>
      names
        .map((name) => headers.indexOf(normalizeHeader(name)))
        .find((index) => index >= 0) ?? -1;

    const read = (...names: string[]) => {
      const index = valueFor(...names);
      return index >= 0 ? parseNumber(row[index]) : 0;
    };
    const readAbs = (...names: string[]) => Math.abs(read(...names));
    const rowMonthKey = artifactKey === "m02-pos" || artifactKey === "m02-settlement"
      ? readMonthKey(
          row,
          valueFor(
            "business_day",
            "business day",
            "date",
            "business_date",
            "order_date",
            "timestamp local date",
            "timestamp utc date",
            "report_date",
            "sales_period_end",
            "sales period end",
            "batch_date",
          ),
        )
      : null;

    const rowBasisAmount = read(
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
      "sales (excl. tax)",
      "subtotal",
    );
    metrics.basisAmount += rowBasisAmount;
    if (artifactKey === "m02-pos" && rowMonthKey) {
        const bucket = monthlyMetrics[rowMonthKey] ?? {
          basisAmount: 0,
          deliveryBasisAmount: 0,
          deliveryCommissionAmount: 0,
          deliveryOrderCount: 0,
          feeAmount: 0,
          orderCount: 0,
          pickupBasisAmount: 0,
          pickupCommissionAmount: 0,
          pickupOrderCount: 0,
          transactionCount: 0,
        };
        bucket.basisAmount += rowBasisAmount;
        bucket.orderCount += read("order_count", "menu_item_count", "order count") || 1;
        bucket.transactionCount += read("transaction_count", "#_txns", "# txns") || 1;
        monthlyMetrics[rowMonthKey] = bucket;
    }
    const standardFeeAmountRaw = read(
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
      "commission",
    );
    const standardFeeAmount =
      artifactKey === "m02-settlement" ? Math.abs(standardFeeAmountRaw) : standardFeeAmountRaw;
    const marketplaceFeeAmount = readAbs("marketplace fee");
    const rowCommissionAmount = marketplaceFeeAmount || standardFeeAmount;
    metrics.feeAmount += rowCommissionAmount;
    const fulfillmentType =
      artifactKey === "m02-settlement" ? resolveM02FulfillmentType(headers, row) : null;
    if (fulfillmentType === "delivery") {
      metrics.deliveryBasisAmount += rowBasisAmount;
      metrics.deliveryCommissionAmount += rowCommissionAmount;
      metrics.deliveryOrderCount += 1;
    } else if (fulfillmentType === "pickup") {
      metrics.pickupBasisAmount += rowBasisAmount;
      metrics.pickupCommissionAmount += rowCommissionAmount;
      metrics.pickupOrderCount += 1;
    }
    if (artifactKey === "m02-settlement" && rowMonthKey) {
      const bucket = monthlyMetrics[rowMonthKey] ?? {
        basisAmount: 0,
        deliveryBasisAmount: 0,
        deliveryCommissionAmount: 0,
        deliveryOrderCount: 0,
        feeAmount: 0,
        orderCount: 0,
        pickupBasisAmount: 0,
        pickupCommissionAmount: 0,
        pickupOrderCount: 0,
        transactionCount: 0,
      };
      bucket.basisAmount += rowBasisAmount;
      bucket.feeAmount += rowCommissionAmount;
      bucket.orderCount += 1;
      bucket.transactionCount += 1;
      if (fulfillmentType === "delivery") {
        bucket.deliveryBasisAmount += rowBasisAmount;
        bucket.deliveryCommissionAmount += rowCommissionAmount;
        bucket.deliveryOrderCount += 1;
      } else if (fulfillmentType === "pickup") {
        bucket.pickupBasisAmount += rowBasisAmount;
        bucket.pickupCommissionAmount += rowCommissionAmount;
        bucket.pickupOrderCount += 1;
      }
      monthlyMetrics[rowMonthKey] = bucket;
    }
    metrics.interchangeFeeAmount += read("interchange_fee", "interchange_amount");
    const serviceFeeAmount = read(
      "service_fee",
      "processing_fees",
      "transaction_fees",
      "payment_processing_fee",
      "fees",
    );
    metrics.serviceFeeAmount +=
      artifactKey === "m02-settlement" ? Math.abs(serviceFeeAmount) : serviceFeeAmount;
    metrics.otherFeeAmount += read("other_merchant_fees", "assessment", "withholdings", "external");
    metrics.marketingFeeAmount +=
      readAbs("marketing adjustment", "offer redemption fee", "marketing fees") ||
      read("marketing_fee", "marketing_contribution", "marketing_fees");
    metrics.taxRemittedAmount += read("tax_remitted", "tax");
    metrics.tipAmount += read("tip");
    metrics.adjustmentAmount += read("adjustment_amount", "adjustment", "adjustments", "external");
    metrics.errorChargeAmount += readAbs("error_charge", "error_charges");
    metrics.deliveryFeeAmount += read("delivery_fee", "consumer_fee");
    const payoutAmount = read(
      "payout_amount",
      "net_payout",
      "platform_net_sales",
      "bank_deposit_amount",
      "payout",
      "total payout",
      "net total",
    );
    metrics.payoutAmount += payoutAmount;
    metrics.depositAmount += read(
      "bank_deposit_amount",
      "total_dsp_deposits",
      "deposit_amount",
      "net_payout",
      "payout_amount",
      "payout",
      "total payout",
      "net total",
    );

    const externalRefIdIndex = valueFor(
      "external_ref_id",
      "external ref. id",
      "reference_id",
      "payout reference id",
      "payout id",
    );
    const typeIndex = valueFor("type");
    const settledDateIndex = valueFor(
      "settled_date",
      "settled date",
      "settlement_date",
      "payout date",
    );
    const externalRefId =
      externalRefIdIndex >= 0 ? normalizeReferenceId(String(row[externalRefIdIndex] ?? "")) : "";
    const rowType = typeIndex >= 0 ? String(row[typeIndex] ?? "").trim().toUpperCase() : "";
    const settledDate = settledDateIndex >= 0 ? String(row[settledDateIndex] ?? "").trim() : "";

    if (
      (artifactKey === "m01-pos" || artifactKey === "m02-settlement") &&
      externalRefId &&
      payoutAmount !== 0
    ) {
      metrics.payoutReferenceRows.push({
        amount: roundTo2(payoutAmount),
        externalRefId,
        rowNumber: metrics.payoutReferenceRows.length + 1,
        settledDate,
        type: rowType || (artifactKey === "m02-settlement" ? "DSP_PAYOUT" : "PAYOUT"),
      });
    }

    const commissionRateApplied = read("commission_rate_applied", "dd_commission_rate");
    if (commissionRateApplied > 0) {
      metrics.commissionRateAppliedAvg += commissionRateApplied;
      commissionRateSampleCount += 1;
    }

    const orderTypeIndex = valueFor("order_type", "channel");
    const orderType = orderTypeIndex >= 0 ? String(row[orderTypeIndex] ?? "").toLowerCase() : "";
    if (!fulfillmentType) {
      if (orderType.includes("pickup")) metrics.pickupOrderCount += 1;
      if (orderType.includes("delivery")) metrics.deliveryOrderCount += 1;
    }
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

  if (artifactKey === "m02-settlement") {
    metrics.payoutReferenceRows = aggregatePayoutReferenceRows(metrics.payoutReferenceRows);
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
  metrics.orderCount =
    round(sumColumn(headers, rows, ["order_count", "menu_item_count", "order count"])) || rows.length;

  if ((artifactKey === "m02-pos" || artifactKey === "m02-settlement") && Object.keys(monthlyMetrics).length > 0) {
    metrics.monthlyMetrics = Object.fromEntries(
      Object.entries(monthlyMetrics).map(([month, bucket]) => [month, {
        basisAmount: roundTo2(bucket.basisAmount),
        deliveryBasisAmount: roundTo2(bucket.deliveryBasisAmount),
        deliveryCommissionAmount: roundTo2(bucket.deliveryCommissionAmount),
        deliveryOrderCount: round(bucket.deliveryOrderCount),
        feeAmount: roundTo2(bucket.feeAmount),
        orderCount: round(bucket.orderCount),
        pickupBasisAmount: roundTo2(bucket.pickupBasisAmount),
        pickupCommissionAmount: roundTo2(bucket.pickupCommissionAmount),
        pickupOrderCount: round(bucket.pickupOrderCount),
        transactionCount: round(bucket.transactionCount),
      }]),
    );
  }

  if (artifactKey.includes("bank")) {
    metrics.basisAmount = 0;
    metrics.feeAmount = 0;
    metrics.payoutAmount = metrics.depositAmount;
  }

  if (artifactKey === "m02-pos" || artifactKey === "m03-pos") {
    metrics.payoutAmount = 0;
    metrics.depositAmount = 0;
  }

  const monetaryMetricKeys: Array<keyof UploadMetrics> = [
    "adjustmentAmount",
    "basisAmount",
    "deliveryFeeAmount",
    "deliveryBasisAmount",
    "deliveryCommissionAmount",
    "depositAmount",
    "errorChargeAmount",
    "feeAmount",
    "interchangeFeeAmount",
    "marketingFeeAmount",
    "mcCreditAmount",
    "mcCreditFeeAmount",
    "mcDebitAmount",
    "mcDebitFeeAmount",
    "otherFeeAmount",
    "payoutAmount",
    "pickupBasisAmount",
    "pickupCommissionAmount",
    "serviceFeeAmount",
    "taxRemittedAmount",
    "tipAmount",
    "visaCreditAmount",
    "visaCreditFeeAmount",
    "visaDebitAmount",
    "visaDebitFeeAmount",
  ];
  for (const key of monetaryMetricKeys) {
    const value = metrics[key];
    if (typeof value === "number") {
      (metrics as Record<string, unknown>)[key] = roundTo2(value);
    }
  }

  return metrics;
}

function aggregatePayoutReferenceRows(rows: UploadMetrics["payoutReferenceRows"]) {
  const grouped = new Map<string, NonNullable<UploadMetrics["payoutReferenceRows"]>[number]>();

  for (const row of rows ?? []) {
    const existing = grouped.get(row.externalRefId);
    if (!existing) {
      grouped.set(row.externalRefId, { ...row });
      continue;
    }

    existing.amount = roundTo2(existing.amount + row.amount);
    if (!existing.settledDate && row.settledDate) {
      existing.settledDate = row.settledDate;
    }
  }

  return [...grouped.values()]
    .filter((row) => row.amount > 0)
    .map((row, index) => ({ ...row, rowNumber: index + 1 }));
}

function resolveM02FulfillmentType(headers: string[], row: string[]) {
  const valueFor = (...names: string[]) =>
    names
      .map((name) => headers.indexOf(normalizeHeader(name)))
      .find((index) => index >= 0) ?? -1;
  const fulfillmentIndex = valueFor("dining mode", "final order status", "fulfillment type");
  if (fulfillmentIndex < 0) return null;

  const value = String(row[fulfillmentIndex] ?? "").trim().toLowerCase();
  if (value.includes("pickup") || value.includes("picked up")) return "pickup" as const;
  if (value.includes("delivery") || value.includes("delivered")) return "delivery" as const;
  return null;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function readDateValue(row: string[], index: number) {
  if (index < 0) return null;
  const raw = String(row[index] ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readMonthKey(row: string[], index: number) {
  if (index < 0) return null;
  const raw = String(row[index] ?? "").trim();
  if (!raw) return null;

  const yearFirst = raw.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?/);
  if (yearFirst) {
    const month = Number(yearFirst[2]);
    return month >= 1 && month <= 12 ? `${yearFirst[1]}-${String(month).padStart(2, "0")}` : null;
  }

  const monthFirst = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})/);
  if (monthFirst) {
    const month = Number(monthFirst[1]);
    const year = monthFirst[3].length === 2 ? 2000 + Number(monthFirst[3]) : Number(monthFirst[3]);
    return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, "0")}` : null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
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
