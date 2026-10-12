/** Coordinates of a frame displayed with centered `image-fit: contain`. */
export interface ViewportPoint {
  x: number;
  y: number;
  inside: boolean;
}

/**
 * Map logical window pixels to framebuffer pixels without stretching the scene.
 * Outside points remain unbounded so an active drag can continue across a margin.
 * Invalid or not yet laid out surfaces have no usable mapping.
 */
export function mapViewportPoint(
  frameWidth: number,
  frameHeight: number,
  areaWidth: number,
  areaHeight: number,
  x: number,
  y: number,
): ViewportPoint | null {
  if (![frameWidth, frameHeight, areaWidth, areaHeight, x, y].every(Number.isFinite)
      || frameWidth <= 0 || frameHeight <= 0 || areaWidth <= 0 || areaHeight <= 0) {
    return null;
  }

  const scale = Math.min(areaWidth / frameWidth, areaHeight / frameHeight);
  const offsetX = (areaWidth - frameWidth * scale) / 2;
  const offsetY = (areaHeight - frameHeight * scale) / 2;
  const frameX = (x - offsetX) / scale;
  const frameY = (y - offsetY) / scale;

  return {
    x: frameX,
    y: frameY,
    inside: frameX >= 0 && frameX <= frameWidth && frameY >= 0 && frameY <= frameHeight,
  };
}
