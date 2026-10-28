// Who operates the service — the party named in /terms, /privacy and the
// data-holding agreement. Barak is registered as an עוסק פטור (sole
// proprietor, no VAT) trading as מרום טכנולוגיות; he issues receipts (קבלה),
// not tax invoices, for subscriptions. Fill in the blanks when he sends them.

export const OPERATOR_NAME = "ברק קישנר";
export const OPERATOR_TRADE_NAME = "מרום טכנולוגיות";
export const OPERATOR_EMAIL = "barak@mirpaa.app";
/** Still to come from Barak — shown as marked blanks until then. */
export const OPERATOR_BUSINESS_NUMBER = "[להשלמה]";
export const OPERATOR_ADDRESS = "[להשלמה]";

/** "ברק קישנר, עוסק פטור (שם העסק: מרום טכנולוגיות), מס׳ עוסק: …, כתובת: …, דוא״ל: …" */
export const OPERATOR_LINE = `${OPERATOR_NAME}, עוסק פטור (שם העסק: ${OPERATOR_TRADE_NAME}), מס׳ עוסק: ${OPERATOR_BUSINESS_NUMBER}, כתובת: ${OPERATOR_ADDRESS}, דוא״ל: ${OPERATOR_EMAIL}`;

/** Under every subscription price: an עוסק פטור charges no VAT. */
export const PRICE_VAT_NOTE = "המחיר הסופי לתשלום · עוסק פטור (ללא מע״מ)";

/** The plain-sentence version for /terms, the plan rules and help. */
export const PRICES_FINAL_SENTENCE = "המחירים סופיים. העסק הוא עוסק פטור ולכן לא נגבה מע״מ.";
