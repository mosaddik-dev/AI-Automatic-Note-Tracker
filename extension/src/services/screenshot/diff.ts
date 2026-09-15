const SAMPLE_SIZE = 32;

async function toGrayscaleSamples(dataUrl: string): Promise<Uint8ClampedArray> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const gray = new Uint8ClampedArray(SAMPLE_SIZE * SAMPLE_SIZE);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return gray;
}

/**
 * Compares two screenshot data URLs by downscaling both to a small grayscale
 * grid and measuring the fraction of pixels whose brightness differs by more
 * than a noise threshold. Works in service workers / offscreen documents
 * (OffscreenCanvas + createImageBitmap, both available in MV3).
 *
 * @param threshold fraction (0-1) of pixels that must differ meaningfully
 *   before this returns true. Comes from `ScreenshotSettings.sensitivity`.
 */
export async function hasSignificantChange(
  prevDataUrl: string | undefined,
  nextDataUrl: string,
  threshold: number,
): Promise<boolean> {
  if (!prevDataUrl) return true;

  const [prev, next] = await Promise.all([
    toGrayscaleSamples(prevDataUrl),
    toGrayscaleSamples(nextDataUrl),
  ]);

  const NOISE_FLOOR = 18; // per-pixel brightness delta (0-255) ignored as sensor/compression noise
  let changed = 0;
  for (let i = 0; i < prev.length; i++) {
    if (Math.abs(prev[i] - next[i]) > NOISE_FLOOR) changed++;
  }

  return changed / prev.length >= threshold;
}
