import type {
  ConnectionInfo,
  ConnectionStatusMessage,
  ConnectorConfig,
  LiveConnector,
  RawConnectorEvent,
  Unsubscribe,
} from "@crowdcircuit/connector-core";
import type { LiveEvent } from "@crowdcircuit/contracts";
import {
  EventNormalizer,
  type NormalizationError,
  type NormalizerOptions,
} from "./index.js";
import {
  EventIntegrityPipeline,
  type EventIntegrityPipelineOptions,
  type PipelineEmission,
  RawEventDeduplicator,
  type RawEventDeduplicatorOptions,
  isGiftStreakEvidence,
} from "./pipeline.js";

export interface HeadlessEventGatewayOptions {
  normalizer?: EventNormalizer;
  normalizerOptions?: NormalizerOptions;
  pipeline?: EventIntegrityPipeline;
  pipelineOptions?: EventIntegrityPipelineOptions;
  rawDeduplicator?: RawEventDeduplicator;
  rawDeduplicatorOptions?: RawEventDeduplicatorOptions;
}

export interface HeadlessEventGatewayStats {
  rawReceived: number;
  normalizationRejected: number;
  dedupeRejected: number;
  normalizedAccepted: number;
  emitted: number;
}

export type GatewayEventListener = (emission: PipelineEmission) => void;
export type GatewayNormalizationErrorListener = (
  error: NormalizationError,
  raw: RawConnectorEvent
) => void;

/**
 * Ordered in-process boundary from LiveConnector raw events to normalized,
 * deduplicated and aggregated Phase B emissions.
 *
 * Connector callbacks only append work to a promise chain; downstream
 * normalization and observers do not block the connector's callback loop.
 */
export class HeadlessEventGateway {
  private readonly normalizer: EventNormalizer;
  private readonly normalizerOptions: NormalizerOptions;
  private readonly pipeline: EventIntegrityPipeline;
  private readonly rawDeduplicator: RawEventDeduplicator;
  private readonly eventListeners = new Set<GatewayEventListener>();
  private readonly normalizationErrorListeners =
    new Set<GatewayNormalizationErrorListener>();
  private connector: LiveConnector | null = null;
  private connectorUnsubscribes: Unsubscribe[] = [];
  private queue: Promise<void> = Promise.resolve();
  private running = false;
  private stats: HeadlessEventGatewayStats = {
    rawReceived: 0,
    normalizationRejected: 0,
    dedupeRejected: 0,
    normalizedAccepted: 0,
    emitted: 0,
  };

  constructor(options: HeadlessEventGatewayOptions = {}) {
    this.normalizer = options.normalizer ?? new EventNormalizer();
    this.normalizerOptions = options.normalizerOptions ?? {};
    this.pipeline =
      options.pipeline ??
      new EventIntegrityPipeline(options.pipelineOptions);
    this.rawDeduplicator =
      options.rawDeduplicator ??
      new RawEventDeduplicator(options.rawDeduplicatorOptions);
  }

  public async start(
    connector: LiveConnector,
    config?: ConnectorConfig
  ): Promise<ConnectionInfo> {
    if (this.running) {
      throw new Error("HeadlessEventGateway is already running");
    }
    this.running = true;
    this.connector = connector;
    this.connectorUnsubscribes = [
      connector.onEvent((raw) => this.enqueueRaw(raw)),
      connector.onStatus((status) => this.enqueueStatus(status)),
      connector.onError(() => {
        // Connector errors remain observable through the connector boundary.
        // The gateway only owns normalized-event validation failures.
      }),
    ];
    try {
      return await connector.connect(config);
    } catch (error) {
      this.detachConnector();
      this.running = false;
      throw error;
    }
  }

  public async stop(): Promise<void> {
    const connector = this.connector;
    if (!connector) return;
    await connector.disconnect();
    await this.drain();
    this.detachConnector();
    this.running = false;
  }

  public onEvent(listener: GatewayEventListener): Unsubscribe {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public onNormalizationError(
    listener: GatewayNormalizationErrorListener
  ): Unsubscribe {
    this.normalizationErrorListeners.add(listener);
    return () => this.normalizationErrorListeners.delete(listener);
  }

  public tick(): void {
    this.enqueue(() => this.publish(this.pipeline.tick()));
  }

  public flush(reason: "disconnect_flush" | "shutdown_flush"): void {
    this.enqueue(() => this.flushNow(reason));
  }

  public async drain(): Promise<void> {
    await this.queue;
  }

  public getStats(): Readonly<HeadlessEventGatewayStats> {
    return { ...this.stats };
  }

  public isRunning(): boolean {
    return this.running;
  }

  private enqueueRaw(raw: RawConnectorEvent): void {
    this.stats.rawReceived += 1;
    this.enqueue(() => {
      const result = this.normalizer.normalize(raw, this.normalizerOptions);
      if (!result.success) {
        this.stats.normalizationRejected += 1;
        for (const listener of Array.from(
          this.normalizationErrorListeners
        )) {
          try {
            listener(result.error, raw);
          } catch {
            // Validation observers cannot corrupt the ordered queue.
          }
        }
        return;
      }
      this.stats.normalizedAccepted += 1;
      if (!this.rawDeduplicator.accept(raw, result.event)) {
        this.stats.dedupeRejected += 1;
        return;
      }
      this.publish(
        this.pipeline.process(result.event, {
          ...(!isGiftStreakEvidence(raw.giftStreak)
            ? {}
            : { giftStreak: raw.giftStreak }),
        })
      );
    });
  }

  private enqueueStatus(status: ConnectionStatusMessage): void {
    if (status.status === "disconnected") {
      this.enqueue(() => this.flushNow("disconnect_flush"));
    } else if (status.status === "ended") {
      this.enqueue(() => this.flushNow("shutdown_flush"));
    }
  }

  private enqueue(work: () => void): void {
    this.queue = this.queue.then(() => {
      work();
    });
  }

  private publish(emissions: readonly PipelineEmission[]): void {
    for (const emission of emissions) {
      this.stats.emitted += 1;
      for (const listener of Array.from(this.eventListeners)) {
        try {
          listener(emission);
        } catch {
          // Downstream observers are isolated from pipeline state.
        }
      }
    }
  }

  private flushNow(reason: "disconnect_flush" | "shutdown_flush"): void {
    this.publish(this.pipeline.flush(reason));
    this.rawDeduplicator.clear();
  }

  private detachConnector(): void {
    for (const unsubscribe of this.connectorUnsubscribes.splice(0)) {
      unsubscribe();
    }
    this.connector = null;
  }
}

export function liveEvents(
  emissions: readonly PipelineEmission[]
): LiveEvent[] {
  return emissions.map((emission) => emission.event);
}
