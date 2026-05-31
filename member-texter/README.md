# member-texter

One small script (`member-texter.mjs`) that works through a list of members and
contacts the ones tagged **"Not started"** — texting them from **Google Voice**
when a phone number is available, or emailing them from **Gmail** when only an
email is. After each send it marks the outreach survey and moves to the next
person, until nobody is left "Not started".

It never contacts the same person twice, never sends both a text and an email to
one person, and prefers a text when a number exists.

## Privacy

Everything runs on your Mac. The script only talks to your member site, Google
Voice, and Gmail — the same servers your browser already uses. No member data is
sent anywhere else, and **no AI sees it at runtime**. You log in by hand once in
the browser window it opens; no passwords are stored by the script.

## Setup (one time)

```bash
cd member-texter
npm install
npx playwright install chromium   # only needed if you use --chromium; real runs use your installed Chrome
```

You need Node 20+ and Google Chrome installed.

## Run it

```bash
# Preview first — walks everyone and prints the plan, sends nothing:
node member-texter.mjs --list "https://your-app.example.com/list/abc" --dry-run

# Real run (texts/emails + marks the survey):
node member-texter.mjs --list "https://your-app.example.com/list/abc" --subject "Following up"
```

On the first real run a Chrome window opens with three tabs (your app, Google
Voice, Gmail). **Log in to each**, then press Enter in the terminal to start.

### Options

| Flag | Meaning |
| --- | --- |
| `--list <url>` | **(required)** the people-list page to work through |
| `--subject <text>` | subject line for any emails sent (Gmail fallback) |
| `--dry-run` | show the plan; send and submit nothing |
| `--max <n>` | stop after `n` sends this run |
| `--min-gap <sec>` / `--max-gap <sec>` | pause range between people (default 15–40s) |
| `--profile <dir>` | Chrome profile folder that remembers your logins (default `./chrome-profile`) |
| `--log <file>` | "already contacted" log (default `./contact-log.json`) |
| `--gv-url <url>` / `--gmail-url <url>` | override Google Voice / Gmail URLs |
| `--chromium` | use Playwright's bundled Chromium instead of installed Chrome |
| `--headless` | run without a visible window (not recommended) |

## What it does, per person

1. Finds the next `Not started` row in the list and opens that person's page.
2. Looks for a phone number (`data-testid="userPhone"`):
   - **Phone present** → clicks **"copy initial message"**, then in Google Voice
     clicks *Send new message*, types the number, clicks `.send-to-button`,
     pastes the message into `.message-input`, and clicks `.send-button`.
   - **No phone, email present** (`data-testid="user-email"`) → clicks **"copy
     initial message"**, then in Gmail clicks *Compose*, fills the recipient and
     the `--subject`, pastes the same message, and sends.
3. Back on the person's page, selects **"Waiting on response"** and clicks
   `#submitContactOutreachButton`.
4. Returns to the list and repeats until no `Not started` people remain.

## Notes

- **Looks manual:** real logged-in Chrome, mouse moved to each control, typing at
  a human cadence, and randomized pauses between people. Keep `--min-gap`/
  `--max-gap` relaxed and consider `--max` to limit batches — Google Voice has
  daily limits and flags bursts.
- **Selectors:** the Google Voice / Gmail / app selectors are defined in one
  `SEL` block at the top of the script. If a site changes, edit them there.
- Automated outreach is regulated (e.g. the US TCPA); since the message comes
  from your page's "copy initial message" button, keep an opt-out line in it.
```
