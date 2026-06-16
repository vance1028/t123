import { ElevationGrid } from './grid';

export interface DesignSurface {
  getElevation(x: number, y: number): number;
}

export class HorizontalDesignSurface implements DesignSurface {
  constructor(public elevation: number) {}

  getElevation(_x: number, _y: number): number {
    return this.elevation;
  }
}

export class SlopedDesignSurface implements DesignSurface {
  centerX: number;
  centerY: number;
  centerElev: number;
  slopeX: number;
  slopeY: number;

  constructor(
    centerX: number,
    centerY: number,
    centerElev: number,
    slopeX: number,
    slopeY: number
  ) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.centerElev = centerElev;
    this.slopeX = slopeX;
    this.slopeY = slopeY;
  }

  getElevation(x: number, y: number): number {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    return this.centerElev + dx * this.slopeX / 100 + dy * this.slopeY / 100;
  }
}

export interface CutFillResult {
  cutVolume: number;
  fillVolume: number;
  area: number;
  diffHeights: Float64Array;
  cellCut: Float64Array;
  cellFill: Float64Array;
}

function triangleSignedVolume(
  h1: number, h2: number, h3: number, area: number
): number {
  return (h1 + h2 + h3) / 3 * area;
}

function triangleCutFillVolume(
  h1: number, h2: number, h3: number, area: number
): { cut: number; fill: number } {
  const allNonNeg = h1 >= 0 && h2 >= 0 && h3 >= 0;
  const allNonPos = h1 <= 0 && h2 <= 0 && h3 <= 0;

  if (allNonNeg) {
    return { cut: triangleSignedVolume(h1, h2, h3, area), fill: 0 };
  }
  if (allNonPos) {
    return { cut: 0, fill: -triangleSignedVolume(h1, h2, h3, area) };
  }

  const verts = [
    { h: h1, idx: 0 },
    { h: h2, idx: 1 },
    { h: h3, idx: 2 }
  ];
  verts.sort((a, b) => a.h - b.h);

  if (verts[1].h < 0 && verts[2].h >= 0) {
    const neg = [verts[0], verts[1]];
    const pos = verts[2];

    const t1 = -neg[0].h / (pos.h - neg[0].h);
    const t2 = -neg[1].h / (pos.h - neg[1].h);

    const cutArea = area * t1 * t2;
    const cutVol = pos.h / 3 * cutArea;

    const fillVol = cutVol - triangleSignedVolume(h1, h2, h3, area);

    return { cut: cutVol, fill: fillVol };
  } else {
    const neg = verts[0];
    const pos = [verts[1], verts[2]];

    const t1 = neg.h / (neg.h - pos[0].h);
    const t2 = neg.h / (neg.h - pos[1].h);

    const fillArea = area * t1 * t2;
    const fillVol = (-neg.h) / 3 * fillArea;

    const cutVol = triangleSignedVolume(h1, h2, h3, area) + fillVol;

    return { cut: cutVol, fill: fillVol };
  }
}

export function calculateCutFill(
  grid: ElevationGrid,
  design: DesignSurface,
  mask?: boolean[] | null
): CutFillResult {
  const { cols, rows, cellSize } = grid;
  const cellCount = (cols - 1) * (rows - 1);
  const diffHeights = new Float64Array(cols * rows);
  const cellCut = new Float64Array(cellCount);
  const cellFill = new Float64Array(cellCount);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = grid.getX(col);
      const y = grid.getY(row);
      const designH = design.getElevation(x, y);
      const groundH = grid.getHeight(col, row);
      diffHeights[row * cols + col] = groundH - designH;
    }
  }

  let totalCut = 0;
  let totalFill = 0;
  let totalArea = 0;

  const triArea = (cellSize * cellSize) / 2;

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const cellIdx = row * (cols - 1) + col;

      if (mask) {
        const idx00 = row * cols + col;
        const idx10 = row * cols + col + 1;
        const idx01 = (row + 1) * cols + col;
        const idx11 = (row + 1) * cols + col + 1;
        if (!mask[idx00] && !mask[idx10] && !mask[idx01] && !mask[idx11]) {
          cellCut[cellIdx] = 0;
          cellFill[cellIdx] = 0;
          continue;
        }
      }

      const h00 = diffHeights[row * cols + col];
      const h10 = diffHeights[row * cols + col + 1];
      const h01 = diffHeights[(row + 1) * cols + col];
      const h11 = diffHeights[(row + 1) * cols + col + 1];

      const t1 = triangleCutFillVolume(h00, h10, h11, triArea);
      const t2 = triangleCutFillVolume(h00, h11, h01, triArea);

      const cellCutVol = t1.cut + t2.cut;
      const cellFillVol = t1.fill + t2.fill;

      cellCut[cellIdx] = cellCutVol;
      cellFill[cellIdx] = cellFillVol;

      totalCut += cellCutVol;
      totalFill += cellFillVol;
      totalArea += cellSize * cellSize;
    }
  }

  return {
    cutVolume: totalCut,
    fillVolume: totalFill,
    area: totalArea,
    diffHeights,
    cellCut,
    cellFill
  };
}
