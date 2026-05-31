import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Page } from "playwright";

const execFileAsync = promisify(execFile);

/**
 * Read the clipboard contents that the page's "copy initial message" button
 * just wrote.
 *
 * Primary strategy: read it from inside the browser via the async Clipboard
 * API. This works on https pages and on localhost (both are "secure contexts")
 * and reads exactly what the page copied, with no OS dependency. The browser
 * context must have been granted the "clipboard-read" permission (see
 * browser.ts).
 *
 * Fallback: on macOS, shell out to `pbpaste`. Useful if a site copies via a
 * mechanism the in-page read can't see, or if permissions are unavailable.
 */
export async function readClipboard(page: Page): Promise<string> {
  try {
    const text = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    if (typeof text === "string" && text.length > 0) return text;
  } catch {
    // fall through to pbpaste
  }

  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("pbpaste");
      return stdout;
    } catch {
      // fall through
    }
  }

  throw new Error(
    "Could not read the clipboard after clicking 'copy initial message'. " +
      "Make sure the browser context was granted clipboard-read permission.",
  );
}
