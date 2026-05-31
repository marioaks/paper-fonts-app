import { chromium, type BrowserContext } from "playwright";
import { mkdir } from "node:fs/promises";
import type { BrowserConfig } from "./types.ts";

/**
 * Launch a persistent browser context. "Persistent" means the profile
 * (cookies, logged-in sessions) is stored on disk in userDataDir, so you log in
 * to your app and Google Voice ONCE, by hand, and the tool reuses that session
 * on every later run. No passwords are ever stored in or handled by this code.
 *
 * On macOS, set channel to "chrome" to drive your real installed Google Chrome.
 */
export async function launchBrowser(cfg: BrowserConfig): Promise<BrowserContext> {
  await mkdir(cfg.userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(cfg.userDataDir, {
    channel: cfg.channel,
    headless: !cfg.headed,
    viewport: null,
    args: [
      // Hide the "Chrome is being controlled by automated test software" banner
      // and the corresponding automation hint. This does not defeat all bot
      // detection, but combined with a real profile + human pacing it keeps the
      // session looking like ordinary browsing.
      "--disable-blink-features=AutomationControlled",
    ],
    // The pages we read the clipboard on (your app) need read access so we can
    // capture the text produced by "copy initial message".
    permissions: ["clipboard-read", "clipboard-write"],
  });

  return context;
}
