import type { GameActionEnvelope } from "@crowdcircuit/contracts";

export interface DeliveryDestination {
  readonly clientId: string;
  readonly gameInstanceId: string | null;
}

export type DeliveryResolution =
  | {
      readonly status: "available";
      readonly destination: DeliveryDestination;
    }
  | {
      readonly status: "no_destination";
    };

export interface PreparedActionDelivery {
  readonly envelope: GameActionEnvelope;
  readonly attemptNumber: number;
  readonly destination: DeliveryDestination;
}

export type ActionDeliveryOutcome =
  | {
      readonly status: "sent";
    }
  | {
      readonly status: "transport_error";
      readonly error: string;
    };

export interface ActionDeliveryPort {
  resolveDestination(
    envelope: GameActionEnvelope,
  ): Promise<DeliveryResolution>;

  send(
    delivery: PreparedActionDelivery,
  ): Promise<ActionDeliveryOutcome>;
}
