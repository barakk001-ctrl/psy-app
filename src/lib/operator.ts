// Who operates the service — the party named in /terms, /privacy, the
// data-holding agreement and the /pricing footer. The operator is an עוסק
// פטור (no VAT) trading as מרום טכנולוגיות, and issues receipts (קבלה), not
// tax invoices, for subscriptions. Only the business name is shown publicly —
// never a personal name. Fill in the address when it arrives.

export const OPERATOR_TRADE_NAME = "מרום טכנולוגיות";
export const OPERATOR_BUSINESS_NUMBER = "305110520";
/** Still to come — shown as a marked blank until then. */
export const OPERATOR_ADDRESS = "[להשלמה]";
export const OPERATOR_EMAIL = "barak@mirpaa.app";

/** "מרום טכנולוגיות (עוסק פטור), מס׳ עוסק: …, כתובת: …, דוא״ל: …" */
export const OPERATOR_LINE = `${OPERATOR_TRADE_NAME} (עוסק פטור), מס׳ עוסק: ${OPERATOR_BUSINESS_NUMBER}, כתובת: ${OPERATOR_ADDRESS}, דוא״ל: ${OPERATOR_EMAIL}`;

/** Short form for page footers. */
export const OPERATOR_FOOTER = `${OPERATOR_TRADE_NAME} · עוסק פטור מס׳ ${OPERATOR_BUSINESS_NUMBER}`;

/** Under every subscription price: an עוסק פטור charges no VAT. */
export const PRICE_VAT_NOTE = "המחיר הסופי לתשלום · עוסק פטור (ללא מע״מ)";

/** The plain-sentence version for /terms, the plan rules and help. */
export const PRICES_FINAL_SENTENCE = "המחירים סופיים. העסק הוא עוסק פטור ולכן לא נגבה מע״מ.";
