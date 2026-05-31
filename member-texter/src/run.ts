import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { BrowserContext, Page } from "playwright";
import type { AppConfig, RunOptions } from "./types.ts";
import { loadConfig } from "./config.ts";
import { launchBrowser } from "./browser.ts";
import { ContactLog } from "./contactLog.ts";
import { log, maskPhone } from "./logger.ts";
import {
  collectMemberUrls,
  readMemberPage,
  copyInitialMessage,
  markSurveyReachedOut,
} from "./scraper.ts";
import { sendText, openGoogleVoice } from "./googleVoice.ts";
import { sleep, randInt, shuffle, waitForActiveHours } from "./humanize.ts";

export interface RunSummary {
  planned: number;
  sent: number;
  skippedEmailOnly: number;
  skippedAlreadyContacted: number;
  failed: number;
  stoppedReason: string;
}

interface FullRunArgs extends RunOptions {
  configPath: string;
  /** Injected in tests to avoid real readline prompts / login waits. */
  nonInteractive?: boolean;
}

export async function run(args: FullRunArgs): Promise<RunSummary> {
  const cfg = await loadConfig(args.configPath);
  const contactLog = await ContactLog.open(cfg.contactLogPath);

  const interactive = !args.nonInteractive && stdin.isTTY;
  const summary: RunSummary = {
    planned: 0,
    sent: 0,
    skippedEmailOnly: 0,
    skippedAlreadyContacted: 0,
    failed: 0,
    stoppedReason: "completed",
  };

  const maxPerRun = args.limit ?? cfg.limits.maxPerRun;
  const remainingToday = cfg.limits.maxPerDay - contactLog.countToday();
  const budget = Math.max(0, Math.min(maxPerRun, remainingToday));

  if (budget === 0) {
    log.warn(
      `Daily limit reached (${contactLog.countToday()}/${cfg.limits.maxPerDay}). Nothing to do.`,
    );
    summary.stoppedReason = "daily-limit";
    return summary;
  }

  log.info(`Send budget for this run: ${budget} message(s).`);
  if (args.dryRun) log.info("DRY RUN: no messages will be sent and no survey will be filled.");

  const context = await launchBrowser(cfg.browser);
  const memberPage = await context.newPage();
  const gvPage = await context.newPage();

  try {
    if (interactive) {
      await waitForLogin(memberPage, gvPage, cfg);
    } else {
      await openGoogleVoice(gvPage, cfg);
    }

    log.step("Collecting member pages from all folders…");
    let memberUrls = await collectMemberUrls(memberPage, cfg);
    if (cfg.behavior.randomizeOrder) memberUrls = shuffle(memberUrls);
    log.info(`Found ${memberUrls.length} member page(s).`);

    for (const url of memberUrls) {
      if (summary.sent >= budget) {
        summary.stoppedReason = "budget-reached";
        break;
      }

      try {
        const member = await readMemberPage(memberPage, cfg, url);

        if (!member.phone) {
          if (cfg.behavior.skipEmailOnly) {
            summary.skippedEmailOnly++;
            log.info(`Skip (no phone): ${member.name}`);
            continue;
          }
        } else if (contactLog.has(member.phone)) {
          summary.skippedAlreadyContacted++;
          log.info(`Skip (already texted): ${member.name} ${maskPhone(member.phone)}`);
          continue;
        }

        if (!member.phone) continue;

        // Click the page's button and capture the exact message it copied.
        const message = await copyInitialMessage(memberPage, cfg);
        summary.planned++;

        log.info(
          `Plan → ${member.name} ${maskPhone(member.phone)} : "${preview(message)}"`,
        );

        if (args.dryRun) continue;

        if (args.confirmEachSend && interactive) {
          const ok = await confirm(`Send to ${member.name} ${maskPhone(member.phone)}?`);
          if (!ok) {
            log.info("Skipped by user.");
            continue;
          }
        }

        await waitForActiveHours(cfg.pacing);
        await sendText(gvPage, cfg, member.phone, message);
        log.success(`Sent to ${member.name} ${maskPhone(member.phone)}`);

        if (cfg.behavior.fillSurvey) {
          await markSurveyReachedOut(memberPage, cfg);
        }

        await contactLog.add({
          phone: member.phone,
          name: member.name,
          url,
          messagePreview: preview(message),
          sentAt: new Date().toISOString(),
        });
        summary.sent++;

        if (summary.sent < budget) {
          const [a, b] = cfg.pacing.betweenMembersSec;
          const waitMs = randInt(a, b) * 1000;
          log.step(`Pausing ~${Math.round(waitMs / 1000)}s before the next member…`);
          await sleep(waitMs);
        }
      } catch (err) {
        summary.failed++;
        log.error(`Problem with ${url}: ${(err as Error).message}`);
      }
    }
  } finally {
    await context.close();
  }

  log.info(
    `Done. sent=${summary.sent} planned=${summary.planned} ` +
      `skipped(email)=${summary.skippedEmailOnly} ` +
      `skipped(already)=${summary.skippedAlreadyContacted} failed=${summary.failed} ` +
      `reason=${summary.stoppedReason}`,
  );
  return summary;
}

function preview(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? oneLine.slice(0, 57) + "…" : oneLine;
}

async function waitForLogin(memberPage: Page, gvPage: Page, cfg: AppConfig): Promise<void> {
  await memberPage.goto(cfg.homeUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
  await openGoogleVoice(gvPage, cfg).catch(() => {});
  log.info("Two tabs are open: your app and Google Voice.");
  await confirm(
    "Log in to BOTH (only needed the first time), then press Enter to begin",
  );
  await memberPage.bringToFront();
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${question} [Y/n] `)).trim().toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function parseArgs(argv: string[]): FullRunArgs {
  const args: FullRunArgs = {
    configPath: "config.json",
    dryRun: false,
    confirmEachSend: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--config":
        args.configPath = argv[++i] ?? args.configPath;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--confirm":
        args.confirmEachSend = true;
        break;
      case "--limit":
        args.limit = Number(argv[++i]);
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (a && a.startsWith("--config=")) args.configPath = a.slice("--config=".length);
        else if (a && a.startsWith("--limit=")) args.limit = Number(a.slice("--limit=".length));
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`member-texter — local, human-paced texting assistant

Usage:
  npm start -- [options]

Options:
  --config <path>   Path to config file (default: config.json)
  --dry-run         Walk every member and show what WOULD be sent; send nothing
  --confirm         Ask in the terminal before each individual send
  --limit <n>       Cap the number of messages this run
  -h, --help        Show this help

Safety:
  • Reuses your logged-in Chrome profile; no passwords are stored.
  • Never double-texts (local contact log).
  • Human-like mouse/typing/pacing and per-day caps to avoid red flags.
  • All data stays on your machine.`);
}

// Run as CLI when executed directly (not when imported by tests).
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  run(parseArgs(process.argv.slice(2)))
    .then((s) => process.exit(s.failed > 0 ? 1 : 0))
    .catch((err) => {
      log.error(err?.message ?? String(err));
      process.exit(1);
    });
}
