# member-texter

One script (`member-texter.mjs`) that works through a people-list URL and contacts everyone tagged **"Not started"** — by text (Google Voice) when a phone exists, or by email (Gmail) otherwise. After each send it marks the outreach survey and continues until no **"Not started"** rows remain.

## Privacy and login (no passwords)

- Everything runs on your Mac. The script never receives or stores your username or password.
- Chrome opens; **you log in by hand** in the browser window.
- The script **waits until it sees member rows** (`button.person-list-item`) on your `--list` page before it does anything. It will **not** treat a login screen as “no people left” or close Chrome while you are still signing in.
- After a successful login, the same `--profile` folder (default `./chrome-profile`) remembers your session for later runs.

## Setup

```bash
cd member-texter
npm install
```

You need Node 20+ and Google Chrome.

## Run

```bash
node member-texter.mjs --list "https://your-app.example.com/your-list-page" --subject "Following up"
```

**First run:** Chrome opens with your list tab and Google Voice. Log in to your app in the first tab. The terminal will say it is waiting for the member list — when rows appear, the script starts on its own (up to 30 minutes by default).

```bash
# Preview without sending:
node member-texter.mjs --list "<url>" --dry-run
```

### Useful flags

| Flag | Meaning |
| --- | --- |
| `--login-timeout <min>` | How long to wait for you to log in (default **30**) |
| `--keep-open` | Leave Chrome open when the script exits (also automatic if login times out) |
| `--list-ready <css>` | Extra CSS selector that must exist when the list is ready (if auto-detect is not enough) |
| `--profile <dir>` | Where Chrome saves logins (default `./chrome-profile`) — use the **same path every run** |
| `--max <n>` | Stop after `n` sends this run |

## If login still fails

1. Confirm `--list` is the **people-list page URL** (with `button.person-list-item` rows), not the site home page.
2. Use the **same** `--profile` directory every time so Chrome does not start “fresh” each run.
3. On login timeout the browser is **left open** so you can finish signing in; fix login, then run the command again.
4. If the list is on screen but the script keeps waiting, run with **`--debug-list`** — it prints which selectors it can see. You can also pass **`--list-ready ".your-selector"`**.

The script does **not** refresh the list page every few seconds while waiting; it loads once and polls until rows appear.

## Flow (short)

List → open next **Not started** row → person page → phone? text via Google Voice : email via Gmail → survey **Waiting on response** → submit → back to list.

Never double-contacts anyone (`contact-log.json`). Prefers text over email when both could apply.
