import { describe, it, expect, vi } from "vitest";
import { MockConnector, MockConnectorInputError } from "../src/index.js";
import type { ConnectionStatusMessage, RawConnectorEvent } from "@crowdcircuit/connector-core";

describe("MockConnector Lifecycle, Safety, and Defensive Copying", () => {
  it("returns ConnectionInfo on connect and respects repeated lifecycle calls without mutating active config or timestamp", async () => {
    const statusHistory: ConnectionStatusMessage[] = [];
    const connector = new MockConnector({
      id: "test_mock_001",
      roomId: "room_init",
      streamerUniqueId: "streamer_init",
      clock: () => "2026-07-23T12:00:00.000Z",
    });

    connector.onStatus((statusMsg) => {
      statusHistory.push(statusMsg);
    });

    expect(connector.getStatus()).toBe("disconnected");

    const info1 = await connector.connect({
      roomId: "room_override",
      streamerUniqueId: "streamer_override",
    });

    expect(info1).toEqual({
      connectorId: "test_mock_001",
      source: "mock",
      status: "connected",
      roomId: "room_override",
      streamerUniqueId: "streamer_override",
      connectedAt: "2026-07-23T12:00:00.000Z",
    });

    // Repeated connect with conflicting config returns ORIGINAL ConnectionInfo unchanged
    const statusCountBefore = statusHistory.length;
    const info2 = await connector.connect({
      roomId: "room_conflicting_new",
      streamerUniqueId: "streamer_conflicting_new",
    });

    expect(info2).toBe(info1); // Exact reference match
    expect(info2.roomId).toBe("room_override");
    expect(info2.streamerUniqueId).toBe("streamer_override");
    expect(statusHistory.length).toBe(statusCountBefore);

    // Repeated disconnect
    await connector.disconnect();
    expect(connector.getStatus()).toBe("disconnected");
    const statusCountAfterDisconnect = statusHistory.length;
    await connector.disconnect();
    expect(statusHistory.length).toBe(statusCountAfterDisconnect);

    // Repeated destroy
    await connector.destroy();
    await connector.destroy();
  });

  it("ensures destroy is terminal and reports disconnected even when the destroy clock read fails", async () => {
    let callCount = 0;
    const statusMessages: ConnectionStatusMessage[] = [];
    const connector = new MockConnector({
      clock: () => {
        callCount++;
        if (callCount === 1) return "2026-07-23T12:00:00.000Z";
        throw new Error("Clock failure during destroy!");
      },
    });

    connector.onStatus((s) => statusMessages.push(s));
    await connector.connect();
    expect(connector.getStatus()).toBe("connected");

    // Call destroy when clock fails
    await connector.destroy();

    // Must be terminal disconnected, inert, listeners cleared
    expect(connector.getStatus()).toBe("disconnected");
    expect(statusMessages.some((message) => message.status === "disconnected")).toBe(false);

    // Subscriptions and emissions after destroy must fail or be no-op
    const eventFn = vi.fn();
    connector.onEvent(eventFn);
    expect(() => connector.emitMockGift()).toThrow(MockConnectorInputError);
    expect(eventFn).not.toHaveBeenCalled();

    // Repeated destroy remains idempotent
    await connector.destroy();
    expect(connector.getStatus()).toBe("disconnected");
  });

  it("isolates status listener exceptions during connect, disconnect, destroy, and stream-ended, ensuring later listeners run and cleanup completes", async () => {
    const connector = new MockConnector({ clock: () => "2026-07-23T12:00:00.000Z" });
    const goodStatusListener1 = vi.fn();
    const goodStatusListener2 = vi.fn();

    connector.onStatus((statusMsg) => {
      if (statusMsg.status === "connecting" || statusMsg.status === "disconnected" || statusMsg.status === "ended") {
        throw new Error("Throwing status listener!");
      }
      goodStatusListener1(statusMsg);
    });
    connector.onStatus(goodStatusListener2);

    // connect completes even if status listener throws during connecting
    const info = await connector.connect();
    expect(info.status).toBe("connected");
    expect(connector.getStatus()).toBe("connected");
    expect(goodStatusListener2).toHaveBeenCalledWith(expect.objectContaining({ status: "connecting" }));

    // stream-ended status listener throwing isolates exception
    connector.emitMockStreamEnded();
    expect(connector.getStatus()).toBe("ended");
    expect(goodStatusListener2).toHaveBeenCalledWith(expect.objectContaining({ status: "ended" }));

    // destroy completes cleanly even if status listener throws during destroy
    await connector.destroy();
    expect(connector.getStatus()).toBe("disconnected");
  });

  it("guards stream-ended transitions for connected, disconnected, repeated, and destroyed states", async () => {
    const statusMessages: ConnectionStatusMessage[] = [];
    const connector = new MockConnector({ clock: () => "2026-07-23T12:00:00.000Z" });
    connector.onStatus((s) => statusMessages.push(s));

    // Stream ended while disconnected throws MockConnectorInputError
    expect(() => connector.emitMockStreamEnded()).toThrow(MockConnectorInputError);

    await connector.connect();
    connector.emitMockStreamEnded("Host stopped broadcast");

    expect(connector.getStatus()).toBe("ended");
    expect(statusMessages).toContainEqual({
      status: "ended",
      timestamp: "2026-07-23T12:00:00.000Z",
      reason: "Host stopped broadcast",
    });

    // Repeated stream-ended does nothing (idempotent)
    const lenBefore = statusMessages.length;
    connector.emitMockStreamEnded("Host stopped broadcast again");
    expect(statusMessages.length).toBe(lenBefore);

    // Stream ended after destroy throws MockConnectorInputError and does not mutate destroyed state
    await connector.destroy();
    expect(() => connector.emitMockStreamEnded()).toThrow(MockConnectorInputError);
    expect(connector.getStatus()).toBe("disconnected");
  });

  it("validates supplied occurredAt timestamp and clock output, delivering zero events and preserving status on rejection", async () => {
    const connector = new MockConnector();
    const receivedEvents: RawConnectorEvent[] = [];
    connector.onEvent((evt) => receivedEvents.push(evt));

    await connector.connect();

    // Valid explicit occurredAt
    connector.emitMockGift({ occurredAt: "2026-07-23T15:30:00.000Z" });
    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].occurredAt).toBe("2026-07-23T15:30:00.000Z");

    // Invalid explicit occurredAt throws MockConnectorInputError, delivers ZERO events, leaves status connected
    expect(() => {
      connector.emitMockGift({ occurredAt: "not-an-iso-datetime" });
    }).toThrow(MockConnectorInputError);

    expect(receivedEvents.length).toBe(1); // Zero new events delivered
    expect(connector.getStatus()).toBe("connected");
  });

  it("preserves defensive copies of ordinary caller input arrays, sender, and payload objects post-emission", async () => {
    const connector = new MockConnector();
    const receivedEvents: RawConnectorEvent[] = [];
    connector.onEvent((evt) => receivedEvents.push(evt));

    await connector.connect();

    const senderInput = {
      userId: "usr_alice",
      nickname: "Alice",
      roles: ["viewer"],
    };

    connector.emitMockGift({
      giftId: "rose",
      sender: senderInput,
    });

    // Mutate caller input post-emit
    senderInput.nickname = "HACKED_NAME";
    senderInput.roles.push("ADMIN_HACK");

    const payload = receivedEvents[0].rawPayload as { sender?: { nickname: string; roles: string[] } };
    expect(payload.sender?.nickname).toBe("Alice");
    expect(payload.sender?.roles).toEqual(["viewer"]);

    const nestedArray = [{ score: 1 }];
    const nestedPayload = { nested: { values: nestedArray } };
    connector.emitMockEvent({
      kind: "chat",
      source: "mock",
      rawPayload: nestedPayload,
    });
    nestedArray[0].score = 99;
    nestedPayload.nested.values.push({ score: 2 });

    const deliveredNested = receivedEvents[1].rawPayload as {
      nested: { values: Array<{ score: number }> };
    };
    expect(deliveredNested.nested.values).toEqual([{ score: 1 }]);
  });

  it("handles valid acyclic repeated shared references correctly using memoization", async () => {
    const connector = new MockConnector();
    const receivedEvents: RawConnectorEvent[] = [];
    connector.onEvent((evt) => receivedEvents.push(evt));

    await connector.connect();

    const shared = { value: 42 };
    const validSharedGraph = { a: shared, b: shared };

    connector.emitMockEvent({
      kind: "chat",
      source: "mock",
      streamerUniqueId: "streamer_001",
      rawPayload: validSharedGraph,
    });

    expect(receivedEvents.length).toBe(1);
    const payload = receivedEvents[0].rawPayload as { a: { value: number }; b: { value: number } };
    expect(payload.a.value).toBe(42);
    expect(payload.b.value).toBe(42);
    expect(payload.a).toBe(payload.b);
    shared.value = 99;
    expect(payload.a.value).toBe(42);
  });

  it("descriptor-safely rejects getters, accessors, undefined, sparse arrays, dangerous keys, non-plain objects, and unsupported values without invoking accessors or notifying onError", async () => {
    const connector = new MockConnector();
    const receivedEvents: RawConnectorEvent[] = [];
    const errorListener = vi.fn();

    connector.onEvent((evt) => receivedEvents.push(evt));
    connector.onError(errorListener);

    await connector.connect();

    const rejectPayload = (payload: unknown) => {
      expect(() => {
        connector.emitMockEvent({
          kind: "chat",
          source: "mock",
          streamerUniqueId: "streamer_001",
          rawPayload: payload as Record<string, unknown>,
        });
      }).toThrow(MockConnectorInputError);
    };

    // 1. Getters and accessors (verify getter function is NEVER called)
    let getterCalled = false;
    const getterObj = {};
    Object.defineProperty(getterObj, "prop", {
      get() {
        getterCalled = true;
        return "value";
      },
      enumerable: true,
      configurable: true,
    });
    rejectPayload(getterObj);
    expect(getterCalled).toBe(false); // PROVES GETTER WAS NEVER CALLED

    // Throwing getter
    const throwingGetterObj = {};
    let throwingGetterCalled = false;
    Object.defineProperty(throwingGetterObj, "prop", {
      get() {
        throwingGetterCalled = true;
        throw new Error("Getter exploded!");
      },
      enumerable: true,
    });
    rejectPayload(throwingGetterObj);
    expect(throwingGetterCalled).toBe(false);

    // Setter only
    let setterCalled = false;
    const setterObj = {};
    Object.defineProperty(setterObj, "prop", {
      set() {
        setterCalled = true;
      },
      enumerable: true,
    });
    rejectPayload(setterObj);
    expect(setterCalled).toBe(false);

    const hiddenAccessor = {};
    Object.defineProperty(hiddenAccessor, "hidden", {
      get() {
        getterCalled = true;
        return "hidden";
      },
      enumerable: false,
    });
    rejectPayload(hiddenAccessor);
    expect(getterCalled).toBe(false);

    // 2. Undefined properties and sparse arrays
    rejectPayload({ prop: undefined });
    rejectPayload({ arr: [1, undefined, 3] });

    const sparseArr = [1, 2, 3];
    delete sparseArr[1];
    rejectPayload({ sparse: sparseArr }); // Sparse array hole

    // 3. Functions, symbols, BigInt, NaN, Infinities
    rejectPayload({ fn: () => {} });
    rejectPayload({ sym: Symbol("test") });
    rejectPayload({ [Symbol("key")]: "val" });
    rejectPayload({ big: BigInt(123) });
    rejectPayload({ nan: NaN });
    rejectPayload({ posInf: Infinity });
    rejectPayload({ negInf: -Infinity });

    // 4. Non-plain objects
    rejectPayload({ date: new Date() });
    rejectPayload({ map: new Map() });
    rejectPayload({ set: new Set() });
    rejectPayload({ weakMap: new WeakMap() });
    rejectPayload({ weakSet: new WeakSet() });
    rejectPayload({ regex: /abc/ });
    rejectPayload({ promise: Promise.resolve() });
    rejectPayload({ error: new Error("test") });
    rejectPayload({ instance: new (class CustomClass {})() });

    // 5. Cyclic object
    const cyclicObj: Record<string, unknown> = {};
    cyclicObj.self = cyclicObj;
    rejectPayload(cyclicObj);

    // 6. Dangerous keys
    const protoObj = Object.create(null);
    protoObj.__proto__ = "hacked";
    rejectPayload(protoObj);

    const constrObj = { constructor: "hacked" };
    rejectPayload(constrObj);

    const protoKeyObj = { prototype: "hacked" };
    rejectPayload(protoKeyObj);

    // PROVES ZERO EVENT DELIVERIES, UNCHANGED CONNECTED STATUS, AND ZERO ONERROR NOTIFICATIONS FOR CALLER VALIDATION FAILURES
    expect(receivedEvents.length).toBe(0);
    expect(connector.getStatus()).toBe("connected");
    expect(errorListener).not.toHaveBeenCalled();
  });

  it("wraps reflection failures and rejects accessor-bearing typed helper input without side effects", async () => {
    const connector = new MockConnector({
      clock: () => "2026-07-23T12:00:00.000Z",
    });
    const receivedEvents: RawConnectorEvent[] = [];
    const errorListener = vi.fn();
    connector.onEvent((event) => receivedEvents.push(event));
    connector.onError(errorListener);
    await connector.connect();

    const throwingReflection = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("reflection trap");
        },
      }
    );
    expect(() =>
      connector.emitMockEvent({
        kind: "chat",
        source: "mock",
        rawPayload: throwingReflection,
      })
    ).toThrow(MockConnectorInputError);

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(() =>
      connector.emitMockEvent({
        kind: "chat",
        source: "mock",
        rawPayload: revoked.proxy,
      })
    ).toThrow(MockConnectorInputError);

    let optionGetterCalled = false;
    const giftOptions = {};
    Object.defineProperty(giftOptions, "giftId", {
      get() {
        optionGetterCalled = true;
        throw new Error("option getter must not run");
      },
      enumerable: true,
    });
    expect(() => connector.emitMockGift(giftOptions)).toThrow(
      MockConnectorInputError
    );

    let senderGetterCalled = false;
    const sender = {};
    Object.defineProperty(sender, "nickname", {
      get() {
        senderGetterCalled = true;
        throw new Error("sender getter must not run");
      },
      enumerable: true,
    });
    expect(() => connector.emitMockGift({ sender })).toThrow(
      MockConnectorInputError
    );

    expect(optionGetterCalled).toBe(false);
    expect(senderGetterCalled).toBe(false);
    expect(receivedEvents).toHaveLength(0);
    expect(errorListener).not.toHaveBeenCalled();
    expect(connector.getStatus()).toBe("connected");
  });

  it("rejects an invalid generated event timestamp without delivery or state change", async () => {
    let calls = 0;
    const connector = new MockConnector({
      clock: () => {
        calls += 1;
        return calls === 1
          ? "2026-07-23T12:00:00.000Z"
          : "not-a-timestamp";
      },
    });
    const eventListener = vi.fn();
    const errorListener = vi.fn();
    connector.onEvent(eventListener);
    connector.onError(errorListener);
    await connector.connect();

    expect(() => connector.emitMockGift()).toThrow(MockConnectorInputError);
    expect(eventListener).not.toHaveBeenCalled();
    expect(errorListener).not.toHaveBeenCalled();
    expect(connector.getStatus()).toBe("connected");
  });

  it("carries explicit identity and streak evidence without inventing it for ordinary gifts", async () => {
    const connector = new MockConnector({
      clock: () => "2026-07-23T12:00:00.000Z",
    });
    const received: RawConnectorEvent[] = [];
    connector.onEvent((event) => received.push(event));
    await connector.connect();

    connector.emitMockGift();
    connector.emitMockGift({
      connectorEventId: "gift_event_1",
      sequenceId: "7",
      giftStreak: {
        streakId: "provider_streak_1",
        lifecycle: "start",
        sequenceId: "7",
      },
    });

    expect(received[0].identity).toBeUndefined();
    expect(received[0].giftStreak).toBeUndefined();
    expect(received[1].identity).toEqual({
      connectorEventId: "gift_event_1",
      sequenceId: "7",
    });
    expect(received[1].giftStreak).toEqual({
      streakId: "provider_streak_1",
      lifecycle: "start",
      sequenceId: "7",
    });

    expect(() =>
      connector.emitMockEvent({
        kind: "gift",
        source: "mock",
        giftStreak: { streakId: "", lifecycle: "start" },
        rawPayload: {},
      })
    ).toThrow(MockConnectorInputError);
  });
});
