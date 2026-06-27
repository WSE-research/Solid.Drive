/**
 * Validates the Solid.Drive GitHub Pages site (issue #69).
 *
 * These are static artifacts (an HTML page, a Jekyll config, a PageCrypt
 * manifest and a deploy workflow), so the test reads them from disk and
 * asserts the acceptance criteria: the required content and links are
 * present, every referenced asset exists, and the page is wired up to be
 * deployed as a password-protected GitHub page.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// vitest runs from the package root, so resolve everything against cwd.
const fromRoot = (rel: string): string => resolve(process.cwd(), rel);
const read = (rel: string): string => readFileSync(fromRoot(rel), "utf8");

const PAGE = "gh-page/index.html";

/** Strips a leading Jekyll front-matter block before DOM parsing. */
const stripFrontMatter = (html: string): string =>
  html.replace(/^---\r?\n[\s\S]*?---\r?\n/, "");

const parsePage = (): Document => {
  const html = stripFrontMatter(read(PAGE));
  return new DOMParser().parseFromString(html, "text/html");
};

const hrefs = (doc: Document): string[] =>
  Array.from(doc.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") ?? "");

describe("gh-page/index.html", () => {
  const doc = parsePage();

  it("keeps the Jekyll front matter so the page is built by Jekyll", () => {
    expect(read(PAGE).startsWith("---")).toBe(true);
  });

  it("describes Solid.Drive and its digital-sovereignty intention", () => {
    const text = doc.body.textContent ?? "";
    expect(text).toMatch(/digital sovereignty/i);
    expect(text).toMatch(/solid pod/i);
    // A meta description for sharing/SEO.
    const desc = doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
    expect(desc.length).toBeGreaterThan(20);
  });

  it("advertises the provided features", () => {
    const features = doc.querySelectorAll("#features .feature");
    expect(features.length).toBeGreaterThanOrEqual(4);
  });

  it("links to the live demo, the repo and the device synchronizer", () => {
    const links = hrefs(doc);
    expect(links.some((h) => h.includes("wse-research.org/Solid.Drive"))).toBe(true);
    expect(links.some((h) => h === "https://github.com/WSE-research/Solid-Drive")).toBe(true);
    expect(
      links.some((h) => h === "https://github.com/WSE-research/SolidPodDeviceSynchronizer"),
    ).toBe(true);
  });

  it("shows a gallery of screenshots whose files all exist", () => {
    const imgs = Array.from(doc.querySelectorAll("#gallery img"));
    expect(imgs.length).toBeGreaterThanOrEqual(4);
    for (const img of imgs) {
      const src = img.getAttribute("src") ?? "";
      expect(src, "gallery image needs a relative src").not.toMatch(/^https?:|^\//);
      expect(existsSync(fromRoot(`gh-page/${src}`)), `${src} should exist`).toBe(true);
    }
  });

  it("references a stylesheet and hero image that exist", () => {
    const css = doc.querySelector('link[rel="stylesheet"]')?.getAttribute("href") ?? "";
    expect(existsSync(fromRoot(`gh-page/${css}`))).toBe(true);
    const hero = doc.querySelector(".hero__art img")?.getAttribute("src") ?? "";
    expect(existsSync(fromRoot(`gh-page/${hero}`))).toBe(true);
  });
});

describe("gh-page/_protected_pages.txt", () => {
  const manifest = read("gh-page/_protected_pages.txt");

  it("password-protects index.html with a non-empty password", () => {
    const entries = manifest
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    expect(entries.length).toBeGreaterThanOrEqual(1);

    const index = entries.find((l) => l.split(/\s+/)[0] === "index.html");
    expect(index, "index.html must be listed as protected").toBeDefined();
    const password = index!.slice("index.html".length).trim();
    expect(password.length).toBeGreaterThan(0);
  });
});

describe(".github/workflows/pages.yml", () => {
  const wf = read(".github/workflows/pages.yml");

  it("builds the gh-page folder with Jekyll", () => {
    expect(wf).toContain("actions/jekyll-build-pages");
    expect(wf).toMatch(/source:\s*\.\/gh-page/);
  });

  it("encrypts the protected pages with PageCrypt before deploying", () => {
    expect(wf).toContain("pagecrypt");
    expect(wf).toContain("gh-page/_protected_pages.txt");
  });

  it("deploys to GitHub Pages with the required permissions", () => {
    expect(wf).toContain("actions/deploy-pages");
    expect(wf).toContain("pages: write");
    expect(wf).toContain("id-token: write");
  });
});
