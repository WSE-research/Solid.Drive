/**
 * @packageDocumentation
 * Calculates summary statistics for benchmark latency measurements.
 */

/**
 * A latency distribution's summary, 
 * in the same unit as the input samples.
 *
 * @public
 */
export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  stddev: number;   // Bessel-corrected sample standard deviation
  p50: number;      // median
  p95: number;      // 95th percentile
  p99: number;      // 99th percentile
}

// Calculates the nearest-rank percentile for a sorted set of values.
function percentile(sortedAscending: number[], p: number): number {
  const rank = Math.ceil((p / 100) * sortedAscending.length);
  const index = Math.min(Math.max(rank, 1), sortedAscending.length) - 1;
  return sortedAscending[index];
}

/**
 * Calculates summary statistics for a set of latency measurements.
 *
 * @param samples - Latency measurements in a common unit.
 * @returns The calculated summary statistics.
 * @throws Error if no samples are provided.
 */
export function stats(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    throw new Error("stats() requires at least one sample");
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const count = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / count;
  const variance = count > 1
    ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1)
    : 0;

  return {
    count,
    min: sorted[0],
    max: sorted[count - 1],
    mean,
    stddev: Math.sqrt(variance),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}
