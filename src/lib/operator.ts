// Who operates the service — the party named in /terms, /privacy, the
// data-holding agreement and the /pricing footer. Internally: the operator is
// an עוסק פטור trading as מרום טכנולוגיות, which is why no VAT is charged and
// subscriptions get a receipt (קבלה), not a tax invoice. Public text shows only
// the business name and number — never a personal name, and says nothing about
// VAT on subscription prices. Fill in the address when it arrives.

export const OPERATOR_TRADE_NAME = "מרום טכנולוגיות";
export const OPERATOR_BUSINESS_NUMBER = "305110520";
/** Still to come — shown as a marked blank until then. */
export const OPERATOR_ADDRESS = "[להשלמה]";
export const OPERATOR_EMAIL = "barak@mirpaa.app";

/** "מרום טכנולוגיות, מס׳ עוסק: …, כתובת: …, דוא״ל: …" */
export const OPERATOR_LINE = `${OPERATOR_TRADE_NAME}, מס׳ עוסק: ${OPERATOR_BUSINESS_NUMBER}, כתובת: ${OPERATOR_ADDRESS}, דוא״ל: ${OPERATOR_EMAIL}`;

/** Short form for page footers. */
export const OPERATOR_FOOTER = `${OPERATOR_TRADE_NAME} · מס׳ עוסק ${OPERATOR_BUSINESS_NUMBER}`;

