import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve(
  "Test/MO2/Uber/FohBoh_Test_M02_UberEats_DSP_Agreement_2026.pdf",
);

const pages = [
  [
    "UBER EATS MERCHANT SERVICES AGREEMENT",
    "Test Fixture - Executed Agreement",
    "",
    "Agreement ID: UE-CBM-2026-001",
    "Effective Date: March 1, 2026",
    "Expiration / Renewal Date: February 28, 2027",
    "Market: Dallas-Fort Worth, Texas",
    "",
    "MERCHANT",
    "Legal Name: Country Burger - Murphy",
    "Location: 104 North Murphy Road, Suite 210, Murphy, TX 75094",
    "Uber Shop ID: 4f949cf1-21c4-421c-8ed1-8af5b8385e3f",
    "Store ID: 4f949cf1-21c4-421c-8ed1-8af5b8385e3f",
    "",
    "SERVICE AND COMMISSION SCHEDULE",
    "Commission Base: Sales excluding tax",
    "Canonical Commission Base: restaurant_food_sales",
    "Marketplace Delivery Commission Rate: 20.00%",
    "Uber One Member Delivery Commission Rate: 20.00%",
    "Pickup / Carryout Commission Rate: 10.00%",
    "Catering / Group Order Commission Rate: 20.00%",
    "Sponsored Listing Rate: 0.00%",
    "Marketing Opt-In Fee: 2.50% of Sales excluding tax",
    "Error Charge Cap: $0.00 unless separately approved in writing",
    "",
    "The commission base excludes sales tax, gratuities, refunds, cancelled",
    "orders, marketplace-facilitator tax, and amounts funded solely by Uber.",
    "Merchant-funded offers reduce the commissionable sales base.",
  ],
  [
    "UBER EATS MERCHANT SERVICES AGREEMENT - CONTINUED",
    "Agreement ID: UE-CBM-2026-001",
    "",
    "SETTLEMENT AND TAX TERMS",
    "Payout Frequency: Weekly",
    "Payout Currency: USD",
    "Tax Remittance by DSP: Yes",
    "Uber acts as marketplace facilitator where applicable and remits the",
    "marketplace-facilitator taxes identified in its settlement statements.",
    "Each payout must include a unique payout reference ID for reconciliation.",
    "",
    "EVIDENCE AND AUDIT TERMS",
    "Uber will provide settlement CSV exports identifying sales excluding tax,",
    "tax, adjustments, marketplace fees, payout totals, payout dates, and payout",
    "reference IDs. Those native exports are the governing settlement evidence.",
    "The Merchant may compare those exports to POS and bank deposit evidence.",
    "",
    "TERM",
    "This agreement remains effective through February 28, 2027 and renews for",
    "successive one-year periods unless either party gives 30 days written notice.",
    "",
    "EXECUTION",
    "Merchant Signatory: Jordan Ellis, Authorized Officer",
    "Merchant Signature: /s/ Jordan Ellis",
    "Merchant Signature Date: February 20, 2026",
    "",
    "Uber Signatory: Morgan Lee, Merchant Services Representative",
    "Uber Signature: /s/ Morgan Lee",
    "Uber Signature Date: February 20, 2026",
    "",
    "TEST DATA NOTICE",
    "This machine-readable agreement is a non-production fixture created solely",
    "for deterministic application testing. It is not a real commercial contract.",
  ],
];

function escapePdfText(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function buildPdf(pageLines) {
  const objects = [];
  const pageObjectNumbers = [];
  const contentObjectNumbers = [];
  const fontObjectNumber = 3 + pageLines.length * 2;
  const infoObjectNumber = fontObjectNumber + 1;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");

  pageLines.forEach((lines, pageIndex) => {
    const pageObjectNumber = 3 + pageIndex * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);
    contentObjectNumbers.push(contentObjectNumber);

    const commands = [
      "BT",
      "/F1 10 Tf",
      "48 748 Td",
      "15 TL",
      ...lines.map((line, index) => {
        const escaped = escapePdfText(line);
        return index === 0 ? `(${escaped}) Tj` : `T* (${escaped}) Tj`;
      }),
      "ET",
    ].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectNumber} 0 R /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(commands, "utf8")} >>\nstream\n${commands}\nendstream`,
    );
  });

  objects[1] =
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push(
    "<< /Title (FohBoh Test M02 Uber Eats DSP Agreement 2026) " +
      "/Author (FohBoh Sentry Test Fixtures) " +
      "/Subject (Executed DSP agreement fixture for M02 certification testing) " +
      "/Creator (FohBoh Sentry fixture generator) >>",
  );

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ` +
    `/Info ${infoObjectNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, buildPdf(pages));
process.stdout.write(`${outputPath}\n`);
