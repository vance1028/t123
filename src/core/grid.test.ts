import { describe, it, expect } from 'vitest';
import { ElevationGrid, generateProceduralTerrain } from './grid';

describe('ElevationGrid', () => {
  it('should create grid with correct dimensions', () => {
    const grid = new ElevationGrid(10, 8, 2);
    expect(grid.cols).toBe(10);
    expect(grid.rows).toBe(8);
    expect(grid.cellSize).toBe(2);
    expect(grid.heights.length).toBe(80);
  });

  it('should set and get height correctly', () => {
    const grid = new ElevationGrid(5, 5, 1);
    grid.setHeight(2, 3, 10.5);
    expect(grid.getHeight(2, 3)).toBe(10.5);
    expect(grid.getIndex(2, 3)).toBe(17);
  });

  it('should return correct bounds', () => {
    const grid = new ElevationGrid(11, 6, 2);
    expect(grid.getWidth()).toBe(20);
    expect(grid.getHeightTotal()).toBe(10);
  });

  it('should compute min and max height', () => {
    const grid = new ElevationGrid(3, 3, 1);
    grid.setHeight(0, 0, 1);
    grid.setHeight(1, 1, 5);
    grid.setHeight(2, 2, 3);
    expect(grid.getMinHeight()).toBe(0);
    expect(grid.getMaxHeight()).toBe(5);
  });

  it('should interpolate height at point', () => {
    const grid = new ElevationGrid(3, 3, 1);
    grid.setHeight(0, 0, 0);
    grid.setHeight(1, 0, 2);
    grid.setHeight(0, 1, 4);
    grid.setHeight(1, 1, 6);

    expect(grid.getHeightAt(0, 0)).toBeCloseTo(0);
    expect(grid.getHeightAt(1, 0)).toBeCloseTo(2);
    expect(grid.getHeightAt(0.5, 0.5)).toBeCloseTo(3);
  });

  it('should clone grid correctly', () => {
    const grid = new ElevationGrid(3, 3, 1, 5);
    const clone = grid.clone();
    clone.setHeight(1, 1, 10);
    expect(grid.getHeight(1, 1)).toBe(5);
    expect(clone.getHeight(1, 1)).toBe(10);
  });

  it('should generate procedural terrain', () => {
    const grid = generateProceduralTerrain(20, 20, 2, 15, 42);
    expect(grid.cols).toBe(20);
    expect(grid.rows).toBe(20);
    expect(grid.getMinHeight()).toBeLessThan(grid.getMaxHeight());
  });

  it('should produce same result with same seed', () => {
    const g1 = generateProceduralTerrain(10, 10, 1, 10, 123);
    const g2 = generateProceduralTerrain(10, 10, 1, 10, 123);
    for (let i = 0; i < g1.heights.length; i++) {
      expect(g1.heights[i]).toBe(g2.heights[i]);
    }
  });
});
