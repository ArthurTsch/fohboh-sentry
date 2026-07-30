import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateUploadArtifact } from "../src/lib/uploads/intake";

async function main() {
  const toastPayoutFixturePath = path.join(
    process.cwd(),
    "Test",
    "MO1",
    "POS",
    "CBM_Toast_Payouts_2026-03.csv",
  );
  const toastPayoutBuffer = await readFile(toastPayoutFixturePath);
  const toastPayoutResult = await validateUploadArtifact({
    artifactKey: "m01-pos",
    buffer: toastPayoutBuffer,
    contentType: "text/csv",
    fileName: path.basename(toastPayoutFixturePath),
    vendorKey: "toast",
    vendorName: "Toast",
  });

  if (
    !toastPayoutResult.schema ||
    !toastPayoutResult.fields ||
    toastPayoutResult.matchPct !== 100 ||
    toastPayoutResult.detectedFormatKey !== "toast-payouts-v1" ||
    !toastPayoutResult.metrics?.transactionCount ||
    !toastPayoutResult.metrics.payoutReferenceRows?.length
  ) {
    throw new Error(`Toast Payouts recognition failed: ${JSON.stringify(toastPayoutResult, null, 2)}`);
  }

  const uberFixturePath = path.join(
    process.cwd(),
    "Test",
    "MO2",
    "Uber",
    "CBM_Uber_PayoutSettlement_2026-03_2026-05.csv",
  );
  const uberBuffer = await readFile(uberFixturePath);
  const uberResult = await validateUploadArtifact({
    artifactKey: "m02-settlement",
    buffer: uberBuffer,
    contentType: "text/csv",
    fileName: path.basename(uberFixturePath),
    vendorKey: "ubereats",
    vendorName: "Uber Eats",
  });

  if (!uberResult.schema || !uberResult.fields || uberResult.matchPct !== 100) {
    throw new Error(`Uber Eats schema recognition failed: ${JSON.stringify(uberResult, null, 2)}`);
  }
  if (
    !uberResult.metrics?.basisAmount ||
    !uberResult.metrics.feeAmount ||
    !uberResult.metrics.payoutAmount ||
    !uberResult.metrics.orderCount ||
    !uberResult.metrics.payoutReferenceRows?.length
  ) {
    throw new Error(`Uber Eats metric normalization failed: ${JSON.stringify(uberResult.metrics, null, 2)}`);
  }

  const toastFixturePath = path.join(
    process.cwd(),
    "Test",
    "MO2",
    "CBM_Toast_SalesByChannel_2026-03_2026-05.csv",
  );
  const toastBuffer = await readFile(toastFixturePath);
  const toastResult = await validateUploadArtifact({
    artifactKey: "m02-pos",
    buffer: toastBuffer,
    contentType: "text/csv",
    fileName: path.basename(toastFixturePath),
    vendorKey: "ubereats",
    vendorName: "Uber Eats",
  });

  if (
    !toastResult.schema ||
    !toastResult.fields ||
    toastResult.matchPct !== 100 ||
    toastResult.detectedFormatKey !== "toast-sales-by-channel-v1"
  ) {
    throw new Error(`Toast POS schema recognition failed: ${JSON.stringify(toastResult, null, 2)}`);
  }

  console.log(
    JSON.stringify(
      {
        toastPayouts: {
          basisAmount: toastPayoutResult.metrics.basisAmount,
          detectedFormat: toastPayoutResult.detectedFormatName,
          matchPct: toastPayoutResult.matchPct,
          payoutAmount: toastPayoutResult.metrics.payoutAmount,
          payoutReferences: toastPayoutResult.metrics.payoutReferenceRows.length,
          transactionCount: toastPayoutResult.metrics.transactionCount,
        },
        toast: {
          basisAmount: toastResult.metrics?.basisAmount,
          detectedFormat: toastResult.detectedFormatName,
          matchPct: toastResult.matchPct,
          orderCount: toastResult.metrics?.orderCount,
          sourceRowsUsed: toastResult.metrics?.orderCount ? "Orders API rows" : "none",
        },
        uberEats: {
          basisAmount: uberResult.metrics.basisAmount,
          detectedFormat: uberResult.detectedFormatName,
          feeAmount: uberResult.metrics.feeAmount,
          matchPct: uberResult.matchPct,
          orderCount: uberResult.metrics.orderCount,
          payoutAmount: uberResult.metrics.payoutAmount,
          payoutReferences: uberResult.metrics.payoutReferenceRows.length,
          rows: uberResult.rows,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
