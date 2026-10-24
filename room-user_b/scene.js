// User B's room: 3D dollhouse of her living room, a sibling of lab/diorama-b (User A's room), whose code this
// started from. layout.json (written by work/gen/b_room/make_layout.py, laid out by hand from the set photos)
// holds the walls with their openings, the floor outline and every furniture piece; nothing the plan contains
// is typed in here. The per-user values (the seated figure, its seat, face decal, dizzy eyes, the shots' objects)
// are the named constants below.
//
// Axis mapping, metres: plan (x, y, z) -> three.js (x - origin[0], z, origin[1] - y). Plan y runs away from
// the camera-side wall, so that wall is at +z and the window wall at -z. Plan yaw (counter-clockwise seen
// from above) -> rotation.y, same angle. A piece's front (plan local -y) is its local +z.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------- asset table (swap models here)

// layout.json piece kind -> how it is drawn: a GLB in models/, scaled uniformly from its measured width (or
// height with fit: 'height'; see model()).
//   fit:         'width' (default) or 'height' (tall pieces: bookshelves, lamp, plant)
//   maxStretchX: extra widening allowed on top of the uniform fit
//   turn:        extra degrees about the vertical, for models whose front is not their local +z (the stools,
//                the director chair and the lamp were made from pictures of their -z side: camera_dir_model in
//                work/gen/b_apartment_3d_colour/final_fits/<name>.json). A quarter turn swaps width and depth.
//   heightOver:  how far the model may rise above the measured height (default MAX_HEIGHT_OVER)
//   onTop:       stands on the top of the one placed piece of that kind, at its own x, y (the lamp on the chest)
const ASSETS = {
  sofa:             { model: 'sofa' },
  coffee_table:     { model: 'coffee_table' },
  front_table:      { model: 'front_table' },
  armchair:         { model: 'armchair', fit: 'height' },
  chest_side_table: { model: 'chest_side_table' },
  table_lamp:       { model: 'table_lamp', fit: 'height', turn: 180, onTop: 'chest_side_table' },
  dining_set:       { model: 'dining_set', fit: 'height', turn: 90 },
  low_bookshelf:    { model: 'low_bookshelf' },
  potted_plant:     { model: 'potted_plant', fit: 'height' },
  tall_bookshelf:   { model: 'tall_bookshelf', fit: 'height' },
  director_chair:   { model: 'director_chair', fit: 'height', turn: 180 },
  lower_counter:    { model: 'lower_counter', turn: -90 },   // modelled with its long front along its local x
  upper_cabinets:   { model: 'upper_cabinets' },
  fridge:           { model: 'fridge', fit: 'height' },
  kitchen_island:   { model: 'kitchen_island', turn: -90 },
  bar_stool:        { model: ['bar_stool_1', 'bar_stool_2'], fit: 'height', turn: 180 },   // one model per stool
};
// The piece the figure sits on, the pieces the rug is laid under, and the ceiling lights hang over.
const SEAT_PIECE = 'sofa';
const RUG_UNDER = ['sofa', 'coffee_table'];
const CEILING_LIGHTS_OVER = ['coffee_table', 'kitchen_island'];

// The seated figure: GLB in models/ (TRELLIS units, front +z, feet at the bottom) and the prefix of its face
// pictures in assets/faces/ (<faces>_<expression>.png).
const FIGURE = { model: 'user_b_sit_phone', faces: 'user_b' };

// User B on the sofa's right cushion (as the viewer faces the sofa), measured on the sofa model by raycasting
// when the room loads (sofa local frame: x along the sofa, - = the viewer's left end; y up from the floor; z
// towards the front; metres) and on the seated mesh itself (GLB units, front +z, feet at the bottom). Her seat
// sinks `sink` into the cushion top and her scale is the one that puts her feet on the floor. She sits as far
// back as the backrest allows, but no further back than keeps the backs of her lower legs `calfClearance` in
// front of the sofa's front face. She is then turned `turn` degrees about the middle of her seat (negative:
// towards her right, where the Inside camera is), so the Inside view sees her face three-quarter rather than
// in profile (the face pictures are drawn from her right).
//   cushion: her centre between the arms' inner faces, as a share of that width (3/4: the right of two)
const FIGURE_SEAT = { cushion: 3 / 4, sink: 0.06, calfClearance: 0.02, turn: -15 };

// Her face: a picture from assets/faces/ (work/gen/b_character_user_b/make_faces.py cuts them from her
// expression sheets) projected onto the head as a decal. Frame in the GLB's own units: `centre` of the
// projection box (just behind the face surface, so the box reaches the far cheek), `towards` the projector
// (above and to her right, the three-quarter angle the sheets were drawn at), `up` the picture's up, `roll`
// degrees about `towards`, `size` [width, height, depth of the projection box]: the approved size and place of
// her face. `fold`: triangles turned away from the projector are kept while the cosine of their normal to it is
// above -fold (the folds beside the nose, on the far cheek and under the jaw, which the camera sees from beside
// the projector, would otherwise be holes); the back of the head is far below that. The model is made to fit the
// pictures (work/gen/b_character_user_b/room_model.py, which reads the same frame from
// work/gen/b_room/face_decal.json): its own nose, eye sockets and lips are flattened under them, and its painted
// face is wiped to plain skin, so the picture's features are the only ones.
const FACE_DECAL = {
  centre: [0.0045, 0.3426, -0.0492], towards: [-0.5357, 0.1972, 0.8210], up: [0.1078, 0.9804, -0.1652],
  roll: -7.55, size: [0.1240, 0.1586, 0.26], fold: 0.25,
};
const FACE_EXPRESSIONS = ['neutral', 'thinking', 'pleased', 'impatient', 'confused', 'delighted', 'angry', 'dizzy'];   // keys 1-8
// Changing expression cross-fades the face picture in two layers split across the nose (FACE_SPLIT: y as a share
// of the picture height, feather half-width): eyes and brows over the first `upper` share of `ms`, the mouth
// over the last `lower` share, so the eyes lead and the mouth follows. A change between two expressions listed
// in FACE_VIA passes through the middle one (each leg viaMs): neutral -> pleased -> delighted reads as a smile
// growing, not as two faces dissolving.
const FACE_FADE = { ms: 480, upper: 0.7, lower: 0.7, viaMs: 360 };
const FACE_SPLIT = { y: 0.6, feather: 0.07 };
const FACE_VIA = [['neutral', 'pleased', 'delighted'], ['thinking', 'pleased', 'delighted'], ['impatient', 'pleased', 'delighted']];
// Blinking: the blink picture (closed eyelids only) laid over the face for `ms` (closing takes `close` of it),
// every `every` ms (random in the range); not while the eyes are squeezed shut or spirals.
const FACE_BLINK = { ms: 170, close: 0.4, every: [2400, 5600], not: ['delighted', 'dizzy'] };
// Dizzy: each eye's spiral is redrawn turning (picture pixels: centre, semi-axes of the eyeball; turns per
// second; lineWidth as a share of the semi-axes), over the dizzy picture's painted spiral.
// eyes: work/gen/b_character_user_b/final/faces/dizzy_eyes.json.
const DIZZY_EYES = { eyes: [[166, 183, 37, 41], [328, 187, 30, 41]], turns: 3.2, speed: 0.9, line: 0.15,
  white: '#f3efe8', ink: '#221c1b' };
// Effects over her head, flat cards always facing the camera, in metres from her face centre (the decal's
// middle): `up` above it, `near` towards the camera (the fire stands in front of her hair, not inside it).
//   fire (angry): flames `size` [w, h], bottom `up` above the face centre, `flicker` ms per sway, at most `opacity`
//   (small and faint: quietly fuming, not her head on fire).
//   orbit (dizzy): stars and question marks circling `up` above the face centre, radius `radius`, `period` ms
//   a turn, each card `size` metres high.
//   sweat (confused): a drop `size` metres high at `at` on her near temple (a point of the face picture as
//   fractions, x from the ear side, y down), `near` metres towards the camera, bobbing `bob` metres every `period` ms.
//   slide (confused): a second drop sliding from `from` to `to` (face picture fractions) every `period` ms, down
//   the side of her face, fading in and out at the ends.
const FACE_FX = {
  fire: { size: [0.1, 0.12], up: 0.17, near: 0.22, flicker: 260, canvas: [128, 160], opacity: 0.7 },
  orbit: { up: 0.22, radius: 0.15, tilt: 0.025, period: 1700, size: 0.055, items: ['star', 'question', 'star', 'question', 'star'] },
  sweat: { at: [-0.02, 0.32], near: 0.02, size: 0.045, bob: 0.004, period: 1400 },
  slide: { from: [0.0, 0.4], to: [0.1, 0.72], near: 0.025, size: 0.04, period: 1800 },
};
const FACE_FX_OF = { angry: ['fire'], dizzy: ['orbit'], confused: ['sweat', 'slide'] };

// The window card (window, curtains and the wall around them, faded out at its edges) on the window wall, standing on the floor:
// `along` its centre in metres from the wall's end a, `h` its height (its width from the image aspect), `off`
// out from the wall face. The wall colour (COLOURS.wall) is the card's own wall colour, so its edges do not show.
const WINDOW_CARD = { card: 'window_wall', wall: 'window', along: 3.16, h: 2.4, off: 0.01 };
// Brick backsplash on the kitchen wall between the counter top and the upper cabinets (LAYOUT.md), as long as
// the placed `over` piece.
const KITCHEN_BRICK = { wall: 'kitchen', over: 'lower_counter', bottom: 0.88, top: 1.47, proud: 0.012 };
// The front door: a painted panel door in its opening (DOOR colours); the open bedroom doorway shows a dim
// room behind it (BEDROOM_BEYOND: colour, depth behind the wall).
const DOOR = { leaf: '#f4efe6', panel: '#e8e1d4', line: '#cfc4b2', knob: '#b9a37a' };
const BEDROOM_BEYOND = { colour: '#8a9aa6', floor: '#a9805a', depth: 1.4 };

// Camera-side wall (TV + desks): 'none' | 'low' (LOW_WALL_H) | 'full' (fades out as the camera comes in).
const CAMERA_WALL = 'low';
const LOW_WALL_H = 0.9;

// Embedded in the site's Demo page (index.html?embed): starts in the Inside view without the toggle, she
// breathes (BREATH), and the page drives it by postMessage (EMBED_SHOTS below). Opened on its own, none of this runs.
const EMBED = new URLSearchParams(location.search).has('embed') && window.parent !== window;
const asset = (path) => new URL(path, import.meta.url).href;  // resolve next to this file, not the page

const layout = await (await fetch(asset('./layout.json'))).json();
const [OX, OY] = layout.origin;
const SLAB = 0.22;   // floor slab thickness drawn below floor level

const toV = (x, y, z = 0) => new THREE.Vector3(x - OX, z, OY - y);   // plan -> three.js
const yawRad = (deg) => THREE.MathUtils.degToRad(deg);

// Colours: the walls take the window card's own grey-blue (as in the set photos), warm planks, red brick.
const COLOURS = {
  wall: '#a4b2b1',
  wallCut: '#c9d2d0',
  trim: '#fcf9f3',
  slabCut: '#d8c6ad',
  step: '#c99a6a',
  brick: '#b06c52',
  mortar: '#e2d3bf',
  plank: '#cf9a66',
  glass: '#dfe9ee',
  background: '#f8f4ec',
};

// ---------------------------------------------------------------- renderer, scene, light

const stage = document.getElementById('stage');
const button = document.getElementById('toggle');
if (EMBED) button.hidden = true;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.touchAction = 'none';
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOURS.background);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);

// Soft, bright light: a warm sky fill and a low-intensity room environment keep shadows light; one soft
// key casts them; screen-space ambient occlusion (AO below) darkens contacts and corners.
const LIGHT = { hemi: 1.5, key: 1.9, fill: 0.45, env: 0.12, shadowMap: 2048 };
// resolution: AO buffers relative to the drawing buffer (half keeps the pass cheap at pixel ratio 2).
const AO = { radius: 0.6, distanceExponent: 1.2, thickness: 1.5, scale: 1.8, samples: 16, blend: 0.9, resolution: 0.5 };

scene.add(new THREE.HemisphereLight('#fff8ee', '#e6d1b4', LIGHT.hemi));
const key = new THREE.DirectionalLight('#fff0dc', LIGHT.key);
key.position.set(4, 9, 6);
key.castShadow = true;
key.shadow.mapSize.set(LIGHT.shadowMap, LIGHT.shadowMap);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);
const fill = new THREE.DirectionalLight('#fff4e6', LIGHT.fill);
fill.position.set(-5, 5, 7);
scene.add(fill);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
pmrem.dispose();

// Shadow camera fitted tightly around the room box (crop rectangle, floor slab to wall top) in light space.
function fitShadowCamera(light, minPlan, maxPlan, bottom, top) {
  const view = new THREE.Matrix4().lookAt(light.position, light.target.position, THREE.Object3D.DEFAULT_UP)
    .setPosition(light.position).invert();
  const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = lo.clone().negate();
  for (const x of [minPlan[0], maxPlan[0]]) for (const y of [minPlan[1], maxPlan[1]]) for (const z of [bottom, top]) {
    const v = toV(x, y, z).applyMatrix4(view);
    lo.min(v);
    hi.max(v);
  }
  const pad = 0.2;
  Object.assign(light.shadow.camera, { left: lo.x - pad, right: hi.x + pad, bottom: lo.y - pad, top: hi.y + pad, near: Math.max(0.1, -hi.z - pad), far: -lo.z + pad });
  light.shadow.camera.updateProjectionMatrix();
}
const crop0 = layout.crop;
fitShadowCamera(key, [crop0[0], crop0[1]], [crop0[2], crop0[3]], -SLAB, Math.max(...layout.walls.map((w) => w.height)));

// ---------------------------------------------------------------- procedural textures, materials

const maxAniso = renderer.capabilities.getMaxAnisotropy();

function canvasTexture(size, draw, colour = true) {
  const c = document.createElement('canvas');
  c.width = size[0];
  c.height = size[1];
  draw(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  if (colour) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Deterministic pseudo-random so the room looks the same on every load.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Low-amplitude clay noise for bump maps: soft blobs over mid grey.
const clayBump = canvasTexture([512, 512], (g, w, h) => {
  g.fillStyle = '#808080';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const x = rand() * w, y = rand() * h, r = 4 + rand() * 22;
    const v = 128 + (rand() - 0.5) * 36;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}, false);

function shade(hex, f) {
  const c = new THREE.Color(hex);
  return `#${c.multiplyScalar(f).getHexString()}`;
}

// Planks 0.14 m wide, staggered lengths; one tile = 2 m x 2 m. Floor UVs are in metres.
const PLANK_TILE = 2;
const floorTex = canvasTexture([1024, 1024], (g, w, h) => {
  const px = w / PLANK_TILE;
  const rows = Math.round(h / (0.14 * px));
  const plankW = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 1.2 * px;
    while (x < w) {
      const len = (0.8 + rand() * 0.9) * px;
      g.fillStyle = shade(COLOURS.plank, 0.9 + rand() * 0.18);
      g.fillRect(x, r * plankW, len, plankW);
      g.fillStyle = 'rgba(110,64,30,0.35)';
      g.fillRect(x, r * plankW, 2, plankW);
      x += len;
    }
    g.fillStyle = 'rgba(110,64,30,0.32)';
    g.fillRect(0, r * plankW, w, 2);
  }
});
floorTex.repeat.set(1 / PLANK_TILE, 1 / PLANK_TILE);

// Bricks 0.21 m x 0.07 m with 1 cm mortar; one tile = 1 m x 0.56 m (8 courses).
const BRICK_TILE = [1, 0.56];
const brickTex = canvasTexture([512, 288], (g, w, h) => {
  g.fillStyle = COLOURS.mortar;
  g.fillRect(0, 0, w, h);
  const courses = 8, bw = w / (1 / 0.22), bh = h / courses, gap = w * 0.01;
  for (let r = 0; r < courses; r++) {
    for (let x = (r % 2) * -bw / 2; x < w; x += bw) {
      g.fillStyle = shade(COLOURS.brick, 0.84 + rand() * 0.28);
      g.fillRect(x + gap / 2, r * bh + gap / 2, bw - gap, bh - gap);
    }
  }
});
brickTex.repeat.set(1 / BRICK_TILE[0], 1 / BRICK_TILE[1]);

const matte = (params) => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...params });
const clay = (params) => matte({ bumpMap: clayBump, bumpScale: 0.5, ...params });

const wallMat = clay({ color: COLOURS.wall });
const wallCut = clay({ color: COLOURS.wallCut });
const trimMat = clay({ color: COLOURS.trim, bumpScale: 0.3 });
const floorMat = clay({ map: floorTex, bumpScale: 0.25 });
const slabCut = clay({ color: COLOURS.slabCut });
const stepMat = clay({ color: COLOURS.step, bumpScale: 0.3 });
const brickMat = clay({ map: brickTex, bumpScale: 0.7 });
const glassMat = matte({ color: COLOURS.glass, side: THREE.DoubleSide });

// Camera-wall materials of their own, so that wall alone can fade.
const cameraWallMat = clay({ color: COLOURS.wall, transparent: CAMERA_WALL === 'full' });
const cameraWallCut = clay({ color: COLOURS.wallCut, transparent: CAMERA_WALL === 'full' });
const cameraTrimMat = clay({ color: COLOURS.trim, bumpScale: 0.3, transparent: CAMERA_WALL === 'full' });

function addMesh(geo, mat, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- floor

// Raised floors (layout.json platforms, optional): this room has none.
const platforms = layout.platforms ?? [];
function insidePoly(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[j];
    if ((y0 > y) !== (y1 > y) && x < x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)) hit = !hit;
  }
  return hit;
}
const floorHeightAt = (x, y) => Math.max(0, ...platforms.filter((p) => insidePoly(p.outline, x, y)).map((p) => p.height));

// Outline in plan coordinates relative to the origin; extruded upwards, then laid flat (shape y -> -z).
function slab(outline, bottom, top, mats) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x - OX, y - OY)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2).translate(0, bottom, 0);
  return addMesh(geo, mats, { cast: false });
}

slab(layout.floor.outline, -SLAB, 0, [floorMat, slabCut]);
for (const p of platforms) slab(p.outline, 0.001, p.height, [floorMat, stepMat]);

// ---------------------------------------------------------------- walls

// Wall frame: origin at end a on the centreline, x along the wall, y up, z across (thickness).
function wallFrame(w) {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const ux = (w.b[0] - w.a[0]) / len, uy = (w.b[1] - w.a[1]) / len;
  const X = new THREE.Vector3(ux, 0, -uy), Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(toV(w.a[0], w.a[1]));
  // +1 when the inner side (towards the room, layout `normal`) is the frame's +z.
  const inner = Math.sign(Z.x * w.normal[0] - Z.z * w.normal[1]);
  return { m, len, inner };
}

function wallHeight(w) {
  if (w.role !== 'camera') return w.height;
  return CAMERA_WALL === 'low' ? LOW_WALL_H : w.height;
}

const cameraWalls = [];

function buildWall(w) {
  if (w.role === 'camera' && CAMERA_WALL === 'none') return;
  const { m, len } = wallFrame(w);
  const h = wallHeight(w);
  const shape = new THREE.Shape([
    new THREE.Vector2(0, -SLAB), new THREE.Vector2(len, -SLAB), new THREE.Vector2(len, h), new THREE.Vector2(0, h),
  ]);
  for (const o of w.openings) {
    const bottom = Math.max(o.bottom, 0.002), top = Math.min(o.top, h - 0.002);
    if (top <= bottom) continue;
    shape.holes.push(new THREE.Path([
      new THREE.Vector2(o.from, bottom), new THREE.Vector2(o.from, top),
      new THREE.Vector2(o.to, top), new THREE.Vector2(o.to, bottom),
    ]));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w.thickness, bevelEnabled: false });
  geo.translate(0, 0, -w.thickness / 2).applyMatrix4(m);
  const mats = w.role === 'camera' ? [cameraWallMat, cameraWallCut] : [wallMat, wallCut];
  const mesh = addMesh(geo, mats);
  if (w.role === 'camera') cameraWalls.push(w);
  return mesh;
}

// A thin box on a wall face: along-range [from, to], height range [bottom, top], standing `proud` off the
// inner face. Used for baseboards and the brick band.
function wallFaceBox(w, from, to, bottom, top, proud, mat, uvScale = null) {
  const { m, inner } = wallFrame(w);
  const geo = new THREE.BoxGeometry(to - from, top - bottom, proud);
  if (uvScale) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (to - from) * uvScale[0], uv.getY(i) * (top - bottom) * uvScale[1]);
  }
  geo.translate((from + to) / 2, (bottom + top) / 2, inner * (w.thickness / 2 + proud / 2)).applyMatrix4(m);
  return addMesh(geo, mat, { cast: false });
}

// A point on the inner face: along the wall, at height y, `off` metres out from the face.
function wallPoint(w, along, y, off) {
  const { m, inner } = wallFrame(w);
  return new THREE.Vector3(along, y, inner * (w.thickness / 2 + off)).applyMatrix4(m);
}

// Rotation that turns a plane (front +z) to face out of the wall's inner side.
function wallFacing(w) {
  const n = new THREE.Vector3(w.normal[0], 0, -w.normal[1]);
  return Math.atan2(n.x, n.z);
}

for (const w of layout.walls) buildWall(w);

// Corner fillers where two walls meet at an angle.
for (const j of layout.joints) {
  const onlyCamera = j.roles.every((r) => r === 'camera');
  if (onlyCamera && CAMERA_WALL === 'none') continue;
  const h = onlyCamera ? wallHeight({ role: 'camera', height: j.height }) : j.height;
  slab(j.outline, -SLAB, h, onlyCamera ? [cameraWallCut, cameraWallCut] : [wallCut, wallMat]).castShadow = true;
}

// Trim profiles: [out from the wall face, up from the profile bottom] in metres, extruded along a wall.
const BASEBOARD = [[0, 0], [0.018, 0], [0.018, 0.085], [0.008, 0.11], [0, 0.11]];
const CROWN = [[0, 0], [0.012, 0], [0.016, 0.018], [0.05, 0.062], [0.075, 0.07], [0.075, 0.095], [0, 0.095]];
const CASING = { width: 0.075, proud: 0.022, sill: 0.04 };

// A profile run along the inner face of wall w over [from, to], profile bottom at height `bottom`.
// Profile x -> out of the face, profile y -> up, extrusion -> along the wall (a right-handed basis).
function wallTrim(w, from, to, bottom, profile, mat) {
  const { m, inner } = wallFrame(w);
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: to - from, bevelEnabled: false });
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, inner), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-inner, 0, 0),
  ).setPosition(inner > 0 ? to : from, bottom, inner * (w.thickness / 2));
  geo.applyMatrix4(basis).applyMatrix4(m);
  return addMesh(geo, mat, { cast: false });
}

const trimFor = (w) => (w.role === 'camera' ? cameraTrimMat : trimMat);

// Baseboards along each wall's inner face, broken at floor-level openings, at the local floor height.
for (const w of layout.walls) {
  if (w.role === 'camera' && CAMERA_WALL === 'none') continue;
  const cuts = w.openings.filter((o) => o.bottom < 0.1).map((o) => [o.from, o.to]).sort((a, b) => a[0] - b[0]);
  let start = 0;
  for (const [s, e] of [...cuts, [w.length, w.length]]) {
    if (s - start > 0.05) {
      const p = wallPoint(w, (start + s) / 2, 0, 0.1);
      const floorY = floorHeightAt(p.x + OX, OY - p.z);
      wallTrim(w, start, s, floorY, BASEBOARD, trimFor(w));
    }
    start = Math.max(start, e);
  }
}

// Crown moulding under the top of every full-height wall.
for (const w of layout.walls) {
  if (w.role === 'camera' && CAMERA_WALL !== 'full') continue;
  wallTrim(w, 0, w.length, wallHeight(w) - CROWN.at(-1)[1], CROWN, trimFor(w));
}

// Flat casings around the doors and doorways and around each wall's group of windows (with a sill). The
// window wall is left bare: its window card brings its own frame.
for (const w of layout.walls) {
  const groups = [...w.openings.filter((o) => o.kind === 'door' || o.kind === 'opening').map((o) => [o])];
  const windows = w.openings.filter((o) => o.kind === 'window');
  if (windows.length && w.role !== 'window') groups.push(windows);
  for (const g of groups) {
    const from = Math.min(...g.map((o) => o.from)), to = Math.max(...g.map((o) => o.to));
    const bottom = Math.min(...g.map((o) => o.bottom)), top = Math.max(...g.map((o) => o.top));
    const { width: cw, proud } = CASING;
    const mat = trimFor(w);
    wallFaceBox(w, from - cw, from, bottom, top + cw, proud, mat);
    wallFaceBox(w, to, to + cw, bottom, top + cw, proud, mat);
    wallFaceBox(w, from - cw, to + cw, top, top + cw, proud, mat);
    if (bottom > 0.1) wallFaceBox(w, from - cw - 0.02, to + cw + 0.02, bottom - cw * 0.6, bottom, CASING.sill, mat);
  }
}

// ---------------------------------------------------------------- cards, models

const texLoader = new THREE.TextureLoader();
async function loadCardTexture(name) {
  const tex = await texLoader.loadAsync(asset(`./assets/${name}.png`));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}
const cardMaterial = (tex) => matte({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });

const gltfLoader = new GLTFLoader();

// The GLBs carry no normals (GLTFLoader then shades them flat from screen derivatives, which the AO
// normal pass cannot see): smooth vertex normals are computed here instead.
async function loadGlb(name, roughness) {
  const obj = (await gltfLoader.loadAsync(asset(`./models/${name}.glb`))).scene;
  obj.traverse((m) => {
    if (!m.isMesh) return;
    if (!m.geometry.attributes.normal) {
      m.geometry.computeVertexNormals();
      m.material.flatShading = false;
      m.material.needsUpdate = true;
    }
    m.castShadow = true;
    m.receiveShadow = true;
    m.material.metalness = 0;
    m.material.roughness = roughness;
  });
  return obj;
}

// Wraps a scaled object in a group whose origin is the centre of its footprint at its lowest point.
function standOnOrigin(obj) {
  const box3 = new THREE.Box3().setFromObject(obj);
  const centre = box3.getCenter(new THREE.Vector3());
  obj.position.set(-centre.x, -box3.min.y, -centre.z);
  const holder = new THREE.Group();
  holder.add(obj);
  return holder;
}

// GLB scaled uniformly to fit inside the measured box (plan size_x, size_z, size_y -> three x, y, z), so its
// modelled proportions stay; maxStretchX widens it further, capped at the measured width. Centred on the
// footprint, standing on the floor, turned to the measured yaw.
// One scale from the piece's main measured dimension (`fit`: its width, or its height for tall pieces;
// depth is ignored because models carry props and run deeper than the plan boxes), capped so the height
// stays within heightOver (default MAX_HEIGHT_OVER) of the measured height; then up to maxStretchX widening to reach the width. Returns
// the holder and the model's scaled size.
const MAX_HEIGHT_OVER = 1.15;
async function model(name, p, [W, , H], turn = 0, maxStretchX = 1, fit = 'width', heightOver = MAX_HEIGHT_OVER) {
  const obj = await loadGlb(name, 1);
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const s = Math.min(fit === 'height' ? H / size.y : W / size.x, heightOver * H / size.y);
  obj.scale.set(s * Math.min(maxStretchX, Math.max(1, W / (s * size.x))), s, s);
  const holder = standOnOrigin(obj);
  holder.position.copy(toV(p.x, p.y, p.z));
  holder.rotation.y = yawRad(p.yaw_deg + turn);
  scene.add(holder);
  return { holder, size: new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()) };
}

// The measured box [width, depth, height] in the frame of the model: a quarter turn swaps width and depth.
function measuredSize(p, spec) {
  const quarter = Math.abs(Math.round((spec.turn ?? 0) / 90)) % 2 === 1;
  const [W, D] = quarter ? [p.size[1], p.size[0]] : p.size;
  return [W, D, p.size[2]];
}

// Height of the top of a placed piece ({ holder } from model()) at plan point (x, y): a ray straight down.
function topAt({ holder }, x, y, what) {
  holder.updateMatrixWorld(true);
  const from = toV(x, y, 5);
  const hit = new THREE.Raycaster(from, new THREE.Vector3(0, -1, 0)).intersectObject(holder, true)[0];
  if (!hit) throw new Error(`${what}: no top surface under plan point ${x}, ${y}`);
  return hit.point.y;
}

// The sofa model at x (sofa local): seat top and front edge, the front face below the seat, and the
// backrest's front at each height above the seat (null above the backrest).
const SEAT_RAY_STEP = 0.01;
function measureSeat({ holder, size }) {
  holder.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const cast = (origin, dir) => {
    ray.set(holder.localToWorld(origin), dir.transformDirection(holder.matrixWorld));
    const hit = ray.intersectObject(holder, true)[0];
    return hit ? holder.worldToLocal(hit.point) : null;
  };
  const down = (x, z) => cast(new THREE.Vector3(x, size.y + 1, z), new THREE.Vector3(0, -1, 0))?.y ?? null;
  const fromFront = (x, y) => cast(new THREE.Vector3(x, y, size.z + 1), new THREE.Vector3(0, 0, -1))?.z ?? null;
  const steps = (a, b) => Array.from({ length: Math.floor((b - a) / SEAT_RAY_STEP) + 1 }, (_, i) => a + i * SEAT_RAY_STEP);

  // Across the front half of the seat: the arms high at both ends, the seat cushions low between them.
  const across = steps(-size.x / 2, size.x / 2).map((x) => [x, down(x, size.z / 6)]).filter(([, h]) => h !== null);
  const armTop = Math.max(...across.map(([, h]) => h));
  const middle = across.filter(([x]) => Math.abs(x) < size.x / 4).map(([, h]) => h).sort((a, b) => a - b);
  const seatLevel = middle[Math.floor(middle.length / 2)];
  const seatXs = across.filter(([, h]) => h < (armTop + seatLevel) / 2).map(([x]) => x);
  if (!seatXs.length || armTop - seatLevel < 0.1) throw new Error(`sofa model: no arms found above the seat (arm top ${armTop.toFixed(3)}, seat ${seatLevel.toFixed(3)})`);
  const x = Math.min(...seatXs) + FIGURE_SEAT.cushion * (Math.max(...seatXs) - Math.min(...seatXs));

  // Front to back at x: the seat is the frontmost run of hits near the seat level.
  const along = steps(-size.z / 2, size.z / 2).reverse().map((z) => [z, down(x, z)]);
  const run = [];
  for (const [z, h] of along) {
    if (h === null && !run.length) continue;
    if (h === null || h > seatLevel + 0.08) break;
    run.push([z, h]);
  }
  if (!run.length) throw new Error(`sofa model: no seat surface found at x ${x.toFixed(3)}`);
  const seatTop = Math.max(...run.map(([, h]) => h));
  const below = steps(0.05, seatTop - 0.15).map((y) => fromFront(x, y)).filter((z) => z !== null);
  if (!below.length) throw new Error(`sofa model: no front face found below the seat at x ${x.toFixed(3)}`);
  const frontFace = Math.max(...below);
  const backrestY0 = seatTop + 0.04;   // just above the seat cushion's own crown
  const backrest = steps(backrestY0, size.y).map((y) => fromFront(x, y));
  const backrestAt = (y) => (y < backrestY0 ? null : backrest[Math.round((y - backrestY0) / SEAT_RAY_STEP)] ?? null);
  return { x, seatTop, frontFace, backrestAt };
}

// Seat points of the seated mesh (GLB units): feet bottom, the underside of the seat (lowest point in the back
// half of the seat's depth, behind SEAT_FROM_BACK of the mesh depth: her skirt hangs lower further forward), the
// back of the lower legs (the points more than SHIN_BELOW of the mesh height below the seat).
const SEAT_FROM_BACK = 0.25, SHIN_BELOW = 0.05;
function measureFigure(pos) {
  const v = new THREE.Vector3();
  const pts = Array.from({ length: pos.count }, (_, i) => v.fromBufferAttribute(pos, i).clone());
  const box = new THREE.Box3().setFromPoints(pts);
  const zMid = (box.min.z + box.max.z) / 2, height = box.max.y - box.min.y;
  const zSeat = box.min.z + SEAT_FROM_BACK * (box.max.z - box.min.z);
  const seatY = Math.min(...pts.filter((p) => p.z < zSeat).map((p) => p.y));
  const shin = pts.filter((p) => p.y < seatY - SHIN_BELOW * height);
  if (shin.some((p) => p.z < zMid)) throw new Error('figure model: points well below the seat behind the middle of its depth; it is not the seated pose');
  const hips = pts.filter((p) => p.y >= seatY && p.y < seatY + 0.1 * height);
  return {
    feetY: box.min.y, seatY, zMid,
    shinBackZ: Math.min(...shin.map((p) => p.z)),
    centreX: (Math.min(...hips.map((p) => p.x)) + Math.max(...hips.map((p) => p.x))) / 2,
    seatZ: hips.filter((p) => p.z < zMid).reduce((sum, p) => sum + p.z, 0) / hips.filter((p) => p.z < zMid).length,
    back: pts.filter((p) => p.z < zMid && p.y >= seatY),
  };
}

// Scale and depth offset that seat the mesh: feet on the floor; back against the backrest, or further
// forward if that is what keeps the lower legs clear of the sofa front.
function fitFigure(fig, seat) {
  const hipY = seat.seatTop - FIGURE_SEAT.sink;
  const s = hipY / (fig.seatY - fig.feetY);
  const y0 = hipY - fig.seatY * s;
  let dz = -Infinity;
  for (const p of fig.back) {
    const zb = seat.backrestAt(y0 + p.y * s);
    if (zb !== null) dz = Math.max(dz, zb - p.z * s);
  }
  if (dz === -Infinity) throw new Error('sofa model: no backrest found behind the figure');
  dz = Math.max(dz, seat.frontFace + FIGURE_SEAT.calfClearance - fig.shinBackZ * s);
  return { s, y0, dz };
}

// ---- her face: the picture on the decal is drawn into a canvas (face.canvas) each frame something on it moves:
// the cross-fade between two expressions, a blink, the dizzy spirals.
const face = {
  pictures: {},      // name -> { upper, lower, source }: the expression picture, and split at FACE_SPLIT (canvases)
  blink: null,       // the closed-eyelid picture
  canvas: null, g: null, texture: null,
  base: null, baseG: null,   // the cross-faded picture before blink and spirals, for starting a new fade from
  from: null,        // { upper, lower } snapshot the current fade starts from
  shown: 'neutral',  // the expression faded to (or being faded to)
  legs: [],          // expressions still to fade to, after the current one (FACE_VIA)
  start: -Infinity, ms: 0, legMs: 0,
  fxFrom: {}, fxTo: {}, fx: {},   // effect weights at the fade's start, end, now
  hold: null,        // debug (?exprT, ?blink): a fixed fade progress and blink closure, no automatic blinking
  nextBlink: 0, blinkStart: -Infinity, blinkWas: 0, drawnT: 1,
  spinSpeed: DIZZY_EYES.speed * 2 * Math.PI,   // radians per second
  dirty: true,
};
let faceDecal = null;
const fxCards = { fire: null, orbit: [], sweat: null, slide: null };
const facePoints = { temple: new THREE.Vector3(), slideFrom: new THREE.Vector3(), slideTo: new THREE.Vector3() };   // mesh-local, FACE_FX sweat and slide

const faceFxOf = (name) => FACE_FX_OF[name] ?? [];
const smooth = (t) => t * t * (3 - 2 * t);

// Fades her face to one of FACE_EXPRESSIONS (and its effects, FACE_FX_OF) over FACE_FADE.ms.
export function setExpression(name) {
  if (!FACE_EXPRESSIONS.includes(name)) throw new Error(`setExpression: unknown expression '${name}' (expected one of ${FACE_EXPRESSIONS.join(', ')})`);
  if (!faceDecal) throw new Error('setExpression: the figure is not in this scene');
  const via = FACE_VIA.find((v) => (v[0] === face.shown && v[2] === name) || (v[2] === face.shown && v[0] === name));
  face.legs = via ? [via[1], name] : [name];
  face.legMs = via ? FACE_FADE.viaMs : FACE_FADE.ms;
  startFaceLeg(performance.now());
}
window.setExpression = setExpression;

// Starts fading from what the face shows now to the next of face.legs.
function startFaceLeg(now) {
  const name = face.legs.shift();
  face.from = splitPicture(face.base);
  face.shown = name;
  face.start = now;
  face.ms = face.legMs;
  face.fxFrom = { ...face.fx };
  face.fxTo = Object.fromEntries(Object.keys(FACE_FX).map((k) => [k, faceFxOf(name).includes(k) ? 1 : 0]));
  face.dirty = true;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// A picture's upper (eyes, brows) and lower (mouth) layers: alpha multiplied by complementary ramps across
// FACE_SPLIT, so drawing both additively gives the picture back.
function splitPicture(img) {
  const { width: w, height: h } = img;
  const y0 = (FACE_SPLIT.y - FACE_SPLIT.feather) * h, y1 = (FACE_SPLIT.y + FACE_SPLIT.feather) * h;
  const layer = (keepTop) => {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const ramp = g.createLinearGradient(0, y0, 0, y1);
    ramp.addColorStop(0, `rgba(0,0,0,${keepTop ? 1 : 0})`);
    ramp.addColorStop(1, `rgba(0,0,0,${keepTop ? 0 : 1})`);
    g.fillStyle = ramp;
    g.fillRect(0, 0, w, h);
    return c;
  };
  return { upper: layer(true), lower: layer(false) };
}

// Fade progress of the eyes-and-brows layer and of the mouth layer at `now` (0..1 each).
function faceFadeAt(now) {
  const t = face.hold?.t ?? THREE.MathUtils.clamp((now - face.start) / face.ms, 0, 1);
  const lead = THREE.MathUtils.clamp(t / FACE_FADE.upper, 0, 1);
  const lag = THREE.MathUtils.clamp((t - (1 - FACE_FADE.lower)) / FACE_FADE.lower, 0, 1);
  return [smooth(lead), smooth(lag), t];
}

// How far closed the eyelids are at `now` (0..1), scheduling the next blink.
function blinkAt(now) {
  if (face.hold) return face.hold.blink;
  if (FACE_BLINK.not.includes(face.shown)) {
    face.nextBlink = Math.max(face.nextBlink, now + 600);
    return 0;
  }
  if (now >= face.nextBlink && now - face.blinkStart > FACE_BLINK.ms) {
    face.blinkStart = now;
    const [a, b] = FACE_BLINK.every;
    face.nextBlink = now + a + Math.random() * (b - a);
  }
  const t = (now - face.blinkStart) / FACE_BLINK.ms;
  if (t < 0 || t > 1) return 0;
  return t < FACE_BLINK.close ? smooth(t / FACE_BLINK.close) : 1 - smooth((t - FACE_BLINK.close) / (1 - FACE_BLINK.close));
}

// The dizzy spirals, turned by `angle` radians, over whatever the canvas holds (only where it is opaque).
function drawSpirals(g, angle, alpha) {
  const d = DIZZY_EYES;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha;
  for (const [x, y, rx, ry] of d.eyes) {
    g.save();
    g.translate(x, y);
    g.scale(rx, ry);
    g.beginPath();
    g.ellipse(0, 0, 1, 1, 0, 0, 2 * Math.PI);
    g.fillStyle = d.white;
    g.fill();
    g.clip();
    g.rotate(angle);
    g.beginPath();
    const steps = 160, end = d.turns * 2 * Math.PI;
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * end, r = 0.92 * (i / steps);
      g.lineTo(r * Math.cos(th), r * Math.sin(th));
    }
    g.lineWidth = d.line;
    g.lineCap = 'round';
    g.strokeStyle = d.ink;
    g.stroke();
    g.restore();
  }
  g.restore();
}

// Redraws the face canvas and moves the effects for this frame.
function updateFace(now) {
  if (!faceDecal) return;
  let [up, low, t] = faceFadeAt(now);
  if (t >= 1 && face.legs.length && !face.hold) {
    startFaceLeg(now);
    [up, low, t] = faceFadeAt(now);
  }
  for (const k of Object.keys(FACE_FX)) face.fx[k] = THREE.MathUtils.lerp(face.fxFrom[k] ?? 0, face.fxTo[k] ?? 0, up);
  const blink = blinkAt(now);
  const spin = face.fx.orbit > 0.001;   // the orbit's weight is the dizzy expression's
  // Also once more after a fade or blink ends, so its last frame is the finished picture.
  if (face.dirty || t < 1 || face.drawnT < 1 || blink > 0 || spin || face.blinkWas > 0) {
    const to = face.pictures[face.shown], { width: w, height: h } = face.canvas;
    const b = face.baseG;
    b.clearRect(0, 0, w, h);
    b.globalCompositeOperation = 'lighter';
    for (const [layer, share] of [[face.from.upper, 1 - up], [to.upper, up], [face.from.lower, 1 - low], [to.lower, low]]) {
      if (share <= 0) continue;
      b.globalAlpha = share;
      b.drawImage(layer, 0, 0);
    }
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    const g = face.g;
    g.clearRect(0, 0, w, h);
    g.drawImage(face.base, 0, 0);
    if (spin) drawSpirals(g, (now / 1000) * face.spinSpeed, face.fx.orbit);
    if (blink > 0) {
      g.globalAlpha = blink;
      g.drawImage(face.blink, 0, 0);
      g.globalAlpha = 1;
    }
    face.texture.needsUpdate = true;
    face.dirty = false;
    face.blinkWas = blink;
    face.drawnT = t;
  }
  updateFaceFx(now);
}

// ---- effects over her head
function fxCanvasTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A camera-facing card (kept out of the AO pass and shadows), `h` metres high.
function fxCard(canvas, h) {
  const mat = new THREE.MeshBasicMaterial({ map: fxCanvasTexture(canvas), transparent: true, depthWrite: false, opacity: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((h * canvas.width) / canvas.height, h), mat);
  mesh.userData.noAO = true;
  mesh.renderOrder = 10;
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

// Cartoon flames: five tongues swaying with time (ms), drawn into canvas c.
function drawFire(c, now) {
  const g = c.getContext('2d'), { width: w, height: h } = c;
  g.clearRect(0, 0, w, h);
  const tongues = [[0.2, 0.55, 0.0], [0.38, 0.8, 1.7], [0.52, 0.96, 3.1], [0.67, 0.78, 4.4], [0.82, 0.5, 5.6]];
  const s = now / FACE_FX.fire.flicker;
  const layer = (scaleW, scaleH, stops) => {
    for (const [x, hh, ph] of tongues) {
      const sway = Math.sin(s + ph) * 0.06 + Math.sin(2.3 * s + 2 * ph) * 0.03;
      const top = h * (1 - scaleH * hh * (0.86 + 0.14 * Math.sin(1.7 * s + ph)));
      const cx = x * w, half = w * 0.13 * scaleW, base = h * 0.98;
      const grad = g.createLinearGradient(0, base, 0, top);
      stops.forEach(([o, col]) => grad.addColorStop(o, col));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx - half, base);
      g.bezierCurveTo(cx - half * 1.2, base - (base - top) * 0.45, cx + sway * w - half * 0.4, top + (base - top) * 0.3, cx + sway * w * 1.6, top);
      g.bezierCurveTo(cx + sway * w + half * 0.5, top + (base - top) * 0.35, cx + half * 1.2, base - (base - top) * 0.45, cx + half, base);
      g.closePath();
      g.fill();
    }
  };
  layer(1.25, 1, [[0, '#e8341c'], [0.45, '#ff7a1a'], [1, '#ffc23a']]);
  layer(0.75, 0.66, [[0, '#ff9a1f'], [0.6, '#ffd54a'], [1, '#fff3b0']]);
  // The base fades out, so the flames rise out of her hair instead of standing on a straight edge.
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, h, 0, h * 0.72);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, h * 0.72, w, h * 0.28);
  g.globalCompositeOperation = 'source-over';
}

// A five-point star or a question mark on a canvas, for the dizzy orbit.
function orbitCanvas(kind) {
  const c = makeCanvas(96, 96), g = c.getContext('2d');
  g.lineJoin = 'round';
  g.lineWidth = 7;
  if (kind === 'star') {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 19 : 42;
      g.lineTo(48 + r * Math.cos(a), 50 + r * Math.sin(a));
    }
    g.closePath();
    g.strokeStyle = '#b57a00';
    g.stroke();
    g.fillStyle = '#ffd23f';
    g.fill();
  } else {
    g.font = 'bold 84px system-ui, -apple-system, "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeStyle = '#2f5fc4';
    g.lineWidth = 10;
    g.strokeText('?', 48, 52);
    g.fillStyle = '#ffffff';
    g.fillText('?', 48, 52);
  }
  return c;
}

// A cartoon sweat drop on a canvas.
function sweatCanvas() {
  const c = makeCanvas(64, 96), g = c.getContext('2d');
  g.beginPath();
  g.moveTo(32, 6);
  g.bezierCurveTo(38, 30, 56, 48, 56, 66);
  g.arc(32, 66, 24, 0, Math.PI);
  g.bezierCurveTo(8, 48, 26, 30, 32, 6);
  g.closePath();
  g.fillStyle = '#9fd6f5';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#3b8fc9';
  g.stroke();
  g.beginPath();
  g.ellipse(24, 62, 5, 9, -0.4, 0, 2 * Math.PI);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fill();
  return c;
}

function buildFaceFx() {
  const f = FACE_FX.fire;
  fxCards.fire = fxCard(makeCanvas(...f.canvas), f.size[1]);
  fxCards.orbit = FACE_FX.orbit.items.map((kind) => fxCard(orbitCanvas(kind), FACE_FX.orbit.size));
  fxCards.sweat = fxCard(sweatCanvas(), FACE_FX.sweat.size);
  fxCards.slide = fxCard(sweatCanvas(), FACE_FX.slide.size);
}

// A card on her face: at a mesh-local point of the head, `near` metres towards the camera.
function onFace(card, local, near) {
  faceDecal.parent.localToWorld(card.position.copy(local));
  fxToCamera.subVectors(camera.position, card.position).normalize();
  card.position.addScaledVector(fxToCamera, near);
  card.quaternion.copy(camera.quaternion);
}

const fxCentre = new THREE.Vector3();
const fxToCamera = new THREE.Vector3();
const fxSlide = new THREE.Vector3();
function updateFaceFx(now) {
  if (!fxCards.fire) return;
  faceDecal.geometry.boundingSphere ?? faceDecal.geometry.computeBoundingSphere();
  faceDecal.localToWorld(fxCentre.copy(faceDecal.geometry.boundingSphere.center));
  const fire = fxCards.fire, wf = face.fx.fire;
  fire.visible = wf > 0.01;
  if (fire.visible) {
    const f = FACE_FX.fire;
    drawFire(fire.material.map.image, now);
    fire.material.map.needsUpdate = true;
    fire.material.opacity = wf * f.opacity;
    const pop = 0.55 + 0.45 * wf;
    fire.scale.setScalar(pop);
    fxToCamera.subVectors(camera.position, fxCentre).setY(0).normalize();
    fire.position.copy(fxCentre).addScaledVector(fxToCamera, f.near);
    fire.position.y += f.up + (f.size[1] * pop) / 2;
    fire.quaternion.copy(camera.quaternion);
  }
  const o = FACE_FX.orbit, wo = face.fx.orbit;
  fxCards.orbit.forEach((card, i) => {
    card.visible = wo > 0.01;
    if (!card.visible) return;
    const a = (now / o.period) * 2 * Math.PI + (i / fxCards.orbit.length) * 2 * Math.PI;
    const r = o.radius * (0.6 + 0.4 * wo);
    card.position.set(fxCentre.x + r * Math.cos(a), fxCentre.y + o.up + o.tilt * Math.sin(a), fxCentre.z + r * Math.sin(a));
    card.quaternion.copy(camera.quaternion);
    card.material.opacity = wo;
    card.scale.setScalar(0.7 + 0.3 * wo);
  });
  const sw = FACE_FX.sweat, ws = face.fx.sweat, drop = fxCards.sweat;
  drop.visible = ws > 0.01;
  if (drop.visible) {
    onFace(drop, facePoints.temple, sw.near);
    drop.position.y -= sw.bob * (0.5 + 0.5 * Math.sin((now / sw.period) * 2 * Math.PI));
    drop.material.opacity = ws;
    drop.scale.setScalar(0.6 + 0.4 * ws);
  }
  const sl = FACE_FX.slide, wsl = face.fx.slide, slider = fxCards.slide;
  slider.visible = wsl > 0.01;
  if (slider.visible) {
    const t = (now % sl.period) / sl.period;
    onFace(slider, fxSlide.lerpVectors(facePoints.slideFrom, facePoints.slideTo, t * t), sl.near);
    slider.material.opacity = wsl * Math.min(1, t / 0.1, (1 - t) / 0.2);
  }
}

// Debug and screenshots (lab page only): ?expr=<name> starts on that expression; with ?exprFrom=<name> and
// ?exprT=<0..1> the face holds that far into the fade from exprFrom to expr; ?blink=<0..1> holds the eyelids that
// far closed. With either hold, she does not blink by herself.
function applyFaceDebug() {
  const q = new URLSearchParams(location.search);
  const number = (key) => {
    const v = Number(q.get(key));
    if (!(v >= 0 && v <= 1)) throw new Error(`?${key} must be in 0..1, got '${q.get(key)}'`);
    return v;
  };
  const known = (key) => {
    const name = q.get(key);
    if (!FACE_EXPRESSIONS.includes(name)) throw new Error(`?${key}: unknown expression '${name}' (expected one of ${FACE_EXPRESSIONS.join(', ')})`);
    return name;
  };
  if (!q.has('expr') && (q.has('exprFrom') || q.has('exprT'))) throw new Error('?exprFrom and ?exprT need ?expr');
  const hold = q.has('exprT') || q.has('blink');
  if (hold) face.hold = { t: q.has('exprT') ? number('exprT') : 1, blink: q.has('blink') ? number('blink') : 0 };
  if (!q.has('expr')) return;
  const to = known('expr');
  showFaceNow(q.has('exprFrom') ? known('exprFrom') : to);
  if (!hold) {
    setExpression(to);
    return;
  }
  face.legs = [to];   // a hold shows the one fade asked for, not a FACE_VIA route
  face.legMs = FACE_FADE.ms;
  startFaceLeg(performance.now());
}

// Shows an expression at once, without a fade (the face's first picture).
function showFaceNow(name) {
  const { width: w, height: h } = face.canvas;
  face.baseG.clearRect(0, 0, w, h);
  face.baseG.drawImage(face.pictures[name].source, 0, 0);
  face.from = splitPicture(face.base);
  face.shown = name;
  face.start = -Infinity;
  face.legs = [];
  face.fx = Object.fromEntries(Object.keys(FACE_FX).map((k) => [k, faceFxOf(name).includes(k) ? 1 : 0]));
  face.fxFrom = { ...face.fx };
  face.fxTo = { ...face.fx };
  face.dirty = true;
}

async function buildFace(mesh) {
  const imageLoader = new THREE.ImageLoader();
  const load = (name) => imageLoader.loadAsync(asset(`./assets/faces/${FIGURE.faces}_${name}.png`));
  // One after another: nine more requests at once, after the room's burst of models and cards, have had the
  // local test server (python http.server) reset connections.
  const loaded = [];
  for (const name of ['blink', ...FACE_EXPRESSIONS]) loaded.push(await load(name));
  const [blink, ...pictures] = loaded;
  FACE_EXPRESSIONS.forEach((name, i) => {
    face.pictures[name] = { ...splitPicture(pictures[i]), source: pictures[i] };
  });
  face.blink = blink;
  const { width: w, height: h } = pictures[0];
  if (pictures.some((p) => p.width !== w || p.height !== h) || blink.width !== w || blink.height !== h) {
    throw new Error(`face pictures differ in size: ${[blink, ...pictures].map((p) => `${p.width}x${p.height}`).join(', ')}`);
  }
  face.canvas = makeCanvas(w, h);
  face.g = face.canvas.getContext('2d');
  face.base = makeCanvas(w, h);
  face.baseG = face.base.getContext('2d');
  face.texture = new THREE.CanvasTexture(face.canvas);
  face.texture.colorSpace = THREE.SRGBColorSpace;
  face.texture.anisotropy = maxAniso;
  const d = FACE_DECAL;
  mesh.updateWorldMatrix(true, false);   // parents too: the figure was just scaled and seated
  const z = new THREE.Vector3(...d.towards).transformDirection(mesh.matrixWorld);
  const y0 = new THREE.Vector3(...d.up).transformDirection(mesh.matrixWorld);
  const x = new THREE.Vector3().crossVectors(y0, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const rot = new THREE.Matrix4().makeBasis(x, y, z).multiply(new THREE.Matrix4().makeRotationZ(yawRad(d.roll)));
  const scale = mesh.getWorldScale(new THREE.Vector3()).x;
  const geo = new DecalGeometry(mesh, mesh.localToWorld(new THREE.Vector3(...d.centre)),
    new THREE.Euler().setFromRotationMatrix(rot), new THREE.Vector3(...d.size).multiplyScalar(scale));
  // Only the triangles facing the projector, or turned only a little away from it (FACE_DECAL.fold): the deep
  // box would also print the face, mirrored, inside the far side of the head.
  const n = geo.attributes.normal, facing = [];
  for (let i = 0; i < n.count; i += 3) {
    const dot = [i, i + 1, i + 2].reduce((sum, k) => sum + n.getX(k) * z.x + n.getY(k) * z.y + n.getZ(k) * z.z, 0) / 3;
    if (dot > -d.fold) facing.push(i, i + 1, i + 2);
  }
  geo.setIndex(facing);
  geo.applyMatrix4(mesh.matrixWorld.clone().invert());
  // FACE_FX points on her face: face picture points (fractions, x from the ear side, y down) projected along the
  // decal's axis onto the head.
  const size = new THREE.Vector3(...d.size).multiplyScalar(scale);
  const onHead = ([u, v], out, what) => {
    const p = mesh.localToWorld(new THREE.Vector3(...d.centre)).addScaledVector(x, (u - 0.5) * size.x).addScaledVector(y, (0.5 - v) * size.y);
    const hit = new THREE.Raycaster(p.clone().addScaledVector(z, size.z), z.clone().negate()).intersectObject(mesh, false)[0];
    if (!hit) throw new Error(`FACE_FX.${what}: no head surface under face picture point ${u}, ${v}`);
    mesh.worldToLocal(out.copy(hit.point));
  };
  onHead(FACE_FX.sweat.at, facePoints.temple, 'sweat.at');
  onHead(FACE_FX.slide.from, facePoints.slideFrom, 'slide.from');
  onHead(FACE_FX.slide.to, facePoints.slideTo, 'slide.to');
  // Same material type and roughness as the body, so it takes the room's light the same way.
  const mat = new THREE.MeshStandardMaterial({
    map: face.texture, roughness: mesh.material.roughness, metalness: 0, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  faceDecal = new THREE.Mesh(geo, mat);
  faceDecal.receiveShadow = true;
  faceDecal.userData.noAO = true;
  mesh.add(faceDecal);
  buildFaceFx();
  showFaceNow('neutral');
  applyFaceDebug();
  window.addEventListener('keydown', (e) => {
    const i = '12345678'.indexOf(e.key);
    if (i >= 0) setExpression(FACE_EXPRESSIONS[i]);
  });
}

// The figure seated on the sofa's right cushion (FIGURE_SEAT), facing the sofa's front; obj from loadGlb.
async function buildFigure(obj) {
  const meshes = [];
  obj.traverse((m) => { if (m.isMesh) meshes.push(m); });
  if (meshes.length !== 1) throw new Error(`figure model ${FIGURE.model}: expected one mesh, found ${meshes.length}`);
  const [mesh] = meshes;
  const sofa = placedModels[SEAT_PIECE];
  if (!sofa) throw new Error(`layout.json: no ${SEAT_PIECE} piece for the figure to sit on`);
  const seat = measureSeat(sofa);
  const pos = mesh.geometry.attributes.position;
  const fig = measureFigure(pos);
  const fit = fitFigure(fig, seat);
  obj.scale.setScalar(fit.s);
  // Turned about the middle of her seat: that point stays where the unturned fit put it.
  const turn = yawRad(FIGURE_SEAT.turn);
  const pivot = new THREE.Vector3(fig.centreX, 0, fig.seatZ).multiplyScalar(fit.s);
  const turned = pivot.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
  obj.rotation.y = turn;
  obj.position.set(seat.x - turned.x, fit.y0, fit.dz + pivot.z - turned.z);
  sofa.holder.add(obj);
  await buildFace(mesh);
  if (EMBED) seated = { obj, mesh, s: fit.s, seatY: fig.seatY, hipY: fit.y0 + fig.seatY * fit.s };
}

// Embedded only: her figure and fit, for breathing about her seat and for the head anchor.
let seated = null;

// Placed GLB pieces by layout.json kind ({ holder, size } from model()), for pieces that others are fitted to.
const placedModels = {};
const kindCount = {};   // pieces of each kind built so far: picks each one's model from a list (the stools)

async function buildPiece(p) {
  const spec = ASSETS[p.kind];
  if (!spec) throw new Error(`layout.json piece kind ${p.kind} has no entry in ASSETS`);
  const i = (kindCount[p.kind] = (kindCount[p.kind] ?? 0) + 1) - 1;
  const name = Array.isArray(spec.model) ? spec.model[i % spec.model.length] : spec.model;
  const placed = await model(name, p, measuredSize(p, spec), spec.turn ?? 0, spec.maxStretchX, spec.fit, spec.heightOver);
  placedModels[p.kind] = placed;
  return placed;
}

// Pieces with onTop wait for the piece they stand on, then are lifted onto its top at their own x, y.
async function buildPieces() {
  const later = layout.pieces.filter((p) => ASSETS[p.kind]?.onTop);
  await Promise.all(layout.pieces.filter((p) => !later.includes(p)).map(buildPiece));
  for (const p of later) {
    const under = ASSETS[p.kind].onTop;
    if (layout.pieces.filter((q) => q.kind === under).length !== 1) throw new Error(`${p.kind} onTop ${under}: layout.json must have exactly one ${under}`);
    const placed = await buildPiece(p);
    placed.holder.position.y = topAt(placedModels[under], p.x, p.y, `${p.kind} onTop ${under}`);
  }
}

// Rug: not in the plan; derived from the sofa and the coffee table (RUG_UNDER), turned with the sofa. It runs
// the sofa's width and reaches from under the sofa's front half to just past the far edge of the table.
async function buildRug() {
  const [sofa, table] = RUG_UNDER.map((k) => layout.pieces.find((p) => p.kind === k));
  const a = yawRad(sofa.yaw_deg);
  const ey = [-Math.sin(a), Math.cos(a)];   // sofa local y, plan
  const dx = table.x - sofa.x, dy = table.y - sofa.y;
  const tv = dx * ey[0] + dy * ey[1];        // table along sofa local y
  const near = 0.1, far = tv - Math.max(table.size[0], table.size[1]) / 2 - 0.25;
  const w = sofa.size[0], d = near - far;
  const mid = (near + far) / 2;
  const tex = await loadCardTexture('rug');
  const mat = cardMaterial(tex);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -1;
  const rug = addMesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat, { cast: false });
  rug.position.copy(toV(sofa.x + ey[0] * mid, sofa.y + ey[1] * mid, 0.004));
  rug.rotation.y = a;
}

const wallById = (id) => {
  const w = layout.walls.find((q) => q.id === id);
  if (!w) throw new Error(`no wall '${id}' in layout.json`);
  return w;
};
const wallsByRole = (role) => layout.walls.filter((w) => w.role === role);

// WINDOW_CARD on the window wall, standing on the floor.
async function buildWindowWall() {
  const c = WINDOW_CARD, w = wallById(c.wall);
  const tex = await loadCardTexture(c.card);
  const width = c.h * tex.image.width / tex.image.height;
  if (c.along - width / 2 < 0 || c.along + width / 2 > w.length) throw new Error(`WINDOW_CARD: ${width.toFixed(2)} m wide at ${c.along} does not fit wall ${w.id} (${w.length} m)`);
  // Blended, not alpha-cut: the card's painted wall fades into the room's wall at its edges
  // (work/gen/b_room/feather_window_card.py).
  const mat = cardMaterial(tex);
  mat.alphaTest = 0.01;
  mat.transparent = true;
  const mesh = addMesh(new THREE.PlaneGeometry(width, c.h).translate(0, c.h / 2, 0), mat, { cast: false });
  mesh.position.copy(wallPoint(w, c.along, 0, c.off));
  mesh.rotation.y = wallFacing(w);
}

// KITCHEN_BRICK: a brick band standing proud of the kitchen wall, along the placed counter's extent.
function buildKitchenBrick() {
  const b = KITCHEN_BRICK, w = wallById(b.wall);
  const placed = placedModels[b.over];
  if (!placed) throw new Error(`KITCHEN_BRICK: no placed ${b.over}`);
  const box = new THREE.Box3().setFromObject(placed.holder);
  const toWall = wallFrame(w).m.clone().invert();
  const along = [box.min, box.max].map((c) => c.clone().applyMatrix4(toWall).x);
  wallFaceBox(w, Math.min(...along), Math.max(...along), b.bottom, b.top, b.proud, [wallCut, wallCut, wallCut, wallCut, brickMat, brickMat], [1, 1]);
}

// Plain glazing in window openings (this room's window is the card; kept for any window opening).
function buildGlazing() {
  for (const w of layout.walls) {
    for (const o of w.openings.filter((o) => o.kind === 'window')) {
      const geo = new THREE.PlaneGeometry(o.to - o.from, o.top - o.bottom);
      const mesh = addMesh(geo, glassMat, { cast: false });
      mesh.position.copy(wallPoint(w, (o.from + o.to) / 2, (o.bottom + o.top) / 2, -w.thickness / 2));
      mesh.rotation.y = wallFacing(w);
    }
  }
}

// A painted panel door (DOOR): leaf, two raised panels, a knob on the side away from the hinge.
function doorTexture() {
  return canvasTexture([256, 560], (g, w, h) => {
    g.fillStyle = DOOR.leaf;
    g.fillRect(0, 0, w, h);
    for (const [y0, y1] of [[0.07, 0.45], [0.53, 0.93]]) {
      g.fillStyle = DOOR.panel;
      g.fillRect(w * 0.16, h * y0, w * 0.68, h * (y1 - y0));
      g.strokeStyle = DOOR.line;
      g.lineWidth = 5;
      g.strokeRect(w * 0.16, h * y0, w * 0.68, h * (y1 - y0));
    }
    g.fillStyle = DOOR.knob;
    g.beginPath();
    g.arc(w * 0.86, h * 0.5, 11, 0, 2 * Math.PI);
    g.fill();
  });
}

// Doors get a leaf in the opening; open doorways ('opening') show the room beyond: a box of BEDROOM_BEYOND
// depth behind the wall, open towards the doorway, so the Inside view looks into a dim room, not out of the set.
function buildDoors() {
  const leafMat = matte({ map: doorTexture() });
  // The room beyond is seen only from inside (the Dollhouse view would see its box from above): it fades with
  // the ceiling (INSIDE_ONLY).
  const beyondMats = { wall: matte({ color: BEDROOM_BEYOND.colour, side: THREE.BackSide, transparent: true }), floor: matte({ color: BEDROOM_BEYOND.floor, transparent: true }) };
  insideOnlyMats.push(beyondMats.wall, beyondMats.floor);
  for (const w of layout.walls) {
    for (const o of w.openings) {
      const width = o.to - o.from, height = o.top - o.bottom, mid = (o.from + o.to) / 2;
      if (o.kind === 'door') {
        const leaf = addMesh(new THREE.PlaneGeometry(width, height).translate(0, height / 2, 0), leafMat, { cast: false });
        leaf.position.copy(wallPoint(w, mid, o.bottom, -w.thickness / 2 + 0.03));
        leaf.rotation.y = wallFacing(w);
      } else if (o.kind === 'opening') {
        const d = BEDROOM_BEYOND.depth, bw = width + 0.8, bh = height + 0.3;
        const box = insideOnly(addMesh(new THREE.BoxGeometry(bw, bh, d), beyondMats.wall, { cast: false, receive: false }));
        box.position.copy(wallPoint(w, mid, o.bottom + bh / 2, -w.thickness - d / 2));
        box.rotation.y = wallFacing(w);
        const floor = insideOnly(addMesh(new THREE.PlaneGeometry(bw, d).rotateX(-Math.PI / 2), beyondMats.floor, { cast: false }));
        floor.position.copy(wallPoint(w, mid, o.bottom + 0.002, -w.thickness - d / 2));
        floor.rotation.y = wallFacing(w);
      }
    }
  }
}

// ---------------------------------------------------------------- inside-only ceiling

// Shown only once the camera is down among the walls (the Inside view), so the Dollhouse view keeps its
// open top: a ceiling over the crop at the wall tops, flush ceiling lights (over CEILING_LIGHTS_OVER) and the
// room beyond the open doorway (buildDoors). They fade in as the camera
// drops from fade[0] above the wall tops to fade[1] (below them), the background turning `background`.
// The ceiling faces down, away from the key light: ceilingLift (emissive share of its colour) keeps it off-white.
// They cast no shadows (the shadow map is drawn once, for the open room).
const INSIDE_ONLY = { ceiling: '#f8f2e8', ceilingLift: 0.3, fixture: '#fdf8ef', fixtureGlow: '#fff1d8', background: '#d9cbb6', fade: [0.2, -0.6], fixtureRadius: 0.17 };
const wallTop = Math.max(...layout.walls.map((w) => w.height));
const insideOnlyMats = [
  matte({ color: INSIDE_ONLY.ceiling, emissive: INSIDE_ONLY.ceiling, emissiveIntensity: INSIDE_ONLY.ceilingLift, transparent: true }),
  matte({ color: INSIDE_ONLY.fixture, emissive: INSIDE_ONLY.fixtureGlow, emissiveIntensity: 0.35, roughness: 0.6, transparent: true }),
];
const [ceilingMat, fixtureMat] = insideOnlyMats;
const insideOnlyMeshes = [];
const insideOnly = (mesh) => {
  mesh.castShadow = false;
  mesh.visible = false;
  insideOnlyMeshes.push(mesh);
  return mesh;
};

function buildInsideOnly() {
  const [x0, y0, x1, y1] = layout.crop;
  const pad = 0.4;
  const ceiling = insideOnly(addMesh(new THREE.PlaneGeometry(x1 - x0 + 2 * pad, y1 - y0 + 2 * pad).rotateX(Math.PI / 2), ceilingMat));
  ceiling.position.copy(toV((x0 + x1) / 2, (y0 + y1) / 2, wallTop));
  for (const kind of CEILING_LIGHTS_OVER) {
    const p = layout.pieces.find((q) => q.kind === kind);
    const r = INSIDE_ONLY.fixtureRadius;
    const dome = insideOnly(addMesh(new THREE.SphereGeometry(r, 32, 12, 0, 2 * Math.PI, Math.PI / 2, Math.PI / 2).scale(1, 0.35, 1), fixtureMat));
    dome.position.copy(toV(p.x, p.y, wallTop));
  }
}

const outsideBackground = new THREE.Color(COLOURS.background);
const insideBackground = new THREE.Color(INSIDE_ONLY.background);
function updateInsideOnly() {
  const f = 1 - THREE.MathUtils.smoothstep(camera.position.y, wallTop + INSIDE_ONLY.fade[1], wallTop + INSIDE_ONLY.fade[0]);
  for (const mat of insideOnlyMats) {
    mat.opacity = f;
    mat.depthWrite = f > 0.99;
  }
  for (const mesh of insideOnlyMeshes) mesh.visible = f > 0.01;
  scene.background.lerpColors(outsideBackground, insideBackground, f);
}

// Lamp glow at the shade of the LAMP_PIECE (placed after it is built: it stands on the chest).
const LAMP_PIECE = 'table_lamp';
const lampGlow = new THREE.PointLight('#ffd6a0', 1.6, 4, 2);
scene.add(lampGlow);
function placeLampGlow() {
  const lamp = placedModels[LAMP_PIECE];
  if (!lamp) throw new Error(`layout.json: no ${LAMP_PIECE} piece for the lamp glow`);
  const box = new THREE.Box3().setFromObject(lamp.holder);
  lampGlow.position.copy(box.getCenter(new THREE.Vector3())).setY(box.min.y + 0.8 * (box.max.y - box.min.y));
}

// ---------------------------------------------------------------- camera views, transition, zoom, orbit

// Inside view: from the front left of the room (by the armchair), eye height 1.6 m, looking across the sofa
// towards the window wall, as the set photo (owner_02_living_room_wide.webp) looks in from the audience side.
// The eye stands this far to her right (about 40 degrees off the sofa's front) so that, with FIGURE_SEAT.turn,
// it sees her face from her right at about the three-quarter angle her face pictures are drawn at.
// Plan metres.
const EYE = { x: 1.85, y: 0.35, height: 1.65 };
const INSIDE_TARGET = { x: 3.6, y: 5.0, z: 0.95 };
const camWall = wallsByRole('camera')[0];
const insideEye = toV(EYE.x, EYE.y, EYE.height);
const insideTarget = toV(INSIDE_TARGET.x, INSIDE_TARGET.y, INSIDE_TARGET.z);
// Debug and screenshots (lab page only): ?eye=x,y,z&at=x,y,z (plan metres) moves the Inside view.
{
  const q = new URLSearchParams(location.search);
  const point = (key) => {
    const v = q.get(key).split(',').map(Number);
    if (v.length !== 3 || v.some((n) => !Number.isFinite(n))) throw new Error(`?${key} must be x,y,z in plan metres, got '${q.get(key)}'`);
    return toV(...v);
  };
  if (q.has('eye') !== q.has('at')) throw new Error('?eye and ?at go together');
  if (q.has('eye')) {
    insideEye.copy(point('eye'));
    insideTarget.copy(point('at'));
  }
}

const crop = layout.crop;
const roomCentre = toV((crop[0] + crop[2]) / 2, (crop[1] + crop[3]) / 2, 0.6);
const VIEWS = {
  // From outside, above the camera side, whole room in view.
  dollhouse: { pos: roomCentre.clone().add(new THREE.Vector3(0.9, 8.6, 9.4)), target: roomCentre.clone().add(new THREE.Vector3(0, 0, -0.3)), fov: 34, hfov: 52 },
  inside:    { pos: insideEye, target: insideTarget, fov: 52, hfov: 70 },
};
const ORBIT = { yaw: THREE.MathUtils.degToRad(10), pitch: THREE.MathUtils.degToRad(4), damping: 0.06 };
const DOLLY = { min: -0.5, max: 1.0, wheel: 0.0025, pinch: 0.008, damping: 0.12 };
const TRANSITION_MS = 1500;

const figureModel = loadGlb(FIGURE.model, 0.9);   // seated after the sofa is placed
await Promise.all([buildRug(), buildWindowWall(), buildPieces()]);
buildDoors();
buildKitchenBrick();
placeLampGlow();
await buildFigure(await figureModel);
buildGlazing();
buildInsideOnly();

// Every standard material takes the room environment at the same low intensity.
scene.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of [o.material].flat()) if (m.isMeshStandardMaterial) m.envMapIntensity = m.userData.envMapIntensity ?? LIGHT.env;
});

// The room is static: the shadow map is drawn once now (and again when the 'full' camera wall changes).
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

// Post-processing: scene -> GTAO (cards are left out of the AO depth, their alpha-cut quads would cast
// rectangles; so is the glass top, marked noAO) -> colour-space output. Multisampled target below pixel ratio 2; at 2 the pixels do it.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType, samples: renderer.getPixelRatio() < 2 ? 4 : 0,
}));
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 1, 1);
gtao.updateGtaoMaterial({ radius: AO.radius, distanceExponent: AO.distanceExponent, thickness: AO.thickness, scale: AO.scale, samples: AO.samples });
gtao.blendIntensity = AO.blend;
const gtaoSetSize = gtao.setSize.bind(gtao);
gtao.setSize = (w, h) => gtaoSetSize(Math.round(w * AO.resolution), Math.round(h * AO.resolution));
const gtaoOverrideVisibility = gtao.overrideVisibility.bind(gtao);
gtao.overrideVisibility = () => {
  gtaoOverrideVisibility();
  scene.traverse((o) => { if (o.isMesh && (o.userData.noAO || [o.material].flat().some((m) => m.alphaTest > 0))) o.visible = false; });
};
composer.addPass(gtao);
composer.addPass(new OutputPass());

let fromView = VIEWS.dollhouse;
let toView = VIEWS.dollhouse;
let transitionStart = -Infinity;
let transitionMs = TRANSITION_MS;
let inside = false;
if (EMBED) {
  fromView = toView = VIEWS.inside;
  inside = true;
}
let dollyGoal = 0, dollyNow = 0;

const pointerGoal = new THREE.Vector2();
const pointerNow = new THREE.Vector2();
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function baseView(now) {
  const t = transitionMs > 0 ? easeInOutCubic(THREE.MathUtils.clamp((now - transitionStart) / transitionMs, 0, 1)) : 1;
  const pos = fromView.pos.clone().lerp(toView.pos, t);
  const target = fromView.target.clone().lerp(toView.target, t);
  pos.addScaledVector(target.clone().sub(pos).normalize(), dollyNow);
  return { pos, target, fov: THREE.MathUtils.lerp(fromView.fov, toView.fov, t), hfov: THREE.MathUtils.lerp(fromView.hfov, toView.hfov, t) };
}

function go(toInside) {
  if (toInside === inside) return;
  const now = performance.now();
  fromView = baseView(now);   // includes the current dolly, which is then dropped
  dollyGoal = dollyNow = 0;
  inside = toInside;
  toView = inside ? VIEWS.inside : VIEWS.dollhouse;
  transitionStart = now;
  transitionMs = TRANSITION_MS;
  button.textContent = inside ? 'Back' : 'Enter';
}
button.addEventListener('click', () => go(!inside));

const canvas = renderer.domElement;
const rel = (e) => {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
};

// Clicking the room (not a drag, not a pinch) from the Dollhouse view flies inside.
const raycaster = new THREE.Raycaster();
const pointers = new Map();
let downAt = null, pinchFrom = null;
canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, e);
  downAt = pointers.size === 1 ? { x: e.clientX, y: e.clientY } : null;
});
canvas.addEventListener('pointermove', (e) => {
  pointerGoal.copy(rel(e));
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, e);
  if (pointers.size === 2 && inside) {
    const [p, q] = [...pointers.values()];
    const d = Math.hypot(p.clientX - q.clientX, p.clientY - q.clientY);
    if (pinchFrom !== null) dollyGoal = THREE.MathUtils.clamp(dollyGoal + (d - pinchFrom) * DOLLY.pinch, DOLLY.min, DOLLY.max);
    pinchFrom = d;
  }
});
const pointerEnd = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchFrom = null;
};
canvas.addEventListener('pointerup', (e) => {
  const click = downAt && pointers.size === 1 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6;
  pointerEnd(e);
  downAt = null;
  if (!click || inside) return;
  const p = rel(e);
  raycaster.setFromCamera(new THREE.Vector2(p.x, -p.y), camera);
  if (raycaster.intersectObjects(scene.children, true).length) go(true);
});
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('pointerleave', () => pointerGoal.set(0, 0));
canvas.addEventListener('wheel', (e) => {
  if (!inside) return;
  e.preventDefault();
  dollyGoal = THREE.MathUtils.clamp(dollyGoal - e.deltaY * DOLLY.wheel, DOLLY.min, DOLLY.max);
}, { passive: false });

const offset = new THREE.Vector3();
const right = new THREE.Vector3();

// 'full' camera wall: opaque seen from well outside, transparent once the camera is at or past it.
const camWallOuter = camWall ? new THREE.Vector3(-camWall.normal[0], 0, camWall.normal[1]) : null;
const camWallPoint = camWall ? toV(camWall.a[0], camWall.a[1]) : null;
function updateCameraWall() {
  if (CAMERA_WALL !== 'full' || !camWall) return;
  const outside = offset.copy(camera.position).sub(camWallPoint).dot(camWallOuter) - camWall.thickness / 2;
  const opacity = THREE.MathUtils.smoothstep(outside, 0.2, 1.4);
  for (const m of [cameraWallMat, cameraWallCut, cameraTrimMat]) {
    m.opacity = opacity;
    m.depthWrite = opacity > 0.99;
    if (m.visible !== opacity > 0.01) renderer.shadowMap.needsUpdate = true;
    m.visible = opacity > 0.01;
  }
}

function updateCamera(now) {
  pointerNow.lerp(pointerGoal, ORBIT.damping);
  dollyNow += (dollyGoal - dollyNow) * DOLLY.damping;
  const view = baseView(now);
  offset.subVectors(view.pos, view.target);
  offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -pointerNow.x * ORBIT.yaw);
  right.crossVectors(THREE.Object3D.DEFAULT_UP, offset).normalize();
  offset.applyAxisAngle(right, -pointerNow.y * ORBIT.pitch);
  camera.position.copy(view.target).add(offset);
  camera.lookAt(view.target);
  const halfH = Math.tan(THREE.MathUtils.degToRad(view.hfov / 2)) / camera.aspect;
  const fov = Math.max(view.fov, THREE.MathUtils.radToDeg(2 * Math.atan(halfH)));
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  updateCameraWall();
  updateInsideOnly();
}

function resize() {
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  composer.setSize(stage.clientWidth, stage.clientHeight);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- embedded: Demo page messages
// From the parent page (same origin), { mpb: <type>, ... }:
//   expression { name }  setExpression(name)
//   shot { name, ms }    camera to EMBED_SHOTS[name] over ms milliseconds (0 cuts)
// To it: ready (room built); anchor { x, y } (top of her head on screen, 0..1 from the top left; sent when it
// moves); error { message }.
// Shots (the names are the Demo page's): inside = VIEWS.inside; him = the figure (FIGURE_SHOT); object = from
// the Inside eye onto the window (OBJECT_SHOT); near = pushed in from the Inside eye towards her face
// (NEAR.share of the way), aimed NEAR.right metres to the camera's right of it and NEAR.down below it, so she
// sits left of the phone the page shows at the right.
const BREATH = { depth: 0.008, ms: 4200 };
const NEAR = { share: 0.22, right: 0.3, down: 0.12, fov: 40, hfov: 52 };
const HEAD_TOP = 0.16;   // metres above her face centre: the anchor the page's thought bubble sits on
const send = (msg) => window.parent.postMessage({ mpb: msg.type, ...msg }, location.origin);
const facePoint = () => {
  faceDecal.geometry.computeBoundingSphere();
  return faceDecal.localToWorld(faceDecal.geometry.boundingSphere.center.clone());
};
const FIGURE_SHOT = { down: 0.25, fov: 44, hfov: 58 };   // from the Inside eye, aimed `down` below her face
// object: the WINDOW_CARD's centre line at height y.
const OBJECT_SHOT = { y: 1.35, fov: 30, hfov: 40 };
const objectTarget = wallPoint(wallById(WINDOW_CARD.wall), WINDOW_CARD.along, OBJECT_SHOT.y, 0);
const EMBED_SHOTS = {
  inside: () => VIEWS.inside,
  him: () => ({ pos: insideEye, target: facePoint().add(new THREE.Vector3(0, -FIGURE_SHOT.down, 0)), fov: FIGURE_SHOT.fov, hfov: FIGURE_SHOT.hfov }),
  object: () => ({ pos: insideEye, target: objectTarget, fov: OBJECT_SHOT.fov, hfov: OBJECT_SHOT.hfov }),
  near: () => {
    const face = facePoint();
    const right = new THREE.Vector3().subVectors(face, insideEye).cross(THREE.Object3D.DEFAULT_UP).normalize();
    const target = face.clone().addScaledVector(right, NEAR.right).add(new THREE.Vector3(0, -NEAR.down, 0));
    return { pos: insideEye.clone().lerp(face, NEAR.share), target, fov: NEAR.fov, hfov: NEAR.hfov };
  },
};
let lastAnchor = null;
function embedFrame(now) {
  if (!seated) return;
  const k = 1 + BREATH.depth * Math.sin((now / BREATH.ms) * 2 * Math.PI);
  seated.obj.scale.y = seated.s * k;
  seated.obj.position.y = seated.hipY - seated.seatY * seated.s * k;
  const p = facePoint().add(new THREE.Vector3(0, HEAD_TOP, 0)).project(camera);
  const a = { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  if (!lastAnchor || Math.hypot(a.x - lastAnchor.x, a.y - lastAnchor.y) > 0.001) {
    lastAnchor = a;
    send({ type: 'anchor', ...a });
  }
}
if (EMBED) {
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || e.origin !== location.origin || !e.data || !e.data.mpb) return;
    try {
      if (e.data.mpb === 'expression') setExpression(e.data.name);
      else if (e.data.mpb === 'shot') {
        const shot = EMBED_SHOTS[e.data.name];
        if (!shot) throw new Error(`shot: unknown shot '${e.data.name}' (expected one of ${Object.keys(EMBED_SHOTS).join(', ')})`);
        const now = performance.now();
        fromView = baseView(now);
        toView = shot();
        transitionStart = now;
        transitionMs = Number(e.data.ms) || 0;
      } else throw new Error(`unknown message '${e.data.mpb}'`);
    } catch (err) {
      send({ type: 'error', message: err.message });
    }
  });
}

renderer.setAnimationLoop((now) => {
  if (EMBED) embedFrame(now);
  updateCamera(now);
  updateFace(now);
  composer.render();
});
if (EMBED) send({ type: 'ready' });
