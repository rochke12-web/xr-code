import { orderLanes, recordLane, laneSnapshot } from "../src/lib/arena-lanes.ts";
const base = ["wan-2.7-image", "grok-imagein-image", "gemini-2.5-flash-image", "flux-3-image-klein"];
console.log("fresh order:", orderLanes(base).join(", "));
recordLane("wan-2.7-image", true, 30000);
recordLane("grok-imagein-image", false, 900, "API request failed with status 429: Too many requests");
recordLane("gemini-2.5-flash-image", true, 34000);
console.log("after results:", orderLanes(base).join(", "));  // grok should sink (cooling)
recordLane("wan-2.7-image", true, 20000);
console.log("wan faster now:", orderLanes(base)[0] === "wan-2.7-image" ? "wan first ✓" : "ORDER BUG");
const s = laneSnapshot()["grok-imagein-image"];
console.log("breaker:", s.cooldownUntil > Date.now() ? "grok cooling ✓" : "BUG", "| ema wan:", laneSnapshot()["wan-2.7-image"].emaMs + "ms");
