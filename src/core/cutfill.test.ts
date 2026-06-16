import { describe, it, expect } from 'vitest';
import { ElevationGrid } from './grid';
import {
  HorizontalDesignSurface,
  SlopedDesignSurface,
  calculateCutFill
} from './cutfill';

describe('CutFill Calculation', () => {
  describe('Horizontal Design Surface', () => {
    it('should compute zero cut and fill when ground matches design exactly', () => {
      const grid = new ElevationGrid(5, 5, 2, 10);
      const design = new HorizontalDesignSurface(10);
      const result = calculateCutFill(grid, design);

      expect(result.cutVolume).toBeCloseTo(0);
      expect(result.fillVolume).toBeCloseTo(0);
    });

    it('should compute correct all-cut volume for flat terrain below design', () => {
      const grid = new ElevationGrid(3, 3, 2, 10);
      const design = new HorizontalDesignSurface(5);
      const result = calculateCutFill(grid, design);

      const expectedVolume = (10 - 5) * 4 * 4;
      expect(result.cutVolume).toBeCloseTo(expectedVolume);
      expect(result.fillVolume).toBeCloseTo(0);
    });

    it('should compute correct all-fill volume for flat terrain above design', () => {
      const grid = new ElevationGrid(3, 3, 2, 5);
      const design = new HorizontalDesignSurface(10);
      const result = calculateCutFill(grid, design);

      const expectedVolume = (10 - 5) * 4 * 4;
      expect(result.fillVolume).toBeCloseTo(expectedVolume);
      expect(result.cutVolume).toBeCloseTo(0);
    });

    it('should correctly separate cut and fill when design cuts through terrain', () => {
      const grid = new ElevationGrid(2, 2, 2);
      grid.setHeight(0, 0, 8);
      grid.setHeight(1, 0, 8);
      grid.setHeight(0, 1, 8);
      grid.setHeight(1, 1, 8);

      const design = new HorizontalDesignSurface(5);
      const result = calculateCutFill(grid, design);

      const expectedCut = (8 - 5) * 2 * 2;
      expect(result.cutVolume).toBeCloseTo(expectedCut);
      expect(result.fillVolume).toBeCloseTo(0);
    });

    it('should handle sloped ground with horizontal design correctly', () => {
      const grid = new ElevationGrid(3, 3, 2);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          grid.setHeight(col, row, col * 2);
        }
      }

      const design = new HorizontalDesignSurface(2);
      const result = calculateCutFill(grid, design);

      expect(result.cutVolume).toBeGreaterThan(0);
      expect(result.fillVolume).toBeGreaterThan(0);
      expect(result.area).toBeCloseTo(16);
    });

    it('should correctly handle partial cell cut/fill with known values', () => {
      const grid = new ElevationGrid(2, 2, 2);
      grid.setHeight(0, 0, 8);
      grid.setHeight(1, 0, 8);
      grid.setHeight(0, 1, 0);
      grid.setHeight(1, 1, 0);

      const design = new HorizontalDesignSurface(5);
      const result = calculateCutFill(grid, design);

      expect(result.cutVolume).toBeGreaterThan(0);
      expect(result.fillVolume).toBeGreaterThan(0);

      const signedVol = result.cutVolume - result.fillVolume;
      const expectedSigned = (8 + 8 + 0 + 0) / 4 * 4 - 5 * 4;
      expect(signedVol).toBeCloseTo(expectedSigned, 1);
    });
  });

  describe('Sloped Design Surface', () => {
    it('should compute zero cut/fill when ground matches sloped design', () => {
      const grid = new ElevationGrid(5, 5, 1);
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          grid.setHeight(col, row, col * 0.1 + row * 0.05 + 5);
        }
      }

      const design = new SlopedDesignSurface(0, 0, 5, 10, 5);
      const result = calculateCutFill(grid, design);

      expect(result.cutVolume).toBeCloseTo(0, 5);
      expect(result.fillVolume).toBeCloseTo(0, 5);
    });

    it('should produce consistent results for sloped design', () => {
      const grid = new ElevationGrid(10, 10, 2, 10);
      const design = new SlopedDesignSurface(10, 10, 10, 5, 3);

      const r1 = calculateCutFill(grid, design);
      const r2 = calculateCutFill(grid, design);

      expect(r1.cutVolume).toBe(r2.cutVolume);
      expect(r1.fillVolume).toBe(r2.fillVolume);
    });
  });

  describe('Mask support', () => {
    it('should compute zero when mask is all false', () => {
      const grid = new ElevationGrid(5, 5, 2, 10);
      const design = new HorizontalDesignSurface(5);
      const mask = new Array(25).fill(false);
      const result = calculateCutFill(grid, design, mask);

      expect(result.cutVolume).toBe(0);
      expect(result.fillVolume).toBe(0);
      expect(result.area).toBeCloseTo(0);
    });

    it('should match full result when mask is all true', () => {
      const grid = new ElevationGrid(5, 5, 2, 10);
      const design = new HorizontalDesignSurface(5);
      const mask = new Array(25).fill(true);

      const r1 = calculateCutFill(grid, design);
      const r2 = calculateCutFill(grid, design, mask);

      expect(r1.cutVolume).toBeCloseTo(r2.cutVolume);
      expect(r1.fillVolume).toBeCloseTo(r2.fillVolume);
    });
  });

  describe('Determinism', () => {
    it('should produce identical results on repeated calls', () => {
      const grid = new ElevationGrid(20, 20, 2, 15);
      const design = new HorizontalDesignSurface(10);

      for (let i = 0; i < 5; i++) {
        const r1 = calculateCutFill(grid, design);
        const r2 = calculateCutFill(grid, design);
        expect(r1.cutVolume).toBe(r2.cutVolume);
        expect(r1.fillVolume).toBe(r2.fillVolume);
      }
    });
  });

  describe('Triangular prism method verification', () => {
    it('should satisfy cut - fill = signed volume for any design level', () => {
      const grid = new ElevationGrid(4, 4, 2);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          grid.setHeight(col, row, Math.sin(col * 0.5) * 3 + Math.cos(row * 0.5) * 2 + 10);
        }
      }

      for (let elev = 5; elev <= 15; elev += 1) {
        const design = new HorizontalDesignSurface(elev);
        const result = calculateCutFill(grid, design);

        const signedVol = computeSignedVolume(grid, design);
        const diff = result.cutVolume - result.fillVolume;

        expect(diff).toBeCloseTo(signedVol, 5);
      }
    });
  });
});

function computeSignedVolume(grid: ElevationGrid, design: { getElevation(x: number, y: number): number }): number {
  const { cols, rows, cellSize } = grid;
  let volume = 0;
  const triArea = (cellSize * cellSize) / 2;

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const x0 = col * cellSize;
      const y0 = row * cellSize;
      const x1 = (col + 1) * cellSize;
      const y1 = (row + 1) * cellSize;

      const h00 = grid.getHeight(col, row) - design.getElevation(x0, y0);
      const h10 = grid.getHeight(col + 1, row) - design.getElevation(x1, y0);
      const h01 = grid.getHeight(col, row + 1) - design.getElevation(x0, y1);
      const h11 = grid.getHeight(col + 1, row + 1) - design.getElevation(x1, y1);

      volume += (h00 + h10 + h11) / 3 * triArea;
      volume += (h00 + h11 + h01) / 3 * triArea;
    }
  }

  return volume;
}
