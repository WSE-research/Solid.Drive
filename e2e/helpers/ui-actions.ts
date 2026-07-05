import { expect, type Page } from "@playwright/test";
import { shot } from "./screenshots";

/**
 * UI-action helpers that mirror what an end user does. Use these in
 * tests instead of poking at the DOM directly so the surface stays small.
 */

export async function addContactViaUI(page: Page, contactWebId: string): Promise<void> {
  await page.locator("contacts-input-row .contacts__input").fill(contactWebId);
  await page
    .locator("contacts-input-row")
    .getByRole("button", { name: /^Add$/ })
    .click();
  await shot(page, "contact added");
}

export async function clickRequestAccessForContact(page: Page, contactName: string): Promise<void> {
  await page
    .locator("contact-row")
    .filter({ has: page.locator(".contact-row__name", { hasText: contactName }) })
    .getByRole("button", { name: /Request Access/i })
    .click();
  await shot(page, "request access");
}

export async function openRequestsPanel(page: Page): Promise<void> {
  const panel = page.locator("requests-panel");
  if ((await panel.locator("requests-panel-body").count()) === 0) {
    await panel.getByRole("button", { name: /^(Requests|Anfragen)/ }).click();
  }
  await shot(page, "requests panel");
}

export async function approveTopRequest(page: Page): Promise<void> {
  await openRequestsPanel(page);
  await page.getByRole("button", { name: /^(Approve|Genehmigen)$/ }).first().click();
  await shot(page, "request approved");
}

export async function denyTopRequest(page: Page): Promise<void> {
  await openRequestsPanel(page);
  await page.getByRole("button", { name: /^(Deny|Ablehnen)$/ }).first().click();
  await shot(page, "request denied");
}

/**
 * Expects A's view to show the type folder for `typeLabel` in "Also available".
 * Expands it and returns the folder locator.
 */
export async function expandTypeFolder(page: Page, typeLabel: string) {
  const folder = page.locator("type-folder").filter({ hasText: typeLabel });
  await expect(folder).toBeVisible();
  await folder.locator(".type-folder__toggle").click();
  await shot(page, `type folder ${typeLabel} expanded`);
  return folder;
}

/**
 * Opens the SharePanel for the named file (B's view of her own pod) and
 * revokes the named contact.
 */
export async function revokeContactInSharePanel(
  page: Page,
  fileTitle: string,
  contactName: string,
): Promise<void> {
  const card = page.locator("file-card").filter({ hasText: fileTitle });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /^(Share|Teilen)$/ }).click();

  const sharePanel = card.locator("share-panel");
  await expect(sharePanel).toBeVisible();
  await shot(page, "share panel");
  await sharePanel
    .locator("share-panel-row")
    .filter({ hasText: contactName })
    .getByRole("button", { name: /^(Revoke|Widerrufen)$/ })
    .click();
  await shot(page, "contact revoked");
}
