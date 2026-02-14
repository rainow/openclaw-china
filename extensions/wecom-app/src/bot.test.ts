import { describe, expect, it } from "vitest";

import { extractWecomAppContent } from "./bot.js";
import type { WecomAppInboundMessage } from "./types.js";

describe("extractWecomAppContent location", () => {
  it("formats classic XML-style location fields", () => {
    const msg = {
      msgtype: "location",
      Location_X: "31.2304",
      Location_Y: "121.4737",
      Scale: "15",
      Label: "上海市黄浦区",
    } as WecomAppInboundMessage;

    expect(extractWecomAppContent(msg)).toBe("[location] 31.2304,121.4737 上海市黄浦区 scale=15");
  });

  it("formats Event=LOCATION style fields", () => {
    const msg = {
      msgtype: "location",
      Latitude: "39.9042",
      Longitude: "116.4074",
      Precision: "30",
    } as WecomAppInboundMessage;

    expect(extractWecomAppContent(msg)).toBe("[location] 39.9042,116.4074 scale=30");
  });

  it("falls back to tag-only output when fields are missing", () => {
    const msg = {
      msgtype: "location",
    } as WecomAppInboundMessage;

    expect(extractWecomAppContent(msg)).toBe("[location]");
  });
});
