import * as THREE from "three";
import {
  Game,
  LANE_WIDTH,
  isHazard,
  isTraffic,
  hazardVisible,
  laneX,
  seededRandom,
  type ObjectKind,
  type RoadObject,
} from "./game.ts";

const palette = {
  road: 0x475260,
  sand: 0xe2d5b4,
  grass: 0x8ca77b,
  sea: 0x519faf,
  navy: 0x163c55,
  blue: 0x2079b4,
  white: 0xf1f5ed,
  orange: 0xf4af4b,
};
const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: number, roughness = 0.7, metalness = 0) {
  const key = `${color}-${roughness}-${metalness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return materials.get(key)!;
}
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeometries = new Map<string, THREE.CylinderGeometry>();
let palmLeafGeometry: THREE.BufferGeometry | undefined;
function box(
  parent: THREE.Object3D,
  dimensions: number[],
  position: number[],
  color: number,
  shadow = false,
) {
  const mesh = new THREE.Mesh(boxGeometry, material(color));
  mesh.scale.set(dimensions[0], dimensions[1], dimensions[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  color: number,
  x: number,
  y: number,
  z: number,
  segments = 8,
) {
  const key = `${top}-${bottom}-${height}-${segments}`;
  if (!cylinderGeometries.has(key))
    cylinderGeometries.set(
      key,
      new THREE.CylinderGeometry(top, bottom, height, segments),
    );
  const mesh = new THREE.Mesh(cylinderGeometries.get(key)!, material(color));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cabin(parent: THREE.Object3D, color: number) {
  const vertices = new Float32Array([
    -0.91, 0.95, -1.1, 0.91, 0.95, -1.1, 0.91, 0.95, 1.16, -0.91, 0.95, 1.16,
    -0.73, 1.66, -0.57, 0.73, 1.66, -0.57, 0.73, 1.66, 0.7, -0.73, 1.66, 0.7,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([
    0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0, 4,
    7, 6, 4, 6, 5,
  ]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material(0x25495a, 0.16, 0.35));
  mesh.castShadow = true;
  parent.add(mesh);
  box(parent, [1.53, 0.1, 1.4], [0, 1.7, 0.05], color, true);
  for (const x of [-0.83, 0.83])
    box(parent, [0.065, 0.64, 0.1], [x, 1.29, 0.2], color);
}

export function makeCar(
  color = palette.white,
  patrol = false,
  truck = false,
): THREE.Group {
  const group = new THREE.Group();
  box(
    group,
    [1.98, 0.48, truck ? 6.2 : 4.05],
    [0, 0.67, truck ? 1.1 : 0],
    color,
    true,
  );
  box(
    group,
    [1.83, 0.2, truck ? 6.4 : 4.2],
    [0, 0.42, truck ? 1.1 : 0],
    0x263943,
  );
  box(
    group,
    [1.87, 0.22, 1.2],
    [0, 0.98, -1.36],
    patrol ? palette.blue : color,
    true,
  );
  cabin(group, color);
  if (truck) {
    box(group, [2.2, 2.65, 4.5], [0, 1.85, 2.4], 0xd9d9cc, true);
    box(group, [2.22, 0.22, 4.54], [0, 1.05, 2.4], palette.blue);
    box(group, [1.96, 2.36, 0.06], [0, 1.85, 4.69], 0xb0b9b9);
    for (const x of [-0.65, 0.65])
      box(group, [0.04, 2.2, 0.09], [x, 1.85, 4.74], 0x7b8d98);
  }
  const wheels: THREE.Mesh[] = [];
  for (const x of [-1.01, 1.01]) {
    for (const z of truck ? [-1.3, 2.9, 3.9] : [-1.3, 1.28]) {
      const tire = cylinder(group, 0.43, 0.43, 0.3, 0x1b2831, x, 0.43, z, 12);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const hub = cylinder(group, 0.24, 0.24, 0.32, 0x9baab1, x, 0.43, z, 8);
      hub.rotation.z = Math.PI / 2;
      wheels.push(tire);
    }
    box(group, [0.25, 0.15, 0.3], [x * 1.06, 1.13, -0.56], color, true);
    if (patrol) {
      box(group, [0.02, 0.23, 2.7], [x * 0.986, 0.8, 0.22], palette.blue);
      box(group, [0.03, 0.32, 0.45], [x, 0.96, 0.22], palette.navy);
      box(group, [0.04, 0.2, 0.12], [x * 1.01, 0.96, 0.22], palette.white);
    }
  }
  for (const x of [-0.64, 0.64]) {
    box(group, [0.48, 0.17, 0.04], [x, 0.85, -2.04], 0xfff1b5);
    box(group, [0.39, 0.14, 0.04], [x, 0.83, truck ? 4.71 : 2.04], 0xe54c3d);
  }
  box(group, [0.7, 0.18, 0.04], [0, 0.64, -2.055], 0x243442);
  box(group, [0.5, 0.13, 0.04], [0, 0.66, truck ? 4.73 : 2.06], 0xf7e2a6);
  if (patrol) {
    box(group, [1.15, 0.08, 0.3], [0, 1.79, 0.08], 0x314954);
    box(group, [0.44, 0.16, 0.27], [-0.33, 1.9, 0.08], 0x40bbf2);
    box(group, [0.44, 0.16, 0.27], [0.33, 1.9, 0.08], 0xf3b14e);
    box(group, [1.65, 0.1, 0.25], [0, 1.12, 1.72], palette.navy);
  }
  group.userData.wheels = wheels;
  return group;
}

function makeMotorcycle() {
  const group = new THREE.Group();
  for (const z of [-0.85, 0.85]) {
    const wheel = cylinder(group, 0.46, 0.46, 0.22, 0x202e36, 0, 0.46, z, 12);
    wheel.rotation.z = Math.PI / 2;
    const rim = cylinder(group, 0.26, 0.26, 0.24, 0xaeb5b6, 0, 0.46, z, 8);
    rim.rotation.z = Math.PI / 2;
  }
  box(group, [0.38, 0.5, 1.4], [0, 0.8, 0], 0xc06f43, true);
  box(group, [0.46, 0.15, 0.7], [0, 1.02, 0.4], 0x243441);
  box(group, [0.78, 0.08, 0.1], [0, 1.3, -0.65], 0x9eacad);
  box(group, [0.55, 0.63, 0.38], [0, 1.48, 0.13], 0x344557, true);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 10, 8),
    material(0xe9dfc5),
  );
  helmet.position.set(0, 1.99, 0.04);
  helmet.castShadow = true;
  group.add(helmet);
  box(group, [0.41, 0.15, 0.1], [0, 2, -0.2], 0x243441);
  for (const x of [-0.3, 0.3]) {
    box(group, [0.15, 0.5, 0.22], [x, 1, 0.4], 0x253d53);
    box(group, [0.12, 0.13, 0.65], [x, 1.55, -0.2], 0x344557);
  }
  box(group, [0.26, 0.2, 0.08], [0, 1, -0.96], 0xffefb5);
  return group;
}

function makeHazard(kind: ObjectKind) {
  const group = new THREE.Group();
  if (kind === "pothole" || kind === "minor") {
    const large = kind === "pothole";
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(large ? 0.82 : 0.42, large ? 1.22 : 0.78, 11),
      material(0x7d817e),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.025;
    rim.scale.y = 1.36;
    group.add(rim);
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(large ? 0.89 : 0.5, 11),
      material(0x202c36),
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.03;
    hole.scale.y = 1.36;
    group.add(hole);
    for (let i = 0; i < 9; i++) {
      const angle = (i * Math.PI * 2) / 9;
      const rock = box(
        group,
        [0.15 + (i % 3) * 0.09, 0.07, 0.17],
        [
          Math.sin(angle) * (large ? 1.06 : 0.67),
          0.055,
          Math.cos(angle) * (large ? 1.38 : 0.86),
        ],
        0x8b8b7e,
      );
      rock.rotation.y = angle;
    }
  } else if (kind === "patch") {
    box(group, [2.5, 0.065, 3.2], [0, 0.035, 0], 0x303e48);
    for (let i = 0; i < 6; i++)
      box(group, [0.03, 0.008, 2.5], [-0.95 + i * 0.38, 0.072, 0], 0x414d53);
  } else {
    const hump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.39, 0.39, 2.95, 16, 1, false, 0, Math.PI),
      material(0xeeb855),
    );
    hump.rotation.z = Math.PI / 2;
    hump.position.y = 0.01;
    group.add(hump);
    // Wide transverse strips make the raised obstacle readable from a chase camera.
    for (const x of [-1, -0.33, 0.33, 1])
      box(group, [0.28, 0.18, 0.6], [x, 0.16, 0], 0x37444b);
  }
  return group;
}

function makePickup(kind: ObjectKind) {
  const group = new THREE.Group();
  const color =
    kind === "shield" ? 0x4faedc : kind === "repair" ? 0x69b589 : 0xe6b450;
  const token = cylinder(group, 0.7, 0.7, 0.18, color, 0, 1.5, 0, 6);
  token.rotation.x = Math.PI / 2;
  if (kind === "repair") {
    box(group, [0.72, 0.17, 0.22], [0, 1.5, 0.15], palette.white);
    box(group, [0.17, 0.72, 0.22], [0, 1.5, 0.15], palette.white);
  } else if (kind === "shield") {
    const shield = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.55, 3),
      material(palette.white),
    );
    shield.rotation.z = Math.PI;
    shield.rotation.y = Math.PI;
    shield.position.set(0, 1.51, 0.23);
    group.add(shield);
  } else {
    for (let i = 0; i < 3; i++)
      box(
        group,
        [0.13, 0.2 + i * 0.2, 0.2],
        [-0.25 + i * 0.25, 1.4 + i * 0.1, 0.15],
        palette.white,
      );
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.035, 4, 24),
    material(color),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  group.add(ring);
  return group;
}

function makePalm(random: () => number) {
  const group = new THREE.Group();
  const height = 5 + random() * 3;
  const trunk = cylinder(group, 0.18, 0.32, 1, 0xa59b7a, 0, height / 2, 0, 7);
  trunk.scale.y = height;
  trunk.rotation.z = -0.08;
  trunk.castShadow = true;
  for (let i = 0; i < 7; i++) {
    const geometry = palmLeafGeometry ?? new THREE.BufferGeometry();
    if (!palmLeafGeometry) {
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [0, 0, 0, -0.52, 0.25, 1.5, 0, -0.9, 3.8, 0.52, 0.25, 1.5],
          3,
        ),
      );
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      palmLeafGeometry = geometry;
    }
    const leafMaterial = material(i % 2 ? 0x547958 : 0x68885a);
    leafMaterial.side = THREE.DoubleSide;
    const frond = new THREE.Mesh(geometry, leafMaterial);
    frond.position.set(-0.45, height - 0.1, 0);
    frond.rotation.y = (i * Math.PI * 2) / 7;
    frond.castShadow = true;
    group.add(frond);
  }
  return group;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 700);
  readonly player = makeCar(palette.white, true);
  private sun: THREE.DirectionalLight;
  private markers: THREE.InstancedMesh;
  private roadside: THREE.Group[] = [];
  private sceneryBatches: {
    mesh: THREE.InstancedMesh;
    items: { matrix: THREE.Matrix4; row: THREE.Group }[];
  }[] = [];
  private objects = new Map<number, THREE.Group>();
  private templates = new Map<string, THREE.Group>();
  private scanner: THREE.Mesh;
  private scannerEdges: THREE.Line;
  private scanLine: THREE.Mesh;
  private shield: THREE.Mesh;
  private particles: THREE.InstancedMesh;
  private ambientDistance = 0;
  private motionTime = 0;
  private cameraTarget = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private look = new THREE.Vector3();
  hood = false;
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0xc3dce4);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.24;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D coastal highway and patrol car",
    );
    container.append(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0xc3dce4, 90, 290);
    this.scene.add(new THREE.HemisphereLight(0xd6ecff, 0x7e8c60, 2.3));
    this.sun = new THREE.DirectionalLight(0xffe4bc, 3.2);
    this.sun.position.set(-45, 70, -55);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -35;
    this.sun.shadow.camera.right = 35;
    this.sun.shadow.camera.top = 65;
    this.sun.shadow.camera.bottom = -35;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    box(this.scene, [800, 0.1, 900], [0, -0.16, -300], palette.grass);
    box(this.scene, [300, 0.12, 900], [-175, -0.1, -300], palette.sea);
    box(this.scene, [14, 0.12, 380], [-14, -0.05, -150], palette.sand);
    box(this.scene, [12.8, 0.12, 380], [0, -0.045, -150], 0xb5b6a5);
    box(this.scene, [11.2, 0.12, 380], [0, 0, -150], palette.road);
    for (const x of [-5.24, 5.24])
      box(this.scene, [0.12, 0.015, 380], [x, 0.07, -150], palette.white);
    this.markers = new THREE.InstancedMesh(boxGeometry, material(0xf0f2df), 76);
    this.markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.markers);
    this.buildScenery();
    this.scene.add(this.player);
    this.camera.position.set(7, 6, 14);
    const scannerGeometry = new THREE.BufferGeometry();
    scannerGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(18), 3),
    );
    scannerGeometry.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4]);
    this.scanner = new THREE.Mesh(
      scannerGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x48c9e7,
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.scanner.frustumCulled = false;
    this.scene.add(this.scanner);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(18), 3),
    );
    this.scannerEdges = new THREE.Line(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        color: 0x6be0f4,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.scannerEdges.frustumCulled = false;
    this.scene.add(this.scannerEdges);
    this.scanLine = new THREE.Mesh(
      boxGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x91eeff,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    this.scanLine.scale.set(10.3, 0.025, 0.2);
    this.scene.add(this.scanLine);
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 12),
      new THREE.MeshBasicMaterial({
        color: 0x6cc8ed,
        transparent: true,
        opacity: 0.12,
        wireframe: true,
      }),
    );
    this.shield.scale.set(1.5, 1.4, 2.6);
    this.scene.add(this.shield);
    this.particles = new THREE.InstancedMesh(
      boxGeometry,
      material(0xffc06b),
      26,
    );
    this.particles.visible = false;
    this.scene.add(this.particles);
    this.resize();
  }
  private buildScenery() {
    const random = seededRandom(18341);
    for (let i = 0; i < 19; i++) {
      const group = new THREE.Group();
      group.userData.baseZ = 24 - i * 18;
      for (const x of [-6.5, 6.5]) {
        box(group, [0.14, 1.12, 0.14], [x, 0.55, 0], 0x84979b, true);
        box(group, [0.15, 0.3, 18], [x, 1, 0], 0xc1cbca);
        box(
          group,
          [0.2, 0.14, 0.2],
          [x, 1.22, 0],
          i % 2 ? palette.orange : palette.white,
        );
      }
      const palm = makePalm(random);
      palm.position.set(13 + random() * 5, 0, -3);
      group.add(palm);
      if (i % 2 === 0) {
        const leftPalm = makePalm(random);
        leftPalm.position.set(-12, 0, -7);
        group.add(leftPalm);
      }
      if (i % 3 === 0) {
        const building = new THREE.Group();
        const h = 4 + random() * 6;
        box(
          building,
          [9, h, 9],
          [0, h / 2, 0],
          i % 2 ? 0xd9cfb5 : 0xe1e2ce,
          true,
        );
        box(building, [9.5, 0.3, 9.5], [0, h + 0.1, 0], 0x799397, true);
        for (let floor = 0; floor < Math.floor(h / 2); floor++)
          for (let w = 0; w < 3; w++)
            box(
              building,
              [0.03, 1, 1.25],
              [-4.51, 1.5 + floor * 2, -2.7 + w * 2.7],
              0x547a87,
            );
        building.position.set(24 + random() * 12, 0, -7);
        group.add(building);
      }
      if (i % 4 === 0) {
        box(group, [0.15, 4.2, 0.15], [7.5, 2.1, -7], 0x83959a, true);
        box(group, [2.6, 1.2, 0.18], [7.5, 4, -7], palette.blue, true);
        box(group, [1.4, 0.12, 0.04], [7.5, 4.2, -6.9], palette.white);
        box(group, [0.9, 0.09, 0.04], [7.5, 3.88, -6.9], palette.white);
      }
      group.position.z = group.userData.baseZ;
      this.roadside.push(group);
    }
    this.batchScenery();
    for (let i = 0; i < 12; i++) {
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(40 + random() * 40, 35 + random() * 70, 5),
        material(i % 2 ? 0x8ba99b : 0x9db1a0),
      );
      mountain.position.set(70 + i * 16, 8, -190 - random() * 180);
      mountain.rotation.y = random() * 3;
      this.scene.add(mountain);
    }
    const island = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 6),
      material(0x8caeaa),
    );
    island.scale.set(65, 15, 30);
    island.position.set(-130, -4, -220);
    this.scene.add(island);
    for (let i = 0; i < 12; i++) {
      const wave = box(
        this.scene,
        [0.18, 0.015, 100],
        [-26 - i * 7, 0.02, -150 + i * 11],
        0x94c3c8,
      );
      wave.rotation.y = 0.015;
    }
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(10, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffedd0, fog: false }),
    );
    sun.position.set(-165, 118, -390);
    this.scene.add(sun);
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 7),
        new THREE.MeshBasicMaterial({ color: 0xe5eeee }),
      );
      cloud.scale.set(26 + i * 2, 3, 7);
      cloud.position.set(-140 + i * 65, 64 + (i % 3) * 13, -270);
      this.scene.add(cloud);
    }
  }
  private batchScenery() {
    const batches = new Map<
      string,
      {
        source: THREE.Mesh;
        shadow: boolean;
        items: { matrix: THREE.Matrix4; row: THREE.Group }[];
      }
    >();
    for (const row of this.roadside) {
      row.updateMatrixWorld(true);
      row.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
          return;
        const key = `${object.geometry.uuid}-${object.material.uuid}`;
        if (!batches.has(key))
          batches.set(key, { source: object, shadow: false, items: [] });
        const batch = batches.get(key)!;
        batch.shadow ||= object.castShadow;
        batch.items.push({ matrix: object.matrixWorld.clone(), row });
      });
    }
    for (const { source, shadow, items } of batches.values()) {
      const mesh = new THREE.InstancedMesh(
        source.geometry,
        source.material,
        items.length,
      );
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.sceneryBatches.push({ mesh, items });
      this.scene.add(mesh);
    }
  }
  resize() {
    const { clientWidth: width, clientHeight: height } =
      this.renderer.domElement.parentElement!;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  setQuality(high: boolean) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.75 : 1));
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => (m.needsUpdate = true));
      }
    });
    this.resize();
  }
  private modelFor(object: RoadObject) {
    const colors = [0xc87558, 0xd4d5cb, 0x547f91, 0xe8b65c, 0x566577, 0x7c9d82];
    const key = `${object.kind}-${object.color % 6}`;
    if (!this.templates.has(key)) {
      const template = isHazard(object.kind)
        ? makeHazard(object.kind)
        : object.kind === "motorcycle"
          ? makeMotorcycle()
          : isTraffic(object.kind)
            ? makeCar(colors[object.color % 6], false, object.kind === "truck")
            : makePickup(object.kind);
      if (isHazard(object.kind)) {
        const marker = new THREE.Mesh(
          new THREE.RingGeometry(1.45, 1.53, 32),
          new THREE.MeshBasicMaterial({
            color: object.kind === "pothole" ? 0xff9d52 : 0xffdb72,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.09;
        marker.name = "detection";
        template.add(marker);
        const beacon = new THREE.Mesh(
          new THREE.ConeGeometry(0.21, 0.4, 3),
          material(0xffce70),
        );
        beacon.rotation.z = Math.PI;
        beacon.position.set(0, 1.8, 0);
        beacon.name = "beacon";
        template.add(beacon);
      }
      this.templates.set(key, template);
    }
    return this.templates.get(key)!.clone(true);
  }
  render(game: Game, dt: number) {
    const menu = game.phase === "menu";
    const frozen = game.phase === "paused" || game.phase === "results";
    if (!frozen) this.motionTime += dt;
    if (menu && !this.reducedMotion) this.ambientDistance += dt * 9;
    const distance = menu ? this.ambientDistance : game.distance;
    for (let i = 0; i < 38; i++)
      for (let lane = 0; lane < 2; lane++) {
        this.dummy.position.set(
          (lane - 0.5) * LANE_WIDTH,
          0.077,
          25 - i * 9 + (distance % 9),
        );
        this.dummy.scale.set(0.11, 0.012, 4.2);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.markers.setMatrixAt(i * 2 + lane, this.dummy.matrix);
      }
    this.markers.instanceMatrix.needsUpdate = true;
    this.roadside.forEach((group) => {
      group.position.z =
        42 - ((((42 - group.userData.baseZ - distance) % 342) + 342) % 342);
    });
    for (const { mesh, items } of this.sceneryBatches) {
      items.forEach(({ matrix, row }, index) => {
        this.dummy.matrix.copy(matrix);
        this.dummy.matrix.elements[14] += row.position.z - row.userData.baseZ;
        mesh.setMatrixAt(index, this.dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    const crash = game.phase === "crashing" || game.phase === "results";
    const crashT = Math.min(game.crashTime, 2.5);
    this.player.position.set(
      menu ? 0 : game.x,
      0.02 + (crash ? Math.sin(Math.min(1, crashT) * Math.PI) * 0.7 : 0),
      menu ? 0 : game.playerZ,
    );
    const steer = menu ? 0 : laneX(game.lane) - game.x;
    this.player.rotation.set(
      crash ? -0.15 * Math.min(crashT, 1) : 0,
      crash ? -crashT * 0.95 : -steer * 0.06,
      crash ? Math.min(crashT * 0.22, 0.44) : steer * 0.025,
    );
    this.player.visible =
      !(this.hood && !menu && !crash) &&
      !(game.invulnerable > 0 && Math.floor(game.invulnerable * 10) % 2 === 0);
    const portrait = this.camera.aspect < 0.8;
    const cameraPosition = menu
      ? new THREE.Vector3(7, 6, 14)
      : this.hood && !crash
        ? new THREE.Vector3(game.x, 1.8, game.playerZ - 1.3)
        : new THREE.Vector3(
            game.x * (portrait ? 1 : 0.42),
            (portrait ? 6.8 : 5.9) + game.boost * 0.6,
            game.playerZ + (portrait ? 15 : 12.5) + (crash ? crashT : 0),
          );
    if (this.camera.aspect < 0.8 && menu) cameraPosition.set(8, 7, 18);
    this.cameraTarget.copy(cameraPosition);
    if (!this.reducedMotion && game.hitFlash > 0)
      this.cameraTarget.x +=
        Math.sin(this.motionTime * 70) * game.hitFlash * 0.3;
    this.camera.position.lerp(
      this.cameraTarget,
      1 - Math.exp(-dt * (menu ? 2.5 : 6)),
    );
    this.look.set(
      menu ? -7 : game.x * (portrait ? 0.8 : 0.5),
      menu ? 0.8 : 1,
      menu ? -4 : game.playerZ - (portrait ? 22 : 28),
    );
    this.camera.lookAt(this.look);
    const targetFov = this.hood ? 72 : 58 + game.boost * 6;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
    const active = new Set<number>();
    if (!menu)
      for (const object of game.objects) {
        active.add(object.id);
        if (!this.objects.has(object.id)) {
          const model = this.modelFor(object);
          this.objects.set(object.id, model);
          this.scene.add(model);
        }
        const model = this.objects.get(object.id)!;
        model.position.set(object.x, 0.07, object.z);
        if (isHazard(object.kind)) {
          model.getObjectByName("detection")!.visible =
            object.detected && !object.resolved;
          const beacon = model.getObjectByName("beacon")!;
          beacon.visible = object.detected && !object.resolved;
          beacon.position.y = 1.65 + Math.sin(this.motionTime * 4) * 0.12;
          model.visible = hazardVisible(object);
        } else if (!isTraffic(object.kind)) {
          model.rotation.y = this.motionTime * 1.4;
          model.position.y = 0.1 + Math.sin(this.motionTime * 3) * 0.15;
          model.visible = !object.resolved;
        } else {
          model.rotation.y = -(laneX(object.lane) - object.x) * 0.07;
          model.visible = !(
            object.resolved && Math.abs(object.z - game.playerZ) < 4
          );
        }
      }
    for (const [id, model] of this.objects)
      if (!active.has(id)) {
        this.scene.remove(model);
        this.objects.delete(id);
      }
    // The beam matches the gameplay detection bounds. Normal radar follows one
    // lane; Scan Boost covers the whole road and reaches farther ahead.
    this.scanner.visible =
      this.scannerEdges.visible =
      this.scanLine.visible =
        game.phase === "playing" || game.phase === "paused";
    const farX = game.wideScan ? 0 : laneX(game.lane);
    const farWidth = game.wideScan ? 5.24 : 1.6;
    const nearZ = game.playerZ - 2;
    const beam = [
      game.x - 1.05,
      0.09,
      nearZ,
      farX - farWidth,
      0.09,
      nearZ - 8,
      farX - farWidth,
      0.09,
      game.radarStartZ,
      farX + farWidth,
      0.09,
      game.radarStartZ,
      farX + farWidth,
      0.09,
      nearZ - 8,
      game.x + 1.05,
      0.09,
      nearZ,
    ];
    for (const geometry of [
      this.scanner.geometry,
      this.scannerEdges.geometry,
    ]) {
      const position = geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      position.array.set(beam);
      position.needsUpdate = true;
    }
    (this.scanner.material as THREE.MeshBasicMaterial).opacity = game.wideScan
      ? 0.18
      : 0.12;
    (this.scannerEdges.material as THREE.LineBasicMaterial).opacity =
      game.wideScan ? 0.85 : 0.55;
    const pulse = (this.motionTime * 0.6) % 1;
    const expansion = Math.min(1, (pulse * (nearZ - game.radarStartZ)) / 8);
    this.scanLine.position.set(
      game.x + (farX - game.x) * expansion,
      0.11,
      nearZ + (game.radarStartZ - nearZ) * pulse,
    );
    this.scanLine.scale.set(
      2.1 + (farWidth * 2 - 2.1) * expansion,
      0.025,
      0.15,
    );
    this.shield.visible = game.shield > 0 && !menu;
    this.shield.position
      .copy(this.player.position)
      .add(new THREE.Vector3(0, 0.9, 0));
    this.particles.visible = crash && crashT < 2.5;
    if (this.particles.visible) {
      for (let i = 0; i < 26; i++) {
        const angle = i * 2.4;
        this.dummy.position.set(
          game.x + Math.sin(angle) * crashT * (2 + (i % 4)),
          Math.max(0.12, 1.2 + crashT * (3 + (i % 3)) - 4 * crashT * crashT),
          game.playerZ + Math.cos(angle) * crashT * 4,
        );
        this.dummy.scale.set(0.07, 0.07, 0.17);
        this.dummy.rotation.set(crashT * i, angle, 0);
        this.dummy.updateMatrix();
        this.particles.setMatrixAt(i, this.dummy.matrix);
      }
      this.particles.instanceMatrix.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
  }
  getHazardVisibility(game: Game) {
    return game.objects
      .filter((object) => isHazard(object.kind))
      .map((object) => ({
        id: object.id,
        lane: object.lane,
        detected: object.detected,
        resolved: object.resolved,
        visible: this.objects.get(object.id)?.visible ?? false,
      }));
  }
}
