import * as THREE from 'three';
import type { Run } from '../../shared/game';
import type { Cosmetics, WorldId } from '../../shared/config';
import { HumanRunner } from './human';
import { visualTravel } from './motion';
import { barkTexture, cloudTexture, foliageTexture, groundTexture, moonTexture, random } from './textures';

type Placement = { position: THREE.Vector3; scale: THREE.Vector3; rotation?: THREE.Euler; quaternion?: THREE.Quaternion };
const TILE = 64;

export class World3D {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 2, .1, 250);
  private human: HumanRunner;
  private sun = new THREE.DirectionalLight('#fff0d4', 3);
  private ambient = new THREE.HemisphereLight('#e7f2ff', '#4b563b', 2.1);
  private forest = new THREE.Group();
  private groundMap = groundTexture('grass');
  private trailMap = groundTexture('dirt');
  private sky: THREE.Mesh;
  private clouds: THREE.Mesh;
  private moon: THREE.Mesh;
  private stars: THREE.Points;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private dirty = true;
  private lastFrame = -Infinity;
  private lastState = '';
  private world: WorldId | '' = '';
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private latest?: { run: Run; look: Cosmetics; world: WorldId; speed: number };

  constructor(private root: HTMLElement, look: Cosmetics) {
    this.canvas.className = 'world-canvas'; this.canvas.setAttribute('aria-hidden', 'true');
    const context = this.canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!context) throw new Error('WebGL2 unavailable');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.position.set(-5, 12, 7); this.sun.target.position.set(-1, 0, 0); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024); Object.assign(this.sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 42 });
    this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .035;
    this.scene.add(this.ambient, this.sun, this.sun.target);
    this.scene.fog = new THREE.FogExp2('#becfd2', .019);
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { night: { value: 0 } },
      vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec3 direction; uniform float night;
        void main(){vec3 d=normalize(direction);float h=pow(max(d.y,0.0),0.5);
          vec3 day=mix(vec3(0.74,0.84,0.89),vec3(0.20,0.47,0.74),h);
          vec3 dusk=mix(vec3(0.18,0.20,0.29),vec3(0.025,0.045,0.10),h);
          float glow=pow(max(dot(d,normalize(vec3(-0.5,0.35,-0.7))),0.0),35.0);
          vec3 color=mix(day,dusk,night)+vec3(0.35,0.22,0.08)*glow*(1.0-night);
          gl_FragColor=vec4(color,1.0);}`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 16), skyMaterial); this.scene.add(this.sky);
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(160, 45), new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, opacity: .65, depthWrite: false, fog: false }));
    this.clouds.position.set(0, 22, -75); this.scene.add(this.clouds);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(2.1, 24, 20), new THREE.MeshBasicMaterial({ color: '#eeece0', map: moonTexture(), fog: false }));
    this.moon.position.set(24, 27, -90); this.scene.add(this.moon);
    const starRng = random(400), positions: number[] = [];
    for (let i = 0; i < 260; i++) positions.push((starRng() - .5) * 180, 5 + starRng() * 70, -70 - starRng() * 70);
    const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#e3ebff', size: .13, transparent: true, opacity: .8, fog: false })); this.scene.add(this.stars);
    this.groundMap.repeat.set(100, 65); this.trailMap.repeat.set(80, 1.2);
    const groundGeometry = new THREE.PlaneGeometry(256, 160, 128, 80);
    groundGeometry.rotateX(-Math.PI / 2);
    const groundVertices = groundGeometry.attributes.position;
    for (let i = 0; i < groundVertices.count; i++) {
      const x = groundVertices.getX(i), z = groundVertices.getZ(i);
      const verge = THREE.MathUtils.smoothstep(Math.abs(z), 1.5, 5);
      groundVertices.setY(i, verge * (.06 * Math.sin(x * .8) * Math.cos(z * .9) + .08 * Math.sin(x * .19 + z * .2)));
    }
    groundGeometry.computeVertexNormals();
    const grass = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ map: this.groundMap, bumpMap: this.groundMap, bumpScale: .055, roughness: 1 }));
    grass.receiveShadow = true; this.scene.add(grass);
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(256, 2.8, 64, 1), new THREE.MeshStandardMaterial({ map: this.trailMap, bumpMap: this.trailMap, bumpScale: .035, roughness: 1, color: '#d3c7b3' }));
    trail.rotation.x = -Math.PI / 2; trail.position.y = .012; trail.receiveShadow = true; this.scene.add(trail);
    this.createMountains(); this.createForest(); this.scene.add(this.forest);
    this.human = new HumanRunner(look); this.human.root.position.x = -1.2; this.scene.add(this.human.root);
    this.root.append(this.canvas); this.root.dataset.renderer = 'webgl';
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(root); this.resize();
    this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.dispose(); });
  }
  private instances(geometry: THREE.BufferGeometry, material: THREE.Material, placements: Placement[], shadow = false) {
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
    placements.forEach((p, i) => { quaternion.identity(); if (p.rotation) quaternion.setFromEuler(p.rotation); if (p.quaternion) quaternion.copy(p.quaternion); matrix.compose(p.position, quaternion, p.scale); mesh.setMatrixAt(i, matrix); });
    mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); return mesh;
  }
  private createForest() {
    const rng = random(603), logs: Placement[] = [], leaves: Placement[] = [], blades: Placement[] = [], stones: Placement[] = [];
    const branch = (a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
      const delta = b.clone().sub(a); logs.push({ position: a.clone().add(b).multiplyScalar(.5), scale: new THREE.Vector3(radius, delta.length(), radius), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()) });
    };
    for (let i = 0; i < 26; i++) {
      const x = (rng() - .5) * TILE, z = -4 - rng() * 35, height = 4.0 + rng() * 4.0;
      const root = new THREE.Vector3(x, 0, z), top = new THREE.Vector3(x + rng() * .3, height * .78, z);
      branch(root, top, .12 + height * .012);
      for (let j = 0; j < 5; j++) {
        const angle = j / 5 * Math.PI * 2 + rng();
        const end = new THREE.Vector3(x + Math.cos(angle) * height * .25, height * (.55 + rng() * .23), z + Math.sin(angle) * height * .25);
        branch(new THREE.Vector3(x, height * .45, z), end, .045 + rng() * .04);
      }
      for (let j = 0; j < 100; j++) {
        const angle = rng() * Math.PI * 2, y = rng() * 2 - 1, radius = Math.sqrt(1 - y * y) * height * (.2 + rng() * .07);
        const p = new THREE.Vector3(x + Math.cos(angle) * radius, height * .72 + y * height * .25, z + Math.sin(angle) * radius);
        leaves.push({ position: p, scale: new THREE.Vector3(.8 + rng() * .8, .7 + rng() * .8, 1), rotation: new THREE.Euler((rng() - .5) * 1.5, rng() * Math.PI, (rng() - .5) * 1.4) });
      }
    }
    for (let i = 0; i < 700; i++) {
      const front = rng() > .5, z = front ? 1.55 + rng() * 6 : -1.55 - rng() * 7;
      const h = .16 + rng() * .32;
      blades.push({ position: new THREE.Vector3((rng() - .5) * TILE, h / 2, z), scale: new THREE.Vector3(.2 + rng() * .35, h, 1), rotation: new THREE.Euler(0, rng() * Math.PI, 0) });
    }
    for (let i = 0; i < 90; i++) stones.push({ position: new THREE.Vector3((rng() - .5) * TILE, .025, (rng() > .5 ? 1 : -1) * (1.35 + rng() * .5)), scale: new THREE.Vector3(.025 + rng() * .07, .02 + rng() * .04, .03 + rng() * .06), rotation: new THREE.Euler(rng(), rng(), rng()) });
    const logMaterial = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 1 });
    const leafMaterial = new THREE.MeshStandardMaterial({ map: foliageTexture('leaves'), alphaTest: .42, side: THREE.DoubleSide, roughness: 1, color: '#b9c69f' });
    const bladeMaterial = new THREE.MeshStandardMaterial({ map: foliageTexture('grass'), alphaTest: .4, side: THREE.DoubleSide, roughness: 1, color: '#b5ba92' });
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#8c8b7e', roughness: 1 });
    const tile = new THREE.Group();
    tile.add(this.instances(new THREE.CylinderGeometry(.65, 1, 1, 8), logMaterial, logs, true));
    tile.add(this.instances(new THREE.PlaneGeometry(1, 1), leafMaterial, leaves, true));
    tile.add(this.instances(new THREE.PlaneGeometry(1, 1), bladeMaterial, blades));
    tile.add(this.instances(new THREE.DodecahedronGeometry(1, 0), stoneMaterial, stones));
    for (const x of [-TILE, 0, TILE]) { const segment = tile.clone(true); segment.position.x = x; this.forest.add(segment); }
  }
  private createMountains() {
    const geometry = new THREE.PlaneGeometry(220, 95, 90, 40); geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position, colors: number[] = [], color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      const ridge = Math.max(0, 1 - Math.abs(z) / 48);
      const noise = Math.sin(x * .065) * .45 + Math.sin(x * .14 + z * .06) * .24 + Math.sin(x * .33 + z * .09) * .12;
      const y = Math.max(-.3, ridge * (9 + noise * 10) + Math.sin(z * .12) * 1.2);
      positions.setY(i, y); color.setHSL(.26 - y * .003, .12 + y * .006, .24 + y * .008); colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    const hills = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }));
    hills.position.set(0, -.1, -80); this.scene.add(hills);
  }
  private resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.root.clientWidth), height = Math.max(1, this.root.clientHeight);
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height;
    if (width / height < 1.5) { this.camera.position.set(3, 2.25, 6.5); this.camera.lookAt(-.75, .95, -1); }
    else { this.camera.position.set(3.8, 2.5, 6.6); this.camera.lookAt(0, 1, -3.5); }
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    const moonRay = new THREE.Vector3(-.05, .78, 1).unproject(this.camera).sub(this.camera.position).normalize();
    this.moon.position.copy(this.camera.position).addScaledVector(moonRay, 105);
    this.dirty = true;
    if (this.latest) this.render(this.latest.run, this.latest.look, this.latest.world, this.latest.speed, true);
  }
  render(run: Run, look: Cosmetics, world: WorldId, speed: number, force = false) {
    if (this.disposed) return;
    this.latest = { run, look, world, speed };
    const seconds = this.reduced.matches ? 0 : run.seconds;
    const state = `${seconds}|${run.phase}|${world}|${JSON.stringify(look)}|${this.reduced.matches}`;
    const now = performance.now();
    if (!force && !this.dirty && (state === this.lastState || now - this.lastFrame < 1000 / 30)) return;
    this.lastFrame = now; this.lastState = state; this.dirty = false;
    if (this.world !== world) {
      this.world = world; const night = world === 'twilight';
      (this.sky.material as THREE.ShaderMaterial).uniforms.night.value = night ? 1 : 0;
      this.sun.color.set(night ? '#a8c5ff' : '#fff0d4'); this.sun.intensity = night ? 1.8 : 3;
      this.ambient.color.set(night ? '#8e9fca' : '#e7f2ff'); this.ambient.groundColor.set(night ? '#3f495a' : '#4b563b'); this.ambient.intensity = night ? 1.65 : 2.1;
      (this.scene.fog as THREE.FogExp2).color.set(night ? '#293044' : '#becfd2');
      this.moon.visible = this.stars.visible = night; (this.clouds.material as THREE.MeshBasicMaterial).opacity = night ? .12 : .65;
      this.renderer.toneMappingExposure = night ? 1.45 : 1.1;
    }
    const travel = this.reduced.matches ? 0 : visualTravel(run.seconds, run.distance);
    this.forest.position.x = -(travel % TILE); this.groundMap.offset.x = (travel * 100 / 256) % 1; this.trailMap.offset.x = (travel * 80 / 256) % 1;
    this.clouds.position.x = -((travel * .025) % 12);
    this.human.setLook(look); this.human.pose(seconds, speed, !this.reduced.matches && run.phase === 'running', run.phase === 'tired');
    this.renderer.render(this.scene, this.camera);
    this.root.dataset.worldTravel = travel.toFixed(3); this.canvas.dataset.frame = String(this.renderer.info.render.frame);
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.resizeObserver?.disconnect();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { geometries.add(object.geometry); const list = Array.isArray(object.material) ? object.material : [object.material]; list.forEach(m => materials.add(m)); } });
    for (const material of materials) { for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); material.dispose(); }
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); this.renderer.dispose(); this.canvas.remove(); this.root.dataset.renderer = 'fallback';
  }
  get available() { return !this.disposed; }
}
