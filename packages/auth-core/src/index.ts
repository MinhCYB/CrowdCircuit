import { createHash, randomBytes as cryptoRandomBytes } from "node:crypto";

export type ClientRole = "admin" | "game" | "voice-output";
export type PairableClientRole = Exclude<ClientRole, "admin">;
export type Clock = () => number;
export type RandomSource = (size: number) => Uint8Array;

export const systemClock: Clock = () => Date.now();
export const secureRandom: RandomSource = (size) => cryptoRandomBytes(size);

export class AuthError extends Error {
  readonly code:
    | "INVALID_CONFIGURATION"
    | "INVALID_CREDENTIAL"
    | "CREDENTIAL_EXPIRED"
    | "CREDENTIAL_REVOKED"
    | "CREDENTIAL_COLLISION"
    | "CAPACITY_EXCEEDED"
    | "FORBIDDEN"
    | "QUERY_TOKEN_FORBIDDEN";

  constructor(code: AuthError["code"], message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

function positiveFiniteInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AuthError("INVALID_CONFIGURATION", `${name} must be a positive safe integer`);
  }
}

function randomToken(random: RandomSource, bytes: number): string {
  const value = random(bytes);
  if (!(value instanceof Uint8Array) || value.byteLength !== bytes) {
    throw new AuthError("INVALID_CONFIGURATION", "Random source returned invalid output");
  }
  return Buffer.from(value).toString("base64url");
}

export class RuntimeSecret {
  #bytes: Uint8Array | undefined;

  private constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  static create(random: RandomSource = secureRandom, bytes = 32): RuntimeSecret {
    positiveFiniteInteger(bytes, "Secret length");
    if (bytes < 32) {
      throw new AuthError("INVALID_CONFIGURATION", "Secret length must be at least 32 bytes");
    }
    const generated = random(bytes);
    if (!(generated instanceof Uint8Array) || generated.byteLength !== bytes) {
      throw new AuthError("INVALID_CONFIGURATION", "Random source returned invalid output");
    }
    return new RuntimeSecret(Uint8Array.from(generated));
  }

  get active(): boolean {
    return this.#bytes !== undefined;
  }

  dispose(): void {
    this.#bytes?.fill(0);
    this.#bytes = undefined;
  }
}

export interface PairingCodeRequest {
  readonly role: PairableClientRole;
  readonly clientId: string;
  readonly ttlMs?: number;
}

export interface PairingCodeCredential {
  readonly code: string;
  readonly expiresAt: number;
}

export interface ConsumedPairingCode {
  readonly role: PairableClientRole;
  readonly clientId: string;
}

interface PairingRecord extends ConsumedPairingCode {
  readonly expiresAt: number;
  revokedAt: number | null;
  consumedAt: number | null;
}

function validClientId(clientId: string): void {
  if (clientId.length === 0 || clientId.length > 128) {
    throw new AuthError("INVALID_CREDENTIAL", "Client identifier is invalid");
  }
}

function validClientRole(role: string): role is ClientRole {
  return role === "admin" || role === "game" || role === "voice-output";
}

function validPairableRole(role: string): role is PairableClientRole {
  return role === "game" || role === "voice-output";
}

export class PairingCodeRegistry {
  readonly #records = new Map<string, PairingRecord>();
  readonly #clock: Clock;
  readonly #random: RandomSource;
  readonly #defaultTtlMs: number;
  readonly #capacity: number;
  readonly #tombstoneTtlMs: number;

  constructor(options: {
    readonly clock?: Clock;
    readonly random?: RandomSource;
    readonly defaultTtlMs?: number;
    readonly capacity?: number;
    readonly tombstoneTtlMs?: number;
  } = {}) {
    this.#clock = options.clock ?? systemClock;
    this.#random = options.random ?? secureRandom;
    this.#defaultTtlMs = options.defaultTtlMs ?? 60_000;
    this.#capacity = options.capacity ?? 1_000;
    this.#tombstoneTtlMs = options.tombstoneTtlMs ?? 60_000;
    positiveFiniteInteger(this.#defaultTtlMs, "Pairing TTL");
    positiveFiniteInteger(this.#capacity, "Pairing capacity");
    positiveFiniteInteger(this.#tombstoneTtlMs, "Pairing tombstone TTL");
  }

  create(request: PairingCodeRequest): PairingCodeCredential {
    if (!validPairableRole(request.role)) {
      throw new AuthError("INVALID_CREDENTIAL", "Client role is invalid");
    }
    validClientId(request.clientId);
    this.cleanup();
    if (this.#records.size >= this.#capacity) {
      throw new AuthError("CAPACITY_EXCEEDED", "Pairing capacity is exhausted");
    }
    const ttlMs = request.ttlMs ?? this.#defaultTtlMs;
    positiveFiniteInteger(ttlMs, "Pairing TTL");
    const now = this.#now();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = randomToken(this.#random, 18);
      if (!this.#records.has(code)) {
        const expiresAt = now + ttlMs;
        if (!Number.isSafeInteger(expiresAt)) {
          throw new AuthError("INVALID_CONFIGURATION", "Pairing expiry is invalid");
        }
        this.#records.set(code, {
          role: request.role,
          clientId: request.clientId,
          expiresAt,
          revokedAt: null,
          consumedAt: null,
        });
        return { code, expiresAt };
      }
    }
    throw new AuthError("CREDENTIAL_COLLISION", "Unable to allocate credential");
  }

  consume(code: string, role: PairableClientRole, clientId: string): ConsumedPairingCode {
    return this.redeem(code, role, clientId, () => ({ role, clientId }));
  }

  redeem<T>(
    code: string,
    role: PairableClientRole,
    clientId: string,
    exchange: () => T,
  ): T {
    if (!validPairableRole(role)) {
      throw new AuthError("INVALID_CREDENTIAL", "Client role is invalid");
    }
    const now = this.#now();
    const record = this.#records.get(code);
    this.#cleanupAt(now);
    if (record === undefined) {
      throw new AuthError("INVALID_CREDENTIAL", "Pairing credential is invalid");
    }
    if (now >= record.expiresAt) {
      throw new AuthError("INVALID_CREDENTIAL", "Pairing credential is invalid");
    }
    if (record.revokedAt !== null || record.consumedAt !== null) {
      throw new AuthError("INVALID_CREDENTIAL", "Pairing credential is invalid");
    }
    if (record.role !== role || record.clientId !== clientId) {
      throw new AuthError("INVALID_CREDENTIAL", "Pairing credential is invalid");
    }
    const result = exchange();
    record.consumedAt = now;
    return result;
  }

  revoke(code: string): boolean {
    const now = this.#now();
    this.#cleanupAt(now);
    const record = this.#records.get(code);
    if (record === undefined) return false;
    if (record.revokedAt !== null || record.consumedAt !== null) return false;
    record.revokedAt = now;
    return true;
  }

  cleanup(): number {
    return this.#cleanupAt(this.#now());
  }

  #cleanupAt(now: number): number {
    let removed = 0;
    for (const [code, record] of this.#records) {
      const tombstoneAt = record.consumedAt ?? record.revokedAt;
      const removable =
        tombstoneAt !== null
          ? now >= tombstoneAt + this.#tombstoneTtlMs
          : now >= record.expiresAt;
      if (removable) {
        this.#records.delete(code);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.#records.size;
  }

  #now(): number {
    const now = this.#clock();
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new AuthError("INVALID_CONFIGURATION", "Clock returned invalid time");
    }
    return now;
  }
}

export interface RoleSession {
  readonly role: ClientRole;
  readonly clientId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly fingerprint: string;
}

export interface IssuedRoleSession extends RoleSession {
  readonly token: string;
}

interface StoredSession extends RoleSession {
  readonly token: string;
  revokedAt: number | null;
}

export class RoleSessionRegistry {
  readonly #sessions = new Map<string, StoredSession>();
  readonly #clock: Clock;
  readonly #random: RandomSource;
  readonly #defaultTtlMs: number;
  readonly #capacity: number;
  readonly #tombstoneTtlMs: number;

  constructor(options: {
    readonly clock?: Clock;
    readonly random?: RandomSource;
    readonly defaultTtlMs?: number;
    readonly capacity?: number;
    readonly tombstoneTtlMs?: number;
  } = {}) {
    this.#clock = options.clock ?? systemClock;
    this.#random = options.random ?? secureRandom;
    this.#defaultTtlMs = options.defaultTtlMs ?? 43_200_000;
    this.#capacity = options.capacity ?? 2_000;
    this.#tombstoneTtlMs = options.tombstoneTtlMs ?? 60_000;
    positiveFiniteInteger(this.#defaultTtlMs, "Session TTL");
    positiveFiniteInteger(this.#capacity, "Session capacity");
    positiveFiniteInteger(this.#tombstoneTtlMs, "Session tombstone TTL");
  }

  issue(role: ClientRole, clientId: string, ttlMs = this.#defaultTtlMs): IssuedRoleSession {
    if (!validClientRole(role)) {
      throw new AuthError("INVALID_CREDENTIAL", "Client role is invalid");
    }
    validClientId(clientId);
    positiveFiniteInteger(ttlMs, "Session TTL");
    if (ttlMs > 43_200_000) {
      throw new AuthError("INVALID_CONFIGURATION", "Session TTL exceeds the runtime ceiling");
    }
    const issuedAt = this.#now();
    this.#cleanupAt(issuedAt);
    if (this.#sessions.size >= this.#capacity) {
      throw new AuthError("CAPACITY_EXCEEDED", "Session capacity is exhausted");
    }
    const expiresAt = issuedAt + ttlMs;
    if (!Number.isSafeInteger(expiresAt)) {
      throw new AuthError("INVALID_CONFIGURATION", "Session expiry is invalid");
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const token = randomToken(this.#random, 32);
      if (!this.#sessions.has(token)) {
        const session: StoredSession = {
          role,
          clientId,
          issuedAt,
          expiresAt,
          fingerprint: tokenFingerprint(token),
          token,
          revokedAt: null,
        };
        this.#sessions.set(token, session);
        return { token, role, clientId, issuedAt, expiresAt, fingerprint: session.fingerprint };
      }
    }
    throw new AuthError("CREDENTIAL_COLLISION", "Unable to allocate credential");
  }

  validate(token: string, role: ClientRole, clientId?: string): RoleSession {
    if (!validClientRole(role)) {
      throw new AuthError("INVALID_CREDENTIAL", "Client role is invalid");
    }
    const now = this.#now();
    const session = this.#sessions.get(token);
    this.#cleanupAt(now);
    if (session === undefined) {
      throw new AuthError("INVALID_CREDENTIAL", "Session credential is invalid");
    }
    if (now >= session.expiresAt) {
      throw new AuthError("CREDENTIAL_EXPIRED", "Session credential expired");
    }
    if (session.revokedAt !== null) {
      throw new AuthError("CREDENTIAL_REVOKED", "Session credential was revoked");
    }
    if (session.role !== role || (clientId !== undefined && session.clientId !== clientId)) {
      throw new AuthError("FORBIDDEN", "Session credential is not authorized");
    }
    return {
      role: session.role,
      clientId: session.clientId,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      fingerprint: session.fingerprint,
    };
  }

  revoke(token: string): boolean {
    const now = this.#now();
    this.#cleanupAt(now);
    const session = this.#sessions.get(token);
    if (session === undefined) return false;
    if (session.revokedAt !== null) return false;
    session.revokedAt = now;
    return true;
  }

  revokeClient(clientId: string): number {
    const now = this.#now();
    this.#cleanupAt(now);
    let count = 0;
    for (const session of this.#sessions.values()) {
      if (session.clientId === clientId && session.revokedAt === null) {
        session.revokedAt = now;
        count += 1;
      }
    }
    return count;
  }

  clear(): void {
    this.#sessions.clear();
  }

  issueOrReuse(
    role: ClientRole,
    clientId: string,
    ttlMs = this.#defaultTtlMs,
  ): IssuedRoleSession {
    const now = this.#now();
    this.#cleanupAt(now);
    for (const session of this.#sessions.values()) {
      if (
        session.role === role &&
        session.clientId === clientId &&
        session.revokedAt === null &&
        now < session.expiresAt
      ) {
        return {
          token: session.token,
          role: session.role,
          clientId: session.clientId,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
          fingerprint: session.fingerprint,
        };
      }
    }
    return this.issue(role, clientId, ttlMs);
  }

  cleanup(): number {
    return this.#cleanupAt(this.#now());
  }

  #cleanupAt(now: number): number {
    let removed = 0;
    for (const [token, session] of this.#sessions) {
      const removableAt =
        session.revokedAt === null
          ? session.expiresAt
          : session.revokedAt + this.#tombstoneTtlMs;
      if (now >= removableAt) {
        this.#sessions.delete(token);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.#sessions.size;
  }

  #now(): number {
    const now = this.#clock();
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new AuthError("INVALID_CONFIGURATION", "Clock returned invalid time");
    }
    return now;
  }
}

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 8);
}

export interface OriginPolicy {
  readonly allowedOrigins: ReadonlySet<string>;
  readonly allowNoOriginOnLoopback: boolean;
}

export function authorizeOrigin(
  origin: string | undefined,
  hostname: string,
  policy: OriginPolicy,
): void {
  const loopback = hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
  if (origin === undefined) {
    if (loopback && policy.allowNoOriginOnLoopback) return;
    throw new AuthError("FORBIDDEN", "Origin is not authorized");
  }
  if (origin === "*" || !policy.allowedOrigins.has(origin)) {
    throw new AuthError("FORBIDDEN", "Origin is not authorized");
  }
}

export interface AuthorizationInput {
  readonly token: string | undefined;
  readonly queryToken?: string;
  readonly role: ClientRole;
  readonly clientId?: string;
}

export function authorizeSession(
  registry: RoleSessionRegistry,
  input: AuthorizationInput,
): RoleSession {
  if (input.queryToken !== undefined) {
    throw new AuthError("QUERY_TOKEN_FORBIDDEN", "Query-string credentials are forbidden");
  }
  if (input.token === undefined || input.token.length === 0) {
    throw new AuthError("INVALID_CREDENTIAL", "Session credential is required");
  }
  return registry.validate(input.token, input.role, input.clientId);
}
