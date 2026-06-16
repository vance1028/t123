import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ElevationGrid } from '../core/grid';
import { DesignSurface, CutFillResult } from '../core/cutfill';
import { ContourLine } from '../core/contour';
import { elevationColor, cutFillColor } from './colorUtils';

export type ViewMode = 'elevation' | 'cutfill' | 'contour';

export interface RendererOptions {
  container: HTMLElement;
  verticalScale?: number;
}

export class TerrainRenderer {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private verticalScale: number;

  private terrainMesh: THREE.Mesh | null = null;
  private terrainGeometry: THREE.PlaneGeometry | null = null;
  private wireframe: THREE.LineSegments | null = null;
  private designSurface: THREE.Mesh | null = null;
  private contourLines: THREE.Group | null = null;
  private gridHelper: THREE.GridHelper | null = null;

  private grid: ElevationGrid | null = null;
  private viewMode: ViewMode = 'elevation';
  private showGrid: boolean = true;
  private showDesign: boolean = true;
  private animFrameId: number = 0;

  constructor(options: RendererOptions) {
    this.container = options.container;
    this.verticalScale = options.verticalScale ?? 1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f4f8);

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      10000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    window.addEventListener('resize', this.handleResize);
    this.animate();
  }

  private handleResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  setTerrain(grid: ElevationGrid): void {
    this.grid = grid;
    this.updateTerrainMesh();
    this.fitCamera();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.updateTerrainColors();
    if (this.contourLines) {
      this.contourLines.visible = mode === 'contour';
    }
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    if (this.wireframe) {
      this.wireframe.visible = show;
    }
    if (this.gridHelper) {
      this.gridHelper.visible = show;
    }
  }

  setShowDesign(show: boolean): void {
    this.showDesign = show;
    if (this.designSurface) {
      this.designSurface.visible = show;
    }
  }

  updateCutFillColors(result: CutFillResult): void {
    if (!this.terrainGeometry || !this.grid) return;

    const colors = this.terrainGeometry.attributes.color as THREE.BufferAttribute;
    const { cols, rows } = this.grid;

    let maxDiff = 0;
    for (let i = 0; i < result.diffHeights.length; i++) {
      const abs = Math.abs(result.diffHeights[i]);
      if (abs > maxDiff) maxDiff = abs;
    }
    if (maxDiff === 0) maxDiff = 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const diff = result.diffHeights[idx];
        const color = cutFillColor(diff, maxDiff);
        colors.setXYZ(idx, color.r, color.g, color.b);
      }
    }

    colors.needsUpdate = true;
  }

  updateElevationColors(): void {
    if (!this.terrainGeometry || !this.grid) return;

    const colors = this.terrainGeometry.attributes.color as THREE.BufferAttribute;
    const minH = this.grid.getMinHeight();
    const maxH = this.grid.getMaxHeight();
    const { cols, rows } = this.grid;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const h = this.grid.getHeight(col, row);
        const color = elevationColor(h, minH, maxH);
        const idx = row * cols + col;
        colors.setXYZ(idx, color.r, color.g, color.b);
      }
    }

    colors.needsUpdate = true;
  }

  updateDesignSurface(design: DesignSurface): void {
    if (!this.grid) return;

    if (this.designSurface) {
      this.scene.remove(this.designSurface);
      this.designSurface.geometry.dispose();
      (this.designSurface.material as THREE.Material).dispose();
    }

    const { cols, rows } = this.grid;
    const geom = new THREE.PlaneGeometry(
      this.grid.getWidth(),
      this.grid.getHeightTotal(),
      cols - 1,
      rows - 1
    );
    geom.rotateX(-Math.PI / 2);

    const positions = geom.attributes.position;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = this.grid.getX(col);
        const y = this.grid.getY(row);
        const h = design.getElevation(x, y);
        const idx = row * cols + col;
        positions.setY(idx, h * this.verticalScale);
      }
    }
    positions.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });

    this.designSurface = new THREE.Mesh(geom, material);
    this.designSurface.visible = this.showDesign;
    this.scene.add(this.designSurface);
  }

  updateContours(contours: ContourLine[]): void {
    if (this.contourLines) {
      this.scene.remove(this.contourLines);
      this.contourLines.traverse(obj => {
        if (obj instanceof THREE.Line) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }

    this.contourLines = new THREE.Group();

    for (const contour of contours) {
      const positions: number[] = [];
      for (const p of contour.points) {
        if (this.grid) {
          const h = this.grid.getHeightAt(p.x, p.y);
          positions.push(p.x, h * this.verticalScale + 0.1, p.y);
        }
      }

      if (positions.length < 6) continue;

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0x333333,
        linewidth: 1
      });
      const line = new THREE.Line(geom, mat);
      this.contourLines.add(line);
    }

    this.contourLines.visible = this.viewMode === 'contour';
    this.scene.add(this.contourLines);
  }

  private updateTerrainMesh(): void {
    if (!this.grid) return;

    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainGeometry?.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    if (this.wireframe) {
      this.scene.remove(this.wireframe);
      this.wireframe.geometry.dispose();
      (this.wireframe.material as THREE.Material).dispose();
    }
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      (this.gridHelper.material as THREE.Material).dispose();
    }

    const { cols, rows, cellSize } = this.grid;
    const width = this.grid.getWidth();
    const depth = this.grid.getHeightTotal();

    const geometry = new THREE.PlaneGeometry(width, depth, cols - 1, rows - 1);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const h = this.grid.getHeight(col, row);
        const idx = row * cols + col;
        positions.setY(idx, h * this.verticalScale);
      }
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const colors = new Float32Array(cols * rows * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: false,
      roughness: 0.8,
      metalness: 0.1
    });

    this.terrainGeometry = geometry;
    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = true;
    this.scene.add(this.terrainMesh);

    const wireGeom = new THREE.WireframeGeometry(geometry);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.3
    });
    this.wireframe = new THREE.LineSegments(wireGeom, wireMat);
    this.wireframe.visible = this.showGrid;
    this.scene.add(this.wireframe);

    const gridSize = Math.max(width, depth);
    this.gridHelper = new THREE.GridHelper(gridSize * 1.2, 20, 0x888888, 0xcccccc);
    this.gridHelper.position.y = -1;
    this.gridHelper.visible = this.showGrid;
    this.scene.add(this.gridHelper);

    this.updateTerrainColors();
  }

  private updateTerrainColors(): void {
    if (this.viewMode === 'elevation') {
      this.updateElevationColors();
    }
  }

  private fitCamera(): void {
    if (!this.grid) return;

    const width = this.grid.getWidth();
    const depth = this.grid.getHeightTotal();
    const maxDim = Math.max(width, depth);

    const centerX = width / 2;
    const centerZ = depth / 2;
    const centerY = (this.grid.getMinHeight() + this.grid.getMaxHeight()) / 2 * this.verticalScale;

    this.camera.position.set(
      centerX + maxDim * 0.8,
      maxDim * 0.8,
      centerZ + maxDim * 0.8
    );
    this.controls.target.set(centerX, centerY, centerZ);
    this.controls.update();
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
