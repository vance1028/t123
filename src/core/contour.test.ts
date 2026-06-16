import { describe, it, expect } from 'vitest';
import { ElevationGrid } from './grid';
import { extractContours, extractContourSegments, generateContourLevels } from './contour';

describe('Contour Extraction', () => {
  it('should extract contours from sloped terrain', () => {
    const grid = new ElevationGrid(10, 10, 1);
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        grid.setHeight(col, row, col * 2 + row);
      }
    }

    const levels = [5, 10, 15];
    const contours = extractContours(grid, levels);

    expect(contours.length).toBeGreaterThan(0);

    for (const contour of contours) {
      expect(contour.points.length).toBeGreaterThan(1);
      expect(levels).toContain(contour.elevation);
    }
  });

  it('should generate appropriate contour levels', () => {
    const grid = new ElevationGrid(5, 5, 1);
    for (let i = 0; i < 25; i++) {
      grid.heights[i] = i * 2;
    }

    const levels = generateContourLevels(grid, 5);
    expect(levels.length).toBeGreaterThan(0);

    for (const l of levels) {
      expect(l).toBeGreaterThanOrEqual(grid.getMinHeight());
      expect(l).toBeLessThanOrEqual(grid.getMaxHeight());
    }
  });

  it('should produce correct contour segment positions for simple slope', () => {
    const grid = new ElevationGrid(10, 10, 1);
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        grid.setHeight(col, row, col);
      }
    }

    const levels = [3.5, 5.5, 7.5];
    const segments = extractContourSegments(grid, levels);

    expect(segments.length).toBeGreaterThan(0);

    let maxError = 0;
    for (const seg of segments) {
      const h1 = grid.getHeightAt(seg.x1, seg.y1);
      const h2 = grid.getHeightAt(seg.x2, seg.y2);
      const err1 = Math.abs(h1 - seg.elevation);
      const err2 = Math.abs(h2 - seg.elevation);
      if (err1 > maxError) maxError = err1;
      if (err2 > maxError) maxError = err2;
    }

    expect(maxError).toBeLessThan(0.01);
  });

  it('should produce consistent results', () => {
    const grid = new ElevationGrid(10, 10, 1);
    for (let i = 0; i < 100; i++) {
      grid.heights[i] = Math.sin(i * 0.3) * 5 + Math.cos(i * 0.5) * 3 + 10;
    }

    const levels = generateContourLevels(grid, 2);

    const c1 = extractContours(grid, levels);
    const c2 = extractContours(grid, levels);

    expect(c1.length).toBe(c2.length);
  });

  it('should return empty for level outside terrain range', () => {
    const grid = new ElevationGrid(5, 5, 1, 10);
    const contours = extractContours(grid, [100]);
    expect(contours.length).toBe(0);
  });
});
