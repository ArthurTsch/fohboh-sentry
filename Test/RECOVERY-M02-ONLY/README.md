# Recovery Pack - M02 Only

Expected outcome:
- Clean monthly-final certification
- Recoverable amount appears in `M02` only
- `M01` should certify cleanly with `0` recovery
- Total recovery should come only from DSP commission overcharge logic

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
- `M01` recovery: `$0.00`
- `M02` recovery: about `$18.82`
- Total recovery: about `$18.82`

Notes:
- `M01` processor fees and bank deposit were neutralized to match the sealed contract terms.
- `M02` keeps the recoverable DSP commission variance.
