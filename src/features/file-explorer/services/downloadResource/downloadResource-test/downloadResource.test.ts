import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadResource } from "../downloadResource-file/downloadResource";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe("downloadResource", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("triggers an anchor click on a successful response", async () => {
    const blob = new Blob(["x"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    const result = await downloadResource("https://pod/file/binary", "file.txt", fetchMock);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://pod/file/binary");
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("returns { ok: false } with the status text on a failed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });
    const result = await downloadResource("https://pod/missing", "x", fetchMock);
    expect(result).toEqual({ ok: false, reason: "404 Not Found" });
  });

  it("returns { ok: false } with the error message when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await downloadResource("https://pod/x", "x", fetchMock);
    expect(result).toEqual({ ok: false, reason: "offline" });
  });

  it("falls back to a generic reason when the rejection is not an Error instance", async () => {
    const fetchMock = vi.fn().mockRejectedValue("network exploded");
    const result = await downloadResource("https://pod/x", "x", fetchMock);
    expect(result).toEqual({ ok: false, reason: "Unknown error" });
  });
});
