import path from "path";
import { pathToFileURL } from "url";

type PdfMetricExtraction = {
  metrics?: {
    basisAmount?: number;
    depositAmount?: number;
    feeAmount?: number;
    orderCount?: number;
    payoutAmount?: number;
    transactionCount?: number;
  };
  warnings: string[];
};

type ExtractedPdfDocument = {
  pageCount: number;
  text: string;
};

const importPdfJsModule = new Function(
  "moduleUrl",
  "return import(moduleUrl);",
) as (moduleUrl: string) => Promise<{
  getDocument: (options: {
    data: Uint8Array;
    standardFontDataUrl: string;
    useWorkerFetch: boolean;
  }) => {
    destroy: () => Promise<void>;
    promise: Promise<{
      getPage: (pageNumber: number) => Promise<{
        cleanup: () => void;
        getTextContent: () => Promise<{
          items: Array<{ hasEOL?: boolean; str?: string }>;
        }>;
      }>;
      numPages: number;
    }>;
  };
}>;

export async function extractPdfDocument(buffer: Buffer): Promise<ExtractedPdfDocument> {
  const pdfjs = await importPdfJsModule(
    pathToFileURL(
      path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs"),
    ).href
  );
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: `${path
      .join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts")
      .replace(/\\/g, "/")}/`,
    useWorkerFetch: false,
  });

  try {
    const document = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        const pageLines: string[] = [];

        for (const item of textContent.items) {
          if (!("str" in item) || typeof item.str !== "string") {
            continue;
          }

          pageLines.push(item.str);
          if (item.hasEOL) {
            pageLines.push("\n");
          }
        }

        pageTexts.push(pageLines.join(" "));
      } finally {
        page.cleanup();
      }
    }

    return {
      pageCount: document.numPages || 1,
      text: normalizeExtractedPdfText(pageTexts.join("\n\n")),
    };
  } finally {
    await loadingTask.destroy();
  }
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

function extractBankMetrics(artifactKey: string, text: string): PdfMetricExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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
      payoutAmount: depositAmount,
      transactionCount: depositMatches.length || undefined,
    },
    warnings: [],
  };
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

function extractProcessorStatementMetrics(text: string): PdfMetricExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const totalBlock = findProcessorTotalBlock(lines);
  const basisAmount = totalBlock?.basisAmount ?? 0;
  const payoutAmount = totalBlock?.payoutAmount ?? basisAmount;
  const feeAmount =
    totalBlock?.feeAmount ??
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
      payoutAmount,
    },
    warnings: feeAmount > 0 ? [] : ["Processor fee total was not detected automatically from this PDF."],
  };
}

function findProcessorTotalBlock(lines: string[]) {
  let bestBlock:
    | {
        basisAmount: number;
        feeAmount: number;
        payoutAmount: number;
        score: number;
      }
    | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^total\b/i.test(lines[index])) continue;

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
        score,
      };
    }
  }

  return bestBlock;
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
