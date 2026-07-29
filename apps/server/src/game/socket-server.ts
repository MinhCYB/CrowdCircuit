import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { OriginPolicy, RoleSessionRegistry } from "@crowdcircuit/auth-core";
import {
  GameHeartbeatMessageSchema,
  GameRegisterMessageSchema,
  GameActionReceivedMessageSchema,
  GameActionResultMessageSchema,
  type GameActionDeliveryMessage,
  type GameProtocolErrorCode,
  type GameProtocolErrorMessage,
} from "@crowdcircuit/contracts";
import { Server } from "socket.io";
import {
  authenticateGameHandshake,
  GameAuthenticationError,
  gameErrorRetryable,
} from "./auth/index.js";
import {
  GameSessionRegistry,
} from "./registry/index.js";
import type { InboundActionLifecyclePort, InboundGameSession } from "./ports.js";

export const GAME_SOCKET_OPTIONS = {
  path: "/socket.io",
  pingInterval: 10_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 65_536,
  registrationDeadlineMs: 5_000,
  sweepIntervalMs: 5_000,
  maxInvalidRegistrationAttempts: 4,
} as const;

interface SocketState {
  readonly clientId: string;
  readonly authenticatedAt: number;
  readonly authExpiresAt: number;
  readonly authFingerprint: string;
  registered:
    | {
        readonly gameId: string;
        readonly gameInstanceId: string;
        readonly connectionGeneration: number;
      }
    | undefined;
  invalidRegistrationAttempts: number;
  heartbeatTokens: number;
  heartbeatRefillAt: number;
  invalidMessageTimes: number[];
}

export interface GameSocketRuntime {
  readonly registry: GameSessionRegistry;
  close(): Promise<void>;
}

interface RegistrationDeadlineScheduler {
  set(callback: () => void, delayMs: number): { unref(): void };
  clear(timer: { unref(): void }): void;
}

interface ActionSendTestHooks {
  isWritable?(): boolean;
  emitAction?(message: GameActionDeliveryMessage): void;
}

function protocolError(code: GameProtocolErrorCode): GameProtocolErrorMessage {
  return {
    type: "game.error",
    specVersion: "0.1",
    code,
    retryable: gameErrorRetryable(code),
    correlationId: randomUUID(),
  };
}

function emitError(socket: { emit(event: "game.error", value: GameProtocolErrorMessage): unknown }, code: GameProtocolErrorCode) {
  socket.emit("game.error", protocolError(code));
}

export function attachGameSocketServer(options: {
  readonly httpServer: HttpServer;
  readonly sessions: RoleSessionRegistry;
  readonly originPolicy: OriginPolicy;
  readonly inboundActionLifecycle: InboundActionLifecyclePort;
  readonly clock?: () => number;
  readonly registry?: GameSessionRegistry;
  /** @internal — test seam only; production default: GAME_SOCKET_OPTIONS.registrationDeadlineMs */
  readonly registrationDeadlineMs?: number;
  /** @internal — test seam only; production default: Node.js timeout scheduler */
  readonly registrationDeadlineScheduler?: RegistrationDeadlineScheduler;
  /** @internal — test seam only; production default: 10_000 */
  readonly invalidMessageWindowMs?: number;
  /**
   * @internal — action-specific test seam; production reads the real transport
   * writable state and emits game.action through the private Socket.IO socket.
   */
  readonly actionSendTestHooks?: ActionSendTestHooks;
}): GameSocketRuntime {
  const clock = options.clock ?? Date.now;
  const registrationDeadlineMs = options.registrationDeadlineMs ?? GAME_SOCKET_OPTIONS.registrationDeadlineMs;
  const registrationDeadlineScheduler = options.registrationDeadlineScheduler ?? {
    set(callback: () => void, delayMs: number) {
      return setTimeout(callback, delayMs);
    },
    clear(timer: { unref(): void }) {
      clearTimeout(timer as NodeJS.Timeout);
    },
  };
  const invalidMessageWindowMs = options.invalidMessageWindowMs ?? 10_000;
  const registry = options.registry ?? new GameSessionRegistry({ clock });
  const io = new Server(options.httpServer, {
    pingInterval: GAME_SOCKET_OPTIONS.pingInterval,
    pingTimeout: GAME_SOCKET_OPTIONS.pingTimeout,
    maxHttpBufferSize: GAME_SOCKET_OPTIONS.maxHttpBufferSize,
    serveClient: false,
  });
  const namespace = io.of("/game");

  namespace.use((socket, next) => {
    try {
      const auth = authenticateGameHandshake({
        handshake: {
          auth: socket.handshake.auth,
          query: socket.handshake.query,
          headers: socket.handshake.headers,
          address: socket.handshake.address,
        },
        sessions: options.sessions,
        originPolicy: options.originPolicy,
        now: clock,
      });
      socket.data["gameState"] = {
        clientId: auth.clientId,
        authenticatedAt: auth.authenticatedAt,
        authExpiresAt: auth.expiresAt,
        authFingerprint: auth.fingerprint,
        registered: undefined,
        invalidRegistrationAttempts: 0,
        heartbeatTokens: 4,
        heartbeatRefillAt: clock(),
        invalidMessageTimes: [],
      } satisfies SocketState;
      next();
    } catch (error) {
      const authError =
        error instanceof GameAuthenticationError
          ? error
          : new GameAuthenticationError("AUTH_INVALID", false);
      const connectionError = new Error(authError.code);
      Object.assign(connectionError, { data: protocolError(authError.code) });
      next(connectionError);
    }
  });

  namespace.on("connection", (socket) => {
    const state = socket.data["gameState"] as SocketState;
    const deadline = registrationDeadlineScheduler.set(() => {
      if (state.registered === undefined) {
        emitError(socket, "REGISTRATION_TIMEOUT");
        socket.disconnect(true);
      }
    }, registrationDeadlineMs);
    deadline.unref();

    const invalidMessage = () => {
      const now = clock();
      state.invalidMessageTimes = state.invalidMessageTimes.filter(
        (timestamp) => now - timestamp < invalidMessageWindowMs,
      );
      state.invalidMessageTimes.push(now);
      emitError(socket, "INVALID_MESSAGE");
      if (state.invalidMessageTimes.length >= 5) socket.disconnect(true);
    };
    socket.onAny((event) => {
      if (
        event !== "game.register" &&
        event !== "game.heartbeat" &&
        event !== "game.action.received" &&
        event !== "game.action.result"
      ) {
        invalidMessage();
      }
    });

    socket.on("game.register", (payload: unknown) => {
      if (state.registered !== undefined) {
        emitError(socket, "ALREADY_REGISTERED");
        return;
      }
      if (
        typeof payload === "object" &&
        payload !== null &&
        Reflect.get(payload, "specVersion") !== undefined &&
        Reflect.get(payload, "specVersion") !== "0.1"
      ) {
        emitError(socket, "UNSUPPORTED_PROTOCOL");
        return;
      }
      const parsed = GameRegisterMessageSchema.safeParse(payload);
      if (!parsed.success) {
        state.invalidRegistrationAttempts += 1;
        emitError(socket, "INVALID_REGISTRATION");
        if (
          state.invalidRegistrationAttempts >=
          GAME_SOCKET_OPTIONS.maxInvalidRegistrationAttempts
        ) {
          socket.disconnect(true);
        }
        return;
      }
      const outcome = registry.registerLiveSession(
        { clientId: state.clientId, authenticatedAt: state.authenticatedAt },
        {
          gameId: parsed.data.gameId,
          instanceId: parsed.data.instanceId,
          sdkVersion: parsed.data.sdkVersion,
          specVersion: parsed.data.specVersion,
          authExpiresAt: state.authExpiresAt,
          authFingerprint: state.authFingerprint,
          handle: {
            id: socket.id,
            disconnect(reason) {
              if (reason !== "SERVER_SHUTDOWN") emitError(socket, reason);
              socket.disconnect(true);
            },
            sendAction(message: GameActionDeliveryMessage) {
              if (!socket.connected) {
                return { status: "unavailable", reason: "disconnected" };
              }
              const writable =
                options.actionSendTestHooks?.isWritable?.() ??
                socket.conn.transport.writable;
              if (!writable) {
                return { status: "unavailable", reason: "backpressured" };
              }
              try {
                const emitAction =
                  options.actionSendTestHooks?.emitAction ??
                  ((action: GameActionDeliveryMessage) => {
                    socket.emit("game.action", action);
                  });
                emitAction(message);
                return { status: "sent" };
              } catch {
                return { status: "unavailable", reason: "emit_failed" };
              }
            },
          },
        },
      );
      if (outcome.status === "rejected") {
        emitError(socket, outcome.errorCode);
        return;
      }
      state.registered = {
        gameId: parsed.data.gameId,
        gameInstanceId: parsed.data.instanceId,
        connectionGeneration: outcome.sessionGeneration,
      };
      registrationDeadlineScheduler.clear(deadline);
      socket.emit("game.registered", {
        type: "game.registered",
        specVersion: "0.1",
        clientId: state.clientId,
        gameId: parsed.data.gameId,
        gameInstanceId: parsed.data.instanceId,
        sessionGeneration: outcome.sessionGeneration,
        heartbeatIntervalMs: outcome.heartbeatIntervalMs,
      });
      outcome.replaced?.disconnect("SESSION_REPLACED");
    });

    socket.on("game.heartbeat", (payload: unknown) => {
      if (state.registered === undefined) {
        emitError(socket, "REGISTRATION_REQUIRED");
        return;
      }
      const now = clock();
      const elapsedSeconds = Math.floor((now - state.heartbeatRefillAt) / 1_000);
      if (elapsedSeconds > 0) {
        state.heartbeatTokens = Math.min(4, state.heartbeatTokens + elapsedSeconds * 2);
        state.heartbeatRefillAt += elapsedSeconds * 1_000;
      }
      if (state.heartbeatTokens === 0) {
        emitError(socket, "RATE_LIMITED");
        return;
      }
      state.heartbeatTokens -= 1;
      if (!GameHeartbeatMessageSchema.safeParse(payload).success) {
        invalidMessage();
        return;
      }
      const current = registry.recordHeartbeat(
        {
          clientId: state.clientId,
          gameId: state.registered.gameId,
          gameInstanceId: state.registered.gameInstanceId,
        },
        state.registered.connectionGeneration,
      );
      if (!current) emitError(socket, "SESSION_STALE");
    });

    const proveCurrentSession = (
      sessionGeneration: number,
    ): InboundGameSession | null => {
      const registered = state.registered;
      if (registered === undefined) return null;
      const current = registry.getSession(
        state.clientId,
        registered.gameId,
        registered.gameInstanceId,
      );
      if (
        current === null ||
        current.clientId !== state.clientId ||
        current.gameId !== registered.gameId ||
        current.gameInstanceId !== registered.gameInstanceId ||
        current.connectionGeneration !== registered.connectionGeneration ||
        sessionGeneration !== registered.connectionGeneration
      ) return null;
      return {
        clientId: state.clientId,
        gameId: registered.gameId,
        gameInstanceId: registered.gameInstanceId,
        sessionGeneration: registered.connectionGeneration,
      };
    };
    const handleInbound = (
      payload: unknown,
      kind: "receipt" | "result",
    ) => {
      if (state.registered === undefined) {
        emitError(socket, "REGISTRATION_REQUIRED");
        return;
      }
      const parsed = kind === "receipt"
        ? GameActionReceivedMessageSchema.safeParse(payload)
        : GameActionResultMessageSchema.safeParse(payload);
      if (!parsed.success) {
        invalidMessage();
        return;
      }
      const session = proveCurrentSession(parsed.data.sessionGeneration);
      if (session === null) {
        emitError(socket, "SESSION_STALE");
        return;
      }
      try {
        const result = kind === "receipt"
          ? options.inboundActionLifecycle.handleReceipt(
              session,
              GameActionReceivedMessageSchema.parse(parsed.data),
            )
          : options.inboundActionLifecycle.handleResult(
              session,
              GameActionResultMessageSchema.parse(parsed.data),
            );
        if (result.status === "rejected") emitError(socket, result.code);
      } catch {
        emitError(socket, "INTERNAL_ERROR");
      }
    };
    socket.on("game.action.received", (payload: unknown) => {
      handleInbound(payload, "receipt");
    });
    socket.on("game.action.result", (payload: unknown) => {
      handleInbound(payload, "result");
    });
    socket.on("disconnect", () => {
      registrationDeadlineScheduler.clear(deadline);
      if (state.registered === undefined) return;
      registry.removeIfCurrent(
        {
          clientId: state.clientId,
          gameId: state.registered.gameId,
          gameInstanceId: state.registered.gameInstanceId,
        },
        state.registered.connectionGeneration,
        "disconnect",
      );
    });
  });

  const sweepTimer = setInterval(
    () => registry.sweepStale(),
    GAME_SOCKET_OPTIONS.sweepIntervalMs,
  );
  sweepTimer.unref();
  let closed = false;
  return {
    registry,
    async close() {
      if (closed) return;
      closed = true;
      clearInterval(sweepTimer);
      registry.closeAll();
      namespace.disconnectSockets(true);
      io.engine.close();
      io.removeAllListeners();
    },
  };
}
