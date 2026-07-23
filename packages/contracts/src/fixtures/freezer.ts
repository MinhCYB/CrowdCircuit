/**
 * Internal helper: recursively freezes an object graph in place using WeakSet to prevent infinite recursion on cyclic objects.
 */
type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

function deepFreezeGraph(obj: object, visited = new WeakSet<object>()): void {
  if (visited.has(obj)) {
    return;
  }
  visited.add(obj);
  if (!Object.isFrozen(obj)) {
    Object.freeze(obj);
  }
  for (const key of Reflect.ownKeys(obj)) {
    const val = Reflect.get(obj, key);
    if (typeof val === "object" && val !== null) {
      deepFreezeGraph(val, visited);
    }
  }
}

/**
 * Internal package helper: recursively freezes the provided object graph in place and returns it without type assertions.
 * Modifies object integrity state in place at runtime.
 */
export function deepFreeze<T extends object>(obj: T): DeepReadonly<T>;
export function deepFreeze(obj: object): object {
  deepFreezeGraph(obj);
  return obj;
}
