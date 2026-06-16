export interface GridSize {
  cols: number;
  rows: number;
}

export interface GridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class ElevationGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly heights: Float64Array;

  constructor(cols: number, rows: number, cellSize: number = 1, initialHeight: number = 0) {
    if (cols < 2 || rows < 2) {
      throw new Error('Grid must have at least 2x2 points');
    }
    if (cellSize <= 0) {
      throw new Error('Cell size must be positive');
    }
    this.cols = cols;
    this.rows = rows;
    this.cellSize = cellSize;
    this.heights = new Float64Array(cols * rows);
    if (initialHeight !== 0) {
      this.heights.fill(initialHeight);
    }
  }

  getIndex(col: number, row: number): number {
    return row * this.cols + col;
  }

  getHeight(col: number, row: number): number {
    return this.heights[this.getIndex(col, row)];
  }

  setHeight(col: number, row: number, height: number): void {
    this.heights[this.getIndex(col, row)] = height;
  }

  getX(col: number): number {
    return col * this.cellSize;
  }

  getY(row: number): number {
    return row * this.cellSize;
  }

  getBounds(): GridBounds {
    return {
      minX: 0,
      minY: 0,
      maxX: (this.cols - 1) * this.cellSize,
      maxY: (this.rows - 1) * this.cellSize
    };
  }

  getWidth(): number {
    return (this.cols - 1) * this.cellSize;
  }

  getHeightTotal(): number {
    return (this.rows - 1) * this.cellSize;
  }

  getMinHeight(): number {
    let min = Infinity;
    for (let i = 0; i < this.heights.length; i++) {
      if (this.heights[i] < min) min = this.heights[i];
    }
    return min;
  }

  getMaxHeight(): number {
    let max = -Infinity;
    for (let i = 0; i < this.heights.length; i++) {
      if (this.heights[i] > max) max = this.heights[i];
    }
    return max;
  }

  cellArea(): number {
    return this.cellSize * this.cellSize;
  }

  clone(): ElevationGrid {
    const g = new ElevationGrid(this.cols, this.rows, this.cellSize);
    g.heights.set(this.heights);
    return g;
  }

  getHeightAt(x: number, y: number): number {
    const maxCol = this.cols - 1;
    const maxRow = this.rows - 1;
    const colF = Math.max(0, Math.min(maxCol, x / this.cellSize));
    const rowF = Math.max(0, Math.min(maxRow, y / this.cellSize));
    const col0 = Math.floor(colF);
    const row0 = Math.floor(rowF);
    const col1 = Math.min(maxCol, col0 + 1);
    const row1 = Math.min(maxRow, row0 + 1);

    if (col0 < 0 || col0 >= this.cols || row0 < 0 || row0 >= this.rows) {
      return 0;
    }

    const fx = col0 === col1 ? 0 : colF - col0;
    const fy = row0 === row1 ? 0 : rowF - row0;

    const h00 = this.getHeight(col0, row0);
    const h10 = this.getHeight(col1, row0);
    const h01 = this.getHeight(col0, row1);
    const h11 = this.getHeight(col1, row1);

    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;

    return h0 * (1 - fy) + h1 * fy;
  }
}

export function generateProceduralTerrain(
  cols: number,
  rows: number,
  cellSize: number,
  amplitude: number = 10,
  seed: number = 42
): ElevationGrid {
  const grid = new ElevationGrid(cols, rows, cellSize);

  function pseudoRandom(x: number, y: number, s: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
    return n - Math.floor(n);
  }

  function smoothNoise(x: number, y: number, s: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = pseudoRandom(ix, iy, s);
    const n10 = pseudoRandom(ix + 1, iy, s);
    const n01 = pseudoRandom(ix, iy + 1, s);
    const n11 = pseudoRandom(ix + 1, iy + 1, s);

    const nx0 = n00 * (1 - sx) + n10 * sx;
    const nx1 = n01 * (1 - sx) + n11 * sx;

    return nx0 * (1 - sy) + nx1 * sy;
  }

  function fbm(x: number, y: number, octaves: number, persistence: number): number {
    let total = 0;
    let freq = 1;
    let amp = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += smoothNoise(x * freq, y * freq, seed + i) * amp;
      maxValue += amp;
      amp *= persistence;
      freq *= 2;
    }

    return total / maxValue;
  }

  const width = (cols - 1) * cellSize;
  const height = (rows - 1) * cellSize;
  const scale = Math.min(width, height) / 4;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col * cellSize) / scale;
      const y = (row * cellSize) / scale;

      let h = fbm(x, y, 5, 0.5);
      h = h * 2 - 1;

      const cx = width / 2;
      const cy = height / 2;
      const distX = (col * cellSize - cx) / (width / 2);
      const distY = (row * cellSize - cy) / (height / 2);
      const dist = Math.sqrt(distX * distX + distY * distY);
      const edgeFactor = Math.min(1, Math.max(0, 1 - dist * 0.3));

      h = h * edgeFactor;

      grid.setHeight(col, row, h * amplitude + amplitude);
    }
  }

  return grid;
}
