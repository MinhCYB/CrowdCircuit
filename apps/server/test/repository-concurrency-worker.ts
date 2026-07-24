import { parentPort, workerData } from "node:worker_threads";
import {
  SqliteDurableActionRepository,
  type CreateDurableAction,
} from "../src/persistence/repository.js";

interface WorkerInput {
  readonly filename: string;
  readonly action: CreateDurableAction;
}

const input: WorkerInput = workerData;
const repository = SqliteDurableActionRepository.open({ filename: input.filename });

parentPort?.postMessage({ type: "ready" });
parentPort?.once("message", () => {
  try {
    repository.reconcilePreviousRuntime("concurrency-runtime", Date.now());
    const result = repository.createBeforeFirstSend(input.action);
    parentPort?.postMessage({
      type: "result",
      created: result.created,
      hasAuthorization: result.sendAuthorization !== null,
    });
  } catch (error) {
    parentPort?.postMessage({
      type: "error",
      code: error instanceof Error && "code" in error ? Reflect.get(error, "code") : "UNKNOWN",
    });
  } finally {
    repository.close();
  }
});
