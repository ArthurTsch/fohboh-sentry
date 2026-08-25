type PdfMetricExtraction = {
  metrics?: {
    basisAmount?: number;
    depositAmount?: number;
    depositReferenceRows?: PdfReferenceRow[];
    feeAmount?: number;
    interchangeFeeAmount?: number;
    networkFeeAmount?: number;
    otherAdjustmentAmount?: number;
    processorFeeAmount?: number;
    statementTotalFeeAmount?: number;
    orderCount?: number;
    payoutAmount?: number;
    transactionCount?: number;
  };
  warnings: string[];
};

type PdfReferenceRow = {
  amount: number;
  candidateAmounts?: number[];
  externalRefId: string;
  lineText?: string;
  postedDate?: string;
  settledDate?: string;
};

type ExtractedPdfDocument = {
  pageCount: number;
  text: string;
};

type PdfParseResult = {
  numpages?: number;
  text?: string;
};

type PdfParseOptions = {
  max?: number;
  pagerender?: (pageData: PdfPageData) => Promise<string>;
  version?: string;
};

type PdfPageData = {
  getTextContent: (options?: { disableCombineTextItems?: boolean; normalizeWhitespace?: boolean }) => Promise<{
    items: PdfTextItem[];
  }>;
};

type PdfTextItem = {
  hasEOL?: boolean;
  height?: number;
  str?: string;
  transform?: number[];
  width?: number;
};

type PdfParseFunction = (buffer: Buffer, options?: PdfParseOptions) => Promise<PdfParseResult>;

let pdfParseModulePromise: Promise<PdfParseFunction> | undefined;

async function loadPdfParse(): Promise<PdfParseFunction> {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = import("pdf-parse/lib/pdf-parse.js").then((loaded) => {
      const parser = loaded as
        | PdfParseFunction
        | { default?: PdfParseFunction };
      return typeof parser === "function" ? parser : parser.default!;
    });
  }

  return pdfParseModulePromise;
}

export async function extractPdfDocument(buffer: Buffer): Promise<ExtractedPdfDocument> {
  const parsePdf = await loadPdfParse();
  const candidates: PdfParseOptions[] = [
    { max: 0, pagerender: renderPageWithLayout },
    { max: 0 },
    { max: 0, version: "v1.10.100" },
    { max: 0, version: "v1.10.88" },
    { max: 0, version: "v1.9.426" },
    { max: 0, version: "v2.0.550" },
  ];

  let bestText = "";
  let bestPageCount = 1;

  for (const options of candidates) {
    try {
      const parsed = await parsePdf(buffer, options);
      const normalized = normalizeExtractedPdfText(parsed.text || "");
      if (getVisibleCharacterCount(normalized) > getVisibleCharacterCount(bestText)) {
        bestText = normalized;
        bestPageCount = parsed.numpages || bestPageCount || 1;
      }
      if (options.pagerender && normalized.length > 0) {
        break;
      }
    } catch {
      continue;
    }
  }

  if (!bestText) {
    const embeddedText = normalizeExtractedPdfText(extractEmbeddedPdfText(buffer));
    if (embeddedText.length > 0) {
      bestText = embeddedText;
      bestPageCount = estimatePdfPageCountFromBuffer(buffer);
    }
  }

  return {
    pageCount: bestPageCount,
    text: bestText,
  };
}

async function renderPageWithLayout(pageData: PdfPageData) {
  const textContent = await pageData.getTextContent({
    disableCombineTextItems: false,
    normalizeWhitespace: false,
  });
  const positionedItems = textContent.items
    .filter((item) => {
      const transform = item.transform ?? [];
      const horizontalScale = Math.abs(transform[0] ?? 0);
      const verticalSkew = Math.abs(transform[1] ?? 0);
      const horizontalSkew = Math.abs(transform[2] ?? 0);
      const verticalScale = Math.abs(transform[3] ?? 0);
      const rotatedVertically = verticalSkew > horizontalScale && horizontalSkew > verticalScale;
      return !rotatedVertically;
    })
    .flatMap((item) => {
      const height = Math.abs(item.height ?? item.transform?.[3] ?? 10);
      const fragments = String(item.str ?? "").replace(/\r/g, "").split("\n");
      return fragments.map((fragment, index) => ({
        forceBreakAfter: index < fragments.length - 1 || Boolean(item.hasEOL),
        height,
        str: fragment.replace(/[ \t]+/g, " ").trim(),
        width: fragments.length === 1 ? Math.abs(item.width ?? 0) : 0,
        x: item.transform?.[4] ?? 0,
        y: (item.transform?.[5] ?? 0) - index * height * 1.2,
      }));
    })
    .filter((item) => item.str.length > 0)
    .sort((left, right) => right.y - left.y || left.x - right.x);

  const lines: typeof positionedItems[] = [];
  for (const item of positionedItems) {
    const currentLine = lines.at(-1);
    const baseline = currentLine?.reduce((sum, entry) => sum + entry.y, 0) ?? 0;
    const averageBaseline = currentLine?.length ? baseline / currentLine.length : item.y;
    // Some bank PDFs report a text-item height several times larger than the
    // visible glyphs. Keep baseline tolerance tight so adjacent transaction
    // rows are not merged into one long date/description/amount line.
    const tolerance = Math.max(0.6, Math.min(1.5, item.height * 0.12));
    if (!currentLine || Math.abs(averageBaseline - item.y) > tolerance) {
      lines.push([item]);
    } else {
      currentLine.push(item);
    }
  }

  return lines
    .flatMap((line) => splitAtExplicitLineBreaks(line.sort((left, right) => left.x - right.x)))
    .map((line) => formatPositionedLine(line))
    .filter(Boolean)
    .join("\n");
}

function splitAtExplicitLineBreaks<T extends { forceBreakAfter: boolean }>(line: T[]) {
  const segments: T[][] = [];
  let segment: T[] = [];
  for (const item of line) {
    segment.push(item);
    if (item.forceBreakAfter) {
      segments.push(segment);
      segment = [];
    }
  }
  if (segment.length > 0) segments.push(segment);
  return segments;
}

function formatPositionedLine(
  line: Array<{ height: number; str: string; width: number; x: number; y: number }>,
) {
  let output = "";
  let previousEnd = line[0]?.x ?? 0;
  let averageCharacterWidth = 5;

  for (const item of line) {
    const measuredCharacterWidth = item.width > 0 ? item.width / Math.max(1, item.str.length) : item.height * 0.5;
    averageCharacterWidth = Math.max(2.5, Math.min(12, measuredCharacterWidth || averageCharacterWidth));
    const gap = item.x - previousEnd;
    if (output && gap > averageCharacterWidth * 0.35) {
      const spaces = Math.max(1, Math.min(24, Math.round(gap / averageCharacterWidth)));
      output += " ".repeat(spaces);
    }
    output += item.str;
    previousEnd = Math.max(previousEnd, item.x + (item.width || item.str.length * averageCharacterWidth));
  }

  return output.trimEnd();
}

function getVisibleCharacterCount(value: string) {
  return value.replace(/\s/g, "").length;
}

export async function extractPdfText(buffer: Buffer) {
  const document = await extractPdfDocument(buffer);
  return document.text;
}

export function extractPdfMetrics(
  artifactKey: string,
  text: string,
  vendorKey?: string | null,
): PdfMetricExtraction {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      warnings: [
        "This PDF does not expose machine-readable text. Upload a machine-readable bank statement PDF or use a supported text-based export for automated reconciliation.",
      ],
    };
  }

  if (artifactKey.includes("bank")) {
    return extractBankMetrics(artifactKey, trimmed, vendorKey);
  }

  if (artifactKey.includes("processor")) {
    return extractProcessorStatementMetrics(trimmed);
  }

  return { warnings: [] };
}

function normalizeExtractedPdfText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmbeddedPdfText(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const textFragments: string[] = [];
  const literalTextPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayTextPattern = /\[([\s\S]*?)\]\s*TJ/g;

  for (const match of source.matchAll(literalTextPattern)) {
    const fragment = decodePdfLiteral(match[0].replace(/\)\s*Tj$/, ""));
    if (fragment) {
      textFragments.push(fragment);
    }
  }

  for (const match of source.matchAll(arrayTextPattern)) {
    const inner = match[1] ?? "";
    const literals = inner.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    const fragment = literals.map((item) => decodePdfLiteral(item)).join("");
    if (fragment) {
      textFragments.push(fragment);
    }
  }

  return textFragments.join("\n");
}

function decodePdfLiteral(value: string) {
  const trimmed = value.replace(/^\(/, "").replace(/\)$/, "");
  return trimmed
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function estimatePdfPageCountFromBuffer(buffer: Buffer) {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length || 1;
}

function extractBankMetrics(artifactKey: string, text: string, vendorKey?: string | null): PdfMetricExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const normalizedVendor = vendorKey?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const toastDepositRefs = artifactKey.startsWith("m01-bank") && (!normalizedVendor || normalizedVendor === "toast")
    ? extractToastBankDepositRows(lines)
    : [];
  const depositMatches = toastDepositRefs.length > 0
    ? toastDepositRefs.map((row) => row.amount)
    : extractLegacyBankDepositMatches(artifactKey, lines, vendorKey);

  const fallbackSummary = extractSummaryFallback(artifactKey, text, vendorKey);
  const depositAmount = roundCurrency(sum(depositMatches)) || fallbackSummary;

  if (depositAmount <= 0) {
    return {
      warnings: [
        "Bank deposits could not be derived from this PDF automatically. Upload a machine-readable bank statement PDF for automated reconciliation.",
      ],
    };
  }

  return {
    metrics: {
      depositAmount,
      depositReferenceRows: toastDepositRefs.length > 0 ? toastDepositRefs : undefined,
      payoutAmount: depositAmount,
      transactionCount: depositMatches.length || undefined,
    },
    warnings: [],
  };
}

function extractLegacyBankDepositMatches(artifactKey: string, lines: string[], vendorKey?: string | null) {
  const normalizedVendor = vendorKey?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const descriptors = artifactKey.startsWith("m01-bank")
    ? normalizedVendor === "toast"
      ? [/toast/i]
      : normalizedVendor === "heartland"
        ? [/heartland/i]
        : [/toast/i, /heartland/i, /processor/i]
    : normalizedVendor === "ubereats"
      ? [/uber/i, /eats/i]
      : normalizedVendor === "doordash"
        ? [/doordash/i, /door dash/i]
        : normalizedVendor === "grubhub"
          ? [/grubhub/i]
          : [/uber/i, /eats/i, /doordash/i, /door dash/i, /grubhub/i, /slice/i, /dsp/i];
  const depositMatches: number[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!descriptors.some((pattern) => pattern.test(line))) continue;

    const inlineAmount = extractCurrencyFromLine(line);
    if (inlineAmount > 0) {
      depositMatches.push(inlineAmount);
      continue;
    }

    for (let lookAhead = 1; lookAhead <= 3 && index + lookAhead < lines.length; lookAhead += 1) {
      const amount = extractCurrencyFromLine(lines[index + lookAhead]);
      if (amount > 0) {
        depositMatches.push(amount);
        break;
      }
    }
  }

  return depositMatches;
}

function extractToastBankDepositRows(lines: string[]): PdfReferenceRow[] {
  const rows: PdfReferenceRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/external deposit\s+toast\s*-\s*dep/i.test(line)) continue;
    if (/withdrawal/i.test(line)) continue;

    const externalRefId = extractToastDepositReferenceId(line);
    if (!externalRefId) continue;

    let amount = extractCurrencyFromLine(line);
    const candidateAmounts = collectNearbyCurrencyCandidates(lines, index);
    if (amount <= 0) {
      amount = 0;
    }

    rows.push({
      amount: roundCurrency(amount),
      candidateAmounts,
      externalRefId: normalizeReferenceId(externalRefId),
      lineText: line,
      postedDate: extractPostedDate(line) ?? extractPostedDate(lines[index - 1] ?? ""),
      settledDate: extractToastSettlementDate(
        line,
        extractPostedDate(line) ?? extractPostedDate(lines[index - 1] ?? ""),
      ),
    });
  }

  return rows;
}

function extractToastSettlementDate(line: string, postedDate?: string) {
  const match = line.match(/\bDEP\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\b/i);
  const postedMatch = postedDate?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match || !postedMatch) return undefined;
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = monthNames.indexOf(match[1].toLowerCase()) + 1;
  const postedMonth = Number(postedMatch[1]);
  let year = Number(postedMatch[3]);
  if (month - postedMonth > 6) year -= 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
}

function extractToastDepositReferenceId(line: string) {
  const explicit = line.match(/DEP\s+[A-Z]{3}\s+\d{2}\s+([A-Z0-9]{8,}?)(?=\d{2}\/\d{2}\/\d{4}\b|[^A-Z0-9]|$)/i);
  if (explicit?.[1]) return explicit[1];

  const fallback = [...line.matchAll(/\b([A-Z0-9]{10,})\b/gi)].map((match) => match[1]);
  return fallback.at(-1) ?? "";
}

function extractPostedDate(line: string) {
  const match = line.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  return match?.[1];
}

function collectNearbyCurrencyCandidates(lines: string[], index: number) {
  const candidates = new Set<number>();

  for (let cursor = Math.max(0, index - 4); cursor <= Math.min(lines.length - 1, index + 10); cursor += 1) {
    for (const amount of extractCurrencyValuesFromLine(lines[cursor])) {
      if (amount > 0) {
        candidates.add(roundCurrency(Math.abs(amount)));
      }
    }
  }

  return [...candidates];
}

function extractSummaryFallback(artifactKey: string, text: string, vendorKey?: string | null) {
  const normalizedVendor = vendorKey?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const summaryPatterns =
    artifactKey.startsWith("m01-bank")
      ? [
          ...(normalizedVendor !== "heartland" ? [/toast(?: card processing)?[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i] : []),
          ...(normalizedVendor !== "toast" ? [/heartland[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i] : []),
          ...(!normalizedVendor ? [/processor[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i] : []),
        ]
      : [
          ...(!normalizedVendor || normalizedVendor === "ubereats" ? [/uber[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i] : []),
          ...(!normalizedVendor || normalizedVendor === "doordash" ? [/doordash[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i] : []),
          ...(!normalizedVendor || normalizedVendor === "grubhub" ? [/grubhub[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i] : []),
          ...(!normalizedVendor || normalizedVendor === "slice" ? [/slice[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i] : []),
        ];

  return roundCurrency(
    summaryPatterns.reduce((total, pattern) => {
      const match = text.match(pattern);
      return total + parseCurrency(match?.[1] ?? "");
    }, 0),
  );
}

function extractCurrencyFromLine(line: string) {
  const currencyMatches = line.match(
    /\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?|\(?\$?\d+\.\d{2}\)?/g,
  );

  if (!currencyMatches?.length) {
    return 0;
  }

  for (const match of currencyMatches) {
    const amount = Math.abs(parseCurrency(match));
    if (amount > 0) {
      return amount;
    }
  }

  return 0;
}

function normalizeReferenceId(value: string) {
  const normalized = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return normalized.replace(/^0+/, "");
}

function extractProcessorStatementMetrics(text: string): PdfMetricExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const totalBlock = findProcessorTotalBlock(lines);
  const basisAmount = totalBlock?.basisAmount ?? 0;
  const payoutAmount = totalBlock?.payoutAmount ?? basisAmount;
  const transactionCount = totalBlock?.transactionCount ?? 0;
  const interchangeFeeAmount = findSummaryAmount(lines, /^interchange fees?$/i);
  const networkFeeAmount = findSummaryAmount(lines, /^network fees?$/i);
  const processingFeeAmount = findSummaryAmount(lines, /^(?:toast )?processing fees?$/i);
  const otherAdjustmentAmount = findSummaryAmount(lines, /^other adjustments?$/i);
  const creditCardBalance = findSummaryAmount(lines, /^credit card balance$/i);
  const hasCompleteSummaryFeeBreakdown = [
    interchangeFeeAmount,
    networkFeeAmount,
    processingFeeAmount,
    otherAdjustmentAmount,
  ].every((amount) => amount !== undefined);
  const summaryFeeTotal = hasCompleteSummaryFeeBreakdown
    ? roundCurrency(
        (interchangeFeeAmount ?? 0) +
          (networkFeeAmount ?? 0) +
          (processingFeeAmount ?? 0) +
          (otherAdjustmentAmount ?? 0),
      )
    : 0;
  const feeAmount =
    creditCardBalance ||
    summaryFeeTotal ||
    totalBlock?.feeAmount ||
    (findAmountNearSequence(lines, ["Card Processing", "Fees"]) ||
      findAmountNearLabel(lines, /^fees$/i));

  if (basisAmount <= 0) {
    return {
      warnings: [
        "Processor statement totals could not be derived from this PDF automatically. Upload the native CSV export or a machine-readable processor PDF for deterministic certification.",
      ],
    };
  }

  return {
    metrics: {
      basisAmount,
      feeAmount: feeAmount > 0 ? feeAmount : undefined,
      interchangeFeeAmount,
      networkFeeAmount,
      otherAdjustmentAmount,
      payoutAmount,
      processorFeeAmount: processingFeeAmount,
      statementTotalFeeAmount: creditCardBalance ?? (summaryFeeTotal > 0 ? summaryFeeTotal : undefined),
      transactionCount: transactionCount > 0 ? transactionCount : undefined,
    },
    warnings: [
      ...(feeAmount > 0 ? [] : ["Processor fee total was not detected automatically from this PDF."]),
      ...(interchangeFeeAmount !== undefined
        ? []
        : ["Interchange fee total was not detected automatically from this processor PDF."]),
      ...(processingFeeAmount !== undefined
        ? []
        : ["Processor-owned fee total was not detected separately from pass-through fees in this processor PDF."]),
    ],
  };
}

function findSummaryAmount(lines: string[], labelPattern: RegExp): number | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const labelOnly = line.replace(/[-+]?\$?\s*\(?[\d,]+\.\d{2}\)?\s*$/, "").trim();
    if (!labelPattern.test(labelOnly)) continue;

    const inlineValues = extractSummaryCurrencyValuesFromLine(line);
    if (inlineValues.length > 0) return inlineValues.at(-1) ?? 0;

    for (let lookAhead = 1; lookAhead <= 2 && index + lookAhead < lines.length; lookAhead += 1) {
      const values = extractSummaryCurrencyValuesFromLine(lines[index + lookAhead]);
      if (values.length > 0) return values[0];
    }
  }
  return undefined;
}

function extractSummaryCurrencyValuesFromLine(line: string) {
  const matches = line.match(/[-+]?\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?|[-+]?\(?\$?\d+\.\d{2}\)?/g);
  return (matches ?? [])
    .map((value) => Math.abs(parseCurrency(value)))
    .filter(Number.isFinite);
}

function findProcessorTotalBlock(lines: string[]) {
  let bestBlock:
    | {
        basisAmount: number;
        feeAmount: number;
        payoutAmount: number;
        transactionCount?: number;
        score: number;
      }
    | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^total(?=\s|\d|\$)/i.test(lines[index])) continue;

    const inlineCurrencyValues = extractCurrencyValuesFromLine(lines[index]);
    const nearbyCurrencyValues = lines
      .slice(index + 1, index + 8)
      .flatMap((line) => extractCurrencyValuesFromLine(line));

    const numericValues =
      inlineCurrencyValues.length >= 3
        ? inlineCurrencyValues
        : nearbyCurrencyValues.length >= 3
          ? nearbyCurrencyValues
          : [];

    if (numericValues.length < 3) continue;

    const transactionCount = extractProcessorTotalTransactionCount(lines[index]);

    const basisAmount = numericValues[0];
    const feeAmount = numericValues.length >= 3 ? numericValues[numericValues.length - 2] : 0;
    const payoutAmount = numericValues[numericValues.length - 1];
    const score =
      basisAmount +
      numericValues.length * 1000000 +
      (inlineCurrencyValues.length >= 3 ? 500000 : 0);

    if (!bestBlock || score > bestBlock.score) {
      bestBlock = {
        basisAmount,
        feeAmount,
        payoutAmount,
        transactionCount,
        score,
      };
    }
  }

  return bestBlock;
}

function extractProcessorTotalTransactionCount(line: string) {
  const normalized = line.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^total\s*(\d{1,6})(?=\$|\s+\$)/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function findAmountNearSequence(lines: string[], labels: string[]) {
  for (let index = 0; index < lines.length - labels.length; index += 1) {
    const matches = labels.every((label, offset) => lines[index + offset].toLowerCase() === label.toLowerCase());
    if (!matches) continue;
    for (let lookAhead = labels.length; lookAhead < labels.length + 6 && index + lookAhead < lines.length; lookAhead += 1) {
      const amount = Math.abs(parseCurrency(lines[index + lookAhead]));
      if (amount > 0) return amount;
    }
  }
  return 0;
}

function findAmountNearLabel(lines: string[], labelPattern: RegExp) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!labelPattern.test(lines[index])) continue;
    for (let lookAhead = 1; lookAhead <= 6 && index + lookAhead < lines.length; lookAhead += 1) {
      const amount = Math.abs(parseCurrency(lines[index + lookAhead]));
      if (amount > 0) return amount;
    }
  }
  return 0;
}

function extractCurrencyValuesFromLine(line: string) {
  const currencyMatches = line.match(
    /\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?|\(?\$?\d+\.\d{2}\)?/g,
  );

  if (!currencyMatches?.length) {
    return [] as number[];
  }

  return currencyMatches
    .map((value) => Math.abs(parseCurrency(value)))
    .filter((value) => value > 0);
}

function parseCurrency(value: string) {
  const normalized = value.replace(/[^\d().-]/g, "");
  if (!normalized) return 0;
  const isNegative = normalized.startsWith("(") && normalized.endsWith(")");
  const numeric = normalized.replace(/[()]/g, "");
  const parsed = Number(numeric.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
