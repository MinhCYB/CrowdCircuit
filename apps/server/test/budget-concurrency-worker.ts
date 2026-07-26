import { parentPort, workerData } from "node:worker_threads";
import { SqliteDurableActionRepository } from "../src/persistence/repository.js";
import type { BudgetAdmissionRequest } from "@crowdcircuit/mapping-engine";

interface WorkerInput {
  readonly filename: string;
  readonly request: BudgetAdmissionRequest;
}

const input: WorkerInput = workerData;
const sharedOwnerRandom = () => new Uint8Array(32).fill(42);

const repository = SqliteDurableActionRepository.open({
  filename: input.filename,
  runtimeOwnerRandom: sharedOwnerRandom,
});

parentPort?.postMessage({ type: "ready" });
parentPort?.once("message", (message) => {
  if (Reflect.get(Object(message), "type") === "go") {
    try {
      repository.reconcilePreviousRuntime("concurrency-runtime", Date.now());
      const admission = repository.admit(input.request);
      parentPort?.postMessage({
        type: "result",
        admission,
      });
    } catch (error) {
      parentPort?.postMessage({
        type: "error",
        code: error instanceof Error && "code" in error ? Reflect.get(error, "code") : "UNKNOWN",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      repository.close();
    }
  }
});
