import { beforeEach, describe, expect, it, vi } from "vitest";

import { wecomPlugin } from "./channel.js";
import { clearOutboundReplyState, registerResponseUrl } from "./outbound-reply.js";

const cfg = {
  channels: {
    wecom: {
      enabled: true,
      token: "token-1",
      encodingAESKey: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    },
  },
};

describe("wecom outbound via response_url", () => {
  beforeEach(() => {
    clearOutboundReplyState();
    vi.restoreAllMocks();
  });

  it("sends markdown via response_url by default", async () => {
    registerResponseUrl({
      accountId: "default",
      to: "user:alice",
      responseUrl: "https://reply.local/text",
    });

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await wecomPlugin.outbound.sendText({
      cfg,
      to: "user:alice",
      text: "hello",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body?: string }];
    const payload = JSON.parse(String(init.body));
    expect(payload.msgtype).toBe("markdown");
    expect(payload.markdown?.content).toBe("hello");
  });

  it("supports explicit text mode for sendText", async () => {
    registerResponseUrl({
      accountId: "default",
      to: "user:alice",
      responseUrl: "https://reply.local/text-plain",
    });

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await wecomPlugin.outbound.sendText({
      cfg,
      to: "user:alice",
      text: "hello plain",
      options: { markdown: false },
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body?: string }];
    const payload = JSON.parse(String(init.body));
    expect(payload.msgtype).toBe("text");
    expect(payload.text?.content).toBe("hello plain");
  });

  it("sends file media via markdown response_url payload", async () => {
    registerResponseUrl({
      accountId: "default",
      to: "user:alice",
      responseUrl: "https://reply.local/file",
    });

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await wecomPlugin.outbound.sendMedia({
      cfg,
      to: "user:alice",
      mediaUrl: "https://cdn.example.com/report.pdf",
      mimeType: "application/pdf",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body?: string }];
    const payload = JSON.parse(String(init.body));
    expect(payload.msgtype).toBe("markdown");
    expect(payload.markdown?.content).toContain("[下载文件](https://cdn.example.com/report.pdf)");
  });

  it("sends media with caption using a single POST", async () => {
    registerResponseUrl({
      accountId: "default",
      to: "user:alice",
      responseUrl: "https://reply.local/file-with-caption",
    });

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await wecomPlugin.outbound.sendMedia({
      cfg,
      to: "user:alice",
      mediaUrl: "https://cdn.example.com/report.pdf",
      mimeType: "application/pdf",
      text: "please check this file",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body?: string }];
    const payload = JSON.parse(String(init.body));
    expect(payload.msgtype).toBe("markdown");
    expect(payload.markdown?.content).toContain("please check this file");
    expect(payload.markdown?.content).toContain("[下载文件](https://cdn.example.com/report.pdf)");
  });

  it("does not allow reusing the same response_url across multiple sends", async () => {
    registerResponseUrl({
      accountId: "default",
      to: "user:alice",
      responseUrl: "https://reply.local/reuse",
    });

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const textResult = await wecomPlugin.outbound.sendText({
      cfg,
      to: "user:alice",
      text: "processing...",
    });
    const fileResult = await wecomPlugin.outbound.sendMedia({
      cfg,
      to: "user:alice",
      mediaUrl: "https://cdn.example.com/report.pdf",
      mimeType: "application/pdf",
    });

    expect(textResult.ok).toBe(true);
    expect(fileResult.ok).toBe(false);
    expect(String(fileResult.error)).toContain("No response_url available");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends template_card via response_url for single chat", async () => {
    registerResponseUrl({
      accountId: "default",
      to: "user:alice",
      responseUrl: "https://reply.local/template-card",
    });

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const card = {
      card_type: "text_notice",
      main_title: { title: "hello" },
      card_action: { type: 1, url: "https://example.com" },
    } as Record<string, unknown>;

    const result = await wecomPlugin.outbound.sendTemplateCard({
      cfg,
      to: "user:alice",
      templateCard: card,
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body?: string }];
    const payload = JSON.parse(String(init.body));
    expect(payload.msgtype).toBe("template_card");
    expect(payload.template_card).toEqual(card);
  });

  it("rejects template_card active reply for group targets", async () => {
    registerResponseUrl({
      accountId: "default",
      to: "group:chat-001",
      responseUrl: "https://reply.local/template-card-group",
    });

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await wecomPlugin.outbound.sendTemplateCard({
      cfg,
      to: "group:chat-001",
      templateCard: { card_type: "text_notice" },
    });

    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("only supported in single chat");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
