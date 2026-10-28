// Who operates the service — the party named in /terms, /privacy, the
// data-holding agreement and the /pricing footer. Internally: the operator is
// an עוסק פטור trading as מרום טכנולוגיות, which is why no VAT is charged and
// subscriptions get a receipt (קבלה), not a tax invoice. Public text shows only
// the business name and number — never a personal name, and not the VAT status
// ("final price" instead). Fill in the address when it arrives.

export const OPERATOR_TRADE_NAME = "מרום טכנולוגיות";
export const OPERATOR_BUSINESS_NUMBER = "305110520";
/** Still to come — shown as a marked blank until then. */
export const OPERATOR_ADDRESS = "[להשלמה]";
export const OPERATOR_EMAIL = "barak@mirpaa.app";

/** "מרום טכנולוגיות, מס׳ עוסק: …, כתובת: …, דוא״ל: …" */
export const OPERATOR_LINE = `${OPERATOR_TRADE_NAME}, מס׳ עוסק: ${OPERATOR_BUSINESS_NUMBER}, כתובת: ${OPERATOR_ADDRESS}, דוא״ל: ${OPERATOR_EMAIL}`;

/** Short form for page footers. */
export const OPERATOR_FOOTER = `${OPERATOR_TRADE_NAME} · מס׳ עוסק ${OPERATOR_BUSINESS_NUMBER}`;

/** Under every subscription price. Not "ללא מע״מ" on its own — out of context
 *  it reads like "plus VAT". */
export const PRICE_VAT_NOTE = "המחיר הסופי לתשלום";

/** The plain-sentence version for /terms, the plan rules and help. */
export const PRICES_FINAL_SENTENCE = "המחירים סופיים, ולא יתווסף להם מע״מ.";
