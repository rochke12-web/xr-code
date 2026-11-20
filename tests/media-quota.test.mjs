// tests/media-quota.test.mjs — verify per-account media quota constants + defensive behavior
// The quota store is now Firestore-backed (xrMediaQuota/{uid}) — see xrstore.ts.
// These tests verify the public contract: the limits the user directive set, and
// that a Firestore outage (no creds in test env) NEVER throws and always opens the gate.
import { test } from "node:test";
import assert from "node:assert/strict";

const store = await import("../src/lib/xrstore.ts");
const { DAILY_VIDEO_LIMIT, DAILY_IMAGE_LIMIT, getMediaUsage, addMedia, mediaOverLimit } = store;

test("DAILY_VIDEO_LIMIT is 3 (user directive)", () => {
  assert.equal(DAILY_VIDEO_LIMIT, 3);
});

test("DAILY_IMAGE_LIMIT is 10 (user directive)", () => {
  assert.equal(DAILY_IMAGE_LIMIT, 10);
});

test("getMediaUsage never throws on Firestore outage (no creds in test env)", async () => {
  // No FIREBASE_SERVICE_ACCOUNT_JSON set in the test runner → firebaseApp throws.
  // getMediaUsage must catch that and return a fresh zero record, NOT propagate.
  const u = await getMediaUsage("uid_test_outage");
  assert.equal(u.videos, 0);
  assert.equal(u.images, 0);
  assert.ok(u.day && /^\d{4}-\d{2}-\d{2}$/.test(u.day), "day is a UTC date string");
});

test("addMedia never throws on Firestore outage", async () => {
  const u = await addMedia("uid_add_outage", "videos", 1);
  // returns the incremented record even when the write fails — the in-memory
  // value is what the caller reports back to the user
  assert.equal(u.videos, 1);
  assert.equal(u.images, 0);
});

test("mediaOverLimit never throws on Firestore outage — gate stays OPEN", async () => {
  // The whole point: a storage outage must NEVER block a paid feature.
  const q = await mediaOverLimit("uid_over_outage", "video");
  assert.equal(q.over, false);
  assert.equal(q.limit, 3);
  const qi = await mediaOverLimit("uid_over_outage", "image");
  assert.equal(qi.over, false);
  assert.equal(qi.limit, 10);
});

test("mediaOverLimit accepts both 'video' and 'image' kinds", async () => {
  await assert.doesNotReject(mediaOverLimit("uid_kind", "video"));
  await assert.doesNotReject(mediaOverLimit("uid_kind", "image"));
});

test("addMedia with both kinds returns independent counters", async () => {
  const v = await addMedia("uid_iso", "videos", 1);
  const i = await addMedia("uid_iso", "images", 1);
  assert.equal(v.videos, 1);
  assert.equal(i.images, 1);
  // video and image counters are separate buckets — filling one never blocks the other
  assert.equal(DAILY_VIDEO_LIMIT, 3);
  assert.equal(DAILY_IMAGE_LIMIT, 10);
});
