import "dotenv/config";
import prisma from "../src/lib/prisma";
import { cleanupUnreferencedUploadBlobs } from "../src/lib/uploads/storage";

const apply = process.argv.includes("--apply");

cleanupUnreferencedUploadBlobs({ apply })
  .then((result) => {
    console.log(JSON.stringify({ ...result, byteCount: result.byteCount.toString() }, null, 2));
    if (!apply) console.log("Dry run only. Re-run with --apply after reviewing the listed keys.");
  })
  .finally(() => prisma.$disconnect());
