// tests/media-quota.test.mjs — verify per-account media counters
// 3 videos/day, 10 images/day, separate buckets, daily reset.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

// run in an isolated XR_DATA_DIR so the real db/ is never touched
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "xr-media-"));
process.env.XR_DATA_DIR = TMP;

const store = await import("../src/lib/xrstore.ts");
const { getMediaUsage, addMedia, mediaOverLimit, DAILY_VIDEO_LIMIT, DAILY_IMAGE_LIMIT } = store;

test("fresh account starts at 0/0", () => {
  const u = getMediaUsage("uid_test_fresh");
  assert.equal(u.videos, 0);
  assert.equal(u.images, 0);
});

test("video counter increments independently of image counter", () => {
  const uid = "uid_video_isolation";
  addMedia(uid, "videos", 1);
  const u = getMediaUsage(uid);
  assert.equal(u.videos, 1);
  assert.equal(u.images, 0);
});

test("image counter increments independently of video counter", () => {
  const uid = "uid_image_isolation";
  addMedia(uid, "images", 1);
  const u = getMediaUsage(uid);
  assert.equal(u.images, 1);
  assert.equal(u.videos, 0);
});

test("video over-limit triggers exactly at 3/day", () => {
  const uid = "uid_video_cap";
  assert.equal(mediaOverLimit(uid, "video").over, false);
  addMedia(uid, "videos", 1); // 1
  assert.equal(mediaOverLimit(uid, "video").over, false);
  addMedia(uid, "videos", 1); // 2
  assert.equal(mediaOverLimit(uid, "video").over, false);
  addMedia(uid, "videos", 1); // 3 → cap
  const q = mediaOverLimit(uid, "video");
  assert.equal(q.over, true);
  assert.equal(q.used, 3);
  assert.equal(q.limit, DAILY_VIDEO_LIMIT);
});

test("image over-limit triggers exactly at 10/day", () => {
  const uid = "uid_image_cap";
  for (let i = 0; i < 9; i++) addMedia(uid, "images", 1);
  assert.equal(mediaOverLimit(uid, "image").over, false);
  addMedia(uid, "images", 1); // 10 → cap
  const q = mediaOverLimit(uid, "image");
  assert.equal(q.over, true);
  assert.equal(q.used, 10);
  assert.equal(q.limit, DAILY_IMAGE_LIMIT);
});

test("hitting video cap does NOT block images (separate buckets)", () => {
  const uid = "uid_separate_buckets";
  addMedia(uid, "videos", 3); // video cap full
  assert.equal(mediaOverLimit(uid, "video").over, true);
  assert.equal(mediaOverLimit(uid, "image").over, false);
});

test("DAILY_VIDEO_LIMIT is 3 and DAILY_IMAGE_LIMIT is 10 (user directive)", () => {
  assert.equal(DAILY_VIDEO_LIMIT, 3);
  assert.equal(DAILY_IMAGE_LIMIT, 10);
});

// cleanup
fs.rmSync(TMP, { recursive: true, force: true });
