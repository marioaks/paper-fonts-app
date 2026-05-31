import type { Page } from "playwright";
import type { AppConfig } from "./types.ts";
import { firstVisible, humanClick, humanType, actionDelay, sleep } from "./humanize.ts";

/**
 * Send a single text from Google Voice's web UI, driving it the way a person
 * would: open a new conversation, type the recipient's number, type the
 * message at a human cadence, then click send.
 *
 * Selectors live in config because Google Voice changes its markup; use
 * `npm run codegen -- https://voice.google.com` to capture current ones.
 */
export async function sendText(
  gvPage: Page,
  cfg: AppConfig,
  phone: string,
  message: string,
): Promise<void> {
  await gvPage.bringToFront();
  const { selectors } = cfg.googleVoice;

  const compose = await firstVisible(gvPage, selectors.composeButton);
  await humanClick(gvPage, compose, cfg.pacing);
  await actionDelay(cfg.pacing);

  const recipient = await firstVisible(gvPage, selectors.recipientInput);
  await humanType(gvPage, recipient, phone, cfg.pacing);
  await actionDelay(cfg.pacing);
  // Commit the recipient (Google Voice turns the typed number into a chip).
  await gvPage.keyboard.press("Enter");
  await sleep(800);

  const body = await firstVisible(gvPage, selectors.messageInput);
  await humanType(gvPage, body, message, cfg.pacing);
  await actionDelay(cfg.pacing);

  const send = await firstVisible(gvPage, selectors.sendButton);
  await humanClick(gvPage, send, cfg.pacing);

  if (selectors.sentIndicator) {
    await firstVisible(gvPage, selectors.sentIndicator, 20000);
  } else {
    await sleep(1500);
  }
}

/** Open Google Voice once at the start of a run. */
export async function openGoogleVoice(gvPage: Page, cfg: AppConfig): Promise<void> {
  await gvPage.goto(cfg.googleVoice.url, { waitUntil: "domcontentloaded" });
}
