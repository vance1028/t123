import { describe, it, expect } from 'vitest';
import { pointInPolygon, createGridMask, createFullMask } from './polygon';

describe('Polygon Utilities', () => {
  describe('pointInPolygon', () => {
    it('should return true for point inside square', () => {
      const polygon = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      expect(pointInPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
    });

    it('should return false for point outside square', () => {
      const polygon = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];
      expect(pointInPolygon({ x: 15, y: 5 }, polygon)).toBe(false);
    });

    it('should handle triangular polygon', () => {
      const polygon = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 }
      ];
      expect(pointInPolygon({ x: 5, y: 2 }, polygon)).toBe(true);
      expect(pointInPolygon({ x: 5, y: 12 }, polygon)).toBe(false);
    });
  });

  describe('createGridMask', () => {
    it('should create mask for rectangular polygon', () => {
      const polygon = [
        { x: 2, y: 2 },
        { x: 7, y: 2 },
        { x: 7, y: 7 },
        { x: 2, y: 7 }
      ];
      const mask = createGridMask(10, 10, 1, polygon);

      expect(mask.length).toBe(100);
      expect(mask[0]).toBe(false);
      expect(mask[5 * 10 + 5]).toBe(true);
    });

    it('should create all-true full mask', () => {
      const mask = createFullMask(5, 5);
      expect(mask.length).toBe(25);
      expect(mask.every(v => v === true)).toBe(true);
    });
  });
});
