/* Tiny console logger. Intentionally never logs full phone numbers or full
 * message bodies at info level, to keep terminal output and any captured logs
 * from leaking member data. */

function ts(): string {
  return new Date().toLocaleTimeString();
}

export const log = {
  info(msg: string): void {
    console.log(`[${ts()}] ${msg}`);
  },
  step(msg: string): void {
    console.log(`[${ts()}] → ${msg}`);
  },
  warn(msg: string): void {
    console.warn(`[${ts()}] ! ${msg}`);
  },
  error(msg: string): void {
    console.error(`[${ts()}] ✗ ${msg}`);
  },
  success(msg: string): void {
    console.log(`[${ts()}] ✓ ${msg}`);
  },
};

/** Mask a phone number for display, e.g. +15551234567 -> +1******4567. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  const visible = phone.slice(-4);
  const prefix = phone.startsWith("+") ? phone.slice(0, 2) : "";
  return `${prefix}${"*".repeat(Math.max(0, phone.length - 4 - prefix.length))}${visible}`;
}
