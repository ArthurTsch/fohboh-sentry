# Certification Test Pack

Use these files against one location in the app to test the upload and certification flow.

Recommended path:

1. Open a location from `Location Waterfall`.
2. Click `Upload Data`.
3. In `M01`, use the `Heartland` card:
   - `FohBoh_Test_M01_Heartland_Processor_Statement.csv`
   - `FohBoh_Test_M01_Heartland_POS_Export.csv`
   - `FohBoh_Test_M01_Merchant_Agreement.pdf`
   - `FohBoh_Test_M01_Bank_Statement.pdf`
4. Or in `M01`, use the `Toast` card:
   - `FohBoh_Test_M01_Toast_Processor_Statement.csv`
   - or `FohBoh_Test_M01_Toast_Processor_Statement.pdf`
   - `FohBoh_Test_M01_Toast_POS_Export.csv`
   - `FohBoh_Test_M01_Toast_Merchant_Agreement.pdf`
   - `FohBoh_Test_M01_Toast_Bank_Statement.pdf`
5. In `M02`, use the `DoorDash` card:
   - `FohBoh_Test_M02_DoorDash_Settlement.csv`
   - `FohBoh_Test_M02_DoorDash_POS_Summary.csv`
   - `FohBoh_Test_M02_DoorDash_Agreement.pdf`
   - `FohBoh_Test_M02_Bank_Statement.pdf`
6. Or in `M02`, use the `Uber Eats` card:
   - `FohBoh_Test_M02_UberEats_Settlement.csv`
   - `FohBoh_Test_M02_UberEats_POS_Summary.csv`
   - `FohBoh_Test_M02_UberEats_Agreement.pdf`
   - `FohBoh_Test_M02_UberEats_Bank_Statement.pdf`

Notes:

- These files are prefilled and follow the current in-app schema matching logic.
- Agreement and bank evidence test PDFs are included for both the M01 and M02 paths.
- Upload one full M01 vendor set plus one full M02 vendor set to the same location so the evidence stays location-scoped.
- M02 can be tested with either `DoorDash` or `Uber Eats`.

## Extended QA Evidence Pack

The folder [QA-PizzaPalace](C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test/QA-PizzaPalace) contains a broader document set copied from `docs/SentryFiles/Sentry QA Files`.

Use it when you need to verify:

- M01 processor agreement evidence
- M01 monthly processor statements
- M02 DSP agreement evidence
- M02 monthly DSP statements
- monthly bank statement reconciliation evidence
- POS daily sales supporting evidence
- cross-month spillover cases between March and April 2026

Included files:

- `TEST_Toast_Merchant_Services_Agreement.pdf`
- `TEST_Toast_Processor_Statement_Mar2026.pdf`
- `TEST_Toast_Processor_Statement_Apr2026.pdf`
- `TEST_UberEats_Restaurant_Partner_Agreement.pdf`
- `TEST_UberEats_Statement_PizzaPalace_Mar2026.pdf`
- `TEST_UberEats_Statement_PizzaPalace_Apr2026.pdf`
- `TEST_DoorDash_Merchant_Agreement.pdf`
- `TEST_DoorDash_Statement_PizzaPalace_Mar2026.pdf`
- `TEST_DoorDash_Statement_PizzaPalace_Apr2026.pdf`
- `TEST_BankStatement_PizzaPalace_Mar2026.pdf`
- `TEST_BankStatement_PizzaPalace_Apr2026.pdf`
- `TEST_POS_DailySales_PizzaPalace_Mar2026.pdf`
- `TEST_POS_DailySales_PizzaPalace_Apr2026.pdf`

## Score-Oriented Packs

Use these folders when you want predictable certification test scenarios by score band:

- [CAAR-92-Court-Admissible](C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test/CAAR-92-Court-Admissible)
  - full 8-document evidence pack
  - validated to pass the monthly-final release gate and produce a court-admissible CAAR

- [CAAR-74-Missing-Bank](C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test/CAAR-74-Missing-Bank)
  - same base evidence, but intentionally omits both bank statements
  - validated to land in the blocked mid band because monthly-final bank reconciliation is incomplete

- [CAAR-38-Schema-Mismatch](C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test/CAAR-38-Schema-Mismatch)
  - intentionally broken CSV headers plus complete agreement/bank evidence
  - validated to trigger schema mismatch / review states and a low-fail Trust Score outcome

## Recovery-Oriented Packs

Use these folders when you want predictable module-specific recoverable amounts:

- [RECOVERY-M01-ONLY](C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test/RECOVERY-M01-ONLY)
  - `M01` produces recoverable variance
  - `M02` certifies cleanly with zero recovery

- [RECOVERY-M02-ONLY](C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test/RECOVERY-M02-ONLY)
  - `M02` produces recoverable variance
  - `M01` certifies cleanly with zero recovery

- [RECOVERY-BOTH](C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test/RECOVERY-BOTH)
  - both `M01` and `M02` produce recoverable variance in the same run

Verification:

- Run `pnpm run verify:caar-scenarios` to replay all three score-oriented packs against the real certification engine.
- Run `pnpm run verify:recovery-packs` to replay the module-specific recovery packs and confirm the recoverable amounts land in the intended module.
