import { ElevationGrid } from './grid';
import { DesignSurface, calculateCutFill, CutFillResult } from './cutfill';

export interface SlopeEmbankmentResult {
  embankmentGrid: ElevationGrid;
  fullResult: CutFillResult;
  innerResult: CutFillResult;
  slopeCutVolume: number;
  slopeFillVolume: number;
}

function distanceToMask(
  cols: number,
  rows: number,
  cellSize: number,
  mask: boolean[]
): Float64Array {
  const dist = new Float64Array(cols * rows);
  const INF = 1e10;

  for (let i = 0; i < cols * rows; i++) {
    dist[i] = mask[i] ? 0 : INF;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (col > 0) {
        dist[idx] = Math.min(dist[idx], dist[idx - 1] + cellSize);
      }
      if (row > 0) {
        dist[idx] = Math.min(dist[idx], dist[idx - cols] + cellSize);
      }
    }
  }

  for (let row = rows - 1; row >= 0; row--) {
    for (let col = cols - 1; col >= 0; col--) {
      const idx = row * cols + col;
      if (col < cols - 1) {
        dist[idx] = Math.min(dist[idx], dist[idx + 1] + cellSize);
      }
      if (row < rows - 1) {
        dist[idx] = Math.min(dist[idx], dist[idx + cols] + cellSize);
      }
    }
  }

  return dist;
}

function dilateMask(
  cols: number,
  rows: number,
  mask: boolean[],
  distance: number,
  cellSize: number
): boolean[] {
  const result = new Array(cols * rows).fill(false);
  const dist = distanceToMask(cols, rows, cellSize, mask);

  for (let i = 0; i < cols * rows; i++) {
    result[i] = dist[i] <= distance + cellSize * 0.01;
  }

  return result;
}

export function computeSlopeEmbankment(
  grid: ElevationGrid,
  design: DesignSurface,
  innerMask: boolean[],
  slopeRatio: number
): SlopeEmbankmentResult {
  const { cols, rows, cellSize } = grid;

  let maxSlopeDist = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (innerMask[idx]) {
        const x = grid.getX(col);
        const y = grid.getY(row);
        const designH = design.getElevation(x, y);
        const groundH = grid.getHeight(col, row);
        const diff = Math.abs(groundH - designH);
        const dist = diff * slopeRatio;
        if (dist > maxSlopeDist) maxSlopeDist = dist;
      }
    }
  }

  maxSlopeDist = Math.max(maxSlopeDist, cellSize * 3);

  const outerMask = dilateMask(cols, rows, innerMask, maxSlopeDist, cellSize);
  const distToInner = distanceToMask(cols, rows, cellSize, innerMask);

  const slopeGrid = grid.clone();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (outerMask[idx] && !innerMask[idx]) {
        const x = grid.getX(col);
        const y = grid.getY(row);
        const designH = design.getElevation(x, y);
        const groundH = grid.getHeight(col, row);
        const d = distToInner[idx];

        if (d > 0) {
          const slopeH = Math.abs(groundH - designH);
          const requiredDist = slopeH * slopeRatio;

          if (d <= requiredDist) {
            const t = d / requiredDist;
            const slopeElev = designH + (groundH - designH) * t;
            slopeGrid.setHeight(col, row, slopeElev);
          }
        }
      } else if (innerMask[idx]) {
        const x = grid.getX(col);
        const y = grid.getY(row);
        slopeGrid.setHeight(col, row, design.getElevation(x, y));
      }
    }
  }

  const innerResult = calculateCutFill(grid, design, innerMask);
  const fullResult = calculateCutFill(grid, design, outerMask);

  let slopeCut = 0;
  let slopeFill = 0;

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const cellIdx = row * (cols - 1) + col;
      const idx00 = row * cols + col;

      const onEdge = outerMask[idx00] && !innerMask[idx00];

      if (onEdge) {
        const x = grid.getX(col) + cellSize / 2;
        const y = grid.getY(row) + cellSize / 2;
        const designH = design.getElevation(x, y);
        const groundH = grid.getHeightAt(x, y);
        const slopeH = slopeGrid.getHeightAt(x, y);

        const cellArea = cellSize * cellSize;

        const originalDiff = groundH - designH;
        const slopeDiff = slopeH - designH;

        if (originalDiff > 0) {
          const avgH = (originalDiff + Math.max(0, slopeDiff)) / 2;
          slopeCut += avgH * cellArea * 0.5;
        } else if (originalDiff < 0) {
          const avgH = (Math.abs(originalDiff) + Math.max(0, -slopeDiff)) / 2;
          slopeFill += avgH * cellArea * 0.5;
        }
      }
    }
  }

  return {
    embankmentGrid: slopeGrid,
    fullResult,
    innerResult,
    slopeCutVolume: slopeCut,
    slopeFillVolume: slopeFill
  };
}

export function getSlopeBandMask(
  cols: number,
  rows: number,
  innerMask: boolean[],
  outerMask: boolean[]
): boolean[] {
  const result = new Array(cols * rows).fill(false);
  for (let i = 0; i < cols * rows; i++) {
    result[i] = outerMask[i] && !innerMask[i];
  }
  return result;
}
