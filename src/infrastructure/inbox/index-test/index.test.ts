import { describe, it, expect } from "vitest";
import * as InboxModule from "..";

describe("infrastructure/inbox/index exports", () => {
  const expectedFunctions = [
    "discoverInboxUri",
    "postCatalogAccessRequest",
    "postFileAccessRequest",
    "postRejectionNotification",
    "postApprovalNotification",
    "listOutcomeNotifications",
    "listAccessRequests",
    "deleteAccessRequest",
  ] as const;

  it.each(expectedFunctions)("exports %s as a function", (name) => {
    expect(typeof (InboxModule as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly 8 runtime values (types are not included)", () => {
    expect(Object.keys(InboxModule)).toHaveLength(8);
  });
});
