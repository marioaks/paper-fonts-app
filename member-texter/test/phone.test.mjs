import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, hasPhone } from "../src/phone.ts";

test("normalizes common US formats to E.164", () => {
  assert.equal(normalizePhone("(555) 010-1001"), "+15550101001");
  assert.equal(normalizePhone("555-010-1003"), "+15550101003");
  assert.equal(normalizePhone("5550101004"), "+15550101004");
  assert.equal(normalizePhone("555.010.1007"), "+15550101007");
  assert.equal(normalizePhone("1-555-010-1007"), "+15550101007");
  assert.equal(normalizePhone("+1 555 010 1006"), "+15550101006");
});

test("keeps already-international numbers", () => {
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
});

test("returns null for email-only / non-phone text", () => {
  assert.equal(normalizePhone("bob@example.com"), null);
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone(undefined), null);
  assert.equal(normalizePhone("123"), null);
});

test("hasPhone reflects normalizePhone", () => {
  assert.equal(hasPhone("(555) 010-1001"), true);
  assert.equal(hasPhone("erin@example.com"), false);
});
