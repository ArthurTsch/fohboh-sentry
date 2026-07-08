# CAAR 38 - Schema Mismatch

Expected outcome:
- Upload UI should show partial schema match or review warnings
- Governance / evidence readiness should remain poor
- Trust Score should stay far below the CAAR gate
- This pack is intended to test failure handling, not a successful claim flow

Use these files on one location configured for:
- `M01`: `Heartland`
- `M02`: `DoorDash`

Upload set:
- `FohBoh_Test_M01_Heartland_Processor_Statement_BAD_HEADERS.csv`
- `FohBoh_Test_M01_Heartland_POS_Export_BAD_HEADERS.csv`
- `FohBoh_Test_M02_DoorDash_Settlement_BAD_HEADERS.csv`
- `FohBoh_Test_M02_DoorDash_POS_Summary_BAD_HEADERS.csv`
- `FohBoh_Test_M02_DoorDash_Agreement.pdf`
- `FohBoh_Test_M02_Bank_Statement.pdf`

Notes:
- The CSV headers are intentionally wrong or incomplete.
- Use this pack to verify schema warnings, review states, and blocked certification behavior.
