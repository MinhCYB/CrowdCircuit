import { parentPort, workerData } from "node:worker_threads";
import { z } from "zod";
import { SqliteDurableActionRepository } from "../src/persistence/repository.js";

const input = z.object({
  filename: z.string(),
  idempotencySeed: z.string(),
  now: z.number().int().nonnegative(),
}).parse(workerData);
const sharedOwnerRandom = () => new Uint8Array(32).fill(73);
const repository = SqliteDurableActionRepository.open({
  filename: input.filename,
  runtimeOwnerRandom: sharedOwnerRandom,
});

parentPort?.postMessage({ type: "ready" });
parentPort?.once("message", () => {
  try {
    repository.reconcilePreviousRuntime("runtime", input.now);
    const result = repository.promoteDeferredCandidate(input.idempotencySeed, input.now);
    parentPort?.postMessage({ type: "result", status: result.status });
  } catch (error) {
    parentPort?.postMessage({
      type: "error",
      code: error instanceof Error && "code" in error
        ? Reflect.get(error, "code")
        : "UNKNOWN",
    });
  } finally {
    repository.close();
  }
});
