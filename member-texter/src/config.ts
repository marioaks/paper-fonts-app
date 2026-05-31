import { readFile } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import type { AppConfig } from "./types.ts";

/**
 * Load and lightly validate a config file. Relative paths inside the config
 * (userDataDir, contactLogPath) are resolved relative to the config file's
 * own directory so the tool can be run from anywhere.
 */
export async function loadConfig(configPath: string): Promise<AppConfig> {
  const absConfigPath = resolve(process.cwd(), configPath);
  let raw: string;
  try {
    raw = await readFile(absConfigPath, "utf8");
  } catch {
    throw new Error(
      `Could not read config file at "${absConfigPath}". ` +
        `Copy config.example.jsonc to config.json and fill it in.`,
    );
  }

  let parsed: AppConfig;
  try {
    parsed = JSON.parse(stripJsonComments(raw)) as AppConfig;
  } catch (err) {
    throw new Error(`Config file is not valid JSON: ${(err as Error).message}`);
  }

  validate(parsed);

  const baseDir = dirname(absConfigPath);
  parsed.browser.userDataDir = resolveRelative(baseDir, parsed.browser.userDataDir);
  parsed.contactLogPath = resolveRelative(baseDir, parsed.contactLogPath);

  return parsed;
}

function resolveRelative(baseDir: string, p: string): string {
  return isAbsolute(p) ? p : resolve(baseDir, p);
}

/** Minimal JSONC support: strip // and /* *\/ comments so configs can be annotated. */
function stripJsonComments(input: string): string {
  // Remove block comments, then line comments, while ignoring those inside strings.
  let out = "";
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i++; // skip the closing slash
      continue;
    }
    out += ch;
  }
  return out;
}

function validate(c: AppConfig): void {
  const errors: string[] = [];
  if (!c.homeUrl) errors.push("homeUrl is required");
  if (!c.browser?.userDataDir) errors.push("browser.userDataDir is required");
  if (!c.googleVoice?.url) errors.push("googleVoice.url is required");
  if (!c.contactLogPath) errors.push("contactLogPath is required");
  if (!c.site) errors.push("site selectors are required");
  if (!c.pacing) errors.push("pacing config is required");
  if (!c.limits) errors.push("limits config is required");
  if (errors.length > 0) {
    throw new Error(`Invalid config:\n  - ${errors.join("\n  - ")}`);
  }
}
