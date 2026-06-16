import { ElevationGrid } from './grid';

export interface ContourSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  elevation: number;
}

export interface ContourLine {
  points: { x: number; y: number }[];
  elevation: number;
}

function interpolate(
  x1: number, y1: number, v1: number,
  x2: number, y2: number, v2: number,
  level: number
): { x: number; y: number } {
  if (v1 === v2) {
    return { x: x1, y: y1 };
  }
  const t = (level - v1) / (v2 - v1);
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

const EDGE_TABLE = [
  [],
  [[0, 3]],
  [[0, 1]],
  [[1, 3]],
  [[1, 2]],
  [[0, 1], [2, 3]],
  [[0, 2]],
  [[2, 3]],
  [[2, 3]],
  [[0, 2]],
  [[0, 3], [1, 2]],
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [[0, 3]],
  []
];

export function extractContourSegments(
  grid: ElevationGrid,
  levels: number[]
): ContourSegment[] {
  const { cols, rows, cellSize } = grid;
  const segments: ContourSegment[] = [];

  for (const level of levels) {
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const h00 = grid.getHeight(col, row);
        const h10 = grid.getHeight(col + 1, row);
        const h11 = grid.getHeight(col + 1, row + 1);
        const h01 = grid.getHeight(col, row + 1);

        let index = 0;
        if (h00 >= level) index |= 1;
        if (h10 >= level) index |= 2;
        if (h11 >= level) index |= 4;
        if (h01 >= level) index |= 8;

        if (index === 0 || index === 15) continue;

        const x0 = col * cellSize;
        const y0 = row * cellSize;
        const x1 = (col + 1) * cellSize;
        const y1 = (row + 1) * cellSize;

        const edges = EDGE_TABLE[index];

        for (const edge of edges) {
          const pts: { x: number; y: number }[] = [];
          for (const e of edge) {
            switch (e) {
              case 0:
                pts.push(interpolate(x0, y0, h00, x1, y0, h10, level));
                break;
              case 1:
                pts.push(interpolate(x1, y0, h10, x1, y1, h11, level));
                break;
              case 2:
                pts.push(interpolate(x1, y1, h11, x0, y1, h01, level));
                break;
              case 3:
                pts.push(interpolate(x0, y1, h01, x0, y0, h00, level));
                break;
            }
          }
          if (pts.length === 2) {
            segments.push({
              x1: pts[0].x,
              y1: pts[0].y,
              x2: pts[1].x,
              y2: pts[1].y,
              elevation: level
            });
          }
        }
      }
    }
  }

  return segments;
}

export function extractContours(
  grid: ElevationGrid,
  levels: number[]
): ContourLine[] {
  const segments = extractContourSegments(grid, levels);
  const byLevel = new Map<number, ContourSegment[]>();

  for (const seg of segments) {
    if (!byLevel.has(seg.elevation)) {
      byLevel.set(seg.elevation, []);
    }
    byLevel.get(seg.elevation)!.push(seg);
  }

  const contours: ContourLine[] = [];

  for (const [elev, segs] of byLevel) {
    const lines = connectSegmentsSimple(segs);
    for (const points of lines) {
      contours.push({ points, elevation: elev });
    }
  }

  return contours;
}

function connectSegmentsSimple(
  segments: ContourSegment[]
): { x: number; y: number }[][] {
  if (segments.length === 0) return [];

  const tolerance = 1e-4;
  const used = new Set<number>();
  const polylines: { x: number; y: number }[][] = [];

  function pointsEqual(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): boolean {
    return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
  }

  while (used.size < segments.length) {
    let startIdx = -1;
    for (let i = 0; i < segments.length; i++) {
      if (!used.has(i)) {
        startIdx = i;
        break;
      }
    }
    if (startIdx === -1) break;

    used.add(startIdx);
    const seg = segments[startIdx];
    const poly = [
      { x: seg.x1, y: seg.y1 },
      { x: seg.x2, y: seg.y2 }
    ];

    let extended = true;
    let iterations = 0;
    while (extended && iterations < 1000) {
      extended = false;
      iterations++;
      const last = poly[poly.length - 1];

      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        const s = segments[i];

        if (pointsEqual({ x: s.x1, y: s.y1 }, last)) {
          poly.push({ x: s.x2, y: s.y2 });
          used.add(i);
          extended = true;
          break;
        } else if (pointsEqual({ x: s.x2, y: s.y2 }, last)) {
          poly.push({ x: s.x1, y: s.y1 });
          used.add(i);
          extended = true;
          break;
        }
      }
    }

    extended = true;
    iterations = 0;
    while (extended && iterations < 1000) {
      extended = false;
      iterations++;
      const first = poly[0];

      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        const s = segments[i];

        if (pointsEqual({ x: s.x1, y: s.y1 }, first)) {
          poly.unshift({ x: s.x2, y: s.y2 });
          used.add(i);
          extended = true;
          break;
        } else if (pointsEqual({ x: s.x2, y: s.y2 }, first)) {
          poly.unshift({ x: s.x1, y: s.y1 });
          used.add(i);
          extended = true;
          break;
        }
      }
    }

    polylines.push(poly);
  }

  return polylines;
}

export function generateContourLevels(
  grid: ElevationGrid,
  interval: number
): number[] {
  const minH = grid.getMinHeight();
  const maxH = grid.getMaxHeight();

  const start = Math.ceil(minH / interval) * interval;
  const levels: number[] = [];

  for (let h = start; h <= maxH; h += interval) {
    levels.push(h);
  }

  return levels;
}
