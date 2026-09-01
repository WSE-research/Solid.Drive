import { describe, it, expect } from "vitest";
import * as WacModule from "..";

describe("infrastructure/wac/index exports", () => {
  const expectedFunctions = [
    "discoverAclUri",
    "readAclDocument",
    "writeAclDocument",
    "readAclAgents",
    "buildAclTurtle",
    "buildListOnlyAclTurtle",
    "buildResourceAclTurtle",
    "writeAcl",
    "writeListOnlyAcl",
    "writeResourceAcl",
    "snapshotAcl",
    "restoreAclFromSnapshot",
    "parseWacAllowModes",
    "checkHasPermission",
  ] as const;

  it.each(expectedFunctions)("exports %s as a function", (name) => {
    expect(typeof (WacModule as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly 14 items", () => {
    expect(Object.keys(WacModule)).toHaveLength(14);
  });
});
