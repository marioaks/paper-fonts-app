import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startMockServer } from "../mock/server.mjs";
import { run } from "../src/run.ts";

const here = dirname(fileURLToPath(import.meta.url));

// Phones the five non-email-only mock members should resolve to.
const EXPECTED_PHONES = [
  "+15550101001", // Alice
  "+15550101003", // Carol
  "+15550101004", // Dave
  "+15550101006", // Frank
  "+15550101007", // Grace
].sort();

let srv;

before(async () => {
  srv = await startMockServer(0);
});

after(async () => {
  await srv.close();
});

/** Build a temp config (based on the mock template) pointed at the live port. */
async function makeConfig() {
  const tmp = await mkdtemp(join(tmpdir(), "member-texter-"));
  const template = JSON.parse(
    await readFile(join(here, "..", "mock", "config.mock.json"), "utf8"),
  );
  template.homeUrl = srv.homeUrl;
  template.googleVoice.url = srv.gvUrl;
  template.browser.userDataDir = join(tmp, "profile");
  template.contactLogPath = join(tmp, "contact-log.json");
  const configPath = join(tmp, "config.json");
  await mkdir(tmp, { recursive: true });
  await writeFile(configPath, JSON.stringify(template), "utf8");
  return { configPath, tmp };
}

test("sends only to members with phones and records the right message", async () => {
  await srv.reset();
  const { configPath, tmp } = await makeConfig();

  const summary = await run({
    configPath,
    dryRun: false,
    confirmEachSend: false,
    nonInteractive: true,
  });

  assert.equal(summary.failed, 0, "no members should error");
  assert.equal(summary.sent, 5, "five members have phone numbers");
  assert.equal(summary.skippedEmailOnly, 2, "two members are email-only");

  const records = await srv.records();
  assert.equal(records.length, 5, "exactly five texts recorded by Google Voice");

  const sentTo = records.map((r) => r.to).sort();
  assert.deepEqual(sentTo, EXPECTED_PHONES, "texts go to the normalized phone numbers");

  // Every message must be the page's own initial message (personalized), never
  // anything invented by the tool.
  for (const rec of records) {
    assert.match(rec.body, /^Hi \w+! Thanks for signing up\. Reply STOP to opt out\.$/);
  }
  // Spot-check that Alice's number got Alice's message.
  const alice = records.find((r) => r.to === "+15550101001");
  assert.ok(alice.body.startsWith("Hi Alice!"), "Alice's number received Alice's message");

  const surveys = await srv.surveys();
  assert.equal(surveys.length, 5, "survey marked for each successful send");
  assert.ok(surveys.every((s) => s.reachedOut === true), "survey answered 'yes'");

  // ---- Re-run with the same contact log: nobody should be texted twice. ----
  const summary2 = await run({
    configPath,
    dryRun: false,
    confirmEachSend: false,
    nonInteractive: true,
  });
  assert.equal(summary2.sent, 0, "no new sends on re-run");
  assert.equal(summary2.skippedAlreadyContacted, 5, "all five recognized as already texted");
  assert.equal(summary2.skippedEmailOnly, 2);

  const recordsAfter = await srv.records();
  assert.equal(recordsAfter.length, 5, "no additional texts sent on re-run");

  await rm(tmp, { recursive: true, force: true });
});

test("dry run sends nothing but plans every reachable member", async () => {
  await srv.reset();
  const { configPath, tmp } = await makeConfig();

  const summary = await run({
    configPath,
    dryRun: true,
    confirmEachSend: false,
    nonInteractive: true,
  });

  assert.equal(summary.sent, 0, "dry run never sends");
  assert.equal(summary.planned, 5, "but it plans all five phone members");
  assert.equal(summary.skippedEmailOnly, 2);

  const records = await srv.records();
  assert.equal(records.length, 0, "Google Voice received nothing");
  const surveys = await srv.surveys();
  assert.equal(surveys.length, 0, "no survey changes during dry run");

  await rm(tmp, { recursive: true, force: true });
});

test("respects the per-run limit", async () => {
  await srv.reset();
  const { configPath, tmp } = await makeConfig();

  const summary = await run({
    configPath,
    dryRun: false,
    confirmEachSend: false,
    nonInteractive: true,
    limit: 2,
  });

  assert.equal(summary.sent, 2, "only two sent when limited");
  const records = await srv.records();
  assert.equal(records.length, 2);

  await rm(tmp, { recursive: true, force: true });
});
