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
 * Gmail — the same servers your browser already uses. No data is sent anywhere
 * else, and you log in by hand once in the browser window it opens.
 *
 * --------------------------------------------------------------------------
 * USAGE
 *   node member-texter.mjs --list "<people-list-url>" --subject "<email subject>"
 *
 * COMMON OPTIONS
 *   --list <url>       (required) The people-list page to work through.
 *   --subject <text>   Subject line for any emails sent (Gmail fallback).
 *   --dry-run          Walk everyone and print the plan; send/submit nothing.
 *   --max <n>          Stop after sending to n people this run.
 *   --min-gap <sec>    Min pause between people (default 15).
 *   --max-gap <sec>    Max pause between people (default 40).
 *   --profile <dir>    Chrome profile folder to remember your logins
 *                      (default ./chrome-profile).
 *   --log <file>       "Already contacted" log (default ./contact-log.json).
 *   --gv-url <url>     Google Voice URL (default https://voice.google.com).
 *   --gmail-url <url>  Gmail URL (default https://mail.google.com).
 *   --chromium         Use Playwright's bundled Chromium instead of your
 *                      installed Google Chrome (mainly for testing).
 *   --headless         Run without a visible window (not recommended for real use).
 *   -h, --help         Show this help.
 *
 * FIRST RUN: a Chrome window opens with three tabs (your app, Google Voice,
 * Gmail). Log in to each, then press Enter in the terminal to begin.
 * --------------------------------------------------------------------------
 */

import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import process from "node:process";

// --- Selectors (from the live app / Google Voice / Gmail) -------------------
const SEL = {
  personRow: "button.person-list-item",
  rowBadge: ".badge",
  rowName: ".emp-flex", // index 1 holds the name (0 = avatar initials)
  personPhone: '[data-testid="userPhone"]',
  personEmail: '[data-testid="user-email"]',
  copyMessage: "copy initial message", // accessible name / visible text
  surveyWaiting: "Waiting on response", // first survey radio
  surveySubmit: "#submitContactOutreachButton",
  gv: {
    compose: "Send new message",
    sendTo: ".send-to-button",
    messageInput: ".message-input",
    send: ".send-button",
  },
  gmail: {
    compose: "Compose",
    to: 'input[aria-label="To recipients"], textarea[name="to"], input[aria-label="To"]',
    subject: 'input[name="subjectbox"]',
    body: 'div[aria-label="Message Body"]',
    send: /^send/i,
  },
};

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

// Resolve when ANY of the promises resolves; reject only if all reject.
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

// Move the mouse to an element and click a random point inside it (looks human).
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
    /* fall through to a normal click */
  }
  await locator.click();
}

// Clear whatever is currently in a focused field (defends against drafts /
// pre-filled values), keeping the field's element focused.
async function clearField(page, locator) {
  await locator.click();
  await page.keyboard.press(`${PASTE_MOD}+A`);
  await page.keyboard.press("Delete");
}

// Type text one key at a time with irregular timing (content is never altered).
async function humanType(page, locator, text) {
  await clearField(page, locator);
  for (const ch of text) {
    await page.keyboard.type(ch);
    let d = rnd(45, 150);
    if (".!?".includes(ch)) d += rnd(120, 400);
    await sleep(d);
  }
}

// Click a button/element by its accessible name, falling back to visible text.
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

// Read the current text of an input/textarea or contenteditable field.
async function fieldText(locator) {
  try {
    return (await locator.inputValue()).trim();
  } catch {
    return (await safeText(locator)).trim();
  }
}

// Paste the previously-copied message into a field. Clears it first, then tries
// a real paste (matches the manual workflow); if that leaves the field empty
// (e.g. headless), falls back to inserting the captured text.
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

// --- Contact log (dedupe so nobody is contacted twice) ----------------------
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

// Find and open the next "Not started" person we haven't visited this run.
// Returns { name } after navigating to their page, or null if none remain.
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
    await humanClick(app, row);
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

// Click "copy initial message" and read back exactly what it copied.
async function copyInitialMessage(app) {
  await app.bringToFront();
  await clickByName(app, SEL.copyMessage);
  await sleep(rnd(250, 600));
  try {
    const text = await app.evaluate(async () => await navigator.clipboard.readText());
    return (text || "").trim();
  } catch {
    return ""; // clipboard still holds it for a real paste even if we can't read it
  }
}

async function sendText(gv, phoneText, message) {
  await gv.bringToFront();
  await clickByName(gv, SEL.gv.compose);
  await sleep(rnd(500, 1100));
  // Type the number into the active recipient input.
  await gv.keyboard.type(phoneText, { delay: rnd(60, 130) });
  await sleep(rnd(400, 900));
  await humanClick(gv, gv.locator(SEL.gv.sendTo).first());
  await sleep(rnd(400, 900));
  await pasteInto(gv, gv.locator(SEL.gv.messageInput).first(), message);
  await sleep(rnd(300, 700));
  await humanClick(gv, gv.locator(SEL.gv.send).first());
  await sleep(rnd(1200, 2200));
}

async function sendEmail(gmail, toEmail, subject, message) {
  await gmail.bringToFront();
  await clickByName(gmail, SEL.gmail.compose);
  await sleep(rnd(600, 1200));
  await humanType(gmail, gmail.locator(SEL.gmail.to).first(), toEmail);
  await sleep(rnd(200, 500));
  await humanType(gmail, gmail.locator(SEL.gmail.subject).first(), subject || "");
  await sleep(rnd(200, 500));
  await pasteInto(gmail, gmail.locator(SEL.gmail.body).first(), message);
  await sleep(rnd(300, 700));
  const sendBtn = gmail.getByRole("button", { name: SEL.gmail.send }).first();
  try {
    await sendBtn.click({ timeout: 3000 });
  } catch {
    await gmail.keyboard.press(`${PASTE_MOD}+Enter`);
  }
  await sleep(rnd(1200, 2200));
}

// Answer the survey ("Waiting on response") and submit it.
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
    texted: 0,
    emailed: 0,
    skippedNoContact: 0,
    skippedAlready: 0,
    failed: 0,
  };

  const context = await chromium.launchPersistentContext(args.profile, {
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

  if (!args.headless && process.stdin.isTTY && !args.dryRun) {
    await app.goto(args.list, { waitUntil: "domcontentloaded" }).catch(() => {});
    await prompt("Log in to your app, Google Voice, and Gmail in the open tabs, then press Enter to begin");
  }

  const processedKeys = new Set();
  try {
    for (;;) {
      if (args.max && summary.sent >= args.max) {
        log.info(`Reached --max ${args.max}; stopping.`);
        break;
      }

      await app.bringToFront();
      await app.goto(args.list, { waitUntil: "domcontentloaded" });
      await app.locator(SEL.personRow).first().waitFor({ state: "attached", timeout: 20000 }).catch(() => {});

      let person;
      try {
        person = await openNextNotStarted(app, processedKeys);
      } catch (e) {
        log.err(`Could not read the list: ${e.message}`);
        break;
      }
      if (!person) {
        log.info('No more "Not started" people. Done.');
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

        if (args.dryRun) {
          const via = channel === "text" ? `text ${maskPhone(phoneText)}` : `email ${maskEmail(emailText)}`;
          log.info(`Plan -> ${person.name} via ${via}`);
          continue;
        }

        const message = await copyInitialMessage(app);

        if (channel === "text") {
          await sendText(gv, phoneText, message);
          summary.texted++;
          log.ok(`Texted ${person.name} ${maskPhone(phoneText)}`);
        } else {
          if (!gmail) {
            gmail = await context.newPage();
            await gmail.goto(args.gmailUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
          }
          await sendEmail(gmail, emailText, args.subject, message);
          summary.emailed++;
          log.ok(`Emailed ${person.name} ${maskEmail(emailText)}`);
        }

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
        summary.sent++;

        if (!args.max || summary.sent < args.max) {
          const waitMs = rnd(args.minGap * 1000, args.maxGap * 1000);
          log.step(`Pausing ~${Math.round(waitMs / 1000)}s before the next person...`);
          await sleep(waitMs);
        }
      } catch (e) {
        summary.failed++;
        log.err(`Problem with ${person.name}: ${e.message}`);
      }
    }
  } finally {
    await context.close();
  }

  log.info(
    `Summary: sent=${summary.sent} (texted=${summary.texted}, emailed=${summary.emailed}) ` +
      `skipped(no-contact)=${summary.skippedNoContact} skipped(already)=${summary.skippedAlready} ` +
      `failed=${summary.failed}`,
  );
  return summary;
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await rl.question(`${question} `);
  } finally {
    rl.close();
  }
}

export function parseArgs(argv) {
  const args = {
    list: "",
    subject: "",
    profile: "./chrome-profile",
    log: "./contact-log.json",
    gvUrl: "https://voice.google.com",
    gmailUrl: "https://mail.google.com",
    channel: "chrome",
    chromium: false,
    headless: false,
    dryRun: false,
    max: 0,
    minGap: 15,
    maxGap: 40,
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
      case "--chromium": args.chromium = true; break;
      case "--headless": args.headless = true; break;
      case "--dry-run": args.dryRun = true; break;
      case "--max": args.max = Number(next()) || 0; break;
      case "--min-gap": args.minGap = Number(next()) || 0; break;
      case "--max-gap": args.maxGap = Number(next()) || 0; break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith("--list=")) args.list = a.slice(7);
        else if (a.startsWith("--subject=")) args.subject = a.slice(10);
    }
  }
  if (args.maxGap < args.minGap) args.maxGap = args.minGap;
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
      "Options:",
      "  --list <url>      (required) people-list page to work through",
      "  --subject <text>  subject for any emails (Gmail fallback)",
      "  --dry-run         show the plan; send/submit nothing",
      "  --max <n>         stop after n sends this run",
      "  --min-gap <sec>   min pause between people (default 15)",
      "  --max-gap <sec>   max pause between people (default 40)",
      "  --profile <dir>   Chrome profile folder (default ./chrome-profile)",
      "  --log <file>      already-contacted log (default ./contact-log.json)",
      "  --gv-url <url>    Google Voice URL",
      "  --gmail-url <url> Gmail URL",
      "  --chromium        use bundled Chromium instead of installed Chrome",
      "  --headless        run without a visible window",
      "  -h, --help        show this help",
    ].join("\n"),
  );
}

// Run when invoked directly (not when imported for testing).
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((s) => process.exit(s && s.failed > 0 ? 1 : 0))
    .catch((e) => {
      log.err(e?.stack || e?.message || String(e));
      process.exit(1);
    });
}
