export interface Point {
  x: number;
  y: number;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

export function createGridMask(
  cols: number,
  rows: number,
  cellSize: number,
  polygon: Point[]
): boolean[] {
  const mask = new Array(cols * rows).fill(false);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize;
      const y = row * cellSize;
      mask[row * cols + col] = pointInPolygon({ x, y }, polygon);
    }
  }

  return mask;
}

export function createFullMask(cols: number, rows: number): boolean[] {
  return new Array(cols * rows).fill(true);
}
