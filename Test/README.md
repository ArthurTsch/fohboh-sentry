# Certification Test Pack

Use these files against one location in the app to test the upload and certification flow.

Recommended path:

1. Open a location from `Location Waterfall`.
2. Click `Upload Data`.
3. In `M01`, use the `Heartland` card:
   - `FohBoh_Test_M01_Heartland_Processor_Statement.csv`
   - `FohBoh_Test_M01_Heartland_POS_Export.csv`
4. In `M02`, use the `DoorDash` card:
   - `FohBoh_Test_M02_DoorDash_Settlement.csv`
   - `FohBoh_Test_M02_DoorDash_POS_Summary.csv`
   - `FohBoh_Test_M02_DoorDash_Agreement.pdf`
   - `FohBoh_Test_M02_Bank_Statement.pdf`

Notes:

- These files are prefilled and follow the current in-app schema matching logic.
- Agreement and bank evidence test PDFs are included for the M02 DoorDash path.
- Upload all six files to the same location so the evidence stays location-scoped.

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
