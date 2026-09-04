/**
 * @packageDocumentation
 * Tests the statistical calculations used by the benchmark, 
 * including count, minimum, maximum, mean, standard deviation, and percentiles.
 * 
 * Also covers empty, single-value, and unsorted inputs.
 */

import { describe, it, expect } from "vitest";
import { stats } from "./stats";

const ONE_TO_TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("stats", () => {
  it("computes count, min, max and mean", () => {
    const summary = stats(ONE_TO_TEN);
    expect(summary.count).toBe(10);
    expect(summary.min).toBe(1);
    expect(summary.max).toBe(10);
    expect(summary.mean).toBeCloseTo(5.5, 10);
  });

  it("computes the sample standard deviation (Bessel-corrected)", () => {
    const summary = stats(ONE_TO_TEN);
    expect(summary.stddev).toBeCloseTo(3.02765, 4);
  });

  it("computes nearest-rank percentiles", () => {
    const summary = stats(ONE_TO_TEN);
    expect(summary.p50).toBe(5);
    expect(summary.p95).toBe(10);
    expect(summary.p99).toBe(10);
  });

  it("sorts unsorted input before summarising", () => {
    const summary = stats([3, 1, 2]);
    expect(summary.min).toBe(1);
    expect(summary.max).toBe(3);
    expect(summary.p50).toBe(2);
  });

  it("handles a single sample without dividing by zero", () => {
    const summary = stats([42]);
    expect(summary.mean).toBe(42);
    expect(summary.stddev).toBe(0);
    expect(summary.p50).toBe(42);
    expect(summary.p99).toBe(42);
  });

  it("throws on empty input instead of returning NaN", () => {
    expect(() => stats([])).toThrow();
  });
});
