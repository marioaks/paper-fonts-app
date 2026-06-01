#!/usr/bin/env node
/**
 * member-texter — a single-file assistant for member outreach.
 *
 * It opens a people-list page you point it at, finds everyone tagged
 * "Not started", and for each person:
 *   1. opens their detail page,
 *   2. if they have a phone number  -> sends the page's copied message as a TEXT
 *      from voice.google.com,
 *      else if they have an email   -> sends the same message as an EMAIL from Gmail,
 *   3. answers the outreach survey ("Waiting on response") and submits it,
 *   4. moves on to the next "Not started" person until none remain.
 *
 * It never contacts the same person twice (local log), never sends both a text
 * and an email to one person, and prefers texting when a number is available.
 *
 * EVERYTHING RUNS LOCALLY. It only talks to your member site, Google Voice, and
 * Gmail — the same servers your browser already uses. No passwords are stored;
 * you log in by hand in the Chrome window it opens, and the script waits until
 * it can see the real member list before doing anything.
 *
 * --------------------------------------------------------------------------
 * USAGE
 *   node member-texter.mjs --list "<people-list-url>" --subject "<email subject>"
 *
 * FIRST RUN
 *   Chrome opens. Log in to your app in the first tab (and Google Voice / Gmail
 *   in the others when you are ready). The script WAITS until it sees member rows
 *   on your list page — it will not exit early or close the window while you are
 *   still on a login screen. After the first successful login, the same
 *   --profile folder remembers your session for later runs.
 * --------------------------------------------------------------------------
 */

import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

/** Folder where this script lives — profile and log defaults are always here. */
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROFILE_DIR = join(SCRIPT_DIR, "chrome-profile");
const DEFAULT_CONTACT_LOG = join(SCRIPT_DIR, "contact-log.json");

// --- Selectors (from the live app / Google Voice / Gmail) -------------------
// Try several selectors — some builds use <button>, others use <div role="button">, etc.
const ROW_SELECTORS = [
  ".person-list-item",
  "button.person-list-item",
  ".person-list-item button",
  '[class*="person-list-item"]',
];

const SEL = {
  personRow: ".person-list-item",
  rowBadge: ".badge",
  rowName: ".emp-flex", // index 1 holds the name (0 = avatar initials)
  personPhone: '[data-testid="userPhone"]',
  personEmail: '[data-testid="user-email"]',
  copyMessage: "copy initial message",
  copyMessageButton: 'button:has-text("copy initial message")',
  surveyWaiting: "Waiting on response",
  surveySubmit: "#submitContactOutreachButton",
  gv: {
    compose: "Send new message",
    sendTo: ".send-to-button",
    messageInput: ".message-input",
    send: ".send-button",
    recipientPicker: '[gv-test-id="recipient-picker"]',
    contactBackdrop: ".contact-list-backdrop, .cdk-overlay-backdrop",
    recipientInput:
      'input[placeholder*="phone" i], input[placeholder*="name" i], input[type="tel"], [gv-test-id="recipient-input"] input, [gv-test-id="recipient-input"]',
  },
  gmail: {
    compose: "Compose",
    to: 'input[aria-label="To recipients"], textarea[name="to"], input[aria-label="To"]',
    subject: 'input[name="subjectbox"]',
    body: 'div[aria-label="Message Body"]',
    send: /^send/i,
  },
};

// URL path fragments that often mean "login / auth", not the member list.
const LOGIN_PATH_HINTS = /\/(login|log-in|signin|sign-in|auth|oauth|sso)(\/|$)/i;

// --- Small utilities --------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const digitsOnly = (s) => (s || "").replace(/\D/g, "");
const PASTE_MOD = process.platform === "darwin" ? "Meta" : "Control";

function ts() {
  return new Date().toLocaleTimeString();
}
const log = {
  info: (m) => console.log(`[${ts()}] ${m}`),
  step: (m) => console.log(`[${ts()}] -> ${m}`),
  warn: (m) => console.warn(`[${ts()}] ! ${m}`),
  ok: (m) => console.log(`[${ts()}] OK ${m}`),
  err: (m) => console.error(`[${ts()}] x ${m}`),
};
function maskPhone(p) {
  const d = digitsOnly(p);
  return d.length <= 4 ? "****" : "*".repeat(d.length - 4) + d.slice(-4);
}
function maskEmail(e) {
  const [u, host] = String(e).split("@");
  if (!host) return "***";
  return `${u.slice(0, 1)}***@${host}`;
}

function waitAny(promises) {
  return new Promise((resolve, reject) => {
    let failures = 0;
    for (const p of promises) {
      Promise.resolve(p).then(resolve, () => {
        if (++failures === promises.length) reject(new Error("all waits failed"));
      });
    }
  });
}

async function safeText(locator) {
  try {
    if ((await locator.count()) === 0) return "";
    return ((await locator.first().textContent()) || "").trim();
  } catch {
    return "";
  }
}

async function humanClick(page, locator) {
  try {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (box) {
      const x = box.x + box.width * (0.3 + Math.random() * 0.4);
      const y = box.y + box.height * (0.3 + Math.random() * 0.4);
      await page.mouse.move(x, y, { steps: rnd(8, 20) });
      await sleep(rnd(40, 160));
      await page.mouse.down();
      await sleep(rnd(30, 90));
      await page.mouse.up();
      return;
    }
  } catch {
    /* fall through */
  }
  await locator.click();
}

async function clearField(page, locator) {
  await locator.click();
  await page.keyboard.press(`${PASTE_MOD}+A`);
  await page.keyboard.press("Delete");
}

async function humanType(page, locator, text) {
  await clearField(page, locator);
  for (const ch of text) {
    await page.keyboard.type(ch);
    let d = rnd(45, 150);
    if (".!?".includes(ch)) d += rnd(120, 400);
    await sleep(d);
  }
}

async function clickByName(page, name) {
  const byRole = page.getByRole("button", { name }).first();
  try {
    if ((await byRole.count()) > 0) {
      await humanClick(page, byRole);
      return;
    }
  } catch {
    /* fall through */
  }
  await humanClick(page, page.getByText(name, { exact: false }).first());
}

async function fieldText(locator) {
  try {
    return (await locator.inputValue()).trim();
  } catch {
    return (await safeText(locator)).trim();
  }
}

async function pasteInto(page, locator, fallbackText) {
  await locator.scrollIntoViewIfNeeded();
  await clearField(page, locator);
  await sleep(rnd(120, 300));
  await page.keyboard.press(`${PASTE_MOD}+V`);
  await sleep(rnd(200, 450));
  if (!(await fieldText(locator)) && fallbackText) {
    await locator.click();
    await page.keyboard.insertText(fallbackText);
  }
}

// --- Login / list detection (no credentials stored) -------------------------
function urlsRoughlyMatch(current, expected) {
  try {
    const a = new URL(current);
    const b = new URL(expected);
    const norm = (p) => (p.replace(/\/$/, "") || "/");
    if (a.origin !== b.origin) return false;
    if (norm(a.pathname) === norm(b.pathname)) return true;
    return a.href.startsWith(b.origin + norm(b.pathname));
  } catch {
    return current === expected || current.startsWith(expected);
  }
}

/** Search main page and any iframes for member rows. */
async function countPersonRows(page, { visibleOnly = false } = {}) {
  let best = { count: 0, selector: ROW_SELECTORS[0], frame: "main" };
  const contexts = [{ name: "main", root: page }];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    contexts.push({ name: "iframe", root: frame });
  }
  for (const { name, root } of contexts) {
    for (const sel of ROW_SELECTORS) {
      try {
        const loc = root.locator(sel);
        const total = await loc.count();
        if (total === 0) continue;
        if (!visibleOnly) {
          if (total > best.count) best = { count: total, selector: sel, frame: name };
          continue;
        }
        let vis = 0;
        for (let i = 0; i < total && i < 30; i++) {
          if (await loc.nth(i).isVisible().catch(() => false)) vis++;
        }
        if (vis > best.count) best = { count: vis, selector: sel, frame: name };
      } catch {
        /* try next */
      }
    }
  }
  return best;
}

/** Heuristic: page looks like a dedicated login screen (not just a list with a header link). */
async function looksLikeLoginPage(page) {
  const rows = await countPersonRows(page, { visibleOnly: false });
  if (rows.count > 0) return false;

  let path = "";
  try {
    path = new URL(page.url()).pathname;
  } catch {
    path = page.url();
  }
  if (LOGIN_PATH_HINTS.test(path)) return true;

  try {
    const pw = page.locator('input[type="password"]');
    if ((await pw.count()) > 0 && (await pw.first().isVisible().catch(() => false))) return true;
  } catch {
    /* ignore */
  }

  return false;
}

/** One-line diagnostics — only when you pass --debug-list */
async function debugListDetection(page, args) {
  const dom = await countPersonRows(page, { visibleOnly: false });
  const vis = await countPersonRows(page, { visibleOnly: true });
  const parts = [
    `url=${page.url()}`,
    `DOM=${dom.count} (${dom.selector})`,
    `visible=${vis.count}`,
  ];
  if (args.listReady) {
    try {
      parts.push(`list-ready=${await page.locator(args.listReady).count()}`);
    } catch {
      parts.push("list-ready=error");
    }
  }
  log.info(`[debug-list] ${parts.join(" | ")}`);
}

/** True when the member list is present (DOM counts — not only Playwright "visible"). */
async function isMemberListReady(page, listReadySelector) {
  if (listReadySelector) {
    try {
      const loc = page.locator(listReadySelector).first();
      await loc.waitFor({ state: "attached", timeout: 2000 });
      return (await loc.count()) > 0;
    } catch {
      return false;
    }
  }
  const dom = await countPersonRows(page, { visibleOnly: false });
  if (dom.count > 0) return true;
  const vis = await countPersonRows(page, { visibleOnly: true });
  return vis.count > 0;
}

/** Wait up to waitMs for rows to appear without reloading the page. */
async function waitForListOnPage(page, args, waitMs) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (await isMemberListReady(page, args.listReady)) return true;
    await sleep(400);
  }
  return false;
}

/**
 * Block until the member list is visible at --list, or until timeout.
 * Navigates once, then polls the DOM — does NOT refresh the page every few seconds.
 */
async function waitForMemberList(app, args, { phase = "startup" } = {}) {
  if (args.skipLoginWait) return true;
  if (args.headless) {
    log.err(
      "Headless mode cannot complete a manual login. Run without --headless so you can log in in the browser window.",
    );
    return false;
  }

  const timeoutMs = args.loginTimeoutMin * 60 * 1000;
  const started = Date.now();
  let lastLog = 0;
  let didInitialGoto = false;

  log.info(
    phase === "startup"
      ? "Opening your list, Google Voice, and Gmail. Sign in in each Chrome tab if needed; the script continues when each is ready."
      : "Waiting for the member list to appear again...",
  );
  log.info(`List URL: ${args.list}`);

  for (;;) {
    await app.bringToFront();

    if (!didInitialGoto || !urlsRoughlyMatch(app.url(), args.list)) {
      await app.goto(args.list, { waitUntil: "load", timeout: 60000 }).catch(() => {});
      didInitialGoto = true;
    }

    const found = await waitForListOnPage(app, args, args.listDetectSec * 1000);
    if (found || (await isMemberListReady(app, args.listReady))) {
      const info = await countPersonRows(app, { visibleOnly: false });
      log.ok(
        `Member list detected (${info.count} row(s) via "${info.selector}"${info.frame !== "main" ? " in " + info.frame : ""}). Starting.`,
      );
      return true;
    }

    const elapsed = Date.now() - started;
    if (elapsed >= timeoutMs) {
      log.err(
        `Timed out after ${args.loginTimeoutMin} minutes waiting for the member list. ` +
          "Log in in Chrome, confirm --list is the correct people-list URL, then run again.",
      );
      if (args.debugList) await debugListDetection(app, args);
      else log.info("Run with --debug-list to print what selectors the script sees on the page.");
      return false;
    }

    if (Date.now() - lastLog > 8000) {
      lastLog = Date.now();
      const onLogin = await looksLikeLoginPage(app);
      const dom = await countPersonRows(app, { visibleOnly: false });
      const vis = await countPersonRows(app, { visibleOnly: true });
      let hint;
      if (onLogin) {
        hint = "Looks like a login page — sign in in the Chrome tab.";
      } else if (dom.count > 0 && vis.count === 0) {
        hint = `Found ${dom.count} row(s) in the page but automation cannot see them as visible — continuing anyway on next check.`;
      } else if (dom.count === 0) {
        hint = "Cannot find .person-list-item rows yet — wait for the list to load (page is not being refreshed).";
      } else {
        hint = "Still checking for the member list...";
      }
      const left = Math.ceil((timeoutMs - elapsed) / 60000);
      log.step(`${hint} (${left} min left)`);
      if (args.debugList) await debugListDetection(app, args);
    }

    await sleep(2000);
  }
}

/** Google sign-in interstitial (Voice and Gmail share Google accounts). */
function isGoogleAccountPage(page) {
  try {
    return /accounts\.google\.com/i.test(page.url());
  } catch {
    return false;
  }
}

async function isGoogleVoiceReady(page) {
  if (isGoogleAccountPage(page)) return false;
  try {
    const compose = page.getByRole("button", { name: new RegExp(SEL.gv.compose, "i") });
    if ((await compose.count()) > 0) return true;
  } catch {
    /* ignore */
  }
  try {
    if ((await page.locator(SEL.gv.messageInput).count()) > 0) return true;
  } catch {
    /* ignore */
  }
  try {
    return /voice\.google\.com/i.test(page.url());
  } catch {
    return false;
  }
}

async function isGmailReady(page) {
  if (isGoogleAccountPage(page)) return false;
  try {
    const compose = page.getByRole("button", { name: new RegExp(SEL.gmail.compose, "i") });
    if ((await compose.count()) > 0) return true;
  } catch {
    /* ignore */
  }
  try {
    return /mail\.google\.com/i.test(page.url());
  } catch {
    return false;
  }
}

/**
 * Wait until a Google service (Voice or Gmail) is usable — same idea as the member list:
 * one navigation, then poll the DOM without hammering reload. Sign-in is manual in Chrome.
 */
async function waitForGoogleService(page, args, { serviceName, url, isReady, phase = "startup" }) {
  if (args.skipLoginWait) return true;
  if (args.headless) return true;

  const timeoutMs = args.loginTimeoutMin * 60 * 1000;
  const started = Date.now();
  let lastLog = 0;
  let didInitialGoto = false;

  log.info(
    phase === "startup"
      ? `Waiting for ${serviceName} — sign in in that Chrome tab if needed.`
      : `${serviceName} session may have expired — sign in again in that tab.`,
  );

  for (;;) {
    await page.bringToFront();
    if (!didInitialGoto || !urlsRoughlyMatch(page.url(), url)) {
      await page.goto(url, { waitUntil: "load", timeout: 60000 }).catch(() => {});
      didInitialGoto = true;
      await sleep(1500);
    }

    if (await isReady(page)) {
      log.ok(`${serviceName} is ready.`);
      return true;
    }

    const elapsed = Date.now() - started;
    if (elapsed >= timeoutMs) {
      log.err(`Timed out waiting for ${serviceName} (${args.loginTimeoutMin} min).`);
      return false;
    }

    if (Date.now() - lastLog > 8000) {
      lastLog = Date.now();
      const hint = isGoogleAccountPage(page)
        ? `Finish Google sign-in for ${serviceName} in Chrome.`
        : `Still waiting for ${serviceName} to load...`;
      const left = Math.ceil((timeoutMs - elapsed) / 60000);
      log.step(`${hint} (${left} min left)`);
    }
    await sleep(2000);
  }
}

async function waitForGoogleVoice(page, args, opts = {}) {
  return waitForGoogleService(page, args, {
    serviceName: "Google Voice",
    url: args.gvUrl,
    isReady: isGoogleVoiceReady,
    phase: opts.phase || "startup",
  });
}

async function waitForGmail(page, args, opts = {}) {
  return waitForGoogleService(page, args, {
    serviceName: "Gmail",
    url: args.gmailUrl,
    isReady: isGmailReady,
    phase: opts.phase || "startup",
  });
}

async function ensureGoogleVoiceReady(page, args) {
  await page.bringToFront();
  if (await isGoogleVoiceReady(page)) return true;
  return waitForGoogleVoice(page, args, { phase: "reauth" });
}

async function ensureGmailReady(page, args) {
  await page.bringToFront();
  if (await isGmailReady(page)) return true;
  return waitForGmail(page, args, { phase: "reauth" });
}

/** Go to the list only if needed; wait for rows without hammering reload. */
async function ensureOnMemberList(app, args) {
  await app.bringToFront();
  if (!urlsRoughlyMatch(app.url(), args.list)) {
    await app.goto(args.list, { waitUntil: "load", timeout: 60000 }).catch(() => {});
    await sleep(500);
  }
  const ok = await waitForListOnPage(app, args, args.listDetectSec * 1000);
  return ok && (await isMemberListReady(app, args.listReady));
}

/** Count rows whose badge is "Not started". */
async function countNotStartedRows(page) {
  const rows = page.locator(SEL.personRow);
  const count = await rows.count();
  let n = 0;
  for (let i = 0; i < count; i++) {
    const badge = await safeText(rows.nth(i).locator(SEL.rowBadge));
    if (norm(badge) === "not started") n++;
  }
  return n;
}

// --- Contact log ------------------------------------------------------------
async function openLog(path) {
  let entries = [];
  try {
    entries = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(entries)) entries = [];
  } catch {
    entries = [];
  }
  const urls = new Set();
  const phones = new Set();
  const emails = new Set();
  for (const e of entries) {
    if (e.personUrl) urls.add(e.personUrl);
    if (e.phoneKey) phones.add(e.phoneKey);
    if (e.emailKey) emails.add(e.emailKey);
  }
  return {
    alreadyContacted(personUrl, phone, email) {
      const pk = digitsOnly(phone);
      const ek = (email || "").trim().toLowerCase();
      return (
        (personUrl && urls.has(personUrl)) ||
        (pk && phones.has(pk)) ||
        (ek && emails.has(ek))
      );
    },
    async add(entry) {
      entries.push(entry);
      if (entry.personUrl) urls.add(entry.personUrl);
      if (entry.phoneKey) phones.add(entry.phoneKey);
      if (entry.emailKey) emails.add(entry.emailKey);
      await mkdir(dirname(path), { recursive: true }).catch(() => {});
      await writeFile(path, JSON.stringify(entries, null, 2), "utf8");
    },
  };
}

// --- Page actions -----------------------------------------------------------
async function openNextNotStarted(app, processedKeys) {
  const rows = app.locator(SEL.personRow);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const badge = await safeText(row.locator(SEL.rowBadge));
    if (norm(badge) !== "not started") continue;

    const key = norm(await safeText(row));
    if (!key || processedKeys.has(key)) continue;
    processedKeys.add(key);

    const name = (await safeText(row.locator(SEL.rowName).nth(1))) || "Unknown";
    const clickTarget = row.locator("button").first();
    if ((await clickTarget.count()) > 0) {
      await humanClick(app, clickTarget);
    } else {
      await humanClick(app, row);
    }
    await waitForPersonPage(app);
    return { name };
  }
  return null;
}

async function waitForPersonPage(app) {
  await waitAny([
    app.getByText(new RegExp(SEL.copyMessage, "i")).first().waitFor({ state: "attached", timeout: 15000 }),
    app.locator(SEL.surveySubmit).first().waitFor({ state: "attached", timeout: 15000 }),
    app.locator(SEL.personPhone).first().waitFor({ state: "attached", timeout: 15000 }),
    app.locator(SEL.personEmail).first().waitFor({ state: "attached", timeout: 15000 }),
  ]).catch(() => {});
}

async function readTestId(page, testid) {
  const loc = page.locator(`[data-testid="${testid}"]`).first();
  try {
    if ((await loc.count()) === 0) return null;
    const t = ((await loc.textContent()) || "").trim();
    return t || null;
  } catch {
    return null;
  }
}

async function readPageClipboard(page) {
  try {
    return (await page.evaluate(async () => await navigator.clipboard.readText())) || "";
  } catch {
    return "";
  }
}

/** Click the real <button> that wraps "copy initial message" (text may be in nested divs). */
async function clickCopyInitialMessageButton(app) {
  await app.bringToFront();
  const candidates = [
    app.getByRole("button", { name: /copy initial message/i }),
    app.locator(SEL.copyMessageButton),
    app.locator("button").filter({ hasText: /copy initial message/i }),
  ];
  for (const loc of candidates) {
    try {
      const btn = loc.first();
      if ((await btn.count()) === 0) continue;
      await btn.scrollIntoViewIfNeeded();
      await humanClick(app, btn);
      return;
    } catch {
      /* try next locator */
    }
  }
  throw new Error('Could not find the "copy initial message" button on this page');
}

/**
 * Click copy, then wait until the clipboard changes (proves the site's copy ran).
 */
async function copyInitialMessage(app) {
  await app.bringToFront();
  const before = (await readPageClipboard(app)).trim();
  await clickCopyInitialMessageButton(app);

  const deadline = Date.now() + 8000;
  let after = before;
  while (Date.now() < deadline) {
    await sleep(150);
    after = (await readPageClipboard(app)).trim();
    if (after && after !== before) {
      log.step(`Copied message (${after.length} characters) from the member page`);
      return after;
    }
  }

  if (after && after === before) {
    throw new Error(
      'Clicked "copy initial message" but the clipboard did not change — still showing your previous copy. ' +
        "Try clicking the button once manually in Chrome to confirm it works.",
    );
  }
  throw new Error('Clicked "copy initial message" but could not read the clipboard');
}

async function dismissGoogleVoiceOverlays(gv) {
  const backdrop = gv.locator(SEL.gv.contactBackdrop);
  for (let i = 0; i < 10; i++) {
    const blocking =
      (await backdrop.count()) > 0 &&
      (await backdrop.first().isVisible().catch(() => false));
    if (!blocking) break;
    await gv.keyboard.press("Escape");
    await sleep(280);
  }
}

/** Close any half-finished compose so the next person starts clean. */
async function resetGoogleVoiceCompose(gv, args) {
  await gv.bringToFront();
  await dismissGoogleVoiceOverlays(gv);
  for (let i = 0; i < 4; i++) {
    await gv.keyboard.press("Escape");
    await sleep(220);
  }
  if (args?.gvUrl) {
    await gv.goto(args.gvUrl, { waitUntil: "load", timeout: 45000 }).catch(() => {});
    await sleep(rnd(600, 1000));
  }
}

/** Start a brand-new Voice thread (like after sending) — used every text and after each dry run. */
async function startNewGoogleVoiceMessage(gv, args) {
  await resetGoogleVoiceCompose(gv, args);
  await clickByName(gv, SEL.gv.compose);
  await sleep(rnd(500, 900));
}

async function focusGoogleVoiceRecipientField(gv) {
  for (const sel of SEL.gv.recipientInput.split(", ").map((s) => s.trim())) {
    const loc = gv.locator(sel).first();
    try {
      if ((await loc.count()) > 0 && (await loc.isVisible())) {
        await loc.click({ timeout: 5000 });
        await sleep(rnd(150, 350));
        return loc;
      }
    } catch {
      /* try next selector */
    }
  }
  return null;
}

/** Pick a visible contact row in the overlay (skip hidden duplicate nodes). */
async function clickVisibleRecipientPicker(gv, phoneText) {
  const pickers = gv.locator(SEL.gv.recipientPicker);
  const n = await pickers.count();
  if (n === 0) return false;
  const last4 = digitsOnly(phoneText).slice(-4);
  let clicked = false;
  for (let i = 0; i < n; i++) {
    const row = pickers.nth(i);
    if (!(await row.isVisible().catch(() => false))) continue;
    const label = ((await row.textContent()) || "").replace(/\s+/g, " ");
    if (last4.length === 4 && label && !label.includes(last4)) continue;
    try {
      await row.click({ timeout: 5000 });
      clicked = true;
      break;
    } catch {
      /* try next visible row */
    }
  }
  return clicked;
}

async function confirmGoogleVoiceRecipient(gv, phoneText) {
  await sleep(rnd(400, 700));
  await clickVisibleRecipientPicker(gv, phoneText);
  await sleep(rnd(400, 700));
  await dismissGoogleVoiceOverlays(gv);
  await sleep(rnd(200, 400));
}

/** Put the copied message in the body (use the string we already have — not the clipboard). */
async function fillGoogleVoiceMessage(gv, message) {
  if (!message || !message.trim()) {
    throw new Error("No message text to put in Google Voice");
  }
  await dismissGoogleVoiceOverlays(gv);
  const input = gv.locator(SEL.gv.messageInput).first();
  await input.waitFor({ state: "visible", timeout: 20000 });
  await dismissGoogleVoiceOverlays(gv);
  try {
    await input.click({ timeout: 8000 });
  } catch {
    await input.focus({ timeout: 8000 }).catch(() => {});
  }
  await sleep(rnd(200, 400));
  await input.fill("");
  await sleep(rnd(150, 300));
  await input.fill(message);
  await sleep(rnd(300, 500));
  let val = await fieldText(input);
  if (val.length < Math.min(20, message.length)) {
    await input.focus();
    await gv.keyboard.insertText(message);
    val = await fieldText(input);
  }
  if (val.length < Math.min(10, message.length)) {
    throw new Error("Could not enter message text in Google Voice");
  }
}

async function addGoogleVoiceRecipient(gv, phoneText) {
  const field = await focusGoogleVoiceRecipientField(gv);
  if (field) {
    await field.fill("");
    await field.fill(phoneText);
  } else {
    await gv.keyboard.press(`${PASTE_MOD}+A`);
    await gv.keyboard.press("Backspace");
    await gv.keyboard.type(phoneText, { delay: rnd(60, 130) });
  }
  await sleep(rnd(400, 800));
  const sendTo = gv.locator(SEL.gv.sendTo).first();
  if ((await sendTo.count()) > 0 && (await sendTo.isVisible().catch(() => false))) {
    await humanClick(gv, sendTo);
  } else {
    await gv.keyboard.press("Enter");
  }
}

async function sendText(gv, phoneText, message, { actuallySend = true, args } = {}) {
  if (args && !(await ensureGoogleVoiceReady(gv, args))) {
    throw new Error("Google Voice is not signed in");
  }
  await startNewGoogleVoiceMessage(gv, args);
  await gv.bringToFront();
  await addGoogleVoiceRecipient(gv, phoneText);
  await sleep(rnd(400, 700));
  await confirmGoogleVoiceRecipient(gv, phoneText);
  await fillGoogleVoiceMessage(gv, message);
  await sleep(rnd(300, 700));
  if (!actuallySend) {
    log.ok(
      `DRY RUN: Google Voice compose filled for ${maskPhone(phoneText)} — Send was NOT clicked`,
    );
    await startNewGoogleVoiceMessage(gv, args);
    log.step("DRY RUN: opened a fresh Google Voice message for the next person");
    return;
  }
  await humanClick(gv, gv.locator(SEL.gv.send).first());
  await sleep(rnd(1200, 2200));
}

async function sendEmail(gmail, toEmail, subject, message, { actuallySend = true, args } = {}) {
  if (args && !(await ensureGmailReady(gmail, args))) {
    throw new Error("Gmail is not signed in");
  }
  await gmail.bringToFront();
  await clickByName(gmail, SEL.gmail.compose);
  await sleep(rnd(600, 1200));
  await humanType(gmail, gmail.locator(SEL.gmail.to).first(), toEmail);
  await sleep(rnd(200, 500));
  await humanType(gmail, gmail.locator(SEL.gmail.subject).first(), subject || "");
  await sleep(rnd(200, 500));
  await pasteInto(gmail, gmail.locator(SEL.gmail.body).first(), message);
  await sleep(rnd(300, 700));
  if (!actuallySend) {
    log.ok(
      `DRY RUN: Gmail compose filled for ${maskEmail(toEmail)} — Send was NOT clicked`,
    );
    return;
  }
  const sendBtn = gmail.getByRole("button", { name: SEL.gmail.send }).first();
  try {
    await sendBtn.click({ timeout: 3000 });
  } catch {
    await gmail.keyboard.press(`${PASTE_MOD}+Enter`);
  }
  await sleep(rnd(1200, 2200));
}

async function markSurvey(app) {
  await app.bringToFront();
  let radio = app.getByRole("radio", { name: new RegExp(SEL.surveyWaiting, "i") }).first();
  if ((await radio.count()) === 0) {
    radio = app.getByText(new RegExp(SEL.surveyWaiting, "i")).first();
  }
  await humanClick(app, radio);
  await sleep(rnd(200, 500));
  await humanClick(app, app.locator(SEL.surveySubmit).first());
  await sleep(rnd(800, 1600));
  await app.waitForLoadState("domcontentloaded").catch(() => {});
}

/**
 * Decide why there is no next "Not started" person.
 * Returns: "done" | "login" | "empty-list"
 */
async function noMoreNotStartedReason(app, args) {
  if (!(await isMemberListReady(app, args.listReady))) {
    return "login";
  }
  const notStarted = await countNotStartedRows(app);
  if (notStarted === 0) return "done";
  return "empty-list";
}

// --- Orchestration ----------------------------------------------------------
export async function main(argv) {
  const args = parseArgs(argv);
  if (!args.list) {
    log.err("Missing required --list <people-list-url>. Use --help for usage.");
    return { sent: 0, error: "missing-list" };
  }

  const contactLog = await openLog(args.log);
  const summary = {
    sent: 0,
    rehearsed: 0,
    texted: 0,
    emailed: 0,
    skippedNoContact: 0,
    skippedAlready: 0,
    failed: 0,
    stoppedReason: "",
  };

  let context;
  let keepBrowserOpen = args.keepOpen;

  try {
    log.info(`Chrome profile (logins saved here): ${args.profile}`);
    context = await chromium.launchPersistentContext(args.profile, {
      channel: args.chromium ? undefined : args.channel,
      headless: args.headless,
      viewport: null,
      args: ["--disable-blink-features=AutomationControlled"],
      permissions: ["clipboard-read", "clipboard-write"],
    });

    const app = await context.newPage();
    const gv = await context.newPage();
    await gv.goto(args.gvUrl, { waitUntil: "domcontentloaded" }).catch(() => {});

    let gmail = null;

    if (!args.skipLoginWait && !args.headless) {
      const ready = await waitForMemberList(app, args, { phase: "startup" });
      if (!ready) {
        summary.stoppedReason = "login-timeout";
        keepBrowserOpen = true;
        return summary;
      }
      const gvReady = await waitForGoogleVoice(gv, args, { phase: "startup" });
      if (!gvReady) {
        summary.stoppedReason = "gv-login-timeout";
        keepBrowserOpen = true;
        return summary;
      }
      gmail = await context.newPage();
      await gmail.goto(args.gmailUrl, { waitUntil: "load", timeout: 60000 }).catch(() => {});
      const gmailReady = await waitForGmail(gmail, args, { phase: "startup" });
      if (!gmailReady) {
        summary.stoppedReason = "gmail-login-timeout";
        keepBrowserOpen = true;
        return summary;
      }
    } else {
      log.info("Skipping login wait (--skip-login-wait / --already-logged-in).");
      await app.goto(args.list, { waitUntil: "load", timeout: 60000 }).catch(() => {});
      const ok = await waitForListOnPage(app, args, args.listDetectSec * 1000);
      if (!ok && !(await isMemberListReady(app, args.listReady))) {
        log.err(
          "Member list not detected. Try without --skip-login-wait, or run with --debug-list.",
        );
        if (args.debugList) await debugListDetection(app, args);
        summary.stoppedReason = "list-not-detected";
        keepBrowserOpen = true;
        return summary;
      }
      const info = await countPersonRows(app, { visibleOnly: false });
      log.ok(`Member list detected (${info.count} row(s)).`);
    }

    if (args.dryRun) {
      log.info(
        "DRY RUN: will walk through Google Voice / Gmail compose but will NOT click Send or submit the survey.",
      );
    }

    const processedKeys = new Set();

    for (;;) {
      const doneCount = args.dryRun ? summary.rehearsed : summary.sent;
      if (args.max && doneCount >= args.max) {
        summary.stoppedReason = "max-reached";
        log.info(`Reached --max ${args.max}; stopping.`);
        break;
      }

      const onList = await ensureOnMemberList(app, args);
      if (!onList) {
        log.warn("Member list not detected on this page.");
        if (args.debugList) await debugListDetection(app, args);
        const again = await waitForMemberList(app, args, { phase: "reauth" });
        if (!again) {
          summary.stoppedReason = "login-lost";
          keepBrowserOpen = true;
          break;
        }
        continue;
      }

      let person;
      try {
        person = await openNextNotStarted(app, processedKeys);
      } catch (e) {
        log.err(`Could not read the list: ${e.message}`);
        summary.stoppedReason = "list-error";
        keepBrowserOpen = true;
        break;
      }

      if (!person) {
        const reason = await noMoreNotStartedReason(app, args);
        if (reason === "login") {
          log.warn("Member list disappeared — waiting for login again...");
          const again = await waitForMemberList(app, args, { phase: "reauth" });
          if (!again) {
            summary.stoppedReason = "login-lost";
            keepBrowserOpen = true;
          }
          if (again) continue;
          break;
        }
        if (reason === "done") {
          summary.stoppedReason = "completed";
          log.info('No more "Not started" people. Done.');
        } else {
          summary.stoppedReason = "no-not-started";
          log.info('List is visible but no "Not started" rows remain. Done.');
        }
        break;
      }

      const personUrl = app.url();
      try {
        const phoneText = await readTestId(app, "userPhone");
        const emailText = await readTestId(app, "user-email");
        const channel = phoneText ? "text" : emailText ? "email" : null;

        if (!channel) {
          summary.skippedNoContact++;
          log.warn(`Skip (no phone or email): ${person.name}`);
          continue;
        }
        if (contactLog.alreadyContacted(personUrl, phoneText, emailText)) {
          summary.skippedAlready++;
          log.info(`Skip (already contacted): ${person.name}`);
          continue;
        }

        if (args.planOnly) {
          const via = channel === "text" ? `text ${maskPhone(phoneText)}` : `email ${maskEmail(emailText)}`;
          log.info(`Plan -> ${person.name} via ${via}`);
          continue;
        }

        const message = await copyInitialMessage(app);
        if (!message.trim()) {
          throw new Error('Empty message after copy initial message');
        }
        const actuallySend = !args.dryRun;

        if (channel === "text") {
          await sendText(gv, phoneText, message, { actuallySend, args });
          if (args.dryRun) {
            summary.rehearsed++;
            log.ok(`DRY RUN rehearsed text flow for ${person.name} ${maskPhone(phoneText)}`);
          } else {
            summary.texted++;
            summary.sent++;
            log.ok(`Texted ${person.name} ${maskPhone(phoneText)}`);
          }
        } else {
          if (!gmail) gmail = await getOrOpenGmail(context, args);
          await sendEmail(gmail, emailText, args.subject, message, { actuallySend, args });
          if (args.dryRun) {
            summary.rehearsed++;
            log.ok(`DRY RUN rehearsed email flow for ${person.name} ${maskEmail(emailText)}`);
          } else {
            summary.emailed++;
            summary.sent++;
            log.ok(`Emailed ${person.name} ${maskEmail(emailText)}`);
          }
        }

        if (!args.dryRun) {
          await markSurvey(app);
          await contactLog.add({
            name: person.name,
            personUrl,
            channel,
            phoneKey: channel === "text" ? digitsOnly(phoneText) : "",
            emailKey: channel === "email" ? emailText.trim().toLowerCase() : "",
            messagePreview: message.replace(/\s+/g, " ").slice(0, 80),
            sentAt: new Date().toISOString(),
          });
        } else {
          log.step(`DRY RUN: survey not submitted for ${person.name}`);
        }

        if (!args.dryRun && (!args.max || summary.sent < args.max)) {
          const waitMs = rnd(args.minGap * 1000, args.maxGap * 1000);
          log.step(`Pausing ~${Math.round(waitMs / 1000)}s before the next person...`);
          await sleep(waitMs);
        } else if (args.dryRun) {
          await sleep(rnd(800, 2000));
        }
      } catch (e) {
        summary.failed++;
        log.err(`Problem with ${person.name}: ${e.message}`);
        if (channel === "text") {
          try {
            await startNewGoogleVoiceMessage(gv, args);
            log.step("Reset Google Voice — fresh message compose for the next person.");
          } catch {
            /* ignore cleanup errors */
          }
        }
      }
    }
  } finally {
    if (context) {
      if (keepBrowserOpen) {
        log.info("Leaving Chrome open so you can finish logging in or inspect the page.");
        log.info("Close the browser window yourself when you are done.");
      } else {
        await context.close();
      }
    }
  }

  const sentPart = args.dryRun
    ? `rehearsed=${summary.rehearsed} (nothing sent)`
    : `sent=${summary.sent} (texted=${summary.texted}, emailed=${summary.emailed})`;
  log.info(
    `Summary: ${sentPart} ` +
      `skipped(no-contact)=${summary.skippedNoContact} skipped(already)=${summary.skippedAlready} ` +
      `failed=${summary.failed} reason=${summary.stoppedReason || "unknown"}`,
  );
  return summary;
}

let gmailPageCache = null;
async function getOrOpenGmail(context, args) {
  if (gmailPageCache && !gmailPageCache.isClosed()) {
    if (!(await isGmailReady(gmailPageCache))) {
      await ensureGmailReady(gmailPageCache, args);
    }
    return gmailPageCache;
  }
  gmailPageCache = await context.newPage();
  await gmailPageCache.goto(args.gmailUrl, { waitUntil: "load", timeout: 60000 }).catch(() => {});
  if (!args.skipLoginWait && !args.headless) {
    await waitForGmail(gmailPageCache, args, { phase: "startup" });
  }
  return gmailPageCache;
}

function resolveDataPath(p) {
  if (!p) return p;
  if (p.startsWith("/")) return p;
  if (process.platform === "win32" && /^[a-zA-Z]:[\\/]/.test(p)) return p;
  return join(SCRIPT_DIR, p);
}

export function parseArgs(argv) {
  const args = {
    list: "",
    subject: "",
    profile: DEFAULT_PROFILE_DIR,
    log: DEFAULT_CONTACT_LOG,
    gvUrl: "https://voice.google.com",
    gmailUrl: "https://mail.google.com",
    channel: "chrome",
    chromium: false,
    headless: false,
    dryRun: false,
    planOnly: false,
    max: 0,
    minGap: 15,
    maxGap: 40,
    loginTimeoutMin: 30,
    skipLoginWait: false,
    listReady: "",
    keepOpen: false,
    debugList: false,
    listDetectSec: 45,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--list": args.list = next(); break;
      case "--subject": args.subject = next(); break;
      case "--profile": args.profile = next(); break;
      case "--log": args.log = next(); break;
      case "--gv-url": args.gvUrl = next(); break;
      case "--gmail-url": args.gmailUrl = next(); break;
      case "--channel": args.channel = next(); break;
      case "--list-ready": args.listReady = next(); break;
      case "--login-timeout": args.loginTimeoutMin = Number(next()) || 30; break;
      case "--chromium": args.chromium = true; break;
      case "--headless": args.headless = true; break;
      case "--dry-run": args.dryRun = true; break;
      case "--plan-only": args.planOnly = true; break;
      case "--max": args.max = Number(next()) || 0; break;
      case "--min-gap": args.minGap = Number(next()) || 0; break;
      case "--max-gap": args.maxGap = Number(next()) || 0; break;
      case "--skip-login-wait":
      case "--already-logged-in":
        args.skipLoginWait = true;
        break;
      case "--keep-open": args.keepOpen = true; break;
      case "--debug-list": args.debugList = true; break;
      case "--list-detect-sec": args.listDetectSec = Number(next()) || 45; break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith("--list=")) args.list = a.slice(7);
        else if (a.startsWith("--subject=")) args.subject = a.slice(10);
        else if (a.startsWith("--login-timeout=")) args.loginTimeoutMin = Number(a.slice(16)) || 30;
    }
  }
  if (args.maxGap < args.minGap) args.maxGap = args.minGap;
  args.profile = resolveDataPath(args.profile);
  args.log = resolveDataPath(args.log);
  return args;
}

function printHelp() {
  console.log(
    [
      "member-texter — texts/emails your 'Not started' members one by one.",
      "",
      "Usage:",
      '  node member-texter.mjs --list "<people-list-url>" --subject "<email subject>"',
      "",
      "Login (secure — no passwords stored):",
      "  Chrome opens. Log in by hand in the browser. The script waits until it",
      "  sees member rows (button.person-list-item) on your --list page, then starts.",
      "  It will NOT exit early just because you are still on a login screen.",
      "  Sessions are saved in --profile for later runs.",
      "",
      "Options:",
      "  --list <url>           (required) people-list page URL",
      "  --subject <text>       email subject (Gmail fallback)",
      "  --login-timeout <min>  max minutes to wait for login (default 30)",
      "  --list-ready <css>     extra selector that must exist when list is ready",
      "  --keep-open            always leave Chrome open when the script exits",
      "  --debug-list           log URL and selector counts while waiting",
      "  --list-detect-sec <n>  seconds to wait for rows after load (default 45)",
      "  --skip-login-wait      skip login wait for list + Voice + Gmail",
      "  --already-logged-in    same as --skip-login-wait",
      "  --dry-run              rehearse Voice/Gmail (fill compose) but never click Send; no survey",
      "  --plan-only            list who would be contacted only (no Voice/Gmail UI)",
      "  --max <n>              stop after n sends",
      "  --profile <dir>        optional override (default: chrome-profile next to this script)",
      "  -h, --help             show this help",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((s) => {
      const bad =
        (s?.failed ?? 0) > 0 ||
        s?.stoppedReason === "login-timeout" ||
        s?.stoppedReason === "login-lost";
      process.exit(bad ? 1 : 0);
    })
    .catch((e) => {
      log.err(e?.stack || e?.message || String(e));
      process.exit(1);
    });
}
