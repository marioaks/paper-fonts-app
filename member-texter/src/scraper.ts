import type { Page } from "playwright";
import type { AppConfig, Selector } from "./types.ts";
import { firstVisible, humanClick, actionDelay } from "./humanize.ts";
import { readClipboard } from "./clipboard.ts";
import { normalizePhone } from "./phone.ts";

export interface MemberPageData {
  name: string;
  /** Normalized phone (E.164) or null when the member is email-only. */
  phone: string | null;
}

function asArray(sel: Selector): string[] {
  return Array.isArray(sel) ? sel : [sel];
}

/** Collect absolute URLs from anchor elements matching the selector. */
async function collectHrefs(page: Page, sel: Selector): Promise<string[]> {
  const urls = new Set<string>();
  for (const s of asArray(sel)) {
    const hrefs = await page
      .locator(s)
      .evaluateAll((nodes) =>
        nodes
          .map((n) => (n as HTMLAnchorElement).href)
          .filter((h): h is string => typeof h === "string" && h.length > 0),
      );
    for (const h of hrefs) urls.add(h);
  }
  return [...urls];
}

/**
 * Walk the home page → each folder/list → collect every member page URL.
 * Member pages are identified by anchor href, which works for server-rendered
 * apps. (If your app navigates purely via JS with no per-member URL, the member
 * links selector can instead target the clickable rows and you'd adapt this to
 * click-and-go-back; the mock and most apps use real links.)
 */
export async function collectMemberUrls(page: Page, cfg: AppConfig): Promise<string[]> {
  await page.goto(cfg.homeUrl, { waitUntil: "domcontentloaded" });
  await actionDelay(cfg.pacing);

  const folderUrls = await collectHrefs(page, cfg.site.folderLinks);
  const memberUrls = new Set<string>();

  // If there are no distinct folders, treat the home page itself as the list.
  const listsToVisit = folderUrls.length > 0 ? folderUrls : [cfg.homeUrl];

  for (const folderUrl of listsToVisit) {
    await page.goto(folderUrl, { waitUntil: "domcontentloaded" });
    await actionDelay(cfg.pacing);
    for (const url of await collectHrefs(page, cfg.site.memberLinks)) {
      memberUrls.add(url);
    }
  }

  return [...memberUrls];
}

async function getTextOrNull(
  page: Page,
  sel: Selector,
  timeoutMs = 2500,
): Promise<string | null> {
  try {
    const loc = await firstVisible(page, sel, timeoutMs);
    return (await loc.innerText()).trim();
  } catch {
    return null;
  }
}

/** Open a member page and read their name + phone (if present). */
export async function readMemberPage(
  page: Page,
  cfg: AppConfig,
  url: string,
): Promise<MemberPageData> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await actionDelay(cfg.pacing);

  const name = (await getTextOrNull(page, cfg.site.memberName)) ?? "Unknown member";
  const phoneText = await getTextOrNull(page, cfg.site.memberPhone);
  const phone = normalizePhone(phoneText);

  return { name, phone };
}

/**
 * Move the mouse to the member page's "copy initial message" button, click it,
 * and read back exactly what it placed on the clipboard. That text is what gets
 * sent — the message content is always defined by your page, never by this
 * tool.
 */
export async function copyInitialMessage(page: Page, cfg: AppConfig): Promise<string> {
  // The page must be focused for the clipboard read to succeed.
  await page.bringToFront();
  const button = await firstVisible(page, cfg.site.copyMessageButton);
  await humanClick(page, button, cfg.pacing);
  await actionDelay(cfg.pacing);
  const message = (await readClipboard(page)).trim();
  if (!message) {
    throw new Error("'copy initial message' produced an empty clipboard.");
  }
  return message;
}

/** Answer the member page's "did you reach out?" survey with yes, then save. */
export async function markSurveyReachedOut(page: Page, cfg: AppConfig): Promise<void> {
  if (!cfg.site.surveyReachedOutYes) return;
  await page.bringToFront();
  const yes = await firstVisible(page, cfg.site.surveyReachedOutYes);
  await humanClick(page, yes, cfg.pacing);
  await actionDelay(cfg.pacing);
  if (cfg.site.surveySubmit) {
    const submit = await firstVisible(page, cfg.site.surveySubmit);
    await humanClick(page, submit, cfg.pacing);
    await actionDelay(cfg.pacing);
  }
  // If the page shows a "saved" confirmation, wait for it so we know the
  // answer persisted before moving to the next member.
  if (cfg.site.surveySavedIndicator) {
    await firstVisible(page, cfg.site.surveySavedIndicator, 15000);
  }
}
