import { describe, it, expect } from "vitest";
import { createMutex, createTransferPool } from "../transferPool-file/transferPool";

/** A promise plus its resolvers, so tests can control when a task finishes. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets every already-queued microtask run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createTransferPool", () => {
  it("runs up to `size` tasks at once and queues the rest", async () => {
    const pool = createTransferPool(2);
    const gates = [deferred(), deferred(), deferred(), deferred()];
    let started = 0;

    const runs = gates.map((gate) =>
      pool.run(async () => {
        started++;
        await gate.promise;
      }),
    );

    await flush();
    expect(started).toBe(2);
    expect(pool.active).toBe(2);
    expect(pool.pending).toBe(2);

    gates[0].resolve();
    await flush();
    expect(started).toBe(3);

    gates.forEach((gate) => gate.resolve());
    await Promise.all(runs);
    expect(pool.active).toBe(0);
    expect(pool.pending).toBe(0);
  });

  it("never exceeds the limit across a large batch", async () => {
    const pool = createTransferPool(4);
    let active = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 50 }, () =>
        pool.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await flush();
          active--;
        }),
      ),
    );

    expect(peak).toBe(4);
    expect(active).toBe(0);
  });

  it("frees the slot when a task rejects, and propagates the rejection", async () => {
    // The whole point of the pool is that one failed transfer cannot wedge the
    // queue, so this is the behaviour most worth pinning down.
    const pool = createTransferPool(1);
    const boom = new Error("transfer failed");

    await expect(pool.run(() => Promise.reject(boom))).rejects.toBe(boom);
    expect(pool.active).toBe(0);

    await expect(pool.run(() => Promise.resolve("next"))).resolves.toBe("next");
  });

  it("hands freed slots out first-come-first-served", async () => {
    const pool = createTransferPool(1);
    const order: number[] = [];

    const runs = [1, 2, 3].map((id) =>
      pool.run(async () => {
        order.push(id);
        await flush();
      }),
    );

    await Promise.all(runs);
    expect(order).toEqual([1, 2, 3]);
  });

  it("clamps a non-positive or non-finite size to 1 rather than deadlocking", async () => {
    for (const size of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const pool = createTransferPool(size);
      expect(pool.size).toBeGreaterThanOrEqual(1);
      await expect(pool.run(() => Promise.resolve(size))).resolves.toBe(size);
    }
  });

  it("truncates a fractional size", () => {
    expect(createTransferPool(3.9).size).toBe(3);
  });
});

describe("createMutex", () => {
  it("serialises overlapping critical sections", async () => {
    const mutex = createMutex();
    const events: string[] = [];

    const section = (id: string) =>
      mutex.run(async () => {
        events.push(`enter:${id}`);
        await flush();
        events.push(`exit:${id}`);
      });

    await Promise.all([section("a"), section("b"), section("c")]);

    // No enter may appear between another section's enter and its exit.
    expect(events).toEqual([
      "enter:a",
      "exit:a",
      "enter:b",
      "exit:b",
      "enter:c",
      "exit:c",
    ]);
  });

  it("keeps serialising after a section throws", async () => {
    const mutex = createMutex();
    const events: string[] = [];

    const failing = mutex.run(async () => {
      events.push("enter:bad");
      throw new Error("nope");
    });
    const following = mutex.run(async () => {
      events.push("enter:good");
    });

    await expect(failing).rejects.toThrow("nope");
    await following;
    expect(events).toEqual(["enter:bad", "enter:good"]);
  });
});
