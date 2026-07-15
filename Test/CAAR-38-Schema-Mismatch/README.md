# CAAR 38 - Schema Mismatch

Expected outcome:
- Upload UI should show partial schema match or review warnings
- Governance / evidence readiness should remain poor
- Trust Score should land in a low-fail band
- This pack is intended to test failure handling, not a successful claim flow

Use these files on one location configured for:
- `M01`: `Heartland`
- `M02`: `DoorDash`

Alternative broken M01 processor set:
- `M01`: `Toast`
- `M02`: `DoorDash`

Alternative broken M02 DSP set:
- `M01`: `Heartland`
- `M02`: `Uber Eats`

Alternative broken M01 + M02 set:
- `M01`: `Toast`
- `M02`: `Uber Eats`

Upload set:
- `FohBoh_Test_M01_Heartland_Processor_Statement_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Heartland_POS_Export_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Merchant_Agreement.pdf`
- `FohBoh_Test_M01_Bank_Statement.pdf`
- `FohBoh_Test_M02_DoorDash_Settlement_BAD_HEADERS.csv`
- `FohBoh_Test_M02_DoorDash_POS_Summary_BAD_HEADERS.csv`
- `FohBoh_Test_M02_DoorDash_Agreement.pdf`
- `FohBoh_Test_M02_Bank_Statement.pdf`

Alternative broken M01 upload set:
- `FohBoh_Test_M01_Toast_Processor_Statement_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Toast_POS_Export_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Toast_Merchant_Agreement.pdf`
- `FohBoh_Test_M01_Bank_Statement.pdf`
- `FohBoh_Test_M02_DoorDash_Settlement_BAD_HEADERS.csv`
- `FohBoh_Test_M02_DoorDash_POS_Summary_BAD_HEADERS.csv`
- `FohBoh_Test_M02_DoorDash_Agreement.pdf`
- `FohBoh_Test_M02_Bank_Statement.pdf`

Alternative broken M02 upload set:
- `FohBoh_Test_M01_Heartland_Processor_Statement_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Heartland_POS_Export_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Merchant_Agreement.pdf`
- `FohBoh_Test_M01_Bank_Statement.pdf`
- `FohBoh_Test_M02_UberEats_Settlement_BAD_HEADERS.csv`
- `FohBoh_Test_M02_UberEats_POS_Summary_BAD_HEADERS.csv`
- `FohBoh_Test_M02_UberEats_Agreement.pdf`
- `FohBoh_Test_M02_Bank_Statement.pdf`

Alternative broken M01 + M02 upload set:
- `FohBoh_Test_M01_Toast_Processor_Statement_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Toast_POS_Export_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Toast_Merchant_Agreement.pdf`
- `FohBoh_Test_M01_Bank_Statement.pdf`
- `FohBoh_Test_M02_UberEats_Settlement_BAD_HEADERS.csv`
- `FohBoh_Test_M02_UberEats_POS_Summary_BAD_HEADERS.csv`
- `FohBoh_Test_M02_UberEats_Agreement.pdf`
- `FohBoh_Test_M02_Bank_Statement.pdf`

Notes:
- The CSV headers are intentionally wrong or incomplete.
- Use this pack to verify schema warnings, review states, and blocked certification behavior.
