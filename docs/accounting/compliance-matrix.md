# Accounting module: compliance matrix

Traceability from each regulatory requirement to its source, the planned implementation, the test that covers it, and a reviewer's sign-off.

**Where the facts come from.** Every fact here is copied from the research report "Issuing Israeli income documents from mirpaa.app" (research date 8 November 2026, read-only research). Nothing was added from memory. Where the report found nothing, the row says so and is marked **open**. Section numbers refer to הוראות מס הכנסה (ניהול פנקסי חשבונות), תשל"ג-1973 ("the bookkeeping instructions") unless another law is named. The report read the consolidated Wikisource text, whose latest listed amendment is from 2019: **check every section number against Nevo or רשומות before relying on it.**

**Status** keeps the report's markings:
- **confirmed**: read in an official source (gov.il / taxes.gov.il, an ITA document, or the text of the law or regulations);
- **secondary**: a reputable non-official source, used only to fill gaps;
- **inferred**: the researcher's reading; an accountant or lawyer must check it;
- **open**: not settled. These are also in the question list at the end of [implementation-plan.md](implementation-plan.md).

**Applies to**: R = קבלה (400), TI = חשבונית מס (305), TIR = חשבונית מס/קבלה (320), CN = חשבונית זיכוי (330), TX = חשבונית עסקה (300), ALL = every issued document, SW = the software / registration, OP = the operator (מרום טכנולוגיות), TH = each therapist's own obligation.

**Sign-off** is left blank for the accountant (CPA or tax adviser) or the lawyer, with name and date.

PR numbers (for example `1.6`) refer to [implementation-plan.md](implementation-plan.md).

---

## Sources

| Id | Source | Date (as given in the report) | Kind |
|---|---|---|---|
| S1 | [gov.il: registering software for a computerized accounting system][S1] | current, read Nov 2026 | official |
| S2 | [Bookkeeping instructions, consolidated (Wikisource)][S2]; cross-check [Nevo][S2N] | consolidated, latest listed amendment 2019 | official text (unofficial consolidation) |
| S3 | [Bookkeeping instructions, VAT adaptations incl. 9א (Wikisource)][S3]; [VAT bookkeeping regulations, BTL copy][S3B] | BTL copy amounts updated to 1.1.2026 | official text |
| S4 | [ITA software-registry FAQ][S4] | undated, current (read Nov 2026) | official |
| S5 | [Uniform-structure instructions v1.31][S5] | 10.05.2009 | official |
| S6 | [Sample 2.6 printout][S6]; [sample 5.4 printout][S7] | read Nov 2026 | official |
| S8 | [Uniform-file simulator][S8] | read Nov 2026 | official |
| S9 | [Software makers: uniform-file transmission v1.0][S9] (on the [software makers' page][S20], updated 15.10.2026) | 3.2026 | official |
| S10 | [File-status API v1.0][S10] | 9.2026 | official |
| S11 | [Israel Invoices API developer document v2.0][S11] | 7.2024 | official |
| S12 | [Minimum-amount service][S12] | 8.2025 | official |
| S13 | [Tax Authority Open API onboarding deck for software houses][S13]; [API rollout letter][S21] | Nov 2023; 20.4.2023 | official |
| S14 | [Allocation-number service page][S14] | "מעודכן לשנת 2026", read Nov 2026 | official |
| S15 | [Israel Invoices FAQ][S15] | published 11.09.2023, updated 27.05.2026 | official |
| S16 | [Income Tax circular 24/2004, computerized documents][S16] | 14.9.2004 | official |
| S17 | [Ministry of Justice: electronic signature, registrar of certification authorities][S17] | read Nov 2026 | official |
| S18 | [VAT Law, ss.38, 45–47 (Wikisource, incl. 2025 amendments)][S18] | includes 2025 amendments | official text |
| X1 | [Kol Zchut: הוצאת חשבונית מס, חשבונית עסקה וקבלה][X1] | updated 16.9.2026 | **secondary** |
| X2 | [Hamichlol: Electronic Signature Law (names of CAs)][X2] | read Nov 2026 | **secondary** |

---

## 1. Software registration (SW, OP)

| Id | Requirement | Source | Source date | Status | Applies to | Planned implementation | Test | Sign-off |
|---|---|---|---|---|---|---|---|---|
| REG-01 | Software for computerized accounting meant for sale, rent or use by others (including free use) must be registered in the ITA software registry; the software maker applies (Instruction 36, Appendix E(ג)) | [S1][S1]; [S2][S2] App. E(ג) | read Nov 2026 | confirmed | SW, OP | Phase 5 registration package (PR 5.7); production issuing stays off until registered (phase 7) | Registration certificate on file, mapped to the released version | |
| REG-02 | A taxpayer whose books run on software that should be registered but isn't is treated as having kept no books for that part | [S4][S4] | undated, current | confirmed | TH | Issuing flag off until registration (PR 7.8); certificate copy to each customer (REG-08) | Launch checklist | |
| REG-03 | Registration is not approval: the certificate does not confirm correctness; the ITA audits a few programs a year | [S4][S4]; certificate text | undated, current | confirmed | SW | Accountant review before launch regardless (phase 7) | — | |
| REG-04 | Applicant: the software maker (an individual or a corporation), someone it digitally authorised, or a representative. A company must register its corporate details in the ITA personal area and give digital authorisation for "בקשה לרישום תוכנה להנהלת חשבונות" | [S1][S1] | read Nov 2026 | confirmed | OP | Admin steps by the director (PR 5.7). **Whether מרום טכנולוגיות, an עוסק פטור, can be the maker is not addressed by the report: open** (Q21) | — | |
| REG-05 | Online form at `secapp.taxes.gov.il/mm-rishum-tochna`; same service for a new edition and for renewal. Attach: the simulator summary, the section 2.6 printout, and the Appendix 4 (section 5.4) printout | [S1][S1]; [S5][S5] | read Nov 2026 | confirmed | SW | PR 5.4 (reports), 5.5 (simulator run), 5.7 (package) | Golden-file tests of the 2.6 and 5.4 reports; simulator result file kept | |
| REG-06 | Declaration and undertakings (תוספת 1 to Appendix E): software meets the instructions; update it when rules change; inform customers; don't distribute unregistered or cancelled software; give each customer a copy of the valid certificate | [S1][S1]; [S2][S2] App. E | read Nov 2026 | confirmed | OP | Operator runbook (PR 5.7, 7.8) | — | |
| REG-07 | The regulation text also says to attach a copy of the software and its manuals; the online process now covers this through the declaration and simulator outputs | [S1][S1] | read Nov 2026 | inferred | OP | Ask during registration (PR 5.7) | — | |
| REG-08 | The applicant keeps a bound customer register (ספר כרוך של לקוחות): name, business address, VAT number and phone of every buyer or renter (Appendix E(ה)) | [S2][S2] App. E(ה) | 2019 consolidation | confirmed | OP | Operator-side customer register export from `User` rows (PR 5.6) | DB test: register lists every account with issuing enabled | |
| REG-09 | Free; answer within 90 days; certificate by email | [S1][S1] | read Nov 2026 | confirmed | OP | Plan timeline (phase 7) | — | |
| REG-10 | Certificate valid until the end of 3 tax years from issue (Appendix E(ג)(3)); renewal through the same service | [S2][S2] App. E(ג)(3); [S4][S4] | 2019 consolidation | confirmed | SW | Config `SOFTWARE_REGISTRATION_NUMBER` + expiry date, admin warning before expiry (PR 5.6) | Unit test of the expiry warning | |
| REG-11 | "כל שינוי בתוכנה, למעט עדכון סכומים, נחשב לגרסה ומחייב רישום חדש"; the ITA FAQ treats database changes and new modules as a new version | [S2][S2] App. E; [S4][S4] | 2019 consolidation; undated | confirmed text; **practice open** | SW | **Blocker** "every change is a new version". Release process for an "accounting edition" (PR 7.8) | — | |
| REG-12 | No formal testing or external tester; the only certification is the simulator report | [S4][S4] | undated, current | confirmed | SW | Simulator run (PR 5.5) | — | |
| REG-13 | Printing the registration number on each document: no requirement found. It is required in INI field 1006 and in the Israel Invoices field `accounting_software_number` | [S5][S5]; [S11][S11] | 10.05.2009; 7.2024 | confirmed absence in the texts reviewed; **may be open** | ALL | Not printed by default; stored in the snapshot's software metadata (PR 1.5) | Snapshot unit test | |
| REG-14 | The ITA recommends a bookkeeping expert and an information-systems expert (advice, not a sign-off) | [S1][S1] | read Nov 2026 | confirmed | OP | Accountant sign-off gate on every phase (implementation plan) | — | |

## 2. Uniform-structure file (SW)

| Id | Requirement | Source | Source date | Status | Applies to | Planned implementation | Test | Sign-off |
|---|---|---|---|---|---|---|---|---|
| UF-01 | Registrable software must export documents and books in the format the Director sets (Appendix E(א2)); spec "הוראות להפקת קבצים במבנה אחיד" v1.31 | [S2][S2] App. E(א2); [S5][S5] | 10.05.2009 | confirmed | SW | PR 5.1 (spec intake), 5.2 (exporter) | Golden files | |
| UF-02 | An "open format" module no more than one step from the main menu (e.g. under Reports, Maintenance or Tools), or a separate program | [S5][S5] | 10.05.2009 | confirmed | SW | Entry under /reports (PR 5.3) | UI check in the release checklist | |
| UF-03 | Output: `INI.TXT` and a zipped `BKMVDATA.TXT`, written to `\OPENFRMT\<8 digits of VAT no>.<YY>\<MMDDhhmm>\`; covers a user-chosen date range | [S5][S5] | 10.05.2009 | confirmed | SW | PR 5.2 (ZIP download containing that folder path) | Golden-file test of names and paths | |
| UF-04 | Record types: A100 / Z900 open and close; C100 header; D110 lines; D120 receipt/payment details; B100 / B110 only with a bookkeeping module; M100 inventory | [S5][S5] | 10.05.2009 | confirmed | SW | PR 5.2 (A100, C100, D110, D120, Z900; no B or M records unless the spec requires them) | Golden files; record counts reconcile to issued documents | |
| UF-05 | Document-type codes: 300 חשבונית / חשבונית עסקה, 305 חשבונית מס, 320 חשבונית מס/קבלה, 330 חשבונית מס זיכוי, 400 קבלה | [S5][S5] example printout | 10.05.2009 | confirmed | ALL | `IssuedDocument.docType` uses these codes, as `DOC_KINDS` already does (PR 1.3) | Unit test of the code map | |
| UF-06 | INI field 1006 = the software registration certificate number | [S5][S5] | 10.05.2009 | confirmed | SW | PR 5.2, from `SOFTWARE_REGISTRATION_NUMBER` | Golden file | |
| UF-07 | A primary id of 15 random digits per export | [S5][S5] | 10.05.2009 | confirmed | SW | PR 5.2; stored on `UniformExport` | Unit test (length, digits) | |
| UF-08 | Simulator: upload a v1.31 file with at least 2,000 records and up to 4 MB; keep the result file | [S8][S8] | read Nov 2026 | confirmed | SW | PR 5.5 with a made-up practice (never real data) | Result file stored in the registration package | |
| UF-09 | Section 2.6 printout (counts and amounts per document type for a date range) and Appendix 4 / section 5.4 output summary | [S5][S5]; [S6][S6] | 10.05.2009 | confirmed | SW | PR 5.4 | Golden files; totals reconcile to the export | |
| UF-10 | Registrable software must transmit the file to the ITA by API "מיד עם סיום הפקתו"; compliance is a condition of registration; flow is OAuth2 → `UniStructFileUploadLinksApi/v1/UploadingFile/GetUrlsForUploadingFiles` → signed Google Cloud Storage URLs → resumable upload of INI and BKM | [S9][S9] | 3.2026 | confirmed | SW | PR 6.5, built only from the official document; sandbox only | Contract tests from official examples | |
| UF-11 | In March 2026 only the sandbox was open, production "בקרוב". Whether production is live and mandatory today | [S9][S9] | 3.2026 | **open** | SW | Ask lakohot-bt@taxes.gov.il or the registration desk (question Q6) | — | |
| UF-12 | File-status API: Uploaded / Approved / Rejected | [S10][S10] | 9.2026 | confirmed | SW | PR 6.5 | Contract tests | |
| UF-13 | Third-party middleware is allowed for the transmission | [S9][S9] | 3.2026 | confirmed | SW | Adapter interface allows a middleware implementation (PR 6.1) | — | |

## 3. Israel Invoices and allocation numbers (TI, TIR)

| Id | Requirement | Source | Source date | Status | Applies to | Planned implementation | Test | Sign-off |
|---|---|---|---|---|---|---|---|---|
| II-01 | Input VAT is not deductible on a חשבונית מס above the threshold unless it carries an allocation number (VAT Law s.38(א1)); an עוסק מורשה must request the number when the buyer demands it, only for non-zero-rate VAT (s.47(א2)(1)) | [S18][S18] s.38(א1), s.47(א2)(1) | incl. 2025 amendments | confirmed | TI, TIR | PR 4.1 guard; PR 6.3 automated allocation | Unit tests of the eligibility rule | |
| II-02 | Thresholds by invoice date (before VAT): 1.1–4.5.2024 none in practice; 5.5–31.12.2024 > 25,000; 2025 > 20,000; 1.1–31.5.2026 > 10,000; from 1.6.2026 > 5,000. No later step found for 2027 | [S14][S14]; [S15][S15] FAQ 48; [S18][S18] | updated 27.05.2026 | confirmed (2027: confirmed absence, open) | TI, TIR | Effective-dated table in code (PR 4.1), then the `MinimumAmount` API (PR 6.4); never hard-code one value | Unit tests at each boundary date | |
| II-03 | The 2024 developer document's older schedule (15k 2026, 10k 2027, 5k 2028) was replaced; don't build to it | [S11][S11]; [S18][S18] | 7.2024 | confirmed | TI, TIR | Not used | — | |
| II-04 | Conditions: above threshold, non-zero VAT, customer is an עוסק מורשה, customer demanded it. Numbers may be requested for any invoice, amount or customer, including private persons (customer 999999998) and credit notes | [S11][S11] §1.2 | 7.2024 | confirmed | TI, TIR, CN | PR 4.1 (customer VAT-number field, "requested by customer" flag) | Unit tests | |
| II-05 | Only חשבונית מס (incl. 320) needs it; not חשבונית עסקה, קבלה, or credit notes ("אין צורך לבקש מספר הקצאה עבור זיכוי", FAQ 9); not a cancellation of a payment demand (FAQ 38) | [S15][S15] FAQ 9, 38 | updated 27.05.2026 | confirmed | R, TX, CN | Eligibility rule returns "not needed" for these (PR 4.1) | Unit tests | |
| II-06 | Print "מספר הקצאה:" (the 9 right-hand digits) in addition to the document number; store it in the document record and PCN874 | [S15][S15] | updated 27.05.2026 | confirmed | TI, TIR | `AllocationNumber` table (separate from the immutable document) and template field (PR 6.3) | PDF snapshot test | |
| II-07 | A number may be requested up to 1 year after the invoice date; then issue a **copy** (העתק) with it, not a new original (FAQ 10) | [S15][S15] FAQ 10 | updated 27.05.2026 | confirmed | TI, TIR | Copy artifact with the allocation number (PR 6.3) | DB test: original unchanged, copy carries the number | |
| II-08 | Splitting one transaction to stay under the threshold is prohibited (FAQ 54) | [S15][S15] FAQ 54 | updated 27.05.2026 | confirmed | TI, TIR | Warning when several invoices to the same customer on one day sum above the threshold (PR 4.1) | Unit test | |
| II-09 | On a substantive refusal (2025 on) the software must offer cancel / issue without a number printed "אין לנכות מס תשומות בגין חשבונית זו" / reverse charge / hearing, and report the choice | [S18][S18] s.47(א2)(3); [S15][S15] | incl. 2025 amendments | confirmed | TI, TIR | PR 6.3 state machine | Contract tests | |
| II-10 | Request data includes invoice_id (unique), document type, supplier VAT number, document number (mandatory since 2025), customer VAT number (mandatory; error 432 if missing; 999999998 for non-dealers), document date and issue date (system date, not editable), `accounting_software_number`, amounts, `user_id` / `user_name` | [S11][S11] | 7.2024 | confirmed | TI, TIR | Snapshot keeps `issuedAt` (system time) apart from `documentDate`, and the actor (PR 1.3) | Unit test of the request mapper (PR 6.3) | |
| II-11 | Per-business digital permission for "חשבוניות ישראל"; the business sets the period, both sides reminded two weeks before expiry; login by the new identification system or smart card | [S15][S15] FAQ 4, 5 | updated 27.05.2026 | confirmed | TH | Onboarding help text (PR 6.2) | — | |
| II-12 | OAuth2 authorisation code; access token short-lived (601 s in the example); refresh token single-use and rotating, `refresh_token_expires_in` 7,776,000 s (90 days); each therapist must log in again at least every 3 months | [S11][S11]; [S15][S15] FAQ 37 | 7.2024; 27.05.2026 | confirmed | TH | `TaxAuthorityConnection` with encrypted tokens, rotation, reminder before expiry (PR 6.2) | Tests for rotation, replay, expiry | |
| II-13 | Vendor onboarding: director's personal area → corporate registration → digital authorisation to an ADMIN → software registered for API services → approval email → developer-portal ORGANIZATION (signed documents) → APP with redirect URI → subscribe to APIs → sandbox `ita-api.taxes.gov.il/shaam/tsandbox/...` → production only after customer-service approval; use requires signing a usage agreement | [S13][S13]; [S21][S21]; [S11][S11] | Nov 2023; 20.4.2023; 7.2024 | confirmed | OP | Manual operator steps (PR 6.1); no sign-ups in phases 0–5 | — | |
| II-14 | Elapsed time for those approvals | [S13][S13] | — | **open** | OP | Plan a few weeks (phase 6) | — | |
| II-15 | Alternatives the ITA recognises: its own web app, intermediaries (חברות תווכה, FAQ 22), off-the-shelf middleware (dev. doc §1.1.1) | [S15][S15] FAQ 22; [S11][S11] §1.1.1 | 2026; 7.2024 | confirmed | TH, SW | MVP points the therapist to the ITA web app (PR 4.1) | — | |
| II-16 | MVP may start without automated allocation: block or warn on tax invoices to VAT-registered customers above the threshold and point to the manual service | report §2.1 | — | inferred | TI, TIR | PR 4.1 | Unit tests | |
| II-17 | Private patients never need an allocation number; an עוסק פטור is not affected (it cannot issue a חשבונית מס) | [S18][S18] s.47(א) | incl. 2025 amendments | confirmed (עוסק פטור); inferred (patients) | TI, TIR | Eligibility rule | Unit tests | |

## 4. Document content (ALL)

| Id | Requirement | Source | Source date | Status | Applies to | Planned implementation | Test | Sign-off |
|---|---|---|---|---|---|---|---|---|
| CON-R-01 | Receipt: consecutive number | [S2][S2] s.5 | 2019 consolidation | confirmed | R | `DocumentSequence` (PR 1.3, 1.6) | 100-parallel numbering test | |
| CON-R-02 | Receipt: issuer's name and ID / company / VAT number | [S2][S2] s.5 | 2019 consolidation | confirmed | R | Issuer snapshot from `docBusiness` (PR 1.5) | Snapshot test | |
| CON-R-03 | Receipt: date | [S2][S2] s.5 | 2019 consolidation | confirmed | R | `documentDate` + `issuedAt` (PR 1.3) | — | |
| CON-R-04 | Receipt: payer's name and address; address not needed for retail cash sales or if already known to the issuer | [S2][S2] s.5 | 2019 consolidation | confirmed | R | Add `Invoice.docClientAddress`, prefilled from `Client.address`, into the customer snapshot (PR 2.1). "Known to the issuer" = on the client card is **inferred** | Unit test of the receipt checks | |
| CON-R-05 | Receipt: amount received | [S2][S2] s.5 | 2019 consolidation | confirmed | R | Payment lines (PR 1.3) | — | |
| CON-R-06 | Receipt: nature of the receipt or the account credited | [S2][S2] s.5 | 2019 consolidation | confirmed | R | `description` required at issue (PR 2.1) | Unit test | |
| CON-R-07 | Receipt: receiver's signature, unless sent as a computerized document | [S2][S2] s.5 | 2019 consolidation | confirmed | R | Phase 3 (e-signature) | — | |
| CON-R-08 | Cheque or bill: its number, bank and branch, and due date (5(ב)) | [S2][S2] s.5(ב) | 2019 consolidation | confirmed | R, TIR | Add `Payment.chequeDueDate` (PR 2.1); cheque fields already required | Unit test | |
| CON-R-09 | A separate receipt for each payment; one copy to the payer; sending as a computerized document counts as delivery | [S2][S2] s.5 | 2019 consolidation | confirmed text; **whether several payment lines of one payment event may share a receipt is open** | R | Today one receipt may hold several payment lines; question Q15 | — | |
| CON-R-10 | Timing: issue at the time of payment ("סמוך לביצוע הפעולה", s.17) | [S2][S2] s.17 | 2019 consolidation | confirmed | R | Warning when the payment date is far from today (PR 2.1); limits are question Q16 | Unit test | |
| CON-TI-01 | Tax invoice, printed: dealer's name and address, the title "חשבונית מס", the words "עוסק מורשה", VAT registration number | [S18][S18] s.47; [S3][S3] 9א | incl. 2025 amendments | confirmed | TI, TIR | Template v1 for 305/320 (PR 4.1) | PDF content test | |
| CON-TI-02 | "מקור" on the original only | [S3][S3] 9א | — | confirmed | TI, TIR | Original / copy (PR 3.4) | — | |
| CON-TI-03 | Date; customer's name and address (exceptions for retail cash sales) | [S3][S3] 9א | — | confirmed | TI, TIR | Customer snapshot incl. address (PR 2.1) | — | |
| CON-TI-04 | Description of the service; unit and quantity; unit price before VAT or a note that it includes VAT; total before VAT | [S3][S3] 9א | — | confirmed | TI, TIR, CN | Lines snapshot (PR 1.3) | — | |
| CON-TI-05 | VAT amount and rate, with the words "מס ערך מוסף"; zero-rated or exempt items shown separately | [S3][S3] 9א | — | confirmed | TI, TIR, CN | VAT rate stored per document (PR 1.5); "mixed" VAT stays unsupported | Unit tests | |
| CON-TI-06 | Total including VAT | [S3][S3] 9א | — | confirmed | TI, TIR, CN | Totals snapshot | Reconciliation test | |
| CON-TI-07 | Buyer's VAT registration number (s.47(ב)(1)); the Director may allow its omission; for private patients it doesn't apply in practice | [S18][S18] s.47(ב)(1) | incl. 2025 amendments | confirmed; patients inferred | TI, TIR | Customer VAT number field (PR 4.1) | — | |
| CON-TI-08 | "מסמך ממוחשב" when sent electronically | [S2][S2] s.18ב | 2019 consolidation | confirmed | ALL | Template (PR 3.1) | PDF content test | |
| CON-TI-09 | Timing: within 14 days of the tax event (VAT Law s.46); a buyer can't demand a tax invoice before payment where the tax event is payment (s.47(א1)); for services on a cash basis the tax event is payment | [S18][S18] s.46, 47(א1); cash-basis point: report §3.2 | incl. 2025 amendments | confirmed; cash-basis point inferred / secondary | TI | Warning only (PR 4.1) | — | |
| CON-TIR-01 | Invoice paid in full near the time of service, marked "נפרע" and showing payment details, also serves as a receipt (5(ג)) | [S2][S2] s.5(ג) | 2019 consolidation | confirmed | TIR | Template marks "נפרע"; payments must equal the total (PR 4.2) | Unit test | |
| CON-TIR-02 | Such invoices are numbered in their own separate consecutive series | [S2][S2] s.5(ג) | 2019 consolidation | confirmed | TIR | Own `DocumentSequence` row (PR 1.3) | Numbering test | |
| CON-TIR-03 | Issue it only when payment is received at the time of the transaction | [X1][X1] | updated Sept 2026 | secondary | TIR | Help text; warning (PR 4.2) | — | |
| CON-CN-01 | Credit note: issuer's name, address, ID / company / VAT number; date; customer name | [S2][S2] s.9(ה) | 2019 consolidation | confirmed | CN | Snapshot (PR 1.5) | — | |
| CON-CN-02 | Numbers and dates of the invoices it refers to | [S2][S2] s.9(ה) | 2019 consolidation | confirmed | CN | `IssuedDocumentLink` + referenced number/date in the snapshot, incl. external documents (PR 4.3) | DB test | |
| CON-CN-03 | Reason for the change | [S2][S2] s.9(ה) | 2019 consolidation | confirmed | CN | New required `creditReason` (PR 4.3) | Unit test | |
| CON-CN-04 | Credit amount before VAT; VAT amount and rate with "מס ערך מוסף"; total credit incl. VAT; signature unless computerized | [S2][S2] s.9(ה) | 2019 consolidation | confirmed | CN | Template (PR 4.3) | — | |
| CON-CN-05 | To reduce the issuer's own VAT (23א(3)): the customer's signature on the copy, registered mail with delivery confirmation (attached above 1,400 ₪ VAT), fax confirmation, or the customer's certified e-signature confirming receipt. A plain email to a patient doesn't satisfy this | [S2][S2] s.23א(3) | 2019 consolidation | confirmed text; product impact inferred | CN | Record of how receipt was confirmed (PR 4.3); question Q10 | — | |
| CON-EX-01 | An עוסק פטור cannot issue a חשבונית מס or a חשבונית מס/קבלה (VAT Law s.47(א)) | [S18][S18] s.47(א) | incl. 2025 amendments | confirmed | TI, TIR | Already enforced by `vatLiableOnly`; re-checked at issue from the issuer snapshot (PR 1.5) | Unit test | |
| CON-EX-02 | An עוסק פטור issues a קבלה (s.5) | [S2][S2] s.5 | 2019 consolidation | confirmed | R | Phase 2 | — | |
| CON-EX-03 | VAT Law s.45 formally requires a חשבונית עסקה for every transaction; Kol Zchut says an עוסק פטור need only issue a receipt, as is the practice | [S18][S18] s.45; [X1][X1] | 2025; Sept 2026 | confirmed text; secondary practice; **open** | TX | **Blocker** "חשבונית עסקה for עוסק פטור". PR 4.5 only if confirmed (Q8) | — | |
| CON-EX-04 | No VAT lines on an עוסק פטור's documents; printing "עוסק פטור" is common practice, not a requirement found | report §3.5 | — | inferred | R | Template (PR 2.3) | — | |
| CON-EX-05 | 2026 turnover ceiling for עוסק פטור: 122,833 ₪ | [X1][X1] | 2026 | secondary | TH | Not enforced; possible later warning | — | |
| CON-LC-01 | Books recorded in Hebrew or Arabic (21(ב)); English needs a relief (s.130(א)(2) of the Ordinance); bilingual documents with the Hebrew wording are fine in practice | [S2][S2] s.21(ב); [S4][S4] | 2019 consolidation | confirmed; bilingual inferred | ALL | Issue refused unless `lang = "he"` (PR 2.1); bilingual later (PR 4.7) | Unit test | |
| CON-LC-02 | Records in Israeli currency; a foreign-currency receipt also states the currency and the amount in it (s.22); VAT on a foreign-currency invoice in ₪ | [S2][S2] s.22 | 2019 consolidation | confirmed; VAT point inferred | ALL | Issue refused unless ILS (PR 2.1) until exchange rates exist (PR 4.6) | Unit test | |
| CON-VAT-01 | The VAT rate in force on a given date | **no source in the research report** | — | **open** | TI, TIR, CN | App has `VAT_RATE = 0.18` (`src/lib/vat.ts`). Effective-dated table whose values must be sourced and signed off (PR 1.5) | Unit test per boundary | |

## 5. Numbering, originals, copies, corrections (ALL)

| Id | Requirement | Source | Source date | Status | Applies to | Planned implementation | Test | Sign-off |
|---|---|---|---|---|---|---|---|---|
| NUM-01 | Permanent file (קובץ קבוע): no record can be deleted; records numbered automatically and consecutively, the sequence kept from run to run through the tax year (s.1 definition) | [S2][S2] s.1 | 2019 consolidation | confirmed | ALL | `DocumentSequence` + write-once tables + triggers (PR 1.3, 1.4, 1.6) | Immutability DB tests; 100-parallel test | |
| NUM-02 | The software can check internal documents are in unbroken sequence (App. E(א)(5)) and allows cross-tracing of sequence numbers (s.24) | [S2][S2] App. E(א)(5), s.24 | 2019 consolidation | confirmed | SW | Sequence-check report (PR 5.4); gap query (PR 1.6) | DB test: no gaps after rollbacks | |
| NUM-03 | No number repeats within a tax year (18(א)(3)) | [S2][S2] s.18(א)(3) | 2019 consolidation | confirmed | ALL | Unique `(userId, docType, series, documentNumber)`; sequence never decreases or resets (PR 1.3, 1.4) | DB tests | |
| NUM-04 | One series per document type per business | [S2][S2] s.5(ג); [S5][S5] | — | inferred from confirmed texts | ALL | One `DocumentSequence` row per type (PR 1.3) | — | |
| NUM-05 | Starting from a chosen number when migrating: no explicit rule found; vendors let the user set the first number of each series, continuing the old sequence or starting clean at a tax year, so no number repeats within a type and tax year | report §3.6 | — | **open** | ALL | Seed from `User.docNext*`; locked after the first issue (PR 1.6, 1.8); questions Q9, Q22 | DB tests | |
| OC-01 | Internal documents printed from the permanent file only; "מקור" on one copy only, "העתק" on all others (App. E(א)(4)) | [S2][S2] App. E(א)(4) | 2019 consolidation | confirmed | ALL | Render only from the snapshot (PR 2.3, 3.1); delivery log decides original vs copy (PR 3.4) | DB test: second delivery is a copy | |
| OC-02 | The customer gets the "מקור" once and can't re-download it as an original whenever they like | [S16][S16] | 14.9.2004 | confirmed | ALL | PR 3.4 | DB test | |
| OC-03 | Output from a temporary file says "טיוטה" prominently (App. E(א)(3)) | [S2][S2] App. E(א)(3) | 2019 consolidation | confirmed | ALL | Already done (`previewNotice`, draft PDF); kept | Existing `document-look` tests | |
| OC-04 | No correcting or changing an internal document except by an additional document (23(ב)) | [S2][S2] s.23(ב) | 2019 consolidation | confirmed | ALL | Triggers; corrections are new linked documents (PR 1.4, 4.3) | DB tests | |
| OC-05 | Before sending: cancel by a counter-document (negative invoice or credit note); after sending: a credit note under 23א(2) (ITA FAQ 56) | [S2][S2] s.23א(2); [S15][S15] FAQ 56 | 2026 | confirmed | TI, TIR, CN | PR 4.3. **Cancelling an עוסק פטור's receipt: no rule found, open** (Q14) | — | |
| OC-06 | A cancelled document's copy is kept (18(ג)) | [S2][S2] s.18(ג) | 2019 consolidation | confirmed | ALL | Nothing is deleted; cancellation is a link (PR 1.3) | — | |
| OC-07 | A copy is readable and identical in substance to the original, marked "העתק" (18(ב)(2)) | [S2][S2] s.18(ב)(2) | 2019 consolidation | confirmed | ALL | Copies re-rendered from the same snapshot and template version; hash checks (PR 3.1) | Snapshot-hash test | |

## 6. Electronic documents and signatures (ALL)

| Id | Requirement | Source | Source date | Status | Applies to | Planned implementation | Test | Sign-off |
|---|---|---|---|---|---|---|---|---|
| ED-01 | Only a receipt, invoice, credit note or tax invoice may be sent by computer, and only after it is recorded in the books | [S2][S2] s.18ב | 2019 consolidation | confirmed | ALL | Delivery only after the issue transaction commits (PR 3.5) | DB test | |
| ED-02 | Marked "מסמך ממוחשב" prominently; generated automatically from the permanent file, without re-typing, apart from the signature and those words | [S2][S2] s.1, s.18ב | 2019 consolidation | confirmed | ALL | PR 3.1 | PDF content test | |
| ED-03 | Signed with a secured (מאובטחת) or certified (מאושרת) electronic signature of the person who prepared it (Electronic Signature Law 2001); the circular says it must be the issuing taxpayer's own | [S2][S2] s.18ב; [S16][S16] | 14.9.2004 | confirmed; **whose key mirpaa may hold is open** | ALL | **Blocker** "digital signature model". `DocumentSigner` interface (PR 3.2); real signer only after Q1 | — | |
| ED-04 | An unsigned PDF has no meaning for income tax or VAT; the customer can't deduct it and it isn't a valid original (circular §2.3) | [S16][S16] §2.3 | 14.9.2004 | confirmed | ALL | No unsigned PDF is called an original; phase 2 PDFs say so (PR 2.3) | PDF content test | |
| ED-05 | The issuer notifies the assessing officer by registered mail before the first computerized document (18ב(ב)) | [S2][S2] s.18ב(ב) | 2019 consolidation | confirmed text; **enforcement open** | TH | Template letter for the therapist (PR 3.7), question Q3 | — | |
| ED-06 | The recipient agreed in advance, in writing or electronically ("I agree" is fine), to receive computerized documents; the consent or its withdrawal is kept as part of the books (18ב(ג)) | [S2][S2] s.18ב(ג); [S16][S16] | 2004 | confirmed | ALL | `RecipientConsent` append-only (PR 3.3) | DB tests | |
| ED-07 | With a secured (not certified) signature, payment must be by the customer's credit card, a crossed non-negotiable cheque drawn on the customer payable only to the issuer, or a direct transfer from the customer's bank account to the issuer's; cash needs a certified signature or paper (18ב(ד)) | [S2][S2] s.18ב(ד) | 2019 consolidation | confirmed text; **Bit / PayBox open** | R, TIR | **Blocker** "cash and Bit under the signature rule". Delivery rule per payment method (PR 3.6) | Unit tests | |
| ED-08 | A credit note sent by computer may carry a secured signature, but the customer's confirmation of receipt needs a certified signature (circular §2.6.3) | [S16][S16] §2.6.3 | 14.9.2004 | confirmed | CN | PR 4.3 | — | |
| ED-09 | Secured signature: unique to the owner, identifies them, created by means under their sole control, reveals later change. Certified: a secured signature with a certificate from a CA registered with the Ministry of Justice | [S17][S17] | read Nov 2026 | confirmed in concept | ALL | PR 3.2 | — | |
| ED-10 | Registered CAs include ComSign and Personal ID | [X2][X2] | read Nov 2026 | secondary; check the current register | ALL | Lawyer to confirm (Q1) | — | |
| ED-11 | Practical choices: per-therapist secured key in a KMS/HSM used only for that therapist's documents, or a CA certificate per therapist, or a CA's delegated signing | report §4.2 | — | inferred | ALL | Decision in Q1 | — | |

## 7. Retention, location, backup, audit trail (ALL, TH)

| Id | Requirement | Source | Source date | Status | Applies to | Planned implementation | Test | Sign-off |
|---|---|---|---|---|---|---|---|---|
| RET-01 | Keep books and documents 7 years from the end of the tax year, or 6 years from filing that year's return, whichever is later (25(ג)) | [S2][S2] s.25(ג) | 2019 consolidation | confirmed | ALL | `retainUntilTaxYear` on each document; no deletion path (PR 1.3); purge guard (PR 1.8) | DB test: purge refuses | |
| RET-02 | Signed electronic documents kept electronically with their signature, by sender and receiver, as part of the books; printing doesn't count (25(ג2)) | [S2][S2] s.25(ג2) | 2019 consolidation | confirmed | ALL | Stored signed artifacts with hash (PR 3.1) | Hash verification test | |
| RET-03 | Card-company settlement documents are part of the books (25(ג1)) | [S2][S2] s.25(ג1) | 2019 consolidation | confirmed | TH | Out of scope (the app takes no card payments for therapists); noted | — | |
| RET-04 | Scanned originals and internal/statistical records: at least 3 years from filing (25(ד)) | [S2][S2] s.25(ד) | 2019 consolidation | confirmed | TH | Noted for expenses and audit events | — | |
| RET-05 | The permanent file is never deleted, even after printing | [S16][S16] | 14.9.2004 | confirmed | ALL | Triggers (PR 1.4); purge guard (PR 1.8); retention after a therapist leaves is question Q13 | DB tests | |
| LOC-01 | Books kept at the business address or another place notified in writing, which for Israeli-source income must be in Israel or "the Area" (25(א)); keeping them abroad is forbidden without a relief under s.130(א)(2) | [S2][S2] s.25(א); [S4][S4] | 2019; undated | confirmed | ALL | **Blocker** "books kept in Israel": the DB is in the EU. Production issuing waits for an Israeli region or a relief (PR 7.1) | — | |
| LOC-02 | Back up in the first week of every quarter, kept at a different place from the main system, notified in writing, also in Israel | [S2][S2] s.25(ו) | 2019 consolidation | confirmed | ALL | PR 7.3 (in addition to the nightly backups) | Restore drill | |
| LOC-03 | Readable printed and on-screen output available, from the backup too (25(ו)) | [S2][S2] s.25(ו) | 2019 consolidation | confirmed | ALL | Restore drill renders documents from a backup (PR 7.3) | Drill record | |
| LOC-04 | No ITA ruling allowing foreign cloud regions for books was found; a 2017 guideline mentions cloud only for handheld terminals | report §4.4 | 2017 | secondary | ALL | Same blocker | — | |
| LOC-05 | Practical answer: host the document DB and backups in an Israeli cloud region (AWS il-central-1, GCP me-west1, Azure Israel Central) or an Israeli provider; Railway likely has no Israeli region | report §4.4 | — | inferred (verify) | ALL | PR 7.1 options paper | — | |
| LOC-06 | Each therapist notifies the assessing officer where the books and backups are held | report §4.4 | — | inferred | TH | Template letter (PR 3.7) | — | |
| AUD-01 | Every record traceable to its sources and documents (21(א)) | [S2][S2] s.21(א) | 2019 consolidation | confirmed | ALL | `draftInvoiceId`, links, `AccountingEvent` (PR 1.3) | DB test | |
| AUD-02 | Non-document computerized records: keep original and corrected record; changes to account, amount or sign by an additional entry (23(א)(2)) | [S2][S2] s.23(א)(2) | 2019 consolidation | confirmed | ALL | Append-only `AccountingEvent`; sequence settings changes logged (PR 1.3, 1.8) | — | |
| AUD-03 | Appendix E(א) functions: ordered output of all permanent-file records with sequence numbers; a header on each output (taxpayer, period, type, date, page numbers, end mark); "טיוטה" on drafts; "מקור" / "העתק"; sequence check; user-initiated backup | [S2][S2] App. E(א) | 2019 consolidation | confirmed | SW | PR 5.4 (reports); user-initiated backup = the account export plus the uniform file (PR 5.2) | Golden files | |
| AUD-04 | A way to locate computerized documents (App. E(א1)) | [S2][S2] App. E(א1) | 2019 consolidation | confirmed | SW | Search by type and number (PR 5.4) | — | |
| AUD-05 | Protection against power failure (App. E(ב)); cloud infrastructure probably satisfies this | [S2][S2] App. E(ב) | 2019 consolidation | confirmed; satisfaction inferred | SW | Transactions; backups | — | |

## 8. Psychologists (Appendix ו') (TH, SW)

| Id | Requirement | Source | Source date | Status | Applies to | Planned implementation | Test | Sign-off |
|---|---|---|---|---|---|---|---|---|
| PSY-01 | Appendix ו' (doctors) defines "רופא" to include פסיכולוג and פיסיותרפיסט | [S2][S2] תוספת ו' | 2019 consolidation | confirmed | TH | — | — | |
| PSY-02 | They keep a diary (a page per day: each patient's name, amounts received, third-party payers, receipt number, payments, notes; names on admission, amounts within 30 days after month end), receipts and invoices, and a file of external documents | [S2][S2] תוספת ו' | 2019 consolidation | confirmed | TH | Diary report from meetings + documents (PR 5.8), after Q7 | Golden file | |
| PSY-03 | Advance registration of patients that sets the date and time of the visit is kept as an integral part of the books (section 4) | [S2][S2] תוספת ו' s.4 | 2019 consolidation | confirmed | TH | — | — | |
| PSY-04 | So for psychologists the appointment calendar is part of the accounting system and needs the same retention, no-deletion and location treatment | report §3.9 | — | inferred | TH | The app hard-deletes meetings today; PR 5.8 after Q20 | — | |
| PSY-05 | Which appendix applies to other kinds of therapist (social workers, art therapists, CBT therapists…) | report §3.9 | — | **open** | TH | Q7 | — | |

## 9. Gaps not covered by the research report (all open)

| Id | Question | Status | Where it bites | Question |
|---|---|---|---|---|
| GAP-01 | Which VAT rate applies on which date (the report does not state rates) | open | CON-VAT-01 | Q17 |
| GAP-02 | Whether a document may be dated before the last document of its type, or before the day it is issued | open | PR 2.1 | Q16 |
| GAP-03 | How an עוסק פטור cancels or corrects a receipt | open | PR 4.3 | Q14 |
| GAP-04 | Whether a credit note or receipt issued in the app may refer to a document issued in another system | open | PR 4.3, 4.4 | Q18 |
| GAP-05 | Whether documents issued in another system before the move belong in the app's uniform file | open | PR 5.2 | Q19 |
| GAP-06 | Who holds a therapist's permanent file after she closes her Mirpaa account | open | PR 1.8 | Q13 |
| GAP-07 | Privacy Protection (Data Security) Regulations 2017 for health data in the same system (outside the report's scope) | open | Phase 7 | Q12 |

[S1]: https://www.gov.il/he/service/registration-software-designed-managing-computerized-accounting-system
[S2]: https://he.wikisource.org/wiki/הוראות_מס_הכנסה_(ניהול_פנקסי_חשבונות)
[S2N]: https://www.nevo.co.il/law_html/law01/255_179.htm
[S3]: https://he.wikisource.org/wiki/הוראות_מס_הכנסה_(ניהול_פנקסי_חשבונות)/מס_ערך_מוסף
[S3B]: https://www.btl.gov.il/Laws1/02_0022_100006.pdf
[S4]: https://secapp.taxes.gov.il/mm-find-tochna/main/sheelotTshuvot
[S5]: https://www.gov.il/BlobFolder/service/registration-software-designed-managing-computerized-accounting-system/he/Service_Pages_Income_tax_horaot-131.pdf
[S6]: https://www.gov.il/BlobFolder/service/registration-software-designed-managing-computerized-accounting-system/he/Service_Pages_Income_tax_registration-software-computer-account-systems-2.6.pdf
[S7]: https://www.gov.il/BlobFolder/service/registration-software-designed-managing-computerized-accounting-system/he/Service_Pages_Income_tax_registration-software-computer-account-systems-5.4.pdf
[S8]: https://www.gov.il/he/service/file-review-simulator
[S9]: https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/IncomeTax_software-houses-100326-1.pdf
[S10]: https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/IncomeTax_software-houses-230926-1.pdf
[S11]: https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/vat_software-houses-180724.pdf
[S12]: https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/vat_software-houses-260825.pdf
[S13]: https://www.gov.il/BlobFolder/service/connect-to-shaam/he/Service_Pages_shaam_connection-work-process-software-houses.pdf
[S14]: https://www.gov.il/he/service/request-assignment-number-for-tax-invoice
[S15]: https://www.gov.il/he/pages/faq_israel_invoice
[S16]: https://www.gov.il/BlobFolder/policy/income-tax-professional-inst-24-2004/he/Policy_IncomeTaxInst_hoz24-2004.pdf
[S17]: https://www.justice.gov.il/units/yeutzvehakika/nosimmishpatim/pages/hatimaelectronit.aspx
[S18]: https://he.wikisource.org/wiki/חוק_מס_ערך_מוסף
[S20]: https://www.gov.il/he/pages/hor-software-other
[S21]: https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/IncomeTax_software-houses-200423.pdf
[X1]: https://www.kolzchut.org.il/he/הוצאת_חשבונית_מס,_חשבונית_עסקה_וקבלה
[X2]: https://www.hamichlol.org.il/חוק_חתימה_אלקטרונית
