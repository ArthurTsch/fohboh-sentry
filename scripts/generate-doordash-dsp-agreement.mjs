import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve(
  "Test/MO2/DoorDash/FohBoh_Test_M02_DoorDash_DSP_Agreement_2026.pdf",
);

const pages = [
  [
    "DOORDASH MERCHANT SERVICES AGREEMENT",
    "Test Fixture - Executed Agreement",
    "",
    "Agreement ID: DD-CBM-2026-001",
    "Effective Date: March 1, 2026",
    "Expiration / Renewal Date: February 28, 2027",
    "Market: Dallas-Fort Worth, Texas",
    "",
    "MERCHANT",
    "Legal Name: Country Burger - Murphy",
    "Location: 104 North Murphy Road, Suite 210, Murphy, TX 75094",
    "DoorDash Business ID: 11717",
    "DoorDash Store ID: 241736",
    "",
    "SERVICE AND COMMISSION SCHEDULE",
    "Commission Base: Order subtotal before tax",
    "Canonical Commission Base: order_subtotal",
    "Marketplace Delivery Commission Rate: 20.00%",
    "DashPass Member Delivery Commission Rate: 15.00%",
    "Pickup / Carryout Commission Rate: 6.00%",
    "Catering / Group Order Commission Rate: 20.00%",
    "Sponsored Listing Rate: 0.00%",
    "Marketing Opt-In Fee: 0.00% unless separately authorized in writing",
    "Error Charge Cap: $0.00 unless supported by order-level evidence",
    "",
    "The commission base excludes sales tax, staff tips, refunds, cancelled",
    "orders, marketplace-facilitator tax, and DoorDash-funded promotions.",
    "Merchant-funded discounts reduce the commissionable order subtotal.",
  ],
  [
    "DOORDASH MERCHANT SERVICES AGREEMENT - CONTINUED",
    "Agreement ID: DD-CBM-2026-001",
    "",
    "SETTLEMENT AND TAX TERMS",
    "Payout Frequency: Weekly",
    "Payout Currency: USD",
    "Tax Remittance by DSP: Yes",
    "DoorDash acts as marketplace facilitator where applicable and remits the",
    "marketplace-facilitator taxes identified in its settlement statements.",
    "Each payout must include a unique Payout ID for bank reconciliation.",
    "",
    "EVIDENCE AND AUDIT TERMS",
    "DoorDash will provide native settlement CSV exports identifying order",
    "subtotals, commissions, taxes, adjustments, error charges, net totals,",
    "payout dates, payout statuses, and Payout IDs. These native exports are",
    "the governing settlement evidence for the applicable certification period.",
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
    "DoorDash Signatory: Taylor Morgan, Merchant Services Representative",
    "DoorDash Signature: /s/ Taylor Morgan",
    "DoorDash Signature Date: February 20, 2026",
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
  const fontObjectNumber = 3 + pageLines.length * 2;
  const infoObjectNumber = fontObjectNumber + 1;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");

  pageLines.forEach((lines, pageIndex) => {
    const pageObjectNumber = 3 + pageIndex * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);

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
    "<< /Title (FohBoh Test M02 DoorDash DSP Agreement 2026) " +
      "/Author (FohBoh Sentry Test Fixtures) " +
      "/Subject (Executed DoorDash DSP agreement fixture for M02 certification testing) " +
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
