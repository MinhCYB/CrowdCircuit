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
        gameId: result.session.gameId,
        gameInstanceId: result.session.gameInstanceId,
        sessionGeneration: result.session.connectionGeneration,
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
      sessionGeneration: delivery.destination.sessionGeneration,
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
}
