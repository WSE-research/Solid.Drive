/**
 * A bounded-concurrency task pool, used to run file transfers in parallel
 * without opening an unbounded number of connections to the Pod.
 *
 * @remarks
 * Browsers already cap concurrent connections per origin (six for HTTP/1.1),
 * but that cap queues requests invisibly at the network layer, after the
 * application has already committed memory for every in-flight `File` body and
 * after the Solid client has minted a DPoP proof for each one. Bounding at the
 * application layer keeps the queue observable, keeps memory proportional to
 * the pool size rather than the batch size, and gives us one knob to tune per
 * deployment and to vary in performance experiments.
 *
 * A mutex is the degenerate case of the same structure, so
 * {@link createMutex} is `createTransferPool(1)` rather than a second
 * implementation.
 *
 * @packageDocumentation
 */

/**
 * Bounded-concurrency task runner.
 *
 * @public
 */
export interface TransferPool {
  /**
   * Runs `task` as soon as a slot is free, and resolves or rejects with its
   * result. Rejections propagate to the caller unchanged and always free the
   * slot.
   */
  run<T>(task: () => Promise<T>): Promise<T>;
  /** Maximum number of tasks that may run at once. */
  readonly size: number;
  /** Tasks currently running. */
  readonly active: number;
  /** Tasks admitted but still waiting for a slot. */
  readonly pending: number;
}

/**
 * Creates a pool that runs at most `size` tasks concurrently.
 *
 * @param size - Maximum concurrency. Must be a positive integer; anything
 * smaller is clamped to 1, because a pool of size 0 would deadlock rather than
 * fail loudly.
 *
 * @public
 */
export function createTransferPool(size: number): TransferPool {
  const limit = Number.isFinite(size) ? Math.max(1, Math.floor(size)) : 1;

  let active = 0;
  const waiting: Array<() => void> = [];

  const release = (): void => {
    active--;
    // Hand the freed slot to the next waiter. Shifting keeps the pool FIFO, so
    // a large batch cannot starve a task queued behind it.
    const next = waiting.shift();
    if (next) next();
  };

  const acquire = (): Promise<void> => {
    if (active < limit) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      waiting.push(() => {
        active++;
        resolve();
      });
    });
  };

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
    get size() {
      return limit;
    },
    get active() {
      return active;
    },
    get pending() {
      return waiting.length;
    },
  };
}

/**
 * A pool of size one: runs tasks strictly one at a time, in the order they
 * were submitted.
 *
 * @remarks
 * Used to serialise writes to a resource that several concurrent transfers
 * share — see the catalog critical section in `useUploadQueue`.
 *
 * @public
 */
export function createMutex(): TransferPool {
  return createTransferPool(1);
}
