import { ElevationGrid } from './grid';
import {
  DesignSurface,
  HorizontalDesignSurface,
  SlopedDesignSurface,
  calculateCutFill,
  CutFillResult
} from './cutfill';

export interface BalanceResult {
  cutVolume: number;
  fillVolume: number;
  diff: number;
  designSurface: DesignSurface;
}

export interface HorizontalBalanceResult extends BalanceResult {
  designSurface: HorizontalDesignSurface;
  elevation: number;
}

export function findOptimalHorizontalElevation(
  grid: ElevationGrid,
  mask?: boolean[] | null,
  tolerance: number = 0.001
): HorizontalBalanceResult {
  let low = grid.getMinHeight() - 10;
  let high = grid.getMaxHeight() + 10;

  function evaluate(elev: number): CutFillResult {
    const design = new HorizontalDesignSurface(elev);
    return calculateCutFill(grid, design, mask);
  }

  let mid = (low + high) / 2;
  let midResult = evaluate(mid);
  let iterations = 0;
  const maxIterations = 100;

  while (high - low > tolerance && iterations < maxIterations) {
    mid = (low + high) / 2;
    midResult = evaluate(mid);
    const diff = midResult.cutVolume - midResult.fillVolume;

    if (Math.abs(diff) < 0.01) {
      break;
    }

    if (diff > 0) {
      low = mid;
    } else {
      high = mid;
    }

    iterations++;
  }

  return {
    elevation: mid,
    cutVolume: midResult.cutVolume,
    fillVolume: midResult.fillVolume,
    diff: midResult.cutVolume - midResult.fillVolume,
    designSurface: new HorizontalDesignSurface(mid)
  };
}

export interface SlopeBalanceResult extends BalanceResult {
  designSurface: SlopedDesignSurface;
  centerElev: number;
  slopeX: number;
  slopeY: number;
}

export function findOptimalSlopedSurface(
  grid: ElevationGrid,
  mask?: boolean[] | null,
  tolerance: number = 0.001
): SlopeBalanceResult {
  const bounds = grid.getBounds();
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  let bestCenterElev = (grid.getMinHeight() + grid.getMaxHeight()) / 2;
  let bestSlopeX = 0;
  let bestSlopeY = 0;
  let bestDiff = Infinity;
  let bestCut = 0;
  let bestFill = 0;

  function evaluate(centerElev: number, sx: number, sy: number): { cut: number; fill: number; diff: number } {
    const design = new SlopedDesignSurface(centerX, centerY, centerElev, sx, sy);
    const result = calculateCutFill(grid, design, mask);
    return {
      cut: result.cutVolume,
      fill: result.fillVolume,
      diff: result.cutVolume - result.fillVolume
    };
  }

  let step = 2;
  let elevStep = 2;
  const minStep = 0.01;
  const elevMinStep = 0.001;

  const initial = evaluate(bestCenterElev, bestSlopeX, bestSlopeY);
  bestDiff = Math.abs(initial.diff);
  bestCut = initial.cut;
  bestFill = initial.fill;

  for (let iter = 0; iter < 50; iter++) {
    let improved = false;

    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue;

        const sx = bestSlopeX + di * step;
        const sy = bestSlopeY + dj * step;

        let lowElev = bestCenterElev - elevStep * 10;
        let highElev = bestCenterElev + elevStep * 10;

        for (let eIter = 0; eIter < 30; eIter++) {
          const midElev = (lowElev + highElev) / 2;
          const r = evaluate(midElev, sx, sy);
          if (r.diff > 0) {
            lowElev = midElev;
          } else {
            highElev = midElev;
          }
        }

        const finalElev = (lowElev + highElev) / 2;
        const finalResult = evaluate(finalElev, sx, sy);
        const absDiff = Math.abs(finalResult.diff);

        if (absDiff < bestDiff) {
          bestDiff = absDiff;
          bestCenterElev = finalElev;
          bestSlopeX = sx;
          bestSlopeY = sy;
          bestCut = finalResult.cut;
          bestFill = finalResult.fill;
          improved = true;
        }
      }
    }

    if (!improved) {
      step *= 0.5;
      elevStep *= 0.5;
      if (step < minStep && elevStep < elevMinStep) {
        break;
      }
    }
  }

  return {
    centerElev: bestCenterElev,
    slopeX: bestSlopeX,
    slopeY: bestSlopeY,
    cutVolume: bestCut,
    fillVolume: bestFill,
    diff: bestCut - bestFill,
    designSurface: new SlopedDesignSurface(centerX, centerY, bestCenterElev, bestSlopeX, bestSlopeY)
  };
}

export function computeBalanceCurve(
  grid: ElevationGrid,
  steps: number = 50,
  mask?: boolean[] | null
): { elevations: number[]; diffs: number[]; cuts: number[]; fills: number[] } {
  const minH = grid.getMinHeight();
  const maxH = grid.getMaxHeight();
  const range = maxH - minH;
  const start = minH - range * 0.2;
  const end = maxH + range * 0.2;

  const elevations: number[] = [];
  const diffs: number[] = [];
  const cuts: number[] = [];
  const fills: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const elev = start + (end - start) * i / steps;
    const design = new HorizontalDesignSurface(elev);
    const result = calculateCutFill(grid, design, mask);
    elevations.push(elev);
    diffs.push(result.cutVolume - result.fillVolume);
    cuts.push(result.cutVolume);
    fills.push(result.fillVolume);
  }

  return { elevations, diffs, cuts, fills };
}
