# Recovery Pack - Both Modules

Expected outcome:
- Clean monthly-final certification
- Recoverable amount appears in both `M01` and `M02`
- Total recovery is the sum of both module-level variances

Use these files on one location configured for:
- `M01`: `Heartland`
- `M02`: `DoorDash`

Upload set:
- `FohBoh_Test_M01_Heartland_Processor_Statement.csv`
- `FohBoh_Test_M01_Heartland_POS_Export.csv`
- `FohBoh_Test_M01_Merchant_Agreement.pdf`
- `FohBoh_Test_M01_Bank_Statement.pdf`
- `FohBoh_Test_M02_DoorDash_Settlement.csv`
- `FohBoh_Test_M02_DoorDash_POS_Summary.csv`
- `FohBoh_Test_M02_DoorDash_Agreement.pdf`
- `FohBoh_Test_M02_Bank_Statement.pdf`

Expected engine result with the default test contract config:
- `M01` recovery: about `$40.60`
- `M02` recovery: about `$18.82`
- Total recovery: about `$59.42`

Notes:
- This is the clean pass-path pack with recoverable variance intentionally preserved in both active modules.
