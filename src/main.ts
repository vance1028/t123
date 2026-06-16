import { ElevationGrid, generateProceduralTerrain } from './core/grid';
import {
  HorizontalDesignSurface,
  SlopedDesignSurface,
  calculateCutFill,
  DesignSurface,
  CutFillResult
} from './core/cutfill';
import {
  findOptimalHorizontalElevation,
  findOptimalSlopedSurface,
  computeBalanceCurve
} from './core/balance';
import { extractContours, generateContourLevels } from './core/contour';
import { createFullMask, createGridMask, Point } from './core/polygon';
import { computeSlopeEmbankment, SlopeEmbankmentResult } from './core/slope';
import { TerrainRenderer, ViewMode } from './render/TerrainRenderer';

let grid: ElevationGrid;
let mask: boolean[];
let renderer: TerrainRenderer;
let currentDesign: DesignSurface;
let currentResult: CutFillResult;
let slopeResult: SlopeEmbankmentResult | null = null;
let viewMode: ViewMode = 'elevation';
let usePolygon: boolean = false;
let useSlope: boolean = true;
let polygonPoints: Point[] = [];

function init() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  const cols = parseInt((document.getElementById('grid-size-x') as HTMLInputElement).value);
  const rows = parseInt((document.getElementById('grid-size-y') as HTMLInputElement).value);
  const cellSize = parseFloat((document.getElementById('cell-size') as HTMLInputElement).value);
  const roughness = parseFloat((document.getElementById('terrain-roughness') as HTMLInputElement).value);

  grid = generateProceduralTerrain(cols, rows, cellSize, roughness, Date.now() % 10000);
  mask = createFullMask(cols, rows);

  renderer = new TerrainRenderer({
    container,
    verticalScale: 1.5
  });

  renderer.setTerrain(grid);

  updateDesign();
  setupEventListeners();
  updateContours();
  updateBalanceChart();
}

function setupEventListeners() {
  document.getElementById('btn-generate')?.addEventListener('click', generateNewTerrain);

  document.querySelectorAll('.view-mode-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const mode = (e.target as HTMLElement).dataset.mode as ViewMode;
      setViewMode(mode);
    });
  });

  document.getElementById('show-grid')?.addEventListener('change', (e) => {
    renderer.setShowGrid((e.target as HTMLInputElement).checked);
  });

  document.getElementById('show-design')?.addEventListener('change', (e) => {
    renderer.setShowDesign((e.target as HTMLInputElement).checked);
  });

  document.getElementById('design-type')?.addEventListener('change', (e) => {
    const type = (e.target as HTMLSelectElement).value;
    document.getElementById('design-horizontal')!.style.display =
      type === 'horizontal' ? 'block' : 'none';
    document.getElementById('design-slope')!.style.display =
      type === 'slope' ? 'block' : 'none';
    updateDesign();
  });

  ['design-elevation', 'slope-center-elev', 'slope-x', 'slope-y', 'slope-ratio'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateDesign);
  });

  document.getElementById('use-polygon')?.addEventListener('change', (e) => {
    usePolygon = (e.target as HTMLInputElement).checked;
    if (usePolygon) {
      createDefaultPolygon();
    } else {
      mask = createFullMask(grid.cols, grid.rows);
      polygonPoints = [];
    }
    updateDesign();
    updateBalanceChart();
  });

  document.getElementById('btn-balance-h')?.addEventListener('click', autoBalanceHorizontal);
  document.getElementById('btn-balance-s')?.addEventListener('click', autoBalanceSloped);

  document.getElementById('btn-export')?.addEventListener('click', exportReport);
  document.getElementById('btn-reset-polygon')?.addEventListener('click', resetPolygon);
}

function createDefaultPolygon() {
  const bounds = grid.getBounds();
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const marginX = w * 0.2;
  const marginY = h * 0.2;

  polygonPoints = [
    { x: bounds.minX + marginX, y: bounds.minY + marginY },
    { x: bounds.maxX - marginX, y: bounds.minY + marginY },
    { x: bounds.maxX - marginX, y: bounds.maxY - marginY },
    { x: bounds.minX + marginX, y: bounds.maxY - marginY }
  ];

  mask = createGridMask(grid.cols, grid.rows, grid.cellSize, polygonPoints);
}

function generateNewTerrain() {
  const cols = parseInt((document.getElementById('grid-size-x') as HTMLInputElement).value);
  const rows = parseInt((document.getElementById('grid-size-y') as HTMLInputElement).value);
  const cellSize = parseFloat((document.getElementById('cell-size') as HTMLInputElement).value);
  const roughness = parseFloat((document.getElementById('terrain-roughness') as HTMLInputElement).value);

  grid = generateProceduralTerrain(cols, rows, cellSize, roughness, Date.now() % 10000);

  if (usePolygon) {
    createDefaultPolygon();
  } else {
    mask = createFullMask(cols, rows);
    polygonPoints = [];
  }

  renderer.setTerrain(grid);
  updateDesign();
  updateContours();
  updateBalanceChart();
}

function setViewMode(mode: ViewMode) {
  viewMode = mode;
  renderer.setViewMode(mode);

  document.querySelectorAll('.view-mode-tab').forEach(tab => {
    if ((tab as HTMLElement).dataset.mode === mode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (mode === 'cutfill') {
    renderer.updateCutFillColors(currentResult);
  }
}

function updateDesign() {
  const designType = (document.getElementById('design-type') as HTMLSelectElement).value;

  if (designType === 'horizontal') {
    const elev = parseFloat((document.getElementById('design-elevation') as HTMLInputElement).value);
    currentDesign = new HorizontalDesignSurface(elev);
  } else {
    const bounds = grid.getBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerElev = parseFloat((document.getElementById('slope-center-elev') as HTMLInputElement).value);
    const slopeX = parseFloat((document.getElementById('slope-x') as HTMLInputElement).value);
    const slopeY = parseFloat((document.getElementById('slope-y') as HTMLInputElement).value);
    currentDesign = new SlopedDesignSurface(centerX, centerY, centerElev, slopeX, slopeY);
  }

  currentResult = calculateCutFill(grid, currentDesign, mask);

  const slopeRatio = parseFloat((document.getElementById('slope-ratio') as HTMLInputElement).value);
  if (usePolygon && slopeRatio > 0) {
    slopeResult = computeSlopeEmbankment(grid, currentDesign, mask, slopeRatio);
  } else {
    slopeResult = null;
  }

  renderer.updateDesignSurface(currentDesign);

  if (viewMode === 'cutfill') {
    renderer.updateCutFillColors(currentResult);
  }

  updateResultDisplay();
}

function updateResultDisplay() {
  let totalCut = currentResult.cutVolume;
  let totalFill = currentResult.fillVolume;
  let slopeCut = 0;
  let slopeFill = 0;

  if (slopeResult) {
    slopeCut = slopeResult.slopeCutVolume;
    slopeFill = slopeResult.slopeFillVolume;
    totalCut += slopeCut;
    totalFill += slopeFill;
  }

  document.getElementById('result-cut')!.textContent =
    totalCut.toFixed(2) + ' m³';
  document.getElementById('result-fill')!.textContent =
    totalFill.toFixed(2) + ' m³';

  const diff = totalCut - totalFill;
  document.getElementById('result-diff')!.textContent = diff.toFixed(2) + ' m³';

  const total = totalCut + totalFill;
  const ratio = total > 0 ? Math.abs(diff) / total * 100 : 0;
  document.getElementById('result-ratio')!.textContent = ratio.toFixed(2) + '%';

  document.getElementById('result-area')!.textContent =
    currentResult.area.toFixed(2) + ' m²';

  const slopeTotal = slopeCut + slopeFill;
  document.getElementById('result-slope')!.textContent =
    slopeTotal.toFixed(2) + ' m³';
}

function autoBalanceHorizontal() {
  const result = findOptimalHorizontalElevation(grid, mask);
  (document.getElementById('design-elevation') as HTMLInputElement).value =
    result.elevation.toFixed(2);
  updateDesign();
}

function autoBalanceSloped() {
  const result = findOptimalSlopedSurface(grid, mask);
  (document.getElementById('slope-center-elev') as HTMLInputElement).value =
    result.centerElev.toFixed(2);
  (document.getElementById('slope-x') as HTMLInputElement).value =
    result.slopeX.toFixed(2);
  (document.getElementById('slope-y') as HTMLInputElement).value =
    result.slopeY.toFixed(2);
  (document.getElementById('design-type') as HTMLSelectElement).value = 'slope';
  document.getElementById('design-horizontal')!.style.display = 'none';
  document.getElementById('design-slope')!.style.display = 'block';
  updateDesign();
}

function updateContours() {
  const interval = Math.max(1, (grid.getMaxHeight() - grid.getMinHeight()) / 10);
  const levels = generateContourLevels(grid, interval);
  const contours = extractContours(grid, levels);
  renderer.updateContours(contours);
}

function updateBalanceChart() {
  const canvas = document.getElementById('balance-chart') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const curve = computeBalanceCurve(grid, 50, mask);

  const w = canvas.width;
  const h = canvas.height;
  const padding = { left: 40, right: 20, top: 10, bottom: 25 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  let maxAbsDiff = 0;
  for (const d of curve.diffs) {
    if (Math.abs(d) > maxAbsDiff) maxAbsDiff = Math.abs(d);
  }
  if (maxAbsDiff === 0) maxAbsDiff = 1;

  const minElev = curve.elevations[0];
  const maxElev = curve.elevations[curve.elevations.length - 1];

  ctx.strokeStyle = '#e4e7ed';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartH / 2);
  ctx.lineTo(padding.left + chartW, padding.top + chartH / 2);
  ctx.stroke();

  ctx.strokeStyle = '#409eff';
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < curve.elevations.length; i++) {
    const x = padding.left + (curve.elevations[i] - minElev) / (maxElev - minElev) * chartW;
    const y = padding.top + chartH / 2 - curve.diffs[i] / maxAbsDiff * (chartH / 2);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  let zeroIdx = -1;
  for (let i = 1; i < curve.diffs.length; i++) {
    if (curve.diffs[i - 1] > 0 && curve.diffs[i] <= 0) {
      zeroIdx = i;
      break;
    }
  }
  if (zeroIdx > 0) {
    const t = curve.diffs[zeroIdx - 1] / (curve.diffs[zeroIdx - 1] - curve.diffs[zeroIdx]);
    const zeroElev = curve.elevations[zeroIdx - 1] + t * (curve.elevations[zeroIdx] - curve.elevations[zeroIdx - 1]);
    const x = padding.left + (zeroElev - minElev) / (maxElev - minElev) * chartW;

    ctx.strokeStyle = '#f56c6c';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + chartH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = '#606266';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';

  ctx.fillText(minElev.toFixed(1), padding.left, h - 8);
  ctx.fillText(maxElev.toFixed(1), padding.left + chartW, h - 8);
  ctx.fillText('设计标高(m)', w / 2, h - 3);

  ctx.save();
  ctx.translate(12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('平衡差(m³)', 0, 0);
  ctx.restore();
}

function resetPolygon() {
  usePolygon = false;
  (document.getElementById('use-polygon') as HTMLInputElement).checked = false;
  mask = createFullMask(grid.cols, grid.rows);
  polygonPoints = [];
  slopeResult = null;
  updateDesign();
  updateBalanceChart();
}

function exportReport() {
  const report = generateReportText();
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '土方计算报告.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateReportText(): string {
  const designType = (document.getElementById('design-type') as HTMLSelectElement).value;
  const now = new Date();

  let totalCut = currentResult.cutVolume;
  let totalFill = currentResult.fillVolume;
  let slopeCut = 0;
  let slopeFill = 0;

  if (slopeResult) {
    slopeCut = slopeResult.slopeCutVolume;
    slopeFill = slopeResult.slopeFillVolume;
    totalCut += slopeCut;
    totalFill += slopeFill;
  }

  let report = '═══════════════════════════════════════════\n';
  report += '           场地平整土方计算报告\n';
  report += '═══════════════════════════════════════════\n\n';
  report += `生成时间: ${now.toLocaleString()}\n\n`;

  report += '一、地形参数\n';
  report += '───────────────────────────────────\n';
  report += `  网格尺寸 (X × Y): ${grid.cols} × ${grid.rows}\n`;
  report += `  单元大小: ${grid.cellSize} m\n`;
  report += `  场地宽度: ${grid.getWidth().toFixed(2)} m\n`;
  report += `  场地长度: ${grid.getHeightTotal().toFixed(2)} m\n`;
  report += `  场地总面积: ${(grid.getWidth() * grid.getHeightTotal()).toFixed(2)} m²\n`;
  report += `  最低标高: ${grid.getMinHeight().toFixed(2)} m\n`;
  report += `  最高标高: ${grid.getMaxHeight().toFixed(2)} m\n`;
  report += `  最大高差: ${(grid.getMaxHeight() - grid.getMinHeight()).toFixed(2)} m\n\n`;

  report += '二、设计面参数\n';
  report += '───────────────────────────────────\n';
  report += `  类型: ${designType === 'horizontal' ? '水平标高' : '倾斜坡面'}\n`;

  if (designType === 'horizontal') {
    const elev = parseFloat((document.getElementById('design-elevation') as HTMLInputElement).value);
    report += `  设计标高: ${elev.toFixed(2)} m\n`;
  } else {
    const centerElev = parseFloat((document.getElementById('slope-center-elev') as HTMLInputElement).value);
    const slopeX = parseFloat((document.getElementById('slope-x') as HTMLInputElement).value);
    const slopeY = parseFloat((document.getElementById('slope-y') as HTMLInputElement).value);
    report += `  中心标高: ${centerElev.toFixed(2)} m\n`;
    report += `  X 向坡度: ${slopeX.toFixed(2)} %\n`;
    report += `  Y 向坡度: ${slopeY.toFixed(2)} %\n`;
  }
  report += '\n';

  report += '三、平整区域\n';
  report += '───────────────────────────────────\n';
  report += `  区域类型: ${usePolygon ? '多边形区域' : '全场地'}\n`;
  report += `  平整面积: ${currentResult.area.toFixed(2)} m²\n`;
  if (usePolygon) {
    const slopeRatio = parseFloat((document.getElementById('slope-ratio') as HTMLInputElement).value);
    report += `  放坡坡比: 1:${slopeRatio.toFixed(2)}\n`;
  }
  report += '\n';

  report += '四、土方计算结果\n';
  report += '───────────────────────────────────\n';
  report += `  平整区挖方量:  ${currentResult.cutVolume.toFixed(2)} m³\n`;
  report += `  平整区填方量:  ${currentResult.fillVolume.toFixed(2)} m³\n`;

  if (slopeResult) {
    report += `  放坡挖方量:    ${slopeCut.toFixed(2)} m³\n`;
    report += `  放坡填方量:    ${slopeFill.toFixed(2)} m³\n`;
  }

  report += `  总挖方量:      ${totalCut.toFixed(2)} m³\n`;
  report += `  总填方量:      ${totalFill.toFixed(2)} m³\n`;

  const diff = totalCut - totalFill;
  report += `  平衡差:        ${diff.toFixed(2)} m³ (挖 - 填)\n`;

  const total = totalCut + totalFill;
  const ratio = total > 0 ? Math.abs(diff) / total * 100 : 0;
  report += `  平衡差率:      ${ratio.toFixed(2)} %\n`;

  if (Math.abs(diff) < total * 0.05) {
    report += `  评价: 填挖基本平衡\n`;
  } else if (diff > 0) {
    report += `  评价: 挖方大于填方，需外运弃土 ${diff.toFixed(2)} m³\n`;
  } else {
    report += `  评价: 填方大于挖方，需借土 ${Math.abs(diff).toFixed(2)} m³\n`;
  }
  report += '\n';

  report += '═══════════════════════════════════════════\n';
  report += '           报告结束\n';
  report += '═══════════════════════════════════════════\n';

  return report;
}

document.addEventListener('DOMContentLoaded', init);
