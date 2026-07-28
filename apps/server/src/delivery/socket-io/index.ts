import type {
  GameActionDeliveryMessage,
  GameActionEnvelope,
} from "@crowdcircuit/contracts";
import type {
  ActionDeliveryOutcome,
  ActionDeliveryPort,
  DeliveryResolution,
  PreparedActionDelivery,
} from "../port.js";
import type {
  GameSessionDeliveryPort,
  RegisteredGameSessionSnapshot,
} from "../../game/ports.js";

const SANITIZED_TRANSPORT_ERROR = "game_session_unavailable";

function encodeDestinationGeneration(
  session: RegisteredGameSessionSnapshot,
): string {
  return JSON.stringify([
    1,
    session.clientId,
    session.gameId,
    session.gameInstanceId,
    session.serverRuntimeGeneration,
    session.connectionGeneration,
    session.connectionGeneration,
  ]);
}

export class SocketIoActionDeliveryAdapter implements ActionDeliveryPort {
  constructor(private readonly registry: GameSessionDeliveryPort) {}

  async resolveDestination(
    envelope: GameActionEnvelope,
  ): Promise<DeliveryResolution> {
    const result = await this.registry.lookupDestination({
      clientId: envelope.gameId,
      gameId: envelope.gameId,
      gameInstanceId: envelope.gameInstanceId,
    });
    if (result.status === "not_found") {
      return { status: "no_destination" };
    }
    return {
      status: "available",
      destination: {
        clientId: result.session.clientId,
        gameInstanceId: result.session.gameInstanceId,
        destinationGeneration: encodeDestinationGeneration(result.session),
      },
    };
  }

  async send(
    delivery: PreparedActionDelivery,
  ): Promise<ActionDeliveryOutcome> {
    const message: GameActionDeliveryMessage = {
      type: "game.action",
      specVersion: "0.1",
      attemptNumber: delivery.attemptNumber,
      sessionGeneration: this.#sessionGeneration(
        delivery.destination.destinationGeneration,
      ),
      data: delivery.envelope,
    };
    const result = this.registry.sendIfCurrent(
      message,
      delivery.destination.destinationGeneration,
    );
    return result.status === "sent"
      ? { status: "sent" }
      : { status: "transport_error", error: SANITIZED_TRANSPORT_ERROR };
  }

  #sessionGeneration(destinationGeneration: string): number {
    try {
      const parsed: unknown = JSON.parse(destinationGeneration);
      if (
        Array.isArray(parsed) &&
        parsed.length === 7 &&
        Number.isSafeInteger(parsed[5]) &&
        (parsed[5] as number) > 0
      ) {
        return parsed[5] as number;
      }
    } catch {
      // The registry owns authoritative fence validation.
    }
    return 0;
  }
}
