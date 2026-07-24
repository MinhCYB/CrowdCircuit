import {
  PairingCodeRegistry,
  RoleSessionRegistry,
  RuntimeSecret,
  type Clock,
  type RandomSource,
} from "@crowdcircuit/auth-core";

export interface AuthRuntime {
  readonly secret: RuntimeSecret;
  readonly pairingCodes: PairingCodeRegistry;
  readonly sessions: RoleSessionRegistry;
  dispose(): void;
}

export function createAuthRuntime(options: {
  readonly clock?: Clock;
  readonly random?: RandomSource;
} = {}): AuthRuntime {
  const secret = RuntimeSecret.create(options.random);
  const pairingCodes = new PairingCodeRegistry(options);
  const sessions = new RoleSessionRegistry(options);
  return {
    secret,
    pairingCodes,
    sessions,
    dispose() {
      sessions.clear();
      secret.dispose();
    },
  };
}
