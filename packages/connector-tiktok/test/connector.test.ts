import { describe, expect, it, vi } from "vitest";
import type { Unsubscribe } from "@crowdcircuit/connector-core";
import {
  TikTokConnector,
  TikTokConnectorError,
  mapTikTokProviderEvent,
  type TikTokProviderClient,
  type TikTokProviderEvent,
} from "../src/index.js";

class FakeClient implements TikTokProviderClient {
  public connectCalls = 0;
  public disconnectCalls = 0;
  public failuresRemaining = 0;
  private readonly listeners = new Map<
    TikTokProviderEvent,
    Set<(payload: unknown) => void>
  >();

  public async connect(): Promise<{ roomId: string }> {
    this.connectCalls += 1;
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("provider unavailable");
    }
    return { roomId: "room_tiktok_1" };
  }

  public async disconnect(): Promise<void> {
    this.disconnectCalls += 1;
  }

  public on(
    event: TikTokProviderEvent,
    listener: (payload: unknown) => void
  ): Unsubscribe {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }

  public emit(event: TikTokProviderEvent, payload: unknown = {}): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }
}

const clock = () => "2026-07-23T12:00:00.000Z";

describe("TikTok provider mapping", () => {
  it("maps chat, gift, follow, and like into detached minimal raw events", () => {
    const user = {
      userId: "123",
      uniqueId: "viewer",
      nickname: "Viewer",
      roles: ["viewer"],
    };
    const context = {
      roomId: "room",
      streamerUniqueId: "streamer",
      occurredAt: clock(),
    };
    const chatPayload = { comment: "hello", user };
    const chat = mapTikTokProviderEvent("chat", chatPayload, context);
    const gift = mapTikTokProviderEvent(
      "gift",
      {
        eventId: "provider_event_1",
        sequenceId: "42",
        giftId: "rose",
        giftName: "Rose",
        diamondCount: 1,
        repeatCount: 2,
        giftType: 1,
        streakId: "provider_streak_1",
        streakState: "update",
        user,
      },
      context
    );
    const follow = mapTikTokProviderEvent("follow", { user }, context);
    const like = mapTikTokProviderEvent(
      "like",
      { likeCount: 5, totalLikeCount: 10, user },
      context
    );

    expect(chat).toMatchObject({
      kind: "chat",
      source: "tiktok",
      rawPayload: { commentText: "hello" },
    });
    expect(gift).toMatchObject({
      kind: "gift",
      identity: {
        connectorEventId: "provider_event_1",
        sequenceId: "42",
      },
      giftStreak: {
        streakId: "provider_streak_1",
        lifecycle: "update",
        sequenceId: "42",
      },
      rawPayload: {
        giftId: "rose",
        giftName: "Rose",
        repeatCount: 2,
        streakable: true,
      },
    });
    expect(follow?.kind).toBe("follow");
    expect(like).toMatchObject({
      kind: "like",
      rawPayload: { likeCount: 5, totalLikes: 10 },
    });

    user.nickname = "mutated";
    expect(chat?.rawPayload).toMatchObject({
      sender: { nickname: "Viewer" },
    });
    expect(chat?.rawPayload).not.toHaveProperty("user");
    expect(gift).not.toHaveProperty("gift");
  });

  it("omits unsafe streak evidence and maps explicit provider END conservatively", () => {
    const context = {
      roomId: "room",
      streamerUniqueId: "streamer",
      occurredAt: clock(),
    };
    const withoutIdentity = mapTikTokProviderEvent(
      "gift",
      { giftId: "rose", streakState: "start", repeatCount: 1 },
      context
    );
    expect(withoutIdentity).not.toHaveProperty("giftStreak");

    const ended = mapTikTokProviderEvent(
      "gift",
      {
        giftId: "rose",
        streakId: "provider_streak",
        repeatEnd: true,
        repeatCount: 3,
      },
      context
    );
    expect(ended?.giftStreak).toEqual({
      streakId: "provider_streak",
      lifecycle: "end",
    });
  });

  it("rejects non-object provider payloads without leaking them", () => {
    expect(
      mapTikTokProviderEvent("chat", "provider-object", {
        roomId: null,
        streamerUniqueId: "streamer",
        occurredAt: clock(),
      })
    ).toBeNull();
  });
});

describe("TikTokConnector", () => {
  it("maps lifecycle, emits raw events, and isolates listeners", async () => {
    const client = new FakeClient();
    const connector = new TikTokConnector({
      clientFactory: () => client,
      streamerUniqueId: "streamer",
      clock,
    });
    const statuses: string[] = [];
    const events: unknown[] = [];
    const errors: Error[] = [];
    connector.onStatus((message) => statuses.push(message.status));
    connector.onEvent(() => {
      throw new Error("observer failure");
    });
    connector.onEvent((event) => events.push(event));
    connector.onError((error) => errors.push(error));

    const info = await connector.connect();
    expect(info).toMatchObject({
      source: "tiktok",
      status: "connected",
      roomId: "room_tiktok_1",
      streamerUniqueId: "streamer",
    });
    expect(statuses).toEqual(["connecting", "connected"]);

    client.emit("chat", {
      comment: "hi",
      user: { uniqueId: "viewer", nickname: "Viewer" },
    });
    expect(events).toHaveLength(1);
    expect(errors[0].message).toContain("event listener");

    await connector.disconnect();
    expect(connector.getStatus()).toBe("disconnected");
    expect(client.disconnectCalls).toBe(1);
  });

  it("maps stream end to ended without reconnecting", async () => {
    const client = new FakeClient();
    const delay = vi.fn(async () => {});
    const connector = new TikTokConnector({
      clientFactory: () => client,
      streamerUniqueId: "streamer",
      clock,
      delay,
    });
    await connector.connect();
    client.emit("streamEnd");
    expect(connector.getStatus()).toBe("ended");
    client.emit("disconnected");
    await Promise.resolve();
    expect(delay).not.toHaveBeenCalled();
  });

  it("reconnects with deterministic bounded backoff after provider disconnect", async () => {
    const clients = [new FakeClient(), new FakeClient(), new FakeClient()];
    clients[1].failuresRemaining = 1;
    let factoryIndex = 0;
    const delays: number[] = [];
    const connector = new TikTokConnector({
      clientFactory: () => clients[factoryIndex++] ?? clients[2],
      streamerUniqueId: "streamer",
      clock,
      retryDelaysMs: [10, 20],
      delay: async (milliseconds) => {
        delays.push(milliseconds);
      },
    });
    await connector.connect();
    clients[0].emit("disconnected");
    for (let index = 0; index < 10; index++) await Promise.resolve();

    expect(delays).toEqual([10, 20]);
    expect(connector.getStatus()).toBe("connected");
    expect(clients[2].connectCalls).toBe(1);
  });

  it("contains provider errors and rejects missing streamer configuration", async () => {
    const connector = new TikTokConnector({
      clientFactory: () => new FakeClient(),
      clock,
    });
    await expect(connector.connect()).rejects.toBeInstanceOf(
      TikTokConnectorError
    );

    const failing = new FakeClient();
    failing.failuresRemaining = 1;
    const errors: Error[] = [];
    const failingConnector = new TikTokConnector({
      clientFactory: () => failing,
      streamerUniqueId: "streamer",
      clock,
    });
    failingConnector.onError((error) => errors.push(error));
    await expect(failingConnector.connect()).rejects.toBeInstanceOf(
      TikTokConnectorError
    );
    expect(failingConnector.getStatus()).toBe("error");
    expect(errors).toHaveLength(1);
  });

  it("contains provider-factory and disconnect-clock failures without partial lifecycle state", async () => {
    const errors: Error[] = [];
    const factoryFailure = new TikTokConnector({
      clientFactory: () => {
        throw new Error("factory failure");
      },
      streamerUniqueId: "streamer",
      clock,
    });
    factoryFailure.onError((error) => errors.push(error));
    await expect(factoryFailure.connect()).rejects.toBeInstanceOf(
      TikTokConnectorError
    );
    expect(factoryFailure.getStatus()).toBe("error");

    let clockCalls = 0;
    const client = new FakeClient();
    const disconnectClockFailure = new TikTokConnector({
      clientFactory: () => client,
      streamerUniqueId: "streamer",
      clock: () => {
        clockCalls += 1;
        if (clockCalls <= 2) return clock();
        throw new Error("disconnect clock failure");
      },
    });
    disconnectClockFailure.onError((error) => errors.push(error));
    await disconnectClockFailure.connect();
    await disconnectClockFailure.disconnect();
    expect(disconnectClockFailure.getStatus()).toBe("disconnected");
    expect(client.disconnectCalls).toBe(1);
    expect(errors.some((error) => error.message.includes("clock"))).toBe(true);
  });

  it("destroys idempotently and makes later subscriptions inert", async () => {
    const client = new FakeClient();
    const connector = new TikTokConnector({
      clientFactory: () => client,
      streamerUniqueId: "streamer",
      clock,
    });
    await connector.connect();
    await connector.destroy();
    await connector.destroy();
    expect(connector.getStatus()).toBe("disconnected");
    const listener = vi.fn();
    connector.onEvent(listener);
    client.emit("chat", {});
    expect(listener).not.toHaveBeenCalled();
    await expect(connector.connect()).rejects.toBeInstanceOf(
      TikTokConnectorError
    );
  });
});
