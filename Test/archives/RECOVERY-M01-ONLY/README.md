# Recovery Pack - M01 Only

Expected outcome:
- Clean monthly-final certification
- Recoverable amount appears in `M01` only
- `M02` should certify cleanly with `0` recovery
- Total recovery should come only from merchant-fee overcharge logic

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
- `M02` recovery: `$0.00`
- Total recovery: about `$40.60`

Notes:
- `M01` keeps the recoverable fee variance.
- `M02` settlement and bank evidence were neutralized so the DSP module still passes but produces no recoverable amount.
