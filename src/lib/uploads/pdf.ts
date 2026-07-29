type PdfMetricExtraction = {
  metrics?: {
    basisAmount?: number;
    depositAmount?: number;
    depositReferenceRows?: PdfReferenceRow[];
    feeAmount?: number;
    interchangeFeeAmount?: number;
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
  version?: string;
};

type PdfParseFunction = (buffer: Buffer, options?: PdfParseOptions) => Promise<PdfParseResult>;

let pdfParseModulePromise: Promise<PdfParseFunction> | undefined;

async function loadPdfParse(): Promise<PdfParseFunction> {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = Promise.resolve().then(() => {
      const loaded = require("pdf-parse/lib/pdf-parse.js") as
        | PdfParseFunction
        | { default?: PdfParseFunction };
      return typeof loaded === "function" ? loaded : loaded.default!;
    });
  }

  return pdfParseModulePromise;
}

export async function extractPdfDocument(buffer: Buffer): Promise<ExtractedPdfDocument> {
  const parsePdf = await loadPdfParse();
  const candidates: PdfParseOptions[] = [
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
      if (normalized.length > bestText.length) {
        bestText = normalized;
        bestPageCount = parsed.numpages || bestPageCount || 1;
      }
      if (normalized.length > 0) {
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

export async function extractPdfText(buffer: Buffer) {
  const document = await extractPdfDocument(buffer);
  return document.text;
}

export function extractPdfMetrics(
  artifactKey: string,
  text: string,
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
    return extractBankMetrics(artifactKey, trimmed);
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

function extractBankMetrics(artifactKey: string, text: string): PdfMetricExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const toastDepositRefs = artifactKey === "m01-bank" ? extractToastBankDepositRows(lines) : [];
  const depositMatches =
    toastDepositRefs.length > 0 ? toastDepositRefs.map((row) => row.amount) : extractLegacyBankDepositMatches(artifactKey, lines);

  const fallbackSummary = extractSummaryFallback(artifactKey, text);
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

function extractLegacyBankDepositMatches(artifactKey: string, lines: string[]) {
  const descriptors =
    artifactKey === "m01-bank"
      ? [/toast/i, /processor/i]
      : [/uber/i, /eats/i, /doordash/i, /grubhub/i, /slice/i, /dsp/i];
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
    });
  }

  return rows;
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

function extractSummaryFallback(artifactKey: string, text: string) {
  const summaryPatterns =
    artifactKey === "m01-bank"
      ? [
          /toast(?: card processing)?[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i,
          /processor[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i,
        ]
      : [
          /uber[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i,
          /doordash[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i,
          /grubhub[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i,
          /slice[\s\S]{0,80}?\$([0-9,]+\.\d{2})/i,
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
  const transactionCount = totalBlock?.transactionCount ?? 0;

  // Prefer the statement's label-anchored Summary block over positional parsing of a
  // "Total" row: the positional path cannot tell fee columns from refund columns
  // (on a Toast statement it reads Refunds as the fee), and the Summary block also
  // carries the interchange pass-through that cost-plus evaluation needs.
  const interchangeFeeAmount = findSummaryAmount(text, "Interchange Fees");
  const processorMarkupFees =
    findSummaryAmount(text, "Toast Processing Fees") || findSummaryAmount(text, "Processing Fees");
  const labeledFeeAmount =
    interchangeFeeAmount > 0 && processorMarkupFees > 0
      ? roundCurrency(interchangeFeeAmount + processorMarkupFees)
      : 0;
  const feeAmount =
    labeledFeeAmount > 0
      ? labeledFeeAmount
      : totalBlock?.feeAmount ??
        (findAmountNearSequence(lines, ["Card Processing", "Fees"]) ||
          findAmountNearLabel(lines, /^fees$/i));

  // Net deposits settle through the batch table, not the card-type fee table.
  const batchNetPayout = findBatchTotalNet(lines);
  const payoutAmount = batchNetPayout > 0 ? batchNetPayout : (totalBlock?.payoutAmount ?? basisAmount);

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
      interchangeFeeAmount: interchangeFeeAmount > 0 ? interchangeFeeAmount : undefined,
      payoutAmount,
      transactionCount: transactionCount > 0 ? transactionCount : undefined,
    },
    warnings: feeAmount > 0 ? [] : ["Processor fee total was not detected automatically from this PDF."],
  };
}

function findSummaryAmount(text: string, label: string) {
  const match = text.match(new RegExp(`^${label}\\s+-?\\$?([\\d,]+\\.\\d{2})`, "im"));
  return match ? Math.abs(parseCurrency(match[1])) : 0;
}

function findBatchTotalNet(lines: string[]) {
  let inBatchSection = false;
  for (const line of lines) {
    if (/credit card batches/i.test(line)) {
      inBatchSection = true;
      continue;
    }
    if (!inBatchSection || !/^total\b/i.test(line)) continue;
    const values = extractCurrencyValuesFromLine(line);
    if (values.length >= 2) return values[values.length - 1];
  }
  return 0;
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
