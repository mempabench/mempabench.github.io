// Overview hero prototype: the top of a pale globe with four crystal balls standing on it.
// Each ball holds one user's world (assets/world_<key>.png, drawn on a sprite that faces the camera).
// Hovering (desktop) or swiping / tapping (touch) turns the globe so one ball comes to the front.
import * as THREE from 'three';

// ---------------------------------------------------------------- knobs
const GLOBE_RADIUS = 22;          // world units; larger = flatter horizon
const BALL_RADIUS = 1.1;          // the four user balls
const RING_COLATITUDE_DEG = 16;   // how far from the north pole the four balls stand (= their outward lean)
const USERS = [                   // evenly round the ring; at rest B and C stand front-left and front-right, A and D behind
  { key: 'a', label: 'User A', lonDeg: -135 },
  { key: 'b', label: 'User B', lonDeg: -45 },
  { key: 'c', label: 'User C', lonDeg: 45 },
  { key: 'd', label: 'User D', lonDeg: 135 },
];
const FOCUS_SCALE = 1.5;          // the front ball grows this much
const ROTATE_SMOOTH_TIME = 0.75;  // seconds; critically damped spring for the globe yaw
const SCALE_SMOOTH_TIME = 0.35;   // seconds; same spring for the ball growth
const IDLE_DRIFT_DEG = 3;         // resting sway amplitude (only while nothing is focused)
const IDLE_DRIFT_PERIOD_S = 48;
const WORLD_FILL = 0.82;          // world image side as a fraction of the ball diameter
const WORLD_DROP = 0.12;          // world image centre lowered by this fraction of the ball radius
const DISTANT_BALL_COUNT = 32;    // spread round the whole globe, outside the ring of the four
const DISTANT_COLAT_DEG = [RING_COLATITUDE_DEG + 4, RING_COLATITUDE_DEG + 10]; // just past the back horizon
const DISTANT_FADE_DEG = [100, 125]; // camera-relative longitude: hidden below the first, fully shown past the second

const COLORS = {
  bg: '#f8f4eb', card: '#fffdf8', ink: '#231f1b',
  accent: '#d2b7b2', accentEdge: '#a8756b',
  sage: '#6f9f86', butter: '#f0c987', sky: '#8fa9d6',
};
const CAMERA_DISTANCE = 11;       // from the aim point above the front ball (desktop)
const CAMERA_ELEVATION_DEG = 10;  // how far the camera looks down
const CAMERA_AIM_HEIGHT = 1.45;   // aim point above the front ball's foot; higher = balls sit lower in frame
const LIGHT_DIR = new THREE.Vector3(-0.55, 1.0, 0.65).normalize(); // towards the sun: upper left, in front

// ---------------------------------------------------------------- setup
const hero = document.getElementById('globe-hero');
const labelEl = document.getElementById('globe-label');
const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
hero.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.bg, 16, 42);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight('#fffaf1', '#efe4d2', 2.1));
const sun = new THREE.DirectionalLight('#fff4e2', 1.5);
sun.position.copy(LIGHT_DIR).multiplyScalar(30);
scene.add(sun);

// The globe group rotates about the vertical axis through the globe centre; everything on the globe is its child.
const globe = new THREE.Group();
globe.position.set(0, -GLOBE_RADIUS, 0); // north pole at the world origin
scene.add(globe);

const deg = THREE.MathUtils.degToRad;
const surfaceDir = (colatDeg, lonDeg) => new THREE.Vector3(
  Math.sin(deg(colatDeg)) * Math.sin(deg(lonDeg)),
  Math.cos(deg(colatDeg)),
  Math.sin(deg(colatDeg)) * Math.cos(deg(lonDeg)),
);

// ---------------------------------------------------------------- distant ball layout (deterministic)
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const angleBetween = (a, b) => Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));

// Aim at a point above the front ball so the balls stand in the lower half and the sky sits above them.
function cameraPose(aspect) {
  const front = surfaceDir(RING_COLATITUDE_DEG, 0).multiplyScalar(GLOBE_RADIUS).add(globe.position);
  const aim = front.add(new THREE.Vector3(0, CAMERA_AIM_HEIGHT, 0));
  // Narrow screens: pull back so the front ball keeps about a third of the width and its neighbours peek in.
  const distance = CAMERA_DISTANCE * THREE.MathUtils.clamp(1.3 / aspect, 1, 1.35);
  const offset = new THREE.Vector3(0, Math.sin(deg(CAMERA_ELEVATION_DEG)), Math.cos(deg(CAMERA_ELEVATION_DEG)));
  return { position: aim.clone().addScaledVector(offset, distance), aim };
}

const heroDirs = USERS.map((u) => surfaceDir(RING_COLATITUDE_DEG, u.lonDeg));
const distantSpecs = [];
{
  const rand = mulberry32(20261023);
  for (let tries = 0; distantSpecs.length < DISTANT_BALL_COUNT && tries < 4000; tries++) {
    // Outside the ring, never inside it: seen from the front they are always beyond the four balls.
    const lon = rand() * 360 - 180;
    const colat = DISTANT_COLAT_DEG[0] + rand() * (DISTANT_COLAT_DEG[1] - DISTANT_COLAT_DEG[0]);
    const dir = surfaceDir(colat, lon);
    if (heroDirs.some((h) => angleBetween(h, dir) < deg(9))) continue;
    const radius = BALL_RADIUS * (0.42 + rand() * 0.28);
    if (distantSpecs.some((s) => angleBetween(s.dir, dir) < (s.radius + radius) / GLOBE_RADIUS * 2.6)) continue;
    distantSpecs.push({ dir, radius, holdsShape: rand() < 0.55 });
  }
}

// ---------------------------------------------------------------- globe surface: soft pale land and water
const GLSL_NOISE = /* glsl */`
  float gh_hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float gh_noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(gh_hash(i), gh_hash(i + vec3(1, 0, 0)), f.x), mix(gh_hash(i + vec3(0, 1, 0)), gh_hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(gh_hash(i + vec3(0, 0, 1)), gh_hash(i + vec3(1, 0, 1)), f.x), mix(gh_hash(i + vec3(0, 1, 1)), gh_hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float gh_fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * gh_noise(p); p *= 2.03; a *= 0.5; } return s; }
`;
const islandCount = heroDirs.length + distantSpecs.length;
// Every ball stands on land: a land bump around each ball's foot.
const islands = [
  ...heroDirs.map((d) => new THREE.Vector4(d.x, d.y, d.z, (BALL_RADIUS * 2.6) / GLOBE_RADIUS)),
  ...distantSpecs.map((s) => new THREE.Vector4(s.dir.x, s.dir.y, s.dir.z, (s.radius * 2.6) / GLOBE_RADIUS)),
];
const mixHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const globeMaterial = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
globeMaterial.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, {
    uIslands: { value: islands },
    uWaterDeep: { value: mixHex(COLORS.sky, COLORS.card, 0.14) },
    uWaterShallow: { value: mixHex(COLORS.sky, COLORS.card, 0.42) },
    uShore: { value: mixHex(COLORS.butter, COLORS.bg, 0.4) },
    uLand: { value: mixHex(COLORS.sage, COLORS.bg, 0.26) },
    uLandLight: { value: mixHex(COLORS.sage, COLORS.bg, 0.5) },
    uField: { value: mixHex(COLORS.butter, COLORS.bg, 0.22) },
  });
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGlobeDir;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlobeDir = normalize(position);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      #define ISLAND_COUNT ${islandCount}
      varying vec3 vGlobeDir;
      uniform vec4 uIslands[ISLAND_COUNT];
      uniform vec3 uWaterDeep, uWaterShallow, uShore, uLand, uLandLight, uField;
      ${GLSL_NOISE}
      vec3 globeColor(vec3 d) {
        float h = gh_fbm(d * 3.2 + vec3(1.7, 0.3, 4.1));
        float isl = 0.0;
        for (int i = 0; i < ISLAND_COUNT; i++) {
          float ang = acos(clamp(dot(d, uIslands[i].xyz), -1.0, 1.0));
          isl = max(isl, 1.0 - smoothstep(uIslands[i].w * 0.6, uIslands[i].w, ang));
        }
        h = max(h, mix(h, 0.64, isl));
        float aa = fwidth(h) * 1.5 + 0.003;
        float landMask = smoothstep(0.52 - aa, 0.52 + aa, h);
        vec3 water = mix(uWaterDeep, uWaterShallow, smoothstep(0.36, 0.515, h));
        float shoreMask = smoothstep(0.52 - aa, 0.52 + aa, h) * (1.0 - smoothstep(0.535, 0.56, h));
        float fields = smoothstep(0.62, 0.72, gh_fbm(d * 9.0 + vec3(5.2, 1.1, 0.7)));
        vec3 land = mix(uLand, uLandLight, smoothstep(0.55, 0.75, h));
        land = mix(land, uField, fields * 0.55);
        land = mix(land, uShore, shoreMask);
        return mix(water, land, landMask);
      }`)
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = globeColor(normalize(vGlobeDir));');
};
globe.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 384, 192), globeMaterial));

// ---------------------------------------------------------------- glass
const glassUniforms = (opacity, back) => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
  uBack: { value: back ? 1 : 0 },
  uOpacity: { value: opacity },
  uTint: { value: new THREE.Color('#ffffff') },
  uSkyRefl: { value: new THREE.Color('#fffbf3') },
  uGroundRefl: { value: mixHex(COLORS.sage, COLORS.bg, 0.45) },
  uEdge: { value: mixHex(COLORS.accentEdge, COLORS.ink, 0.25).lerp(new THREE.Color(COLORS.bg), 0.35) },
  uLightDir: { value: LIGHT_DIR.clone() },
}]);
const GLASS_VERTEX = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const GLASS_FRAGMENT = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform float uBack, uOpacity;
  uniform vec3 uTint, uSkyRefl, uGroundRefl, uLightDir, uEdge;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 n = normalize(vWorldNormal) * (uBack > 0.5 ? -1.0 : 1.0);
    vec3 v = normalize(vViewDir);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, 2.4);
    vec3 r = reflect(-v, n);
    // Reflected surroundings: bright warm sky above, the pale globe below.
    vec3 env = mix(uGroundRefl, uSkyRefl, smoothstep(-0.15, 0.25, r.y));
    // A soft window-like highlight from the sun and a weaker one opposite it.
    float key = pow(max(dot(r, uLightDir), 0.0), 40.0) * 0.55;
    float keySoft = pow(max(dot(r, uLightDir), 0.0), 8.0) * 0.1;
    float bounce = pow(max(dot(r, normalize(vec3(-uLightDir.x, -0.2, -uLightDir.z * 0.2 + 0.4))), 0.0), 18.0) * 0.18;
    // A soft crescent of window light inside the upper-left rim of the front glass.
    vec3 nView = normalize((viewMatrix * vec4(n, 0.0)).xyz);
    float crescent = smoothstep(0.62, 0.9, dot(nView.xy, normalize(vec2(-0.62, 0.78))))
                   * smoothstep(0.45, 0.62, 1.0 - ndv) * (1.0 - smoothstep(0.8, 0.92, 1.0 - ndv)) * 0.32;
    float spec = (key + keySoft + bounce) * (1.0 - uBack * 0.7) + crescent * (1.0 - uBack);
    // A thin warm edge where the glass turns away: what makes a clear ball readable on a light ground.
    float edge = smoothstep(0.72, 0.97, 1.0 - ndv) * (1.0 - uBack);
    vec3 color = mix(mix(uTint, env, fresnel), uEdge, edge * 0.7) + spec;
    float alpha = 0.03 + 0.45 * fresnel + 0.25 * edge + spec;
    gl_FragColor = vec4(color, clamp(alpha * uOpacity, 0.0, 1.0));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
function glassMaterial(opacity, back) {
  return new THREE.ShaderMaterial({
    uniforms: glassUniforms(opacity, back), vertexShader: GLASS_VERTEX, fragmentShader: GLASS_FRAGMENT,
    transparent: true, depthWrite: false, fog: true, side: back ? THREE.BackSide : THREE.FrontSide,
  });
}

// ---------------------------------------------------------------- decal textures
function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const radialTexture = (rgb, stops) => canvasTexture(128, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [at, alpha] of stops) g.addColorStop(at, `rgba(${rgb},${alpha})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});
const occlusionTexture = radialTexture('60,45,35', [[0, 0.32], [0.45, 0.2], [1, 0]]);
const castShadowTexture = radialTexture('70,55,45', [[0, 0.16], [0.6, 0.1], [1, 0]]);
const causticTexture = radialTexture('255,236,190', [[0, 0.4], [0.35, 0.14], [1, 0]]);
// The faint generic shape some distant balls hold: a little disc with a house on it.
const genericWorldTexture = canvasTexture(128, (ctx, s) => {
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath(); ctx.ellipse(s / 2, s * 0.72, s * 0.36, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLORS.accentEdge;
  ctx.fillRect(s * 0.4, s * 0.48, s * 0.2, s * 0.2);
  ctx.beginPath(); ctx.moveTo(s * 0.36, s * 0.5); ctx.lineTo(s * 0.5, s * 0.36); ctx.lineTo(s * 0.64, s * 0.5); ctx.fill();
});

// ---------------------------------------------------------------- one ball on its pedestal
const pedestalBodyMaterial = new THREE.MeshStandardMaterial({ color: COLORS.accent, roughness: 0.65 });
const pedestalRingMaterial = new THREE.MeshStandardMaterial({ color: COLORS.accentEdge, roughness: 0.5 });
const distantPedestalMaterial = new THREE.MeshStandardMaterial({ color: mixHex(COLORS.accent, COLORS.card, 0.45), roughness: 0.7 });
const sphereGeometry = new THREE.SphereGeometry(1, 64, 48);
const decalGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const decalMaterial = (map, blending) => new THREE.MeshBasicMaterial({
  map, transparent: true, depthWrite: false, blending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

// Pedestal proportions in units of the ball radius: a low body with a ring on top that the ball rests in.
const BODY_HEIGHT = 0.12, BODY_TOP_RADIUS = 0.6, BODY_BOTTOM_RADIUS = 0.68;
const RING_RADIUS = 0.42, RING_TUBE = 0.06;
// The ball touches the ring tube: its centre is (r + tube) away from the tube's centre circle.
const BALL_CENTRE_HEIGHT = BODY_HEIGHT + RING_TUBE + Math.sqrt((1 + RING_TUBE) ** 2 - RING_RADIUS ** 2);

// The world faces the camera; it sits low, along the ball axis, so it rests on the ball's floor.
function addWorldSprite(body, texture, opacity) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity }));
  sprite.scale.setScalar(2 * WORLD_FILL);
  sprite.position.y = BALL_CENTRE_HEIGHT - WORLD_DROP;
  sprite.renderOrder = 2;
  body.add(sprite);
  return sprite;
}

function buildBall({ dir, radius, worldTexture, distant }) {
  const assembly = new THREE.Group(); // origin at the foot, +y along the surface normal
  assembly.position.copy(dir).multiplyScalar(GLOBE_RADIUS - 0.015 * radius);
  assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  // Inner nodes are plain Object3Ds, not Groups: a nested Group would reset the assembly's render order.
  const body = new THREE.Object3D(); // scaled for focus; scaling from the foot keeps the ball seated
  body.scale.setScalar(radius);
  assembly.add(body);

  const occlusion = new THREE.Mesh(decalGeometry, decalMaterial(occlusionTexture, THREE.NormalBlending));
  occlusion.scale.set(2.0, 1, 2.0);
  occlusion.position.y = 0.012;
  const shadowPivot = new THREE.Object3D(); // turned each frame so the cast shadow points away from the sun
  const castShadow = new THREE.Mesh(decalGeometry, decalMaterial(castShadowTexture, THREE.NormalBlending));
  castShadow.position.y = 0.014;
  shadowPivot.add(castShadow);
  let caustic = null;
  if (!distant) {
    caustic = new THREE.Mesh(decalGeometry, decalMaterial(causticTexture, THREE.AdditiveBlending));
    caustic.position.y = 0.016;
    shadowPivot.add(caustic);
  }
  body.add(occlusion, shadowPivot);

  // Distant balls fade in and out, so each gets its own see-through pedestal material.
  const distantPedestal = distant ? distantPedestalMaterial.clone() : null;
  if (distantPedestal) distantPedestal.transparent = true;
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(BODY_TOP_RADIUS, BODY_BOTTOM_RADIUS, BODY_HEIGHT, 48),
    distantPedestal ?? pedestalBodyMaterial);
  pedestal.position.y = BODY_HEIGHT / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 16, 48).rotateX(Math.PI / 2),
    distantPedestal ?? pedestalRingMaterial);
  ring.position.y = BODY_HEIGHT + RING_TUBE * 0.6; // slightly sunk into the body
  body.add(pedestal, ring);

  const glassOpacity = distant ? 0.75 : 1;
  const glassBack = new THREE.Mesh(sphereGeometry, glassMaterial(glassOpacity * 0.6, true));
  const glassFront = new THREE.Mesh(sphereGeometry, glassMaterial(glassOpacity, false));
  glassBack.position.y = glassFront.position.y = BALL_CENTRE_HEIGHT;
  glassBack.renderOrder = 1; glassFront.renderOrder = 3; // back wall, then the world, then the front wall
  body.add(glassBack, glassFront);

  const sprite = worldTexture ? addWorldSprite(body, worldTexture, distant ? 0.28 : 1) : null;

  globe.add(assembly);
  // What fades with a distant ball: [material, its full opacity].
  const fading = distant ? [
    [distantPedestal, 1], [occlusion.material, 1], [castShadow.material, 1],
    [glassBack.material, null], [glassFront.material, null], ...(sprite ? [[sprite.material, sprite.material.opacity]] : []),
  ].map(([material, full]) => ({ material, full: full ?? material.uniforms.uOpacity.value })) : [];
  return { assembly, body, shadowPivot, castShadow, caustic, radius, scale: 1, scaleVel: 0, fading };
}

const textureLoader = new THREE.TextureLoader();
const loadWorldTexture = (key) => new Promise((resolve, reject) => {
  textureLoader.load(new URL(`./assets/world_${key}.png`, import.meta.url).href, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    resolve(texture);
  }, undefined, () => reject(new Error(`could not load assets/world_${key}.png`)));
});

const heroBalls = USERS.map((user, i) => ({ ...user, ...buildBall({ dir: heroDirs[i], radius: BALL_RADIUS, worldTexture: null, distant: false }) }));
const distantBalls = distantSpecs.map((spec) => buildBall({
  dir: spec.dir, radius: spec.radius, worldTexture: spec.holdsShape ? genericWorldTexture : null, distant: true,
}));
const allBalls = [...heroBalls, ...distantBalls];

Promise.all(USERS.map((u) => loadWorldTexture(u.key))).then((textures) => {
  heroBalls.forEach((ball, i) => addWorldSprite(ball.body, textures[i], 1));
});

// ---------------------------------------------------------------- camera framing
function frameCamera(width, height) {
  const aspect = width / height;
  const { position, aim } = cameraPose(aspect);
  camera.aspect = aspect;
  camera.fov = 30;
  camera.position.copy(position);
  camera.lookAt(aim);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- motion state
const state = {
  yaw: 0, yawVel: 0,
  focus: null,            // index into heroBalls, or null at rest
  focusYaw: 0,            // yaw that brings the focused ball to the front, the shorter way round from where the globe was
  drag: null,             // touch swipe in progress
  reducedMotion: reducedMotionQuery.matches,
};
reducedMotionQuery.addEventListener('change', (e) => { state.reducedMotion = e.matches; });

const yawForBall = (i) => -deg(USERS[i].lonDeg);
const wrapAngle = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2)); // into [-pi, pi]
function nearestBallToYaw(yaw) {
  let best = 0;
  USERS.forEach((_, i) => { if (Math.abs(wrapAngle(yawForBall(i) - yaw)) < Math.abs(wrapAngle(yawForBall(best) - yaw))) best = i; });
  return best;
}
function targetYaw(time) {
  if (state.drag) return state.drag.yaw;
  if (state.focus !== null) return state.focusYaw;
  return state.reducedMotion ? 0 : deg(IDLE_DRIFT_DEG) * Math.sin((time / IDLE_DRIFT_PERIOD_S) * Math.PI * 2);
}

function setFocus(index) {
  if (index === state.focus) return;
  state.focus = index;
  state.focusYaw = state.yaw + wrapAngle(yawForBall(index) - state.yaw);
  hero.dataset.focus = USERS[index].key;
  labelEl.textContent = USERS[index].label;
}

// Critically damped spring (as in Unity's SmoothDamp): eases in and out, never overshoots.
function smoothDamp(current, target, velocity, smoothTime, dt) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}

// ---------------------------------------------------------------- input
const tmp = new THREE.Vector3();
function toScreen(worldPos) {
  tmp.copy(worldPos).project(camera);
  return { x: (tmp.x * 0.5 + 0.5) * hero.clientWidth, y: (-tmp.y * 0.5 + 0.5) * hero.clientHeight };
}
const ballCentreWorld = (ball) => ball.body.localToWorld(tmp.set(0, BALL_CENTRE_HEIGHT, 0)).clone();

// Desktop hover: the ball under the pointer comes to the front. After a turn starts, hover is disarmed until the
// pointer travels HOVER_REARM_PX from where the turn began, or touches the focused ball once the globe has settled,
// so a ball that slides in under a resting pointer never takes over; no other ball counts while the globe turns.
const HOVER_SETTLED_RAD = deg(4);
const HOVER_REARM_PX = 40;
let hoverTrigger = null; // pointer position that started the current turn; null = armed
function hoverAt(x, y) {
  const hit = ballAt(x, y);
  const settled = state.focus === null || Math.abs(wrapAngle(state.focusYaw - state.yaw)) <= HOVER_SETTLED_RAD;
  if (hoverTrigger && ((settled && hit === state.focus) || Math.hypot(x - hoverTrigger.x, y - hoverTrigger.y) > HOVER_REARM_PX)) hoverTrigger = null;
  if (hit === null || hit === state.focus || hoverTrigger || !settled) return;
  hoverTrigger = { x, y };
  setFocus(hit);
}

// True when the globe stands between the camera and this point (a ball behind the horizon).
function hiddenByGlobe(point) {
  const ray = point.clone().sub(camera.position);
  const toCentre = globe.position.clone().sub(camera.position);
  const t = THREE.MathUtils.clamp(toCentre.dot(ray) / ray.lengthSq(), 0, 1);
  return camera.position.clone().addScaledVector(ray, t).distanceTo(globe.position) < GLOBE_RADIUS;
}

function ballAt(x, y) {
  let hit = null, hitDepth = Infinity;
  heroBalls.forEach((ball, i) => {
    const centre = ballCentreWorld(ball);
    if (hiddenByGlobe(centre)) return;
    const s = toScreen(centre);
    const edge = toScreen(centre.clone().add(tmp.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(ball.radius * ball.scale)));
    const r = Math.abs(edge.x - s.x) * 1.1;
    const depth = centre.distanceTo(camera.position);
    if ((x - s.x) ** 2 + (y - s.y) ** 2 < r * r && depth < hitDepth) { hit = i; hitDepth = depth; }
  });
  return hit;
}

const localPoint = (e) => { const b = hero.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
const SWIPE_RAD_PER_PX = () => deg(USERS[1].lonDeg - USERS[0].lonDeg) / Math.max(160, 0.42 * hero.clientWidth);

hero.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { const p = localPoint(e); hoverAt(p.x, p.y); return; }
  const drag = state.drag;
  if (!drag || drag.id !== e.pointerId) return;
  const p = localPoint(e);
  const dx = p.x - drag.startX, dy = p.y - drag.startY;
  if (!drag.swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) drag.swiping = true;
  if (drag.swiping) drag.yaw = drag.startYaw + dx * SWIPE_RAD_PER_PX();
});
hero.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  const p = localPoint(e);
  state.drag = { id: e.pointerId, startX: p.x, startY: p.y, startYaw: state.yaw, yaw: state.yaw, startFocus: state.focus, swiping: false };
  hero.setPointerCapture(e.pointerId);
});
function endTouch(e) {
  const drag = state.drag;
  if (!drag || drag.id !== e.pointerId) return;
  state.drag = null;
  if (drag.swiping) {
    // Settle on the ball nearest to where the swipe carried the globe; a short swipe still moves one ball on,
    // wrapping round the ring (D -> A).
    let best = nearestBallToYaw(drag.yaw);
    const towardsRight = drag.yaw < drag.startYaw; // dragging left brings the balls on the right forward
    if (best === drag.startFocus) best = (best + (towardsRight ? 1 : -1) + USERS.length) % USERS.length;
    setFocus(best);
  } else if (e.type === 'pointerup') {
    const p = localPoint(e);
    const hit = ballAt(p.x, p.y);
    if (hit !== null) setFocus(hit);
  }
}
hero.addEventListener('pointerup', endTouch);
hero.addEventListener('pointercancel', endTouch);
// Pointer leaving the hero keeps the last ball in front: nothing moves when the visitor scrolls away.

// ---------------------------------------------------------------- per-frame updates
const inverseQuat = new THREE.Quaternion();
const localLight = new THREE.Vector3();
function updateShadows() {
  for (const ball of allBalls) {
    ball.assembly.getWorldQuaternion(inverseQuat).invert();
    localLight.copy(LIGHT_DIR).applyQuaternion(inverseQuat);
    const cosA = THREE.MathUtils.clamp(localLight.y, 0.25, 1);
    const tanA = Math.sqrt(1 - cosA * cosA) / cosA;
    ball.shadowPivot.rotation.y = Math.atan2(localLight.z, -localLight.x); // pivot +x points away from the sun
    // Shadow of the sphere on the ground: an ellipse stretched away from the sun.
    ball.castShadow.position.x = BALL_CENTRE_HEIGHT * tanA;
    ball.castShadow.scale.set(2.2 / cosA, 1, 2.2);
    if (ball.caustic) {
      ball.caustic.position.x = BALL_CENTRE_HEIGHT * tanA * 1.15;
      ball.caustic.scale.set(0.9 / cosA, 1, 0.7);
    }
  }
}

// Distant balls show only on the far side at the current rotation: they shrink and fade out
// as they turn towards the camera's side and come back near the back horizon.
const footWorld = new THREE.Vector3();
function updateDistantBalls() {
  for (const ball of distantBalls) {
    ball.assembly.getWorldPosition(footWorld).sub(globe.position);
    const awayDeg = THREE.MathUtils.radToDeg(Math.abs(Math.atan2(footWorld.x, footWorld.z))); // 0 = facing the camera
    const shown = THREE.MathUtils.smoothstep(awayDeg, DISTANT_FADE_DEG[0], DISTANT_FADE_DEG[1]);
    ball.assembly.visible = shown > 0.001;
    ball.body.scale.setScalar(ball.radius * (0.35 + 0.65 * shown)); // shrinks towards its foot
    for (const { material, full } of ball.fading) {
      if (material.uniforms) material.uniforms.uOpacity.value = full * shown;
      else material.opacity = full * shown;
    }
  }
}

const depthOrder = [];
function sortBallsByDepth() {
  depthOrder.length = 0;
  for (const ball of allBalls) depthOrder.push([ball, ball.assembly.getWorldPosition(tmp).distanceToSquared(camera.position)]);
  depthOrder.sort((a, b) => b[1] - a[1]);
  depthOrder.forEach(([ball], i) => { ball.assembly.renderOrder = i; }); // group order: far balls first
}

function updateLabel() {
  const settled = state.focus !== null && !state.drag && Math.abs(state.yaw - state.focusYaw) < deg(4);
  labelEl.classList.toggle('is-visible', settled);
  if (state.focus === null) return;
  const ball = heroBalls[state.focus];
  // Under the front edge of the pedestal: the foot moved towards the camera by the pedestal's radius.
  const foot = ball.assembly.getWorldPosition(new THREE.Vector3());
  const towardsCamera = camera.position.clone().sub(foot).setY(0).normalize();
  const edge = toScreen(foot.addScaledVector(towardsCamera, BODY_BOTTOM_RADIUS * ball.radius * ball.scale));
  labelEl.style.transform = `translate(${Math.round(edge.x - labelEl.offsetWidth / 2)}px, ${Math.round(edge.y + 10)}px)`;
}

function resize() {
  const width = hero.clientWidth, height = hero.clientHeight;
  renderer.setSize(width, height, false);
  frameCamera(width, height);
}
new ResizeObserver(resize).observe(hero);
resize();

// On a narrow screen the rest view (between B and C) shows neither of them, so start with B in front.
{
  globe.updateMatrixWorld(true);
  const w = hero.clientWidth;
  const restFits = [1, 2].every((i) => { const x = toScreen(ballCentreWorld(heroBalls[i])).x; return x > 0.1 * w && x < 0.9 * w; });
  if (!restFits) { setFocus(1); state.yaw = state.focusYaw; }
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const time = clock.elapsedTime;
  const target = targetYaw(time);
  if (state.reducedMotion) { state.yaw = target; state.yawVel = 0; }
  else [state.yaw, state.yawVel] = smoothDamp(state.yaw, target, state.yawVel, state.drag ? 0.08 : ROTATE_SMOOTH_TIME, dt);
  globe.rotation.y = state.yaw;

  heroBalls.forEach((ball, i) => {
    const scaleTarget = i === state.focus ? FOCUS_SCALE : 1;
    if (state.reducedMotion) { ball.scale = scaleTarget; ball.scaleVel = 0; }
    else [ball.scale, ball.scaleVel] = smoothDamp(ball.scale, scaleTarget, ball.scaleVel, SCALE_SMOOTH_TIME, dt);
    ball.body.scale.setScalar(ball.radius * ball.scale);
  });

  scene.updateMatrixWorld();
  updateDistantBalls();
  updateShadows();
  sortBallsByDepth();
  renderer.render(scene, camera);
  updateLabel();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
