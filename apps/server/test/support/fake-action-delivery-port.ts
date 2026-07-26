import type { GameActionEnvelope } from "@crowdcircuit/contracts";
import type {
  ActionDeliveryOutcome,
  ActionDeliveryPort,
  DeliveryResolution,
  PreparedActionDelivery,
} from "../../src/delivery/port.js";

export class FakeActionDeliveryPort implements ActionDeliveryPort {
  #resolutions: DeliveryResolution[] = [];
  #outcomes: ActionDeliveryOutcome[] = [];
  #defaultResolution: DeliveryResolution = { status: "no_destination" };
  #defaultOutcome: ActionDeliveryOutcome = { status: "sent" };

  readonly resolvedEnvelopes: GameActionEnvelope[] = [];
  readonly sentDeliveries: PreparedActionDelivery[] = [];

  queueResolution(resolution: DeliveryResolution): void {
    this.#resolutions.push(resolution);
  }

  queueOutcome(outcome: ActionDeliveryOutcome): void {
    this.#outcomes.push(outcome);
  }

  setDefaultResolution(resolution: DeliveryResolution): void {
    this.#defaultResolution = resolution;
  }

  setDefaultOutcome(outcome: ActionDeliveryOutcome): void {
    this.#defaultOutcome = outcome;
  }

  async resolveDestination(
    envelope: GameActionEnvelope,
  ): Promise<DeliveryResolution> {
    this.resolvedEnvelopes.push(envelope);
    const next = this.#resolutions.shift();
    return next ?? this.#defaultResolution;
  }

  async send(
    delivery: PreparedActionDelivery,
  ): Promise<ActionDeliveryOutcome> {
    this.sentDeliveries.push(delivery);
    const next = this.#outcomes.shift();
    return next ?? this.#defaultOutcome;
  }

  reset(): void {
    this.#resolutions = [];
    this.#outcomes = [];
    this.resolvedEnvelopes.length = 0;
    this.sentDeliveries.length = 0;
  }
}
