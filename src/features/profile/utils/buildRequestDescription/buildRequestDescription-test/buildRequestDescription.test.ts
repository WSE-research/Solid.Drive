import { describe, it, expect, vi } from "vitest";
import type { TFunction } from "i18next";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";
import {
  buildRequestDescription,
  getResourceLabel,
  getTypeLabel,
} from "../buildRequestDescription-file/buildRequestDescription";

vi.mock("@/infrastructure/validation/fileTypeRegistry", () => ({
  getFileTypeInfo: (uri: string) => ({ label: `Label(${uri})`, description: "" }),
}));

const translate = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}|${JSON.stringify(vars)}` : key) as unknown as TFunction;

const baseRequest = {
  messageUri: "https://pod.example/inbox/msg1",
  requesterWebId: "https://alice.example/profile#me",
  accessTo: "https://pod.example/files/foo/",
  timestamp: "2026-05-20T10:00:00Z",
} as const;

describe("getResourceLabel", () => {
  it("returns the final path segment, decoded", () => {
    expect(getResourceLabel("https://pod.example/files/My%20File")).toBe("My File");
  });

  it("strips the trailing slash from container URIs", () => {
    expect(getResourceLabel("https://pod.example/files/foo/")).toBe("foo");
  });

  it("returns the host when only an origin is provided", () => {
    expect(getResourceLabel("https://pod.example")).toBe("pod.example");
  });
});

describe("getTypeLabel", () => {
  it("delegates to the file type registry", () => {
    expect(getTypeLabel("http://schema.org/ImageObject")).toBe("Label(http://schema.org/ImageObject)");
  });
});

describe("buildRequestDescription", () => {
  it("uses the file-access key for file requests", () => {
    const request: AccessRequest = { ...baseRequest, requestType: "file" };
    expect(buildRequestDescription(request, translate)).toBe(
      'requestsPanel.requestsFileAccess|{"resource":"foo"}',
    );
  });

  it("uses the type-access key when a forClass is present", () => {
    const request: AccessRequest = {
      ...baseRequest,
      requestType: "type",
      forClass: "http://schema.org/ImageObject",
    };
    expect(buildRequestDescription(request, translate)).toBe(
      'requestsPanel.requestsTypeAccess|{"type":"Label(http://schema.org/ImageObject)"}',
    );
  });

  it("falls back to the default key when type request lacks a forClass", () => {
    const request: AccessRequest = { ...baseRequest, requestType: "type" };
    expect(buildRequestDescription(request, translate)).toBe(
      "requestsPanel.requestsAccess",
    );
  });

  it("uses the default key for catalog requests", () => {
    const request: AccessRequest = { ...baseRequest, requestType: "catalog" };
    expect(buildRequestDescription(request, translate)).toBe(
      "requestsPanel.requestsAccess",
    );
  });
});
