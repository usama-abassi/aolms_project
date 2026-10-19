# Service Assurance — October 2026

`lib/service-assurance-schema.json` contains headers, item codes, units, and categorical replacement resolutions extracted from the three supplied workbooks. It contains no customer records. Controller A:AO and Technician A:AD retain exact source labels and order. Technician AE (`Column 29`) has no populated responses and is excluded.

All formulas in `Tech Sheet Replica` use consistent direct source mappings. The implemented destination/source columns are F/O, G/P, H/Q, I/R, J/M, L/K, N/I, O/U, P/S, Q/N, R/T, W/J, X/L, AA/V, AI/H. A uses the Technician timestamp, B the ticket, and AW the Technician new serial. AX comes from the ONT database. AY uses comments. AZ has no populated values or formulas and remains blank.

Corrections to the replica:

- FTB source I appears at both N and U with the same item code. N receives the quantity, U remains blank.
- Replica Z incorrectly repeats blue connector source N under a green connector header. Z uses Technician AD (green connector) instead. Q retains the blue quantity.
- Replica AF copies a model string into a quantity column. WiFi-6/W6 maps to AF, H-5 to AG, and 2G to AH, with quantity one when ONT replacement is reported. Other models require review instead of being guessed.

Unresolved source data:

- H5 and green connector report columns have no item codes. Consumption is retained and flagged for review.
- ONT Power Adaptor and the FTTR/invisible-cable/ATB/splitter fields have no verified columns in the supplied report. Their original values are preserved and positive consumption is flagged rather than silently assigned to another item.
- W5, F50, FTTR ONTs, and other models have no verified installed-equipment columns in the report.

For duplicate ticket numbers, the latest saved Controller row by `created_at`, then stable UUID, is authoritative. Eligibility is checked after that selection. Older Controller rows and response audit logs remain intact. Submitted material snapshots remain unchanged while a draft is edited. Reassigned submissions are retained and flagged with the previous Technician identity.

PO matching uses full trimmed, case-normalized ONT serials in the existing `equipment_records` ONT database. Each record supplies its PO number, falling back to reservation number when PO is blank. Conflicting effective numbers require review. Export rows 1–5 preserve the supplied report's groups, codes, units, and headers across A:AZ.
