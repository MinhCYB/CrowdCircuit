import {
  PairingCodeRegistry,
  RoleSessionRegistry,
  type ClientRole,
  type PairingCodeRequest,
} from "@crowdcircuit/auth-core";

const role: ClientRole = "game";
const request: PairingCodeRequest = { role, clientId: "game-1" };
new PairingCodeRegistry().create(request);
new RoleSessionRegistry().issue("voice-output", "voice-1");
new PairingCodeRegistry({ capacity: 10, tombstoneTtlMs: 1_000 }).cleanup();
new RoleSessionRegistry({ capacity: 10, tombstoneTtlMs: 1_000 }).cleanup();
// @ts-expect-error cleanup time is controlled only by the injected clock
new PairingCodeRegistry().cleanup(Number.MAX_SAFE_INTEGER);
// @ts-expect-error cleanup time is controlled only by the injected clock
new RoleSessionRegistry().cleanup(Number.MAX_SAFE_INTEGER);

// @ts-expect-error invalid role
const invalidRole: ClientRole = "operator";
// @ts-expect-error clientId is required
const missingClient: PairingCodeRequest = { role: "game" };
// @ts-expect-error TTL must be numeric
new PairingCodeRegistry().create({ role: "game", clientId: "g", ttlMs: "60" });
// @ts-expect-error admin sessions are bootstrapped, never paired
new PairingCodeRegistry().create({ role: "admin", clientId: "admin" });
// @ts-expect-error capacity must be numeric
new PairingCodeRegistry({ capacity: "10" });

void invalidRole;
void missingClient;
