import { describe, expect, it } from "vitest";
import { parseSettingsTab, settingsHref, settingsTabs } from "@/lib/settings-tabs";

describe("settings tabs", () => {
  it("shows the admin tab to admins only", () => {
    expect(settingsTabs(false).map((t) => t.key)).toEqual(["personal", "business", "documents", "calendar", "security"]);
    expect(settingsTabs(true).map((t) => t.key)).toContain("admin");
  });
  it("opens the tab in the address, else the first one", () => {
    expect(parseSettingsTab("documents", false)).toBe("documents");
    expect(parseSettingsTab(undefined, false)).toBe("personal");
    expect(parseSettingsTab("nonsense", false)).toBe("personal");
    // Someone else's link to the admin tab doesn't open it
    expect(parseSettingsTab("admin", false)).toBe("personal");
    expect(parseSettingsTab("admin", true)).toBe("admin");
  });
  it("links to a tab and a card in it", () => {
    expect(settingsHref("calendar", "meeting-types")).toBe("/settings?tab=calendar#meeting-types");
    expect(settingsHref("security")).toBe("/settings?tab=security");
  });
});
