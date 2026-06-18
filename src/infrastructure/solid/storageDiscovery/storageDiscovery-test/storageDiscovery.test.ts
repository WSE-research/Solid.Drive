import { describe, it, expect, vi } from "vitest";
import { discoverStorageRoot } from "../storageDiscovery-file/storageDiscovery";

const STORAGE_TYPE_LINK =
  '<http://www.w3.org/ns/pim/space#Storage>; rel="type", <http://www.w3.org/ns/ldp#Container>; rel="type"';
const RESOURCE_LINK = '<http://www.w3.org/ns/ldp#Resource>; rel="type"';

const linkResponse = (link: string | null): Response =>
  ({ headers: { get: (name: string) => (name.toLowerCase() === "link" ? link : null) } } as unknown as Response);

const fetchFor = (linkByUri: Record<string, string | null>) =>
  vi.fn(async (input: RequestInfo) => linkResponse(linkByUri[String(input)] ?? null));

describe("discoverStorageRoot", () => {
  it("returns the nearest storage ancestor, climbing past an unreadable container", async () => {
    const fetch = fetchFor({
      "http://h.test/pod/profile/card": RESOURCE_LINK,
      "http://h.test/pod/profile/": RESOURCE_LINK,
      "http://h.test/pod/": STORAGE_TYPE_LINK,
      "http://h.test/": STORAGE_TYPE_LINK,
    });

    const result = await discoverStorageRoot("http://h.test/pod/profile/card#me", fetch);

    expect(result).toBe("http://h.test/pod/");
  });

  it("strips the WebID fragment before walking", async () => {
    const fetch = fetchFor({ "http://h.test/pod/": STORAGE_TYPE_LINK });
    await discoverStorageRoot("http://h.test/pod/#me", fetch);
    expect(fetch).toHaveBeenCalledWith("http://h.test/pod/", { method: "HEAD" });
  });

  it("keeps climbing when an intermediate request throws", async () => {
    const fetch = vi.fn(async (input: RequestInfo) => {
      if (String(input) === "http://h.test/pod/profile/") throw new Error("network");
      if (String(input) === "http://h.test/pod/") return linkResponse(STORAGE_TYPE_LINK);
      return linkResponse(RESOURCE_LINK);
    });

    const result = await discoverStorageRoot("http://h.test/pod/profile/card", fetch);

    expect(result).toBe("http://h.test/pod/");
  });

  it("returns undefined when no ancestor is a storage", async () => {
    const fetch = fetchFor({});
    const result = await discoverStorageRoot("http://h.test/pod/profile/card", fetch);
    expect(result).toBeUndefined();
  });

  it("returns undefined for an invalid WebID", async () => {
    const fetch = vi.fn();
    const result = await discoverStorageRoot("not a url", fetch);
    expect(result).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("adds a trailing slash when the matched resource lacks one", async () => {
    const fetch = fetchFor({ "http://h.test/storage": STORAGE_TYPE_LINK });
    const result = await discoverStorageRoot("http://h.test/storage", fetch);
    expect(result).toBe("http://h.test/storage/");
  });
});
