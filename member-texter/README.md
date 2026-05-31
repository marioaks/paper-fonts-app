# member-texter

A small, **local** assistant that takes the tedium out of texting your members one
by one. It opens each member's page in a real Chrome window, skips anyone who
only signed up with an email, clicks the page's **"copy initial message"**
button, and sends that exact message from **your Google Voice number** — then
marks the "did you reach out?" survey. It paces itself like a human so it doesn't
trip spam/automation flags, and it keeps a local log so nobody is ever texted
twice.

## Why this is safe with your data

- **Everything runs on your Mac.** The tool only talks to your member site and to
  Google Voice — the same servers your browser already talks to. Phone numbers
  and messages are never sent to any AI, cloud service, or third party.
- **No AI sees member data at runtime.** An AI helped write this code, but when
  you run it, it executes locally. You can read every line in `src/` to confirm
  there is no "phone home" behavior.
- **No passwords stored.** You log in to your app and Google Voice **by hand,
  once**, in the tool's browser profile. The session is remembered on disk
  (`chrome-profile/`) so later runs reuse it. The tool never sees or stores your
  credentials.
- **The message is always yours.** The text that gets sent is whatever your
  page's "copy initial message" button copies — the tool never writes or alters
  message content.
- **Local data is gitignored.** `data/` (the contact log) and `chrome-profile/`
  are never committed.

## What it does, step by step

1. Opens your home page and finds the folder/list links.
2. Visits each folder and collects every member page link.
3. For each member:
   - Reads their name and looks for a phone number. **No phone → skipped**
     (email-only sign-ups).
   - **Already texted before → skipped** (local contact log).
   - Moves the mouse to **"copy initial message"** and clicks it.
   - Reads the copied text from the clipboard.
   - Switches to Google Voice, starts a new message, types the number, types the
     message at a human pace, and clicks send.
   - Marks the "did you reach out?" survey as **yes**.
   - Records the send locally, then waits a randomized gap before the next
     person.

## Requirements

- macOS
- [Node.js](https://nodejs.org) 20 or newer (`node --version`)
- Google Chrome installed (the tool drives your real Chrome)

## Setup

```bash
cd member-texter
npm install
npx playwright install chromium   # one-time browser download
```

## Try it first on the built-in mock (no real data)

Before pointing it at anything real, you can watch the whole flow against a fake
site that ships with the tool:

```bash
npm test
```

This spins up a mock member site + a mock Google Voice and verifies that
email-only members are skipped, the right message goes to the right number, the
survey is marked, and re-runs never double-text. To click around the mock
yourself:

```bash
npm run mock:serve
# then open the two URLs it prints in your browser
```

## Configure it for your real site

1. Copy the annotated template and open it:

   ```bash
   cp config.example.jsonc config.json
   ```

2. Fill in the selectors for **your** app and for Google Voice. The fastest way
   to get a selector is Playwright's recorder — run it, click the element you
   care about, and copy the suggested selector:

   ```bash
   npm run codegen -- https://your-app.example.com
   npm run codegen -- https://voice.google.com
   ```

   You need selectors for: the folder links, the member links, the member name,
   the phone number, the "copy initial message" button, (optionally) the survey
   controls, and Google Voice's compose / recipient / message / send elements.
   Each field accepts a single selector **or a list of fallbacks**.

3. Keep `browser.channel` set to `"chrome"` and `browser.headed` set to `true`
   for real use.

## Running it

**Always start with a dry run.** It walks every member and prints exactly what it
*would* send, without sending anything or touching the survey:

```bash
npm run dry-run
```

The first time, a Chrome window opens with two tabs (your app and Google Voice).
**Log in to both**, then press Enter in the terminal to begin.

When the dry-run plan looks right, do a real run. Consider `--confirm` at first so
you approve each text individually:

```bash
npm start -- --confirm          # ask before each send
npm start                       # send normally
npm start -- --limit 10         # cap this run at 10 messages
```

### Options

| Flag | Meaning |
| --- | --- |
| `--dry-run` | Show what would be sent; send nothing. |
| `--confirm` | Ask in the terminal before each individual send. |
| `--limit <n>` | Cap the number of messages this run. |
| `--config <path>` | Use a different config file (default `config.json`). |

## How it avoids red flags

- Drives your **real, logged-in Chrome** profile (not a throwaway automated
  browser), with the automation banner disabled.
- Moves the **mouse along a path** to each button and clicks a random spot inside
  it, instead of firing synthetic clicks.
- Types messages **one key at a time** with randomized delays and natural pauses
  after punctuation (it never alters the message text — only the timing).
- Waits a **randomized gap between members**, and you can restrict sending to
  normal `activeHours`.
- Enforces **per-run and per-day caps** (`limits` in the config). Google Voice
  has daily sending limits and is quick to flag bursts — keep these conservative.

These measures make the activity look human, but no technique is a guarantee.
Send modest batches and keep the pace relaxed.

## Please also consider (not legal advice)

Your members consented at sign-up, but automated texting is regulated (e.g. the
US **TCPA** and carrier rules). It's good practice to keep messages relationship/
transactional rather than promotional, and to include an opt-out line such as
"Reply STOP to opt out." Since the message comes from your page's
"copy initial message" button, you control that wording on your side.

## Troubleshooting

- **"None of these selectors became visible…"** — a selector is wrong or the page
  changed. Re-capture it with `npm run codegen`. Provide a few fallbacks in the
  array form.
- **It didn't recognize a phone number / skipped someone who has one** — check the
  `site.memberPhone` selector and that the page text contains a 10–11 digit US
  number. International formats are kept as-is if they start with `+`.
- **Google Voice asks to log in every run** — make sure `browser.userDataDir`
  points to a stable folder and that you completed login in that window once.
- **Clipboard read fails** — the member page must be the focused tab when "copy
  initial message" is clicked; the tool brings it to front automatically, so this
  usually means the copy button selector is off.

## Project layout

```
member-texter/
  src/
    run.ts          # orchestrator + CLI (the entry point)
    config.ts       # loads/validates config.json (JSONC supported)
    browser.ts      # launches your persistent Chrome profile
    scraper.ts      # walks folders, reads members, clicks "copy initial message"
    googleVoice.ts  # composes and sends a text in Google Voice
    clipboard.ts    # reads the copied message
    contactLog.ts   # local "already texted" log (dedupe)
    humanize.ts     # human-like mouse, typing, and pacing
    phone.ts        # phone-number detection/normalization
    logger.ts       # console output (masks phone numbers)
  mock/             # a fake site + fake Google Voice for safe testing
  test/             # automated tests that drive the mock end-to-end
  config.example.jsonc
```

## A note on scope

This was built and tested here against the included mock. The parts that need
*your* machine — your logged-in Chrome profile, your real member URLs, and the
live Google Voice UI — can only be exercised on your Mac, so expect to spend a
little time capturing the right selectors with `npm run codegen` the first time.
```
