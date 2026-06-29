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

  it('uses the "Your files. Your Pod. Your power." headline', () => {
    const title = doc.querySelector(".hero__title")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    expect(title).toMatch(/Your files\.\s*Your Pod\.\s*Your power\./i);
  });

  it("integrates Tim Berners-Lee's Solid vision in the Why section", () => {
    const why = doc.querySelector(".why")?.textContent ?? "";
    expect(why).toMatch(/Berners-Lee/);
    expect(why).toMatch(/vision/i);
  });

  it("states that Solid's complexity is kept in the background", () => {
    const features = (doc.querySelector("#features")?.textContent ?? "").replace(/\s+/g, " ");
    expect(features).toMatch(/complexity in the background/i);
  });

  it("advertises the provided features", () => {
    const features = doc.querySelectorAll("#features .feature");
    expect(features.length).toBeGreaterThanOrEqual(4);
  });

  it("has a usage & installation section", () => {
    const section = doc.querySelector("#get-started");
    expect(section).toBeTruthy();
    const text = (section?.textContent ?? "").replace(/\s+/g, " ");
    // Usage steps + installation options (PWA, Docker, source).
    expect(section!.querySelectorAll(".step").length).toBeGreaterThanOrEqual(3);
    expect(text).toMatch(/install/i);
    expect(text).toMatch(/docker run/i);
    expect(text).toMatch(/npm run dev/i);
    // Points to the repo README too.
    expect(
      Array.from(section!.querySelectorAll("a")).some((a) =>
        /github\.com\/WSE-research\/Solid-Drive#readme/i.test(a.getAttribute("href") ?? ""),
      ),
    ).toBe(true);
    // The standalone PWA install card was removed.
    expect(text).not.toMatch(/desktop app \(PWA\)/i);
    // Linked from the primary nav.
    expect(
      Array.from(doc.querySelectorAll(".site-nav a")).some(
        (a) => a.getAttribute("href") === "#get-started",
      ),
    ).toBe(true);
  });

  it("links to the live demo, the repo and Solid.Sync", () => {
    const links = hrefs(doc);
    expect(links.some((h) => h.includes("wse-research.org/Solid.Drive"))).toBe(true);
    expect(links.some((h) => h === "https://github.com/WSE-research/Solid-Drive")).toBe(true);
    // The companion project is now "Solid.Sync".
    expect(links.some((h) => h === "https://github.com/WSE-research/Solid.Sync")).toBe(true);
    expect(links.some((h) => h.includes("SolidPodDeviceSynchronizer"))).toBe(false);
    expect(doc.body.textContent ?? "").toContain("Solid.Sync");
    expect(doc.body.textContent ?? "").not.toMatch(/Solid Pod Device Synchronizer/);
  });

  it("shows the logo beside the hero headline and has no fork ribbon", () => {
    const heroLogo = doc.querySelector(".hero .hero__head .hero__logo")?.getAttribute("src") ?? "";
    expect(heroLogo).toBe("assets/img/hero-logo.png");
    expect(existsSync(fromRoot(`gh-page/${heroLogo}`))).toBe(true);
    expect(doc.querySelector(".fork-ribbon")).toBeNull();
  });

  it("provides a lightbox with prev/next and a caption", () => {
    expect(doc.querySelector("#lightbox")).toBeTruthy();
    expect(doc.querySelector("#lightbox .lightbox__nav--prev")).toBeTruthy();
    expect(doc.querySelector("#lightbox .lightbox__nav--next")).toBeTruthy();
    expect(doc.querySelector("#lightbox .lightbox__caption")).toBeTruthy();
    const lightboxImgs = Array.from(doc.querySelectorAll("img[data-lightbox]"));
    expect(lightboxImgs.length).toBeGreaterThanOrEqual(4);
    // Each lightbox image carries a title for the bottom caption.
    for (const img of lightboxImgs) {
      expect((img.getAttribute("data-title") ?? "").length).toBeGreaterThan(0);
    }
  });

  it("has a fixed semi-transparent header", () => {
    const header = doc.querySelector(".site-header");
    expect(header).toBeTruthy();
    const css = read("gh-page/assets/css/style.css");
    expect(css).toMatch(/\.site-header\s*\{[^}]*position:\s*fixed/);
  });

  it("credits Leipzig University of Applied Sciences with a UTM-tagged link", () => {
    const link = Array.from(doc.querySelectorAll("a")).find((a) =>
      (a.textContent ?? "").includes("Leipzig University of Applied Sciences"),
    );
    expect(link, "Leipzig University of Applied Sciences link").toBeTruthy();
    const href = link!.getAttribute("href") ?? "";
    expect(href).toContain("htwk-leipzig.de");
    expect(href).toMatch(/utm_source=/);
    expect(href).toMatch(/utm_medium=/);
    expect(href).toMatch(/utm_campaign=/);
    // No bare "HTWK Leipzig" wording remains on the page.
    expect(doc.body.textContent ?? "").not.toMatch(/HTWK Leipzig/);
  });

  it("shows a gallery of screenshots whose files all exist", () => {
    const imgs = Array.from(doc.querySelectorAll("#showcase .gallery-grid img"));
    expect(imgs.length).toBeGreaterThanOrEqual(4);
    for (const img of imgs) {
      const src = img.getAttribute("src") ?? "";
      expect(src, "gallery image needs a relative src").not.toMatch(/^https?:|^\//);
      expect(existsSync(fromRoot(`gh-page/${src}`)), `${src} should exist`).toBe(true);
    }
  });

  it("ships every theme × color-scheme showcase image the switcher needs", () => {
    const themes = ["dark", "light"];
    const schemes = ["indigo", "emerald", "amber", "rose"];
    for (const theme of themes) {
      for (const scheme of schemes) {
        const rel = `gh-page/assets/img/showcase/my-files-${theme}-${scheme}.png`;
        expect(existsSync(fromRoot(rel)), `${rel} should exist`).toBe(true);
      }
    }
    // The switcher controls expose both axes.
    expect(doc.querySelector('.switcher__buttons[data-axis="theme"]')).toBeTruthy();
    expect(doc.querySelector('.switcher__buttons[data-axis="scheme"]')).toBeTruthy();
  });

  it("has a scroll-to-top control", () => {
    expect(doc.querySelector("#scroll-top")).toBeTruthy();
  });

  it("uses an aspect-preserved square favicon and references existing assets", () => {
    const icon = doc.querySelector('link[rel="icon"]')?.getAttribute("href") ?? "";
    expect(icon).toBe("assets/img/favicon.png");
    expect(existsSync(fromRoot(`gh-page/${icon}`))).toBe(true);
    const css = doc.querySelector('link[rel="stylesheet"][href$=".css"]')?.getAttribute("href") ?? "";
    expect(existsSync(fromRoot(`gh-page/${css}`))).toBe(true);
    const logo = doc.querySelector(".brand__logo")?.getAttribute("src") ?? "";
    expect(existsSync(fromRoot(`gh-page/${logo}`))).toBe(true);
  });

  it('shows the "Built on the Solid Protocol" pill above the headline with the Solid emblem', () => {
    const hero = doc.querySelector(".hero");
    const pill = hero?.querySelector(".pill") ?? null;
    const head = hero?.querySelector(".hero__head") ?? null;
    expect(pill).toBeTruthy();
    expect(head).toBeTruthy();
    // Pill must precede the headline row in document order (i.e. above it).
    expect(pill!.compareDocumentPosition(head!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((pill!.textContent ?? "").replace(/\s+/g, " ")).toMatch(/Built on the\s*Solid Protocol/);
    // The Solid emblem is inlined inside the pill, between "the" and "Solid".
    expect(pill!.querySelector("svg.pill__emblem")).toBeTruthy();
  });

  it("loads the DM Sans font used by the live app", () => {
    const fontLink = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).some((l) =>
      (l.getAttribute("href") ?? "").includes("family=DM+Sans"),
    );
    expect(fontLink).toBe(true);
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

describe("webpage Docker deployment (WSE docker-service-updater)", () => {
  const dockerWf = read(".github/workflows/webpage-docker-image.yml");
  const registerWf = read(".github/workflows/register_service.yml");

  it("ships a self-contained nginx Dockerfile that encrypts the page", () => {
    expect(existsSync(fromRoot("gh-page/Dockerfile"))).toBe(true);
    const dockerfile = read("gh-page/Dockerfile");
    expect(dockerfile).toMatch(/FROM nginx/i);
    expect(dockerfile).toContain("pagecrypt");
    expect(dockerfile).toContain("gh-page/nginx.conf");
  });

  it("serves the page for the /Solid.Drive proxy without a redirect loop", () => {
    expect(existsSync(fromRoot("gh-page/nginx.conf"))).toBe(true);
    const conf = read("gh-page/nginx.conf");
    // The WSE proxy strips the prefix, so serve from root and also map the
    // prefix (intact case). Crucially: no prefix redirect, which loops
    // behind a stripping proxy.
    expect(conf).toMatch(/location\s+\/\s*\{/);
    expect(conf).toMatch(/location\s+\/Solid\.Drive\/\s*\{/);
    expect(conf).toMatch(/alias\s+\/usr\/share\/nginx\/html\//);
    expect(conf).toContain("try_files");
    expect(conf).not.toMatch(/return\s+30\d\s+\/Solid\.Drive/);
  });

  it("sets <base> so relative assets resolve under /Solid.Drive/", () => {
    expect(read(PAGE)).toMatch(/<base\s+href="\/Solid\.Drive\/"/);
  });

  it("builds from gh-page/Dockerfile and pushes solid.drive-webpage on tags only", () => {
    expect(dockerWf).toMatch(/--file gh-page\/Dockerfile/);
    expect(dockerWf).toContain("wseresearch/solid.drive-webpage");
    // Push/login steps are gated on tag releases.
    expect(dockerWf).toMatch(/startsWith\(github\.ref, 'refs\/tags\/'\)/);
    expect(dockerWf).toContain("docker push wseresearch/solid.drive-webpage:latest");
  });

  it("triggers the WSE docker-service-updater on release", () => {
    expect(dockerWf).toContain("WSE-research/docker-service-updater");
    expect(dockerWf).toContain("UPDATER_HOST");
    expect(dockerWf).toContain("API_KEY");
  });

  it("registers the webpage service via service_config", () => {
    expect(registerWf).toContain("WSE-research/docker-service-updater");
    expect(registerWf).toMatch(/mode:\s*register/);
    const config = JSON.parse(read("service_config/service_config.json")) as {
      services: Array<{ image: string }>;
    };
    expect(config.services.some((s) => s.image === "wseresearch/solid.drive-webpage")).toBe(true);
  });
});
