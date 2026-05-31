import type { Locator, Page } from "playwright";
import type { PacingConfig, Selector } from "./types.ts";

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Random integer in [min, max]. */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Random pause sized for a small in-page action (clicks, focus changes). */
export function actionDelay(pacing: PacingConfig): Promise<void> {
  const [a, b] = pacing.actionDelayMs;
  return sleep(randInt(a, b));
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Try each candidate selector in order; resolve to the first that is visible. */
export async function firstVisible(
  page: Page,
  selector: Selector,
  timeoutMs = 15000,
): Promise<Locator> {
  const candidates = Array.isArray(selector) ? selector : [selector];
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    for (const sel of candidates) {
      const loc = page.locator(sel).first();
      try {
        if (await loc.isVisible()) return loc;
      } catch (err) {
        lastErr = err;
      }
    }
    await sleep(200);
  }
  throw new Error(
    `None of these selectors became visible within ${timeoutMs}ms: ` +
      `${candidates.join(" | ")}${lastErr ? ` (last error: ${String(lastErr)})` : ""}`,
  );
}

/**
 * Move the real mouse pointer to an element along a multi-step path and click
 * it. This is what makes the interaction look like a person moving the mouse
 * rather than a script firing synthetic events.
 */
export async function humanClick(
  page: Page,
  locator: Locator,
  pacing: PacingConfig,
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    // Fall back to a normal click if geometry isn't available.
    await locator.click();
    return;
  }
  // Aim for a random point inside the element, not dead-center.
  const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
  const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);
  await page.mouse.move(targetX, targetY, { steps: randInt(8, 22) });
  await actionDelay(pacing);
  await page.mouse.down();
  await sleep(randInt(40, 120));
  await page.mouse.up();
}

/**
 * Type text one character at a time with randomized inter-key delays. We never
 * inject typos into the actual message — the content must match the page's
 * "copy initial message" exactly — but the cadence is intentionally irregular.
 */
export async function humanType(
  page: Page,
  locator: Locator,
  text: string,
  pacing: PacingConfig,
): Promise<void> {
  await locator.click();
  await actionDelay(pacing);
  const [minK, maxK] = pacing.keystrokeDelayMs;
  for (const char of text) {
    await page.keyboard.type(char);
    let delay = randInt(minK, maxK);
    // Occasional longer "thinking" pause, like a person composing.
    if (Math.random() < 0.04) delay += randInt(250, 900);
    // A natural beat after sentence-ending punctuation.
    if (".!?".includes(char)) delay += randInt(150, 500);
    await sleep(delay);
  }
}

/**
 * If an active-hours window is configured, block until we're inside it. Keeps
 * the sending pattern looking like a human who works during normal hours.
 */
export async function waitForActiveHours(pacing: PacingConfig): Promise<void> {
  const window = pacing.activeHours;
  if (!window) return;
  for (;;) {
    const hour = new Date().getHours();
    const inWindow =
      window.start <= window.end
        ? hour >= window.start && hour < window.end
        : hour >= window.start || hour < window.end; // window wraps midnight
    if (inWindow) return;
    await sleep(60_000);
  }
}
