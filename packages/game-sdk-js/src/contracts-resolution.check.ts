import type { GameActionEnvelope, LiveEventEnvelope } from "@crowdcircuit/contracts";
import type { CANONICAL_GAME_ACTION_ENVELOPE } from "@crowdcircuit/contracts/fixtures";

// Isolated type-only verification of package-name resolution from consuming workspace package.
// Contains 0 runtime value imports, 0 logs, and 0 side effects.
type _CheckRootContract = GameActionEnvelope;
type _CheckLiveEvent = LiveEventEnvelope;
type _CheckFixtureType = typeof CANONICAL_GAME_ACTION_ENVELOPE;
type _CheckFixtureActionType = _CheckFixtureType["actionType"];
type _CheckFixtureParams = _CheckFixtureType["params"];
