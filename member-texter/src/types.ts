/**
 * Shared types for the member-texter tool.
 *
 * A "selector" may be a single CSS/Playwright selector string, or an array of
 * candidate selectors that are tried in order. This makes the config resilient
 * to small markup differences and to UI changes on sites you don't control
 * (e.g. Google Voice).
 */
export type Selector = string | string[];

export interface SiteSelectors {
  /** Links/buttons on the home page that lead to the different member lists. */
  folderLinks: Selector;
  /** Links on a list page that open an individual member's page. */
  memberLinks: Selector;
  /** Element on a member page that contains the member's display name. */
  memberName: Selector;
  /** Element on a member page that contains the phone number (if any). */
  memberPhone: Selector;
  /** The "copy initial message" button on a member page. */
  copyMessageButton: Selector;
  /**
   * Optional: the control used to answer the "did you reach out?" survey with
   * "yes", and the button that saves/submits it. Leave empty to disable.
   */
  surveyReachedOutYes?: Selector;
  surveySubmit?: Selector;
  /**
   * Optional: an element that appears once the survey answer is saved. If set,
   * the tool waits for it before moving on, guaranteeing the save completed.
   */
  surveySavedIndicator?: Selector;
}

export interface GoogleVoiceSelectors {
  /** Button that starts composing a brand new message. */
  composeButton: Selector;
  /** The "To" recipient input where a phone number is typed. */
  recipientInput: Selector;
  /** The message body input. */
  messageInput: Selector;
  /** The send button. */
  sendButton: Selector;
  /** An element that appears once a message has been delivered/sent. */
  sentIndicator?: Selector;
}

export interface PacingConfig {
  /** Min/max milliseconds to pause between individual UI actions. */
  actionDelayMs: [number, number];
  /** Min/max milliseconds between keystrokes when typing a message. */
  keystrokeDelayMs: [number, number];
  /** Min/max seconds to wait after finishing one member before the next. */
  betweenMembersSec: [number, number];
  /** Optional active-hours window (local 24h clock). Outside it, the run waits. */
  activeHours?: { start: number; end: number };
}

export interface LimitsConfig {
  /** Maximum messages to send in a single run. */
  maxPerRun: number;
  /** Maximum messages to send per calendar day (across runs, via the log). */
  maxPerDay: number;
}

export interface BehaviorConfig {
  /** Skip members whose page has no phone number (email-only sign-ups). */
  skipEmailOnly: boolean;
  /** Mark the "did you reach out?" survey after a successful send. */
  fillSurvey: boolean;
  /** Shuffle member order so the cadence looks less mechanical. */
  randomizeOrder: boolean;
}

export interface BrowserConfig {
  /**
   * Chrome channel to launch. "chrome" uses your installed Google Chrome
   * (recommended on macOS so it looks like normal browsing). Omit to use the
   * bundled Chromium (used by the test harness).
   */
  channel?: "chrome" | "chrome-beta" | "msedge";
  /** Directory for a persistent browser profile so your login is remembered. */
  userDataDir: string;
  /** Run with a visible window. Should be true for real use. */
  headed: boolean;
}

export interface AppConfig {
  /** The page to open first (your app's home/dashboard with the folders). */
  homeUrl: string;
  browser: BrowserConfig;
  site: SiteSelectors;
  googleVoice: {
    url: string;
    selectors: GoogleVoiceSelectors;
  };
  pacing: PacingConfig;
  limits: LimitsConfig;
  behavior: BehaviorConfig;
  /** Where the local audit/dedupe log is written (JSON). */
  contactLogPath: string;
}

export interface RunOptions {
  dryRun: boolean;
  /** Ask for confirmation in the terminal before each individual send. */
  confirmEachSend: boolean;
  /** Override config.limits.maxPerRun for this run. */
  limit?: number;
}

export interface MemberRecord {
  phone: string;
  name: string;
  url: string;
  messagePreview: string;
  sentAt: string;
}
