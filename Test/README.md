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
