import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';

// ─── Die geometry ──────────────────────────────────────────────
const DIE = 28;
const ROUND_R = 3;
const ROUND_SEG = 5;
const DOT_R = 1.8;
const DOT_SEG = 10;
const TILT_X = 0.32;

// ─── Physics ───────────────────────────────────────────────────
const FRIC = 0.94;
const BOUNCE = 0.55;
const STOP = 5;
const MAX_F = 300;
const MIN_F = 18;
const PAD = 20;
const DT = 1 / 60;
const BAR_W = 24; // ширина центрального бара на доске (см. BackgammonBoard.js)
const BAR_PAD = DIE / 2 + 2; // минимальная дистанция центра кубика до грани бара

// Dot positions per face value, in [-0.5, 0.5] local face coords
const DOTS = {
  1: [[0, 0]],
  2: [[-0.4, 0.4], [0.4, -0.4]],
  3: [[-0.4, 0.4], [0, 0], [0.4, -0.4]],
  4: [[-0.4, -0.4], [-0.4, 0.4], [0.4, -0.4], [0.4, 0.4]],
  5: [[-0.4, -0.4], [-0.4, 0.4], [0, 0], [0.4, -0.4], [0.4, 0.4]],
  6: [[-0.4, -0.4], [-0.4, 0], [-0.4, 0.4], [0.4, -0.4], [0.4, 0], [0.4, 0.4]],
};

// Euler that brings target face value to +Z (toward the camera)
// BoxGeometry material order: +X(3) -X(4) +Y(2) -Y(5) +Z(1) -Z(6)
const FACE_ROT = {
  1: [0, 0, 0],
  2: [Math.PI / 2, 0, 0],
  3: [0, -Math.PI / 2, 0],
  4: [0, Math.PI / 2, 0],
  5: [-Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

// normal, up, value for each cube face
const FACES = [
  { n: [1, 0, 0],  u: [0, 1, 0],  v: 3 },
  { n: [-1, 0, 0], u: [0, 1, 0],  v: 4 },
  { n: [0, 1, 0],  u: [0, 0, -1], v: 2 },
  { n: [0, -1, 0], u: [0, 0, 1],  v: 5 },
  { n: [0, 0, 1],  u: [0, 1, 0],  v: 1 },
  { n: [0, 0, -1], u: [0, 1, 0],  v: 6 },
];

// ─── Joint physics simulation (both dice + inter-die collision) ─
const COL_DIST = DIE * 0.92; // min center-to-center before collision (slightly less than DIE for rounded corners)
const COL_E = 0.65;          // die-die collision elasticity

function addSnap(frames, face) {
  const last = frames[frames.length - 1];
  const cQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(last.rx, last.ry, last.rz));
  const tr = FACE_ROT[face];
  const tQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(tr[0], tr[1], tr[2]));
  // Чем меньше расхождение, тем короче (и незаметнее) финальный доснап.
  const dot = Math.min(1, Math.max(-1, Math.abs(cQ.dot(tQ))));
  const ang = 2 * Math.acos(dot); // 0..PI
  // Финальный доснап всегда есть, но он должен быть "чуть-чуть":
  // основную работу делает snapStep во время замедления, а здесь только доводим последние градусы.
  const steps = ang < 0.04 ? 0 : 10; // <~2.3° — вообще не трогаем, иначе 10 мягких шагов
  for (let j = 1; j <= steps; j++) {
    const t = 1 - Math.pow(1 - j / steps, 3);
    const q = cQ.clone().slerp(tQ, t);
    const e = new THREE.Euler().setFromQuaternion(q);
    frames.push({ x: last.x, y: last.y, rx: e.x, ry: e.y, rz: e.z });
  }
}

function buildSim(sp, ep, bw, bh, dice) {
  const ddx = ep.x - sp.x, ddy = ep.y - sp.y;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
  const ang = Math.atan2(ddy, ddx);

  const norm = Math.min(dist / 250, 1);
  const spd = 60 + norm * norm * 1540;

  const spread = norm * 0.8 + 0.08;
  const sg = Math.random() > 0.5 ? 1 : -1;
  const a2 = ang + sg * spread * (0.5 + Math.random() * 0.5);
  const s2 = spd * (0.75 + Math.random() * 0.4);

  // Per-die state
  let x1 = sp.x, y1 = sp.y, vx1 = Math.cos(ang) * spd, vy1 = Math.sin(ang) * spd;
  let x2 = sp.x, y2 = sp.y, vx2 = Math.cos(a2) * s2, vy2 = Math.sin(a2) * s2;
  let rx1 = 0, ry1 = 0, rz1 = 0, rx2 = 0, ry2 = 0, rz2 = 0;

  const spd01 = Math.sqrt(vx1 * vx1 + vy1 * vy1);
  const spd02 = Math.sqrt(vx2 * vx2 + vy2 * vy2);

  const rxd1 = (Math.random() - 0.5) * 2, ryd1 = (Math.random() - 0.5) * 2, rzd1 = Math.random() > 0.5 ? 1 : -1;
  const rxd2 = (Math.random() - 0.5) * 2, ryd2 = (Math.random() - 0.5) * 2, rzd2 = Math.random() > 0.5 ? 1 : -1;

  const arcH1 = Math.min(spd01 / 16, 80), arcN1 = Math.min(12, Math.max(4, Math.round(spd01 / 90)));
  const arcH2 = Math.min(spd02 / 16, 80), arcN2 = Math.min(12, Math.max(4, Math.round(spd02 / 90)));
  const arcSafe = Math.max(arcN1, arcN2) + 2; // skip collision during initial arc

  const barLeft = (bw - BAR_W) / 2;
  const barRight = barLeft + BAR_W;

  const t1 = FACE_ROT[dice[0]];
  const t2v = FACE_ROT[dice[1]];
  const tQ1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(t1[0], t1[1], t1[2]));
  const tQ2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(t2v[0], t2v[1], t2v[2]));

  // Начинаем «подтягивать» ориентацию к результату при замедлении — чтобы не было резкой докрутки в самом конце.
  const SNAP_START_SPEED = 520; // px/s: начинаем раньше, чтобы финальная докрутка была минимальной
  const snapStep = (rx, ry, rz, targetQ, speed) => {
    if (speed >= SNAP_START_SPEED) return [rx, ry, rz];
    const cQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    const w = (1 - speed / SNAP_START_SPEED);      // 0..1
    const t = 0.01 + 0.13 * w * w;                 // 0.01..0.14 за кадр: сильнее ближе к остановке
    const q = cQ.clone().slerp(targetQ, t);
    const e = new THREE.Euler().setFromQuaternion(q);
    return [e.x, e.y, e.z];
  };

  const f1 = [{ x: x1, y: y1, rx: 0, ry: 0, rz: 0 }];
  const f2 = [{ x: x2, y: y2, rx: 0, ry: 0, rz: 0 }];

  let done1 = false, done2 = false;

  for (let i = 1; i <= MAX_F; i++) {
    // — Die 1 physics —
    if (!done1) {
      const s1 = Math.sqrt(vx1 * vx1 + vy1 * vy1);
      if (s1 < STOP && i >= MIN_F) { done1 = true; }
      else {
        x1 += vx1 * DT; y1 += vy1 * DT;
        const rs = s1 * 0.012;
        rx1 += rs * rxd1; ry1 += rs * ryd1; rz1 += rs * rzd1;
        if (x1 < PAD) { x1 = PAD; vx1 = Math.abs(vx1) * BOUNCE; }
        if (x1 > bw - PAD) { x1 = bw - PAD; vx1 = -Math.abs(vx1) * BOUNCE; }
        // центральный бар — отдельная «стенка» с двумя гранями
        if (x1 > barLeft - BAR_PAD && x1 < barRight + BAR_PAD) {
          if (vx1 > 0) { x1 = barLeft - BAR_PAD; vx1 = -Math.abs(vx1) * BOUNCE; }
          else if (vx1 < 0) { x1 = barRight + BAR_PAD; vx1 = Math.abs(vx1) * BOUNCE; }
          else {
            // если скорость по X ~0, выталкиваем по ближайшей стороне
            const dl = Math.abs(x1 - (barLeft - BAR_PAD));
            const dr = Math.abs(x1 - (barRight + BAR_PAD));
            x1 = dl < dr ? (barLeft - BAR_PAD) : (barRight + BAR_PAD);
          }
        }
        if (y1 < PAD) { y1 = PAD; vy1 = Math.abs(vy1) * BOUNCE; }
        if (y1 > bh - PAD) { y1 = bh - PAD; vy1 = -Math.abs(vy1) * BOUNCE; }
        vx1 *= FRIC; vy1 *= FRIC;

        [rx1, ry1, rz1] = snapStep(rx1, ry1, rz1, tQ1, s1);
      }
    }

    // — Die 2 physics —
    if (!done2) {
      const s2c = Math.sqrt(vx2 * vx2 + vy2 * vy2);
      if (s2c < STOP && i >= MIN_F) { done2 = true; }
      else {
        x2 += vx2 * DT; y2 += vy2 * DT;
        const rs = s2c * 0.012;
        rx2 += rs * rxd2; ry2 += rs * ryd2; rz2 += rs * rzd2;
        if (x2 < PAD) { x2 = PAD; vx2 = Math.abs(vx2) * BOUNCE; }
        if (x2 > bw - PAD) { x2 = bw - PAD; vx2 = -Math.abs(vx2) * BOUNCE; }
        // центральный бар — отдельная «стенка» с двумя гранями
        if (x2 > barLeft - BAR_PAD && x2 < barRight + BAR_PAD) {
          if (vx2 > 0) { x2 = barLeft - BAR_PAD; vx2 = -Math.abs(vx2) * BOUNCE; }
          else if (vx2 < 0) { x2 = barRight + BAR_PAD; vx2 = Math.abs(vx2) * BOUNCE; }
          else {
            const dl = Math.abs(x2 - (barLeft - BAR_PAD));
            const dr = Math.abs(x2 - (barRight + BAR_PAD));
            x2 = dl < dr ? (barLeft - BAR_PAD) : (barRight + BAR_PAD);
          }
        }
        if (y2 < PAD) { y2 = PAD; vy2 = Math.abs(vy2) * BOUNCE; }
        if (y2 > bh - PAD) { y2 = bh - PAD; vy2 = -Math.abs(vy2) * BOUNCE; }
        vx2 *= FRIC; vy2 *= FRIC;

        [rx2, ry2, rz2] = snapStep(rx2, ry2, rz2, tQ2, s2c);
      }
    }

    // — Die-die collision (skip during arc to avoid spawn-overlap) —
    if (i > arcSafe) {
      const cx = x2 - x1, cy = y2 - y1;
      const cd = Math.sqrt(cx * cx + cy * cy);
      if (cd > 0.01 && cd < COL_DIST) {
        const nx = cx / cd, ny = cy / cd;
        const overlap = (COL_DIST - cd) / 2;
        x1 -= nx * overlap; y1 -= ny * overlap;
        x2 += nx * overlap; y2 += ny * overlap;

        const v1n = vx1 * nx + vy1 * ny;
        const v2n = vx2 * nx + vy2 * ny;
        if (v1n - v2n > 0) {
          const imp = (v1n - v2n) * COL_E;
          vx1 -= imp * nx; vy1 -= imp * ny;
          vx2 += imp * nx; vy2 += imp * ny;
        }
      }
    }

    const arc1 = i <= arcN1 ? -arcH1 * Math.sin((i / arcN1) * Math.PI) : 0;
    const arc2 = i <= arcN2 ? -arcH2 * Math.sin((i / arcN2) * Math.PI) : 0;

    f1.push({ x: x1, y: y1 + arc1, rx: rx1, ry: ry1, rz: rz1 });
    f2.push({ x: x2, y: y2 + arc2, rx: rx2, ry: ry2, rz: rz2 });

    if (done1 && done2) break;
  }

  // Settle: slerp each die to its target face independently
  addSnap(f1, dice[0]);
  addSnap(f2, dice[1]);

  const len = Math.max(f1.length, f2.length);
  while (f1.length < len) f1.push({ ...f1[f1.length - 1] });
  while (f2.length < len) f2.push({ ...f2[f2.length - 1] });
  while (f1.length < MIN_F) { f1.push({ ...f1[f1.length - 1] }); f2.push({ ...f2[f2.length - 1] }); }

  return { f1, f2, dur: Math.max(400, len * (1000 / 60)) };
}

// ─── Rounded box geometry ───────────────────────────────────────
// Minkowski sum: shrink box by radius, then expand every vertex
// outward by radius along the offset from the inner box surface.
function createRoundedBoxGeo(size, radius, seg) {
  const geo = new THREE.BoxGeometry(size, size, size, seg, seg, seg);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const inner = size / 2 - radius;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const cx = Math.max(-inner, Math.min(inner, vx));
    const cy = Math.max(-inner, Math.min(inner, vy));
    const cz = Math.max(-inner, Math.min(inner, vz));
    const dx = vx - cx, dy = vy - cy, dz = vz - cz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    pos.setXYZ(i, cx + (dx / len) * radius, cy + (dy / len) * radius, cz + (dz / len) * radius);
    nor.setXYZ(i, dx / len, dy / len, dz / len);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  return geo;
}

// ─── Shared resources ──────────────────────────────────────────
let _dotGeo, _dotMat, _cubeMat, _boxGeo;

function ensureShared() {
  if (!_dotGeo) {
    _dotGeo = new THREE.CircleGeometry(DOT_R, DOT_SEG);
    _dotMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, side: THREE.DoubleSide });
    _cubeMat = new THREE.MeshStandardMaterial({ color: 0xFFFDE7, roughness: 0.28, metalness: 0.08 });
    _boxGeo = createRoundedBoxGeo(DIE, ROUND_R, ROUND_SEG);
  }
}

function createDie() {
  ensureShared();
  const h = DIE / 2;
  const g = new THREE.Group();

  g.add(new THREE.Mesh(_boxGeo, _cubeMat));

  const sp = h * 0.62;
  for (const { n, u, v } of FACES) {
    const normal = new THREE.Vector3(...n);
    const up = new THREE.Vector3(...u);
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    for (const [du, dv] of DOTS[v]) {
      const dot = new THREE.Mesh(_dotGeo, _dotMat);
      dot.position.copy(
        normal.clone().multiplyScalar(h + 0.08)
          .add(right.clone().multiplyScalar(du * sp))
          .add(up.clone().multiplyScalar(dv * sp)),
      );
      dot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      g.add(dot);
    }
  }
  return g;
}

function createShadow() {
  return new THREE.Mesh(
    new THREE.CircleGeometry(DIE * 0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }),
  );
}

// ─── Component ─────────────────────────────────────────────────
export default function DiceThrow3D({ dice, startPos, endPos, boardWidth, boardHeight, onComplete, pausedRef }) {
  const aliveRef = useRef(true);
  const doneRef = useRef(false);
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;

  const simRef = useRef(null);
  if (!simRef.current && dice && startPos && endPos)
    simRef.current = buildSim(startPos, endPos, boardWidth || 360, boardHeight || 260, dice);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const onGL = useCallback((gl) => {
    const sim = simRef.current;
    if (!sim) return;
    const bw = boardWidth || 360;
    const bh = boardHeight || 260;

    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        style: {},
        addEventListener() {},
        removeEventListener() {},
        clientWidth: gl.drawingBufferWidth,
        clientHeight: gl.drawingBufferHeight,
      },
      context: gl,
      alpha: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    const cam = new THREE.OrthographicCamera(-bw / 2, bw / 2, bh / 2, -bh / 2, 0.1, 500);
    cam.position.set(bw / 2, bh / 2, 200);
    cam.lookAt(bw / 2, bh / 2, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(bw * 0.35, bh * 0.8, 140);
    scene.add(sun);

    const d1 = createDie(), d2 = createDie();
    const sh1 = createShadow(), sh2 = createShadow();
    scene.add(d1); scene.add(d2);
    scene.add(sh1); scene.add(sh2);

    let t0 = Date.now();
    let pausedAt = 0;
    const half = DIE / 2;
    const fLen = sim.f1.length;

    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOB = (t) => { const c = 1.7; return 1 + (t - 1) ** 3 + c * (t - 1) ** 2; };

    const loop = () => {
      if (!aliveRef.current) return;
      if (pausedRef?.current) {
        if (!pausedAt) pausedAt = Date.now();
        setTimeout(loop, 50);
        return;
      }
      if (pausedAt) {
        t0 += Date.now() - pausedAt;
        pausedAt = 0;
      }
      requestAnimationFrame(loop);

      const ms = Date.now() - t0;
      const p = Math.min(ms / sim.dur, 1);
      const raw = p * (fLen - 1);
      const i = Math.min(Math.floor(raw), fLen - 2);
      const fr = raw - i;

      // Die 1
      const a = sim.f1[i], b = sim.f1[i + 1];
      const x1 = lerp(a.x, b.x, fr), y1 = bh - lerp(a.y, b.y, fr);
      d1.position.set(x1, y1, half);
      d1.rotation.set(lerp(a.rx, b.rx, fr) + TILT_X, lerp(a.ry, b.ry, fr), lerp(a.rz, b.rz, fr));

      // Die 2
      const c1 = sim.f2[i], e = sim.f2[i + 1];
      const x2 = lerp(c1.x, e.x, fr), y2 = bh - lerp(c1.y, e.y, fr);
      d2.position.set(x2, y2, half);
      d2.rotation.set(lerp(c1.rx, e.rx, fr) + TILT_X, lerp(c1.ry, e.ry, fr), lerp(c1.rz, e.rz, fr));

      // Shadows
      sh1.position.set(x1, y1, 0.05);
      sh2.position.set(x2, y2, 0.05);

      // Scale-in
      const st1 = Math.min(ms / 200, 1);
      const scl1 = st1 < 1 ? 0.3 + 0.7 * easeOB(st1) : 1;
      d1.scale.setScalar(scl1);
      sh1.scale.setScalar(scl1);
      const st2 = Math.min((ms - 40) / 200, 1);
      const scl2 = st2 > 0 ? (st2 < 1 ? 0.3 + 0.7 * easeOB(st2) : 1) : 0.01;
      d2.scale.setScalar(scl2);
      sh2.scale.setScalar(scl2);

      // Settle bounce + fire callback
      if (p >= 1 && !doneRef.current) {
        const be = ms - sim.dur;
        if (be < 200) {
          const bt = be / 200;
          const bounce = 1 + 0.06 * Math.sin(bt * Math.PI) * (1 - bt);
          d1.scale.setScalar(bounce);
          d2.scale.setScalar(bounce);
          sh1.scale.setScalar(bounce);
          sh2.scale.setScalar(bounce);
        } else if (be >= 500) {
          doneRef.current = true;
          cbRef.current?.();
        }
      }

      renderer.render(scene, cam);
      gl.endFrameEXP();
    };
    loop();
  }, [boardWidth, boardHeight]);

  if (!simRef.current) return null;

  return (
    <GLView
      style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
      onContextCreate={onGL}
      pointerEvents="none"
    />
  );
}
