/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling.
 * Keeps the visual shape (peaks/troughs) of a large series while reducing the
 * number of SVG points rendered into the DOM — 5,760 intervals -> ~300 points.
 */
export function lttb<T>(
  data: T[],
  threshold: number,
  x: (d: T) => number,
  y: (d: T) => number,
): T[] {
  const n = data.length;
  if (threshold >= n || threshold < 3) return data;

  const sampled: T[] = [data[0]];
  const every = (n - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * every) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * every) + 1, n);

    // average of the next bucket
    let avgX = 0;
    let avgY = 0;
    const count = Math.max(1, rangeEnd - rangeStart);
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgX += x(data[j]);
      avgY += y(data[j]);
    }
    avgX /= count;
    avgY /= count;

    const bucketStart = Math.floor(i * every) + 1;
    const bucketEnd = Math.floor((i + 1) * every) + 1;
    const ax = x(data[a]);
    const ay = y(data[a]);

    let maxArea = -1;
    let next = bucketStart;
    for (let j = bucketStart; j < Math.min(bucketEnd, n); j++) {
      const area = Math.abs((ax - avgX) * (y(data[j]) - ay) - (ax - x(data[j])) * (avgY - ay)) / 2;
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    sampled.push(data[next]);
    a = next;
  }

  sampled.push(data[n - 1]);
  return sampled;
}
