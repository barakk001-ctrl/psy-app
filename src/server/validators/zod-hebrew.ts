import { z } from "zod";

// Global Hebrew error map — replaces Zod's English defaults ("Expected string,
// received null" etc.) for any issue without an explicit message. Imported for
// its side effect by every validator module.
const hebrewErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "null" || issue.received === "undefined") {
        return { message: "שדה חובה" };
      }
      return { message: "ערך לא תקין" };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "ערך לא תקין" };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "כתובת אימייל לא תקינה" };
      if (issue.validation === "url") return { message: "קישור לא תקין" };
      return { message: "ערך לא תקין" };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return issue.minimum === 1
          ? { message: "שדה חובה" }
          : { message: `נדרשים לפחות ${issue.minimum} תווים` };
      }
      if (issue.type === "number") {
        return { message: `הערך המינימלי הוא ${issue.minimum}` };
      }
      return { message: "ערך קטן מדי" };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return { message: `עד ${issue.maximum} תווים` };
      }
      if (issue.type === "number") {
        return { message: `הערך המקסימלי הוא ${issue.maximum}` };
      }
      return { message: "ערך גדול מדי" };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(hebrewErrorMap);
