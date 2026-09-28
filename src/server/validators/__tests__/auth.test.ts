import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "../auth";

const errorsFor = (input: Record<string, string>) => {
  const r = changePasswordSchema.safeParse(input);
  return r.success ? {} : r.error.flatten().fieldErrors;
};

describe("changePasswordSchema", () => {
  it("accepts a valid change", () => {
    expect(changePasswordSchema.safeParse({ current: "oldPass1", password: "newPass22", confirm: "newPass22" }).success).toBe(true);
  });

  it("requires the current password", () => {
    expect(errorsFor({ current: "", password: "newPass22", confirm: "newPass22" }).current).toBeDefined();
  });

  it("applies the registration rules to the new password", () => {
    expect(errorsFor({ current: "oldPass1", password: "short1", confirm: "short1" }).password).toBeDefined();
    expect(errorsFor({ current: "oldPass1", password: "onlyletters", confirm: "onlyletters" }).password).toBeDefined();
    expect(errorsFor({ current: "oldPass1", password: "12345678", confirm: "12345678" }).password).toBeDefined();
  });

  it("rejects a mismatched confirmation", () => {
    expect(errorsFor({ current: "oldPass1", password: "newPass22", confirm: "newPass23" }).confirm).toEqual(["הסיסמאות אינן תואמות"]);
  });

  it("rejects reusing the current password", () => {
    expect(errorsFor({ current: "samePass1", password: "samePass1", confirm: "samePass1" }).password).toEqual(["הסיסמה החדשה זהה לנוכחית"]);
  });
});
