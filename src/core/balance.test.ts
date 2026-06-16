import { describe, it, expect } from 'vitest';
import { ElevationGrid } from './grid';
import { HorizontalDesignSurface, calculateCutFill } from './cutfill';
import {
  findOptimalHorizontalElevation,
  findOptimalSlopedSurface,
  computeBalanceCurve
} from './balance';

describe('Balance Optimization', () => {
  describe('Horizontal Optimal Elevation', () => {
    it('should find elevation where cut ~ fill for symmetric terrain', () => {
      const grid = new ElevationGrid(11, 11, 2);
      const cx = 10, cy = 10;

      for (let row = 0; row < 11; row++) {
        for (let col = 0; col < 11; col++) {
          const x = col * 2;
          const y = row * 2;
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          grid.setHeight(col, row, 10 + dist * 0.3);
        }
      }

      const result = findOptimalHorizontalElevation(grid);

      expect(Math.abs(result.diff)).toBeLessThan(1);

      const lowDesign = new HorizontalDesignSurface(result.elevation - 5);
      const lowResult = calculateCutFill(grid, lowDesign);
      expect(lowResult.cutVolume).toBeGreaterThan(lowResult.fillVolume);

      const highDesign = new HorizontalDesignSurface(result.elevation + 5);
      const highResult = calculateCutFill(grid, highDesign);
      expect(highResult.fillVolume).toBeGreaterThan(highResult.cutVolume);
    });

    it('should return elevation within terrain range', () => {
      const grid = new ElevationGrid(10, 10, 1);
      for (let i = 0; i < 100; i++) {
        grid.heights[i] = 5 + Math.sin(i * 0.3) * 3 + Math.cos(i * 0.5) * 2;
      }

      const result = findOptimalHorizontalElevation(grid);

      expect(result.elevation).toBeGreaterThan(grid.getMinHeight() - 1);
      expect(result.elevation).toBeLessThan(grid.getMaxHeight() + 1);
    });

    it('should produce consistent results', () => {
      const grid = new ElevationGrid(15, 15, 2);
      for (let i = 0; i < grid.heights.length; i++) {
        grid.heights[i] = 10 + (i % 7) * 1.5;
      }

      const r1 = findOptimalHorizontalElevation(grid);
      const r2 = findOptimalHorizontalElevation(grid);

      expect(r1.elevation).toBe(r2.elevation);
      expect(r1.cutVolume).toBe(r2.cutVolume);
      expect(r1.fillVolume).toBe(r2.fillVolume);
    });

    it('should work with mask', () => {
      const grid = new ElevationGrid(10, 10, 1, 10);
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          grid.setHeight(col, row, col + row);
        }
      }

      const mask = new Array(100).fill(false);
      for (let row = 2; row < 8; row++) {
        for (let col = 2; col < 8; col++) {
          mask[row * 10 + col] = true;
        }
      }

      const result = findOptimalHorizontalElevation(grid, mask);
      expect(result.cutVolume).toBeGreaterThan(0);
      expect(result.fillVolume).toBeGreaterThan(0);
      expect(Math.abs(result.diff)).toBeLessThan(2);
    });
  });

  describe('Sloped Optimal Surface', () => {
    it('should find sloped surface with better balance than horizontal', () => {
      const grid = new ElevationGrid(21, 21, 1);
      for (let row = 0; row < 21; row++) {
        for (let col = 0; col < 21; col++) {
          const x = col - 10;
          const y = row - 10;
          grid.setHeight(col, row, 10 + x * 0.5 + y * 0.3 + Math.sin(x * 0.5) * 0.5);
        }
      }

      const hResult = findOptimalHorizontalElevation(grid);
      const sResult = findOptimalSlopedSurface(grid);

      expect(Math.abs(sResult.diff)).toBeLessThanOrEqual(Math.abs(hResult.diff) + 1);
    });

    it('should produce deterministic results', () => {
      const grid = new ElevationGrid(10, 10, 2);
      for (let i = 0; i < grid.heights.length; i++) {
        grid.heights[i] = 8 + (i * 7) % 10;
      }

      const r1 = findOptimalSlopedSurface(grid);
      const r2 = findOptimalSlopedSurface(grid);

      expect(r1.centerElev).toBeCloseTo(r2.centerElev, 5);
      expect(r1.slopeX).toBeCloseTo(r2.slopeX, 5);
      expect(r1.slopeY).toBeCloseTo(r2.slopeY, 5);
    });
  });

  describe('Balance Curve', () => {
    it('should return correct number of points', () => {
      const grid = new ElevationGrid(10, 10, 2, 10);
      const curve = computeBalanceCurve(grid, 20);

      expect(curve.elevations.length).toBe(21);
      expect(curve.diffs.length).toBe(21);
      expect(curve.cuts.length).toBe(21);
      expect(curve.fills.length).toBe(21);
    });

    it('should have monotonic decreasing diff with increasing elevation', () => {
      const grid = new ElevationGrid(10, 10, 1);
      for (let i = 0; i < 100; i++) {
        grid.heights[i] = 5 + Math.random() * 10;
      }

      const curve = computeBalanceCurve(grid, 30);

      for (let i = 1; i < curve.diffs.length; i++) {
        expect(curve.diffs[i]).toBeLessThan(curve.diffs[i - 1] + 0.001);
      }
    });

    it('should cross zero near optimal elevation', () => {
      const grid = new ElevationGrid(15, 15, 1);
      for (let i = 0; i < grid.heights.length; i++) {
        grid.heights[i] = 8 + (i * 3.7) % 8;
      }

      const optimal = findOptimalHorizontalElevation(grid);
      const curve = computeBalanceCurve(grid, 50);

      let crossIdx = -1;
      for (let i = 1; i < curve.diffs.length; i++) {
        if (curve.diffs[i - 1] > 0 && curve.diffs[i] <= 0) {
          crossIdx = i;
          break;
        }
      }

      expect(crossIdx).toBeGreaterThan(-1);
      expect(curve.elevations[crossIdx]).toBeCloseTo(optimal.elevation, 0);
    });
  });
});
