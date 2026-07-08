# CAAR 74 - Missing Bank

Expected outcome:
- Uploads succeed for processor, POS, DSP settlement, and agreement
- Reconciliation remains incomplete
- Trust Score should stay below the CAAR gate
- Monthly final certification should remain blocked or qualified because bank evidence is intentionally missing

Use these files on one location configured for:
- `M01`: `Heartland`
- `M02`: `DoorDash`

Upload set:
- `FohBoh_Test_M01_Heartland_Processor_Statement.csv`
- `FohBoh_Test_M01_Heartland_POS_Export.csv`
- `FohBoh_Test_M02_DoorDash_Settlement.csv`
- `FohBoh_Test_M02_DoorDash_POS_Summary.csv`
- `FohBoh_Test_M02_DoorDash_Agreement.pdf`

Do not upload:
- `FohBoh_Test_M02_Bank_Statement.pdf`

Notes:
- The bank statement is omitted on purpose.
- This pack is for validating the D3 / reconciliation gate and low-trust messaging.
