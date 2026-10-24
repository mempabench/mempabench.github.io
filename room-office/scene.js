// Office set: the 3D dollhouse shared by User D (the reception desk) and User C (the manager's office behind
// the glass partition), laid out by hand in layout.json (work/gen/cd_office_layout/make_layout.py) from the
// set photos in work/set_refs/cd_office/. Built from lab/diorama-b (User A's room): the same lighting, walls,
// face decal, embed messages and views; ?user=user_d|user_c picks who sits in it (one of them per page).
//
// Axis mapping, metres: plan (x, y, z) -> three.js (x - origin[0], z, origin[1] - y). Plan y runs away from
// the open front (the camera side). Plan yaw (counter-clockwise seen from above) -> rotation.y, same angle. A
// piece's front (plan local -y) is its local +z.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------- asset table (swap models here)

// layout.json piece kind -> how it is drawn (see lab/diorama-b/scene.js for every option).
//   model:      GLB in models/, one uniform scale from the measured width (fit: 'height' for tall pieces)
//   turn:       extra degrees about the vertical, where the TRELLIS model's front is not its local +z
//   heightOver: how far the model may rise above the measured height (default MAX_HEIGHT_OVER): the reception
//               desk's fit box still holds the monitor and lamp cut out of it (their vertices stay in the GLB)
//   seat:       a chair someone can sit on (CHARACTERS[...].chair names it)
//   build:      drawn here instead of from a model: a function of the layout.json piece (procedural pieces below)
//   props:      procedural props added in the piece's frame: a function of the layout.json piece
const ASSETS = {
  reception_desk:    { model: 'reception_desk', turn: 180, heightOver: 1.4, props: receptionDeskProps },
  reception_chair:   { model: 'reception_chair', fit: 'height', seat: true },
  binder_shelf:      { model: 'binder_shelf' },
  paper_boxes:       { model: 'paper_boxes' },
  copier:            { model: 'copier', fit: 'height' },
  potted_plant:      { model: 'potted_plant', fit: 'height' },
  coat_rack:         { model: 'coat_rack', fit: 'height' },
  waiting_sofa:      { model: 'waiting_sofa' },
  manager_desk:      { build: managerDesk },
  manager_chair:     { model: 'manager_chair', fit: 'height', seat: true },
  guest_chair:       { models: ['guest_chair_1', 'guest_chair_2'], fit: 'height' },   // one model per chair
  manager_bookshelf: { model: 'manager_bookshelf' },
  globe:             { model: 'globe', fit: 'height' },
};

// Who sits in the room (?user=, required): their seated model, chair (a layout.json piece kind with seat: true), face
// pictures (assets/faces/<user>_<expression>.png), the face decal and effects fitted to that model, the Inside
// view (eye: plan x, y and height; target: the piece kind looked at, at a share of its height), and the piece
// the 'object' shot opens on.
// seat: sink into the seat top, calfClearance in front of the chair's front below the seat, turn degrees
// about the middle of the seat (negative: towards the figure's right).
// phone: the mobile phone in their hands (MOBILE), in the model's frame (GLB units): its centre, the direction of
// its long side, and the way its screen faces (towards the eyes). From the TRELLIS phone each model held
// (work/gen/cd_office_props/measure_phone.py): his in its plane, its lower edge in his fingers; hers turned upright
// and tipped back towards her face, in her fingers.
// decal / fx / dizzyEyes: as FACE_DECAL / FACE_FX / DIZZY_EYES in lab/diorama-b/scene.js, measured on this
// model and its face sheet; dizzyEyes: null when the dizzy picture has no spiral eyes to turn (User C's).
const CHARACTERS = {
  // work/gen/c_character_user_c/ (the decal fitted by its fit_face_decal.py: it reads best from his right-front)
  user_c: {
    model: 'user_c_sit_phone', chair: 'manager_chair',
    seat: { sink: 0.03, calfClearance: 0.03, turn: 0 },
    phone: { at: [-0.0012, 0.1523, 0.1163], long: [0.996, -0.0421, -0.0784], towards: [-0.0334, 0.6393, -0.7682] },   // held level in both hands
    decal: { centre: [0.0092, 0.3507, -0.1013], towards: [-0.5163, 0.007, 0.8564], up: [0.0036, 1.0, -0.006],
             roll: -9.55, size: [0.1337, 0.1611, 0.26] },
    fx: {
      fire: { size: [0.1, 0.12], up: 0.14, near: 0.1, flicker: 260, canvas: [128, 160], opacity: 0.7 },
      orbit: { up: 0.16, radius: 0.15, tilt: 0.025, period: 1700, size: 0.055, items: ['star', 'question', 'star', 'question', 'star'] },
      sweat: { at: [-0.02, 0.32], near: 0.02, size: 0.045, bob: 0.004, period: 1400 },
      slide: { from: [0.0, 0.4], to: [0.1, 0.72], near: 0.025, size: 0.04, period: 1800 },
    },
    fxOf: { dizzy: ['orbit', 'sweat'] },   // the drop of his dizzy picture lies outside the decal
    dizzyEyes: null,
    inside: { eye: [6.8, 1.7, 1.55], target: { kind: 'manager_chair', share: 0.95 } },
    object: { kind: 'manager_desk', share: 1 },
  },
  // work/gen/d_character_user_d/ (seat points in its final/face_decal.json; the decal along this room's camera, room_fix/face_decal_room.json)
  user_d: {
    model: 'user_d_sit_phone', chair: 'reception_chair',
    seat: { sink: 0.04, calfClearance: 0.02, turn: 25 },
    phone: { at: [0.0856, 0.1913, 0.0753], long: [0.13, 0.835, 0.533], towards: [-0.2, 0.55, -0.81] },   // upright in her left hand, tipped back towards her
    decal: { centre: [-0.013, 0.3531, -0.0591], towards: [-0.6095, 0.0928, 0.7873], up: [0.0731, 0.9955, -0.0607],
             roll: 0, size: [0.1368, 0.1805, 0.24] },
    fx: {
      fire: { size: [0.1, 0.12], up: 0.22, near: 0.12, flicker: 260, canvas: [128, 160], opacity: 0.7 },
      orbit: { up: 0.16, radius: 0.15, tilt: 0.025, period: 1700, size: 0.055, items: ['star', 'question', 'star', 'question', 'star'] },
      sweat: { at: [-0.02, 0.32], near: 0.02, size: 0.045, bob: 0.004, period: 1400 },
      slide: { from: [0.0, 0.4], to: [0.1, 0.72], near: 0.025, size: 0.04, period: 1800 },
    },
    fxOf: { dizzy: [] },   // her dizzy picture alone: eyes closed, a small sigh
    dizzyEyes: null,
    inside: { eye: [3.3, -0.2, 1.75], target: { kind: 'reception_chair', share: 0.8 } },
    object: { card: 'watercolour_building' },
  },
};
const USER = new URLSearchParams(location.search).get('user');
const CHAR = CHARACTERS[USER];
if (!CHAR) throw new Error(`?user=${USER}: no such character in this room (expected one of ${Object.keys(CHARACTERS).join(', ')})`);

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
// CHARACTERS[...].fxOf replaces the effects of the expressions it names (User C's dizzy also sweats).
const FACE_FX_OF = { angry: ['fire'], dizzy: ['orbit'], confused: ['sweat', 'slide'], ...CHAR.fxOf };
const { decal: FACE_DECAL, fx: FACE_FX, dizzyEyes: DIZZY_EYES, seat: SEAT } = CHAR;
if (DIZZY_EYES === undefined) throw new Error(`CHARACTERS.${USER}.dizzyEyes: give the spiral eyes, or null for none`);

// Wall flats, each card's width from its image aspect and the given height h (or width w). wall: a layout.json
// wall id; along: centre, metres from end a (must lie in a free span); y: centre height; off: out from the face.
const WALL_FLATS = [
  // The watercolour of the office building on the reception's back wall, behind her desk.
  { card: 'watercolour_building', wall: 'back', along: 3.02, y: 1.72, h: 0.62, off: 0.01 },
];
// Every window opening gets this card (frame, blinds and a strip of wall), `margin` wider than the opening.
const WINDOW_CARD = { card: 'manager_window', margin: 0.1 };
// The glass partition (layout.json `partition`): black frame posts every `bay` metres, `frame` thick, glass,
// and blinds drawn on the glass (white slats `slat` apart, down to `blindsTo` of the height); the door in it
// is the entrance-door card.
const PARTITION = { frame: 0.05, bay: 1.15, glass: '#dbe6ea', glassOpacity: 0.22, slat: 0.05, slatColour: '#f5f2ec', blindsTo: 0.45, blindsOpacity: 0.85 };

// Embedded in the site's Demo page (index.html?embed&user=...): starts in the Inside view without the toggle, the figure
// breathes (BREATH), and the page drives it by postMessage (EMBED_SHOTS below). Opened on its own, none of this runs.
const EMBED = new URLSearchParams(location.search).has('embed') && window.parent !== window;
const asset = (path) => new URL(path, import.meta.url).href;  // resolve next to this file, not the page

const layout = await (await fetch(asset('./layout.json'))).json();
const [OX, OY] = layout.origin;
const SLAB = 0.22;   // floor slab thickness drawn below floor level

const toV = (x, y, z = 0) => new THREE.Vector3(x - OX, z, OY - y);   // plan -> three.js
const yawRad = (deg) => THREE.MathUtils.degToRad(deg);

// Colours, lighter and airier than the photos while keeping their hues: off-white walls, grey speckled carpet.
const COLOURS = {
  wall: '#ece6da',
  wallCut: '#f4efe6',
  trim: '#fbf8f2',
  slabCut: '#cfc8bc',
  carpet: '#9a9894',
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

// Commercial carpet: fine light and dark flecks over grey; one tile = 1 m x 1 m. Floor UVs are in metres.
const CARPET_TILE = 1;
const floorTex = canvasTexture([512, 512], (g, w, h) => {
  g.fillStyle = COLOURS.carpet;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = shade(COLOURS.carpet, 0.78 + rand() * 0.5);
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
});
floorTex.repeat.set(1 / CARPET_TILE, 1 / CARPET_TILE);

const matte = (params) => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...params });
const clay = (params) => matte({ bumpMap: clayBump, bumpScale: 0.5, ...params });

const wallMat = clay({ color: COLOURS.wall });
const wallCut = clay({ color: COLOURS.wallCut });
const trimMat = clay({ color: COLOURS.trim, bumpScale: 0.3 });
const floorMat = clay({ map: floorTex, bumpScale: 0.25 });
const slabCut = clay({ color: COLOURS.slabCut });

function addMesh(geo, mat, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- floor

// Outline in plan coordinates relative to the origin; extruded upwards, then laid flat (shape y -> -z).
function slab(outline, bottom, top, mats) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x - OX, y - OY)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2).translate(0, bottom, 0);
  return addMesh(geo, mats, { cast: false });
}

slab(layout.floor.outline, -SLAB, 0, [floorMat, slabCut]);

// ---------------------------------------------------------------- walls

// Wall frame: origin at end a on the centreline, x along the wall, y up, z across (thickness).
function wallFrame(w) {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const ux = (w.b[0] - w.a[0]) / len, uy = (w.b[1] - w.a[1]) / len;
  const X = new THREE.Vector3(ux, 0, -uy), Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(toV(w.a[0], w.a[1]));
  // +1 when the inner side (into the room, layout `normal`) is the frame's +z.
  const inner = Math.sign(Z.x * w.normal[0] - Z.z * w.normal[1]);
  return { m, len, inner };
}

function buildWall(w) {
  const { m, len } = wallFrame(w);
  const h = w.height;
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
  return addMesh(geo, [wallMat, wallCut]);
}

// A thin box on a wall face: along-range [from, to], height range [bottom, top], standing `proud` off the
// inner face.
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

// Baseboards along each wall's inner face, broken at floor-level openings.
for (const w of layout.walls) {
  const cuts = w.openings.filter((o) => o.bottom < 0.1).map((o) => [o.from, o.to]).sort((a, b) => a[0] - b[0]);
  let start = 0;
  for (const [s, e] of [...cuts, [w.length, w.length]]) {
    if (s - start > 0.05) wallTrim(w, start, s, 0, BASEBOARD, trimMat);
    start = Math.max(start, e);
  }
}

// Crown moulding under the top of every full-height wall.
for (const w of layout.walls) wallTrim(w, 0, w.length, w.height - CROWN.at(-1)[1], CROWN, trimMat);

// Flat casings around the doors (the window card brings its own frame).
for (const w of layout.walls) {
  const groups = w.openings.filter((o) => o.kind === 'door').map((o) => [o]);
  for (const g of groups) {
    const from = Math.min(...g.map((o) => o.from)), to = Math.max(...g.map((o) => o.to));
    const bottom = Math.min(...g.map((o) => o.bottom)), top = Math.max(...g.map((o) => o.top));
    const { width: cw, proud } = CASING;
    const mat = trimMat;
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

// Upright plane w x h standing at `pos` (bottom centre), turned by rotY.
async function card(name, w, h, pos, rotY, { cast = true } = {}) {
  const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
  const mesh = addMesh(geo, cardMaterial(await loadCardTexture(name)), { cast });
  mesh.position.copy(pos);
  mesh.rotation.y = rotY;
  return mesh;
}

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

// A chair model (holder and scaled size from model(), chair local frame: x across, y up from the floor, z towards
// its front; metres): the seat top in the middle of the seat (x = 0), the front of whatever stands below the
// seat (the gas column of a task chair), and the backrest's front at each height above the seat (null above
// the backrest).
const SEAT_RAY_STEP = 0.01, SEAT_MIN_Y = 0.25;
function measureChairSeat({ holder, size }) {
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
  const x = 0;
  // Front to back: the seat is the frontmost run of hits that does not climb more than 8 cm above its start.
  // Hits below SEAT_MIN_Y are the star base and casters reaching out in front of a task chair's seat: no seat.
  const along = steps(-size.z / 2, size.z / 2).reverse().map((z) => [z, down(x, z)])
    .map(([z, h]) => [z, h !== null && h < SEAT_MIN_Y ? null : h]);
  const run = [];
  for (const [z, h] of along) {
    if (h === null && !run.length) continue;
    if (h === null || (run.length && h > run[0][1] + 0.08)) break;
    run.push([z, h]);
  }
  if (run.length < 10) throw new Error(`chair model: no seat surface found (${run.length} hits)`);
  const seatTop = Math.max(...run.map(([, h]) => h));
  const below = steps(0.05, seatTop - 0.12).map((y) => fromFront(x, y)).filter((z) => z !== null);
  if (!below.length) throw new Error('chair model: nothing found below the seat');
  const frontFace = Math.max(...below);
  const backrestY0 = seatTop + 0.04;
  const backrest = steps(backrestY0, size.y).map((y) => fromFront(x, y));
  const backrestAt = (y) => (y < backrestY0 ? null : backrest[Math.round((y - backrestY0) / SEAT_RAY_STEP)] ?? null);
  return { x, seatTop, frontFace, backrestAt };
}

// Seat points of the seated mesh (GLB units): feet bottom, head top, the underside of the seat (lowest point
// behind the middle of its depth: everything lower is lower legs), the back of the lower legs.
function measureFigure(pos) {
  const v = new THREE.Vector3();
  const pts = Array.from({ length: pos.count }, (_, i) => v.fromBufferAttribute(pos, i).clone());
  const box = new THREE.Box3().setFromPoints(pts);
  const zMid = (box.min.z + box.max.z) / 2, height = box.max.y - box.min.y;
  const seatY = Math.min(...pts.filter((p) => p.z < zMid).map((p) => p.y));
  const shin = pts.filter((p) => p.y < seatY);
  if (shin.some((p) => p.z < zMid)) throw new Error(`${USER} model: points below the seat behind the middle of its depth; it is not the seated pose`);
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
// forward if that is what keeps the lower legs clear of the chair's front below the seat.
function fitFigure(fig, seat) {
  const hipY = seat.seatTop - SEAT.sink;
  const s = hipY / (fig.seatY - fig.feetY);
  const y0 = hipY - fig.seatY * s;
  let dz = -Infinity;
  for (const p of fig.back) {
    const zb = seat.backrestAt(y0 + p.y * s);
    if (zb !== null) dz = Math.max(dz, zb - p.z * s);
  }
  if (dz === -Infinity) throw new Error(`chair model: no backrest found behind ${USER}`);
  dz = Math.max(dz, seat.frontFace + SEAT.calfClearance - fig.shinBackZ * s);
  return { s, y0, dz };
}

// ---- his face: the picture on the decal is drawn into a canvas (face.canvas) each frame something on it moves:
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
  spinSpeed: DIZZY_EYES ? DIZZY_EYES.speed * 2 * Math.PI : 0,   // radians per second
  dirty: true,
};
let faceDecal = null;
const fxCards = { fire: null, orbit: [], sweat: null, slide: null };
const facePoints = { temple: new THREE.Vector3(), slideFrom: new THREE.Vector3(), slideTo: new THREE.Vector3() };   // mesh-local, FACE_FX sweat and slide

const faceFxOf = (name) => FACE_FX_OF[name] ?? [];
const smooth = (t) => t * t * (3 - 2 * t);

// Fades User A's face to one of FACE_EXPRESSIONS (and its effects, FACE_FX_OF) over FACE_FADE.ms.
export function setExpression(name) {
  if (!FACE_EXPRESSIONS.includes(name)) throw new Error(`setExpression: unknown expression '${name}' (expected one of ${FACE_EXPRESSIONS.join(', ')})`);
  if (!faceDecal) throw new Error('setExpression: nobody sits in this scene (no ?user)');
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
  const spin = DIZZY_EYES !== null && face.fx.orbit > 0.001;   // the orbit's weight is the dizzy expression's
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

// ---- effects over his head
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
  // The base fades out, so the flames rise out of his hair instead of standing on a straight edge.
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

// A card on his face: at a mesh-local point of the head, `near` metres towards the camera.
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
    fire.material.opacity = wf;
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
// far closed. With either hold, he does not blink by himself.
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
  const load = (name) => imageLoader.loadAsync(asset(`./assets/faces/${USER}_${name}.png`));
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
  // Only the triangles facing the projector: the deep box would also print the face, mirrored, inside the
  // far side of the head.
  const n = geo.attributes.normal, facing = [];
  for (let i = 0; i < n.count; i += 3) {
    const dot = [i, i + 1, i + 2].reduce((sum, k) => sum + n.getX(k) * z.x + n.getY(k) * z.y + n.getZ(k) * z.z, 0);
    if (dot > 0) facing.push(i, i + 1, i + 2);
  }
  geo.setIndex(facing);
  geo.applyMatrix4(mesh.matrixWorld.clone().invert());
  // FACE_FX points on his face: face picture points (fractions, x from the ear side, y down) projected along the
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

// The figure seated on its chair (CHAR.chair, SEAT), facing the chair's front; obj from loadGlb.
async function buildFigure(obj) {
  const meshes = [];
  obj.traverse((m) => { if (m.isMesh) meshes.push(m); });
  if (meshes.length !== 1) throw new Error(`${USER} model: expected one mesh, found ${meshes.length}`);
  const [mesh] = meshes;
  const chair = placedModels[CHAR.chair];
  if (!chair) throw new Error(`${USER}: chair '${CHAR.chair}' is not a placed model`);
  const seat = measureChairSeat(chair);
  const pos = mesh.geometry.attributes.position;
  const fig = measureFigure(pos);
  const fit = fitFigure(fig, seat);
  obj.scale.setScalar(fit.s);
  // Turned about the middle of the seat: that point stays where the unturned fit put it.
  const turn = yawRad(SEAT.turn);
  const pivot = new THREE.Vector3(fig.centreX, 0, fig.seatZ).multiplyScalar(fit.s);
  const turned = pivot.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
  obj.rotation.y = turn;
  obj.position.set(seat.x - turned.x, fit.y0, fit.dz + pivot.z - turned.z);
  chair.holder.add(obj);
  if (!CHAR.phone) throw new Error(`CHARACTERS.${USER}.phone: give the phone in their hands`);
  mesh.add(mobilePhone(CHAR.phone, fit.s));
  await buildFace(mesh);
  if (EMBED) seated = { obj, mesh, s: fit.s, seatY: fig.seatY, hipY: fit.y0 + fig.seatY * fit.s };
}

// Embedded only: the figure and its fit, for breathing about the seat and for the head anchor.
let seated = null;

// ---------------------------------------------------------------- procedural pieces and props

// Drawn here where the TRELLIS mesh came out melted: the manager's desk and what stands on it, the reception
// desk's monitor, telephone and candy jar, and the mobile phone in each figure's hand. The reception desk's
// monitor, telephone, jar and lamp were cut out of reception_desk.glb (work/gen/cd_office_props/cut_glb.py drops
// their triangles and keeps their vertices, so the model's fit box and scale are unchanged; the candy colours
// baked into the counter round the old jar were painted over by patch_counter_texture.py).
// A piece's frame (pieceFrame): metres, x across, y up from the floor, z towards the piece's front; a prop is
// placed in it at [x, y, z] and turned `yaw` degrees, its own front being its local +z.
const PROP_COLOURS = {
  deskTop: '#8a512c', deskBody: '#7a4524', deskPlinth: '#3d281b', handle: '#b49a6a',
  plastic: '#2a2a2d', keys: '#3c3c40', screen: '#0c0e12',
  deskPhone: '#2f3033', deskPhoneKeys: '#55565b',
  cup: '#2e3f6e', cupInside: '#1c2645', pens: ['#2f55b8', '#1d1d20', '#c23a32'],
  paper: '#f6f3ea', clipboard: '#8c6a44', clip: '#b8b6b0', coaster: '#b38c5c', deskPad: '#2e3b34',
  jarGlass: '#eef4f4', jarLid: '#cfcac2', sweets: ['#e0433a', '#f2b632', '#4fae5b', '#ef7f2e', '#e978a8', '#4a86d8'],
  mobile: '#1f2023',
};

// Wood: fine wavy grain a little darker and lighter than the base colour, along u (whole waves, so it tiles).
function woodTexture(hex) {
  return canvasTexture([512, 512], (g, w, h) => {
    g.fillStyle = hex;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const y = rand() * h, amp = 2 + rand() * 7, f = (2 * Math.PI * (1 + Math.floor(rand() * 3))) / w, ph = rand() * 2 * Math.PI;
      g.strokeStyle = shade(hex, 0.84 + rand() * 0.24);
      g.globalAlpha = 0.35 + rand() * 0.3;
      g.lineWidth = 1 + rand() * 2.5;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + amp * Math.sin(x * f + ph));
      g.stroke();
    }
  });
}

const woodTopMat = clay({ map: woodTexture(PROP_COLOURS.deskTop), bumpScale: 0.25 });
const woodBodyMat = clay({ map: woodTexture(PROP_COLOURS.deskBody), bumpScale: 0.25 });
const plinthMat = clay({ color: PROP_COLOURS.deskPlinth, bumpScale: 0.2 });
const handleMat = matte({ color: PROP_COLOURS.handle, roughness: 0.45 });
const plasticMat = matte({ color: PROP_COLOURS.plastic, roughness: 0.55 });
const keysMat = matte({ color: PROP_COLOURS.keys, roughness: 0.7 });
// Screens are dark and glossy: they take more of the room environment than the matte room (envMapIntensity).
const screenMat = new THREE.MeshStandardMaterial({ color: PROP_COLOURS.screen, roughness: 0.12, metalness: 0 });
screenMat.userData.envMapIntensity = 0.7;
const deskPhoneMat = matte({ color: PROP_COLOURS.deskPhone, roughness: 0.5 });
const deskPhoneKeysMat = matte({ color: PROP_COLOURS.deskPhoneKeys, roughness: 0.6 });
const cupMats = [matte({ color: PROP_COLOURS.cup, roughness: 0.45 }), matte({ color: PROP_COLOURS.cupInside }), matte({ color: PROP_COLOURS.cup })];
const penMats = PROP_COLOURS.pens.map((color) => matte({ color, roughness: 0.4 }));
const paperMat = matte({ color: PROP_COLOURS.paper });
const clipboardMat = matte({ color: PROP_COLOURS.clipboard, roughness: 0.8 });
const clipMat = matte({ color: PROP_COLOURS.clip, roughness: 0.35 });
const jarGlassMat = new THREE.MeshStandardMaterial({ color: PROP_COLOURS.jarGlass, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
jarGlassMat.userData.envMapIntensity = 0.8;
const jarLidMat = matte({ color: PROP_COLOURS.jarLid, roughness: 0.35 });
const coasterMat = clay({ color: PROP_COLOURS.coaster, bumpScale: 0.6 });
const deskPadMat = matte({ color: PROP_COLOURS.deskPad, roughness: 0.7 });
const sweetMats = PROP_COLOURS.sweets.map((color) => matte({ color, roughness: 0.3 }));
const mobileMat = matte({ color: PROP_COLOURS.mobile, roughness: 0.5 });

const rounded = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r);

// A mesh added to `parent` at `at`, turned `yaw` degrees about the vertical.
function part(parent, geo, mat, at = [0, 0, 0], yaw = 0, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.position.set(...at);
  mesh.rotation.y = yawRad(yaw);
  parent.add(mesh);
  return mesh;
}

// An empty group in `parent` at `at`, turned `yaw` degrees: the frame a prop is built in.
function propFrame(parent, at, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(...at);
  g.rotation.y = yawRad(yaw);
  parent.add(g);
  return g;
}

// A layout.json piece's frame in the scene.
const pieceFrame = (p) => propFrame(scene, toV(p.x, p.y, p.z).toArray(), p.yaw_deg);

// A flat-panel monitor; origin under the middle of the panel, on the surface it stands on; screen towards +z.
// panel [w, h, d], bezel round the screen, lift: the panel's bottom above the surface; the neck behind the panel,
// the foot under the neck.
const MONITOR = { panel: [0.56, 0.33, 0.022], bezel: 0.012, lift: 0.045, back: [0.3, 0.2, 0.018], neck: [0.06, 0.03], foot: [0.24, 0.012, 0.17] };
function monitor(parent, at, yaw) {
  const g = propFrame(parent, at, yaw);
  const { panel: [w, h, d], bezel, lift, back, neck, foot } = MONITOR;
  const cy = lift + h / 2;
  part(g, rounded(w, h, d, 0.008), plasticMat, [0, cy, 0]);
  part(g, new THREE.PlaneGeometry(w - 2 * bezel, h - 2 * bezel), screenMat, [0, cy, d / 2 + 0.0005]);
  part(g, rounded(...back, 0.006), plasticMat, [0, cy, -(d + back[2]) / 2 + 0.004]);
  const neckZ = -d / 2 - back[2] - neck[1] / 2 + 0.006;
  part(g, rounded(neck[0], cy, neck[1], 0.008), plasticMat, [0, cy / 2, neckZ]);
  part(g, rounded(...foot, 0.005), plasticMat, [0, foot[1] / 2, neckZ + 0.03]);
}

// A keyboard, its keys towards its user (+z).
function keyboard(parent, at, yaw) {
  const g = propFrame(parent, at, yaw);
  part(g, rounded(0.42, 0.016, 0.135, 0.005), plasticMat, [0, 0.008, 0]);
  part(g, new THREE.BoxGeometry(0.39, 0.004, 0.1), keysMat, [0, 0.017, 0.006]);
}

// A desk telephone, its keypad and display at the front (+z), the handset lying across the back.
function deskPhone(parent, at, yaw) {
  const g = propFrame(parent, at, yaw);
  part(g, rounded(0.2, 0.055, 0.18, 0.014), deskPhoneMat, [0, 0.0275, 0]);
  part(g, rounded(0.09, 0.008, 0.075, 0.003), deskPhoneKeysMat, [0.035, 0.056, 0.042]);
  part(g, rounded(0.06, 0.006, 0.03, 0.002), screenMat, [-0.055, 0.056, 0.05]);
  part(g, rounded(0.21, 0.04, 0.055, 0.018), deskPhoneMat, [0, 0.07, -0.05]);
}

// A pen cup with three pens leaning out of it: each pen at [x, z] in the cup, tipped [about x, about z] radians.
const PEN_CUP = { radius: 0.038, height: 0.1, pen: [0.0045, 0.15], pens: [[0.01, -0.008, 0.12, -0.2], [-0.012, 0.004, -0.06, 0.16], [0.004, 0.014, 0.22, 0.04]] };
function penCup(parent, at) {
  const g = propFrame(parent, at);
  const { radius: r, height: h, pen: [pr, pl], pens } = PEN_CUP;
  part(g, new THREE.CylinderGeometry(r, r * 0.94, h, 32), cupMats, [0, h / 2, 0]);
  pens.forEach(([x, z, ax, az], i) => {
    const barrel = part(g, new THREE.CylinderGeometry(pr, pr, pl, 12).translate(0, pl / 2, 0), penMats[i], [x, 0.012, z]);
    barrel.rotation.set(ax, 0, az);
    part(barrel, new THREE.CylinderGeometry(pr * 1.25, pr * 1.25, 0.035, 12), penMats[1], [0, pl - 0.0175, 0]);
  });
}

// A few loose sheets of paper, each a little off the one below.
function paperStack(parent, at, yaw) {
  const g = propFrame(parent, at, yaw);
  [[0, 0, 0], [0.006, -0.004, 3], [-0.004, 0.005, -2], [0.003, 0.002, 5]].forEach(([x, z, turn], i) => {
    part(g, new THREE.BoxGeometry(0.21, 0.0025, 0.297), paperMat, [x, 0.00125 + i * 0.0026, z], turn);
  });
}

// A clipboard lying flat, its clip away from +z.
function clipboard(parent, at, yaw) {
  const g = propFrame(parent, at, yaw);
  part(g, rounded(0.23, 0.006, 0.32, 0.0025), clipboardMat, [0, 0.003, 0]);
  part(g, new THREE.BoxGeometry(0.21, 0.002, 0.27), paperMat, [0, 0.007, 0.012]);
  part(g, rounded(0.1, 0.012, 0.035, 0.004), clipMat, [0, 0.009, -0.135]);
}

// A clear glass candy jar with a lid on a cork coaster (`coaster` [radius, thickness]; on the reception counter it
// also covers the hole the old jar's foot left): `sweets` round sweets of `sweet` radius heaped in its lower half.
const CANDY_JAR = { radius: 0.07, height: 0.13, lid: 0.022, knob: 0.014, sweets: 22, sweet: 0.0125, coaster: [0.085, 0.007] };
function candyJar(parent, at) {
  const { radius: r, height: h, lid, knob, sweets, sweet, coaster: [cr, ct] } = CANDY_JAR;
  part(propFrame(parent, at), new THREE.CylinderGeometry(cr, cr, ct, 48), coasterMat, [0, ct / 2, 0]);
  const g = propFrame(parent, [at[0], at[1] + ct, at[2]]);
  for (let i = 0; i < sweets; i++) {
    const a = rand() * 2 * Math.PI, d = Math.sqrt(rand()) * (r - sweet - 0.004);
    const layer = Math.floor(i / 8);
    part(g, new THREE.SphereGeometry(sweet, 16, 12), sweetMats[i % sweetMats.length],
      [d * Math.cos(a), 0.006 + sweet + layer * 1.6 * sweet + rand() * 0.004, d * Math.sin(a)], 0, { cast: false });
  }
  const glass = part(g, new THREE.CylinderGeometry(r, r, h, 40, 1, true), jarGlassMat, [0, h / 2, 0], 0, { cast: false });
  glass.userData.noAO = true;
  glass.renderOrder = 1;
  // Sweets and lid cast no shadow: through the glass it would print a dark disc on the counter inside the jar.
  part(g, new THREE.CylinderGeometry(r + 0.004, r + 0.004, lid, 40), jarLidMat, [0, h + lid / 2, 0], 0, { cast: false });
  part(g, new THREE.SphereGeometry(knob, 16, 12), jarLidMat, [0, h + lid + knob * 0.6, 0], 0, { cast: false });
}

// The mobile phone in a figure's hands (CHARACTERS[...].phone), a child of the figure's mesh (scaled by s, the
// figure's fit): a slim rounded slab, size [w, h, d] metres, dark glossy screen `bezel` in from its edges.
const MOBILE = { size: [0.07, 0.15, 0.008], radius: 0.0035, bezel: 0.004 };
function mobilePhone({ at, long, towards }, s) {
  const [w, h, d] = MOBILE.size;
  const z = new THREE.Vector3(...towards).normalize();
  const y = new THREE.Vector3(...long).projectOnPlane(z);
  if (y.length() < 0.5) throw new Error(`CHARACTERS.${USER}.phone: long ${long} is not across towards ${towards}`);
  y.normalize();
  const phone = new THREE.Group();
  phone.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
  phone.position.set(...at);
  phone.scale.setScalar(1 / s);
  part(phone, rounded(w, h, d, MOBILE.radius), mobileMat);
  part(phone, new THREE.PlaneGeometry(w - 2 * MOBILE.bezel, h - 2 * MOBILE.bezel), screenMat, [0, 0, d / 2 + 0.0003]);
  return phone;
}

// The manager's desk (layout.json manager_desk, its size [W, D, H]): a top with bevelled edges, overhanging
// the two pedestals by `overhang`; three drawers in each pedestal on his side (-z), `drawers` the shares of
// their height; a modesty panel between the pedestals on the visitors' side, `panelInset` back from their faces;
// dark plinths. Its props stand where the TRELLIS desk it replaces had them (monitor turned towards his chair).
const MANAGER_DESK = {
  top: 0.045, overhang: 0.03, pedestal: 0.43, plinth: 0.06, plinthInset: 0.02, gap: 0.01, drawers: [0.3, 0.33, 0.37],
  panelInset: 0.03, panelBottom: 0.14, panel: 0.025,
  monitor: { at: [-0.525, 0.147], yaw: 152 }, keyboard: { at: [-0.4, -0.09], yaw: 152 },
  phone: { at: [0.6, -0.12], yaw: -136 }, penCup: [-0.05, 0.21], papers: { at: [0.22, 0.02], yaw: 8 },
};
function managerDesk(p) {
  const g = pieceFrame(p);
  const [W, D, H] = p.size;
  const d = MANAGER_DESK;
  part(g, rounded(W, d.top, D, 0.012), woodTopMat, [0, H - d.top / 2, 0]);
  const bodyD = D - 2 * d.overhang, bodyH = H - d.top - d.plinth;
  const drawerSpace = bodyH - (d.drawers.length + 1) * d.gap;
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - d.overhang - d.pedestal / 2);
    part(g, rounded(d.pedestal, bodyH, bodyD, 0.008), woodBodyMat, [x, d.plinth + bodyH / 2, 0]);
    part(g, new THREE.BoxGeometry(d.pedestal - 2 * d.plinthInset, d.plinth, bodyD - 2 * d.plinthInset), plinthMat, [x, d.plinth / 2, 0]);
    let top = d.plinth + bodyH - d.gap;
    for (const share of d.drawers) {
      const dh = share * drawerSpace;
      part(g, rounded(d.pedestal - 2 * d.gap, dh, 0.014, 0.004), woodTopMat, [x, top - dh / 2, -bodyD / 2 - 0.005]);
      part(g, rounded(0.11, 0.012, 0.014, 0.005), handleMat, [x, top - dh * 0.3, -bodyD / 2 - 0.016]);
      top -= dh + d.gap;
    }
  }
  const panelW = W - 2 * d.overhang - 2 * d.pedestal, panelH = H - d.top - d.panelBottom;
  part(g, rounded(panelW + 0.02, panelH, d.panel, 0.005), woodBodyMat, [0, d.panelBottom + panelH / 2, bodyD / 2 - d.panelInset - d.panel / 2]);
  const on = ([x, z]) => [x, H, z];
  monitor(g, on(d.monitor.at), d.monitor.yaw);
  keyboard(g, on(d.keyboard.at), d.keyboard.yaw);
  deskPhone(g, on(d.phone.at), d.phone.yaw);
  penCup(g, on(d.penCup));
  paperStack(g, on(d.papers.at), d.papers.yaw);
}

// The reception desk's props (reception_desk.glb's piece frame): on the inner work surface (`work` high, behind
// the counter) the monitor turned to her, and a desk pad (`pad` [w, h, d]) with the telephone on it, over where
// the old telephone stood; on the counter (`counter` high) the candy jar and the sign-in clipboard (over the hole
// the old monitor's foot left).
const RECEPTION_DESK = {
  work: 0.75, counter: 1.03,
  monitor: { at: [0.62, -0.12], yaw: 140 },
  pad: { at: [-0.15, -0.32], size: [0.56, 0.014, 0.3] }, phone: { at: [-0.2, -0.33], yaw: 120 },
  candyJar: [1.075, 0.36], clipboard: { at: [-0.01, 0.33], yaw: -6 },
};
function receptionDeskProps(p) {
  const g = pieceFrame(p);
  const d = RECEPTION_DESK;
  monitor(g, [d.monitor.at[0], d.work, d.monitor.at[1]], d.monitor.yaw);
  const [pw, ph, pd] = d.pad.size;
  part(g, rounded(pw, ph, pd, 0.004), deskPadMat, [d.pad.at[0], d.work + ph / 2, d.pad.at[1]]);
  deskPhone(g, [d.phone.at[0], d.work + ph, d.phone.at[1]], d.phone.yaw);
  candyJar(g, [d.candyJar[0], d.counter, d.candyJar[1]]);
  clipboard(g, [d.clipboard.at[0], d.counter, d.clipboard.at[1]], d.clipboard.yaw);
}

// Placed GLB pieces by layout.json kind ({ holder, size } from model()), for the chairs the figures sit on.
const placedModels = {};
const modelsUsed = {};   // kind -> how many of its `models` list are taken

async function buildPiece(p) {
  const spec = ASSETS[p.kind];
  if (!spec) throw new Error(`layout.json piece kind ${p.kind} (${p.source}) has no entry in ASSETS`);
  if (spec.build) return spec.build(p);
  let name = spec.model;
  if (spec.models) {
    const i = modelsUsed[p.kind] = (modelsUsed[p.kind] ?? -1) + 1;
    name = spec.models[i];
    if (!name) throw new Error(`layout.json has more ${p.kind} pieces than ASSETS.${p.kind}.models (${spec.models.length})`);
  }
  const placed = await model(name, p, measuredSize(p, spec), spec.turn ?? 0, 1, spec.fit, spec.heightOver);
  if (spec.seat) placedModels[p.kind] = placed;
  if (spec.props) spec.props(p);
}

// The window card over each window opening, WINDOW_CARD.margin wider; glass behind it.
async function buildWindows() {
  const jobs = [];
  for (const w of layout.walls) {
    for (const o of w.openings.filter((o) => o.kind === 'window')) {
      const glass = addMesh(new THREE.PlaneGeometry(o.to - o.from, o.top - o.bottom), glassMat, { cast: false });
      glass.position.copy(wallPoint(w, (o.from + o.to) / 2, (o.bottom + o.top) / 2, -w.thickness / 2));
      glass.rotation.y = wallFacing(w);
      const m = WINDOW_CARD.margin;
      jobs.push(card(WINDOW_CARD.card, o.to - o.from + 2 * m, o.top - o.bottom + 2 * m,
        wallPoint(w, (o.from + o.to) / 2, o.bottom - m, 0.012), wallFacing(w), { cast: false }));
    }
  }
  await Promise.all(jobs);
}

async function buildDoors() {
  const jobs = [];
  for (const w of layout.walls) {
    for (const o of w.openings.filter((o) => o.kind === 'door')) {
      jobs.push(card('entrance_door', o.to - o.from, o.top - o.bottom, wallPoint(w, (o.from + o.to) / 2, o.bottom, 0.006), wallFacing(w), { cast: false }));
    }
  }
  await Promise.all(jobs);
}

// The glass partition along plan x = partition.x from y0 to y1: black posts PARTITION.bay apart and along the
// top and bottom, glass panes with blinds drawn on them, and the door (the entrance-door card, both faces).
const glassMat = new THREE.MeshStandardMaterial({ color: PARTITION.glass, transparent: true, opacity: PARTITION.glassOpacity, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
glassMat.userData.envMapIntensity = 0.5;
async function buildPartition() {
  const P = layout.partition, f = PARTITION.frame;
  const frameMat = clay({ color: '#2b2a29', bumpScale: 0.2 });
  const len = P.y1 - P.y0;
  const at = (y, h) => toV(P.x, P.y0 + y, h);
  const post = (y) => { const m = addMesh(new THREE.BoxGeometry(f, P.height, f), frameMat); m.position.copy(at(y, P.height / 2)); };
  const rail = (y0, y1, h) => { const m = addMesh(new THREE.BoxGeometry(f, f, y1 - y0), frameMat); m.position.copy(at((y0 + y1) / 2, h)); };
  const door = P.door;
  const spans = [[0, door.from], [door.to, len]];
  const doorTop = 2.1;
  const blinds = canvasTexture([64, 256], (g, w, h) => {
    const n = Math.round((P.height * PARTITION.blindsTo) / PARTITION.slat);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      g.fillStyle = PARTITION.slatColour;
      g.fillRect(0, (i / n) * h, w, (h / n) * 0.72);
    }
  });
  blinds.wrapS = THREE.RepeatWrapping;
  const blindsMat = matte({ map: blinds, transparent: true, opacity: PARTITION.blindsOpacity, side: THREE.DoubleSide, depthWrite: false });
  for (const [s0, s1] of spans) {
    const bays = Math.max(1, Math.round((s1 - s0) / PARTITION.bay));
    for (let i = 0; i <= bays; i++) post(s0 + ((s1 - s0) * i) / bays);
    rail(s0, s1, f / 2);
    rail(s0, s1, P.height - f / 2);
    const pane = addMesh(new THREE.PlaneGeometry(s1 - s0, P.height - 2 * f), glassMat, { cast: false });
    pane.position.copy(at((s0 + s1) / 2, P.height / 2));
    pane.rotation.y = Math.PI / 2;
    pane.userData.noAO = true;
    const bh = (P.height - 2 * f) * PARTITION.blindsTo;
    const blind = addMesh(new THREE.PlaneGeometry(s1 - s0, bh), blindsMat, { cast: false });
    blind.position.copy(at((s0 + s1) / 2, P.height - f - bh / 2)).add(new THREE.Vector3(0.012, 0, 0));
    blind.rotation.y = Math.PI / 2;
    blind.userData.noAO = true;
  }
  rail(door.from, door.to, doorTop + f / 2);
  const over = addMesh(new THREE.PlaneGeometry(door.to - door.from, P.height - doorTop - f), glassMat, { cast: false });
  over.position.copy(at((door.from + door.to) / 2, (doorTop + P.height) / 2));
  over.rotation.y = Math.PI / 2;
  over.userData.noAO = true;
  for (const side of [-1, 1]) {
    const pos = at((door.from + door.to) / 2, 0).add(new THREE.Vector3(side * 0.008, 0, 0));
    await card('entrance_door', door.to - door.from, doorTop, pos, side * Math.PI / 2, { cast: false });
  }
}

// A WALL_FLATS card: sized from its image, centred at `along` and `y`, facing out of the wall's inner face.
async function wallFlat(f) {
  const w = layout.walls.find((q) => q.id === f.wall);
  if (!w) throw new Error(`wall flat ${f.card}: no wall ${f.wall} in layout.json`);
  const tex = await loadCardTexture(f.card);
  const aspect = tex.image.width / tex.image.height;
  const [cw, ch] = f.w ? [f.w, f.w / aspect] : [f.h * aspect, f.h];
  if (!w.free_spans.some(([s, e]) => f.along - cw / 2 >= s && f.along + cw / 2 <= e)) {
    throw new Error(`wall flat ${f.card}: [${(f.along - cw / 2).toFixed(3)}, ${(f.along + cw / 2).toFixed(3)}] is not inside a free span of wall ${w.id} ${JSON.stringify(w.free_spans)}`);
  }
  const mesh = addMesh(new THREE.PlaneGeometry(cw, ch), cardMaterial(tex), { cast: false });
  mesh.position.copy(wallPoint(w, f.along, f.y, f.off));
  mesh.rotation.y = wallFacing(w);
}

// ---------------------------------------------------------------- inside-only ceiling

// Shown only once the camera is down among the walls (the Inside view), so the Dollhouse view keeps its
// open top: a ceiling over the room at the wall tops with a flush light over each desk. It fades in as the
// camera drops from fade[0] above the wall tops to fade[1] (below them), the background turning `background`.
// The ceiling faces down, away from the key light: ceilingLift (emissive share of its colour) keeps it off-white.
const INSIDE_ONLY = { ceiling: '#f8f4ec', ceilingLift: 0.3, fixture: '#fdf8ef', fixtureGlow: '#fff1d8', background: '#d6d0c6', fade: [0.2, -0.6], fixture_size: [1.1, 0.5] };
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
  for (const kind of ['reception_desk', 'manager_desk']) {
    const p = layout.pieces.find((q) => q.kind === kind);
    const [w, d] = INSIDE_ONLY.fixture_size;
    const panel = insideOnly(addMesh(new THREE.BoxGeometry(w, 0.03, d), fixtureMat));
    panel.position.copy(toV(p.x, p.y, wallTop - 0.015));
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

// ---------------------------------------------------------------- camera views, transition, zoom, orbit

// Inside view: the figure's CHAR.inside (eye at plan x, y and height, looking at a piece at a share of its height).
const pieceOf = (kind) => {
  const p = layout.pieces.find((q) => q.kind === kind);
  if (!p) throw new Error(`layout.json has no ${kind} piece`);
  return p;
};
const lookAt = ({ kind, share }) => { const p = pieceOf(kind); return toV(p.x, p.y, p.z + p.size[2] * share); };
const INSIDE = CHAR.inside;
const insideEye = toV(...INSIDE.eye);
const insideTarget = lookAt(INSIDE.target);

const crop = layout.crop;
const roomCentre = toV((crop[0] + crop[2]) / 2, (crop[1] + crop[3]) / 2, 0.6);
const VIEWS = {
  // From outside, above the open front, whole room in view.
  dollhouse: { pos: roomCentre.clone().add(new THREE.Vector3(0.6, 8.5, 11.5)), target: roomCentre.clone().add(new THREE.Vector3(0, 0, -0.3)), fov: 34, hfov: 56 },
  inside:    { pos: insideEye, target: insideTarget, fov: 52, hfov: 70 },
};
const ORBIT = { yaw: THREE.MathUtils.degToRad(10), pitch: THREE.MathUtils.degToRad(4), damping: 0.06 };
const DOLLY = { min: -0.5, max: 1.0, wheel: 0.0025, pinch: 0.008, damping: 0.12 };
const TRANSITION_MS = 1500;

const figureModel = loadGlb(CHAR.model, 0.9);   // seated after its chair is placed
await Promise.all([
  buildWindows(), buildDoors(), buildPartition(),
  ...WALL_FLATS.map(wallFlat),
  ...layout.pieces.map(buildPiece),
]);
await buildFigure(await figureModel);
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
// To it: ready (room built); anchor { x, y } (top of his head on screen, 0..1 from the top left; sent when it
// moves); error { message }.
// Shots: inside = VIEWS.inside; him (HIM, the seated figure; the name is the Demo page's); object = from the Inside eye
// onto CHAR.object (a piece kind at a share of its height, or a WALL_FLATS card); near = pushed in from the Inside
// eye towards his face (NEAR.share of the way), aimed NEAR.right metres to the camera's right of it and
// NEAR.down below it, so he sits left of the phone the page shows at the right.
const BREATH = { depth: 0.008, ms: 4200 };
const NEAR = { share: 0.22, right: 0.3, down: 0.12, fov: 40, hfov: 52 };
const HEAD_TOP = 0.16;   // metres above his face centre: the anchor the page's thought bubble sits on
const send = (msg) => window.parent.postMessage({ mpb: msg.type, ...msg }, location.origin);
const facePoint = () => {
  faceDecal.geometry.computeBoundingSphere();
  return faceDecal.localToWorld(faceDecal.geometry.boundingSphere.center.clone());
};
const HIM = { down: 0.25, fov: 44, hfov: 58 };   // him: from the Inside eye, aimed HIM.down below his face
// CHAR.object: { kind, share } (a layout.json piece) or { card } (a WALL_FLATS card's centre).
function objectTarget(o) {
  if (!o.card) return lookAt(o);
  const f = WALL_FLATS.find((q) => q.card === o.card);
  if (!f) throw new Error(`object shot: no wall flat ${o.card}`);
  return wallPoint(layout.walls.find((w) => w.id === f.wall), f.along, f.y, f.off);
}
const EMBED_SHOTS = {
  inside: () => VIEWS.inside,
  him: () => ({ pos: insideEye, target: facePoint().add(new THREE.Vector3(0, -HIM.down, 0)), fov: HIM.fov, hfov: HIM.hfov }),
  object: () => ({ pos: insideEye, target: objectTarget(CHAR.object), fov: 30, hfov: 40 }),
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
