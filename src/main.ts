import * as THREE from 'three';
import { portfolio as D } from './data';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

interface Panel {
  kind: string; title: string; sub: string; body?: string; avatar?: string;
  list?: string[]; tags?: string[]; links?: [string, string][];
}

// ---------- panel data ----------
const panels: Panel[] = [
  { kind: 'PROFILE', title: D.name, sub: `${D.title} · ${D.location}`, body: D.bio, avatar: D.avatar,
    links: [['GitHub', D.github], ['Email', 'mailto:' + D.email]] },
  { kind: 'SKILLS', title: 'Skills', sub: `${D.skills.length} total`, list: D.skills },
  ...D.work.map(w => ({ kind: 'WORK', title: w.title, sub: `${w.subtitle} · ${w.year}`, body: w.description, tags: w.tags,
    links: [w.live && ['Open', w.live], w.repo && ['Code', w.repo]].filter((l): l is [string, string] => !!l) })),
  ...D.path.map(p => ({ kind: 'PATH', title: p.title, sub: `${p.org} · ${p.period}`, body: p.body })),
  ...D.study.map(s => ({ kind: 'STUDY', title: s.school, sub: `${s.degree} · ${s.period}` })),
  { kind: 'CONTACT', title: 'Get in touch', sub: D.email, body: 'The gallery loops from here. Leave a message instead.',
    links: [['Send mail', 'mailto:' + D.email], ['GitHub', D.github]] },
];

$('hudName').textContent = $('name').textContent = D.name;
$('hudTitle').textContent = $('title').textContent = D.title;
$('bio').textContent = D.bio;
$<HTMLImageElement>('avatar').src = D.avatar;
$('hudCount').textContent = String(panels.length);
// screen-reader / no-WebGL copy of everything on the walls
$('sr').innerHTML = panels.map(p => `<section><h2>${p.kind}: ${p.title}</h2><p>${p.sub}</p><p>${p.body || (p.list || []).join(', ')}</p>${(p.links || []).map(([t, u]) => `<a href="${u}">${t}</a>`).join(' ')}</section>`).join('');

// ---------- corridor ----------
const W = 4, H = 3.2, EYE = 1.6, SEG = 1600, UP = new THREE.Vector3(0, 1, 0);
const R = Math.max(18, panels.length * 14 / (Math.PI * 2)); // ~14 m between panels
const pts = Array.from({ length: 14 }, (_, i) => {
  const a = i / 14 * Math.PI * 2, r = R * (1 + 0.12 * Math.sin(a * 3));
  return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
});
const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
const L = curve.getLength();
const wrap = (u: number) => ((u % 1) + 1) % 1;
interface Frame { p: THREE.Vector3; t: THREE.Vector3; s: THREE.Vector3 }
function frame(u: number): Frame {
  u = wrap(u);
  const p = curve.getPointAt(u), t = curve.getTangentAt(u);
  return { p, t, s: new THREE.Vector3().crossVectors(t, UP).normalize() };
}
const at = (f: Frame, side: number, y: number) => new THREE.Vector3(f.p.x + f.s.x * side, y, f.p.z + f.s.z * side);
const frames = Array.from({ length: SEG + 1 }, (_, i) => frame(i / SEG));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0);
scene.fog = new THREE.Fog(0, 3, 48);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);

function ribbon(a: [number, number], b: [number, number], color: number) {
  const pos: number[] = [], idx: number[] = [];
  frames.forEach((f, i) => {
    pos.push(...at(f, ...a).toArray(), ...at(f, ...b).toArray());
    if (i < SEG) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
}
ribbon([-W / 2, 0], [W / 2, 0], 0x101010);   // floor
ribbon([-W / 2, H], [W / 2, H], 0x070707);   // ceiling
ribbon([-W / 2, 0], [-W / 2, H], 0x161616);  // left wall
ribbon([W / 2, 0], [W / 2, H], 0x161616);    // right wall

const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
for (const [side, y] of [[-W / 2, 0.02], [W / 2, 0.02], [-W / 2, H], [W / 2, H]] as const) {
  const c = new THREE.CatmullRomCurve3(frames.slice(0, SEG).filter((_, i) => i % 4 === 0).map(f => at(f, side, y)), true);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(c, SEG, 0.025, 6, true), white));
}

// floor tiles + ceiling light bars, one every 2 / 3 metres
const tile: number[] = [];
for (let d = 0; d < L; d += 2) { const f = frame(d / L); tile.push(...at(f, -W / 2, 0.01).toArray(), ...at(f, W / 2, 0.01).toArray()); }
for (const side of [-W / 6, W / 6]) frames.forEach((f, i) => i < SEG && tile.push(...at(f, side, 0.01).toArray(), ...at(frames[i + 1], side, 0.01).toArray()));
const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tile, 3));
scene.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0x262626 })));

const nBars = Math.floor(L / 3), bars = new THREE.InstancedMesh(new THREE.BoxGeometry(W * 0.5, 0.04, 0.18), white, nBars);
const m4 = new THREE.Matrix4();
for (let i = 0; i < nBars; i++) {
  const f = frame(i * 3 / L);
  bars.setMatrixAt(i, m4.makeBasis(f.s, UP, f.t).setPosition(f.p.x, H - 0.03, f.p.z));
}
scene.add(bars);

// ---------- panels ----------
await Promise.all(['700 60px "JetBrains Mono"', '400 28px "JetBrains Mono"'].map(f => document.fonts.load(f)));

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  let line = '', n = 0;
  for (const word of text.split(' ')) {
    if (ctx.measureText(line + word).width > maxW && line) {
      if (++n === maxLines) { ctx.fillText(line.trim() + '…', x, y); return y + lh; }
      ctx.fillText(line, x, y); y += lh; line = '';
    }
    line += word + ' ';
  }
  ctx.fillText(line, x, y); return y + lh;
}

function drawPanel(p: Panel, img?: HTMLImageElement) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 1024, 640);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 1004, 620);
  const textW = img ? 700 : 912;
  ctx.fillStyle = '#888'; ctx.font = '400 24px "JetBrains Mono"'; ctx.fillText(p.kind, 56, 84);
  ctx.fillStyle = '#fff';
  let size = 60; do ctx.font = `700 ${size}px "JetBrains Mono"`; while (ctx.measureText(p.title).width > textW && (size -= 4) > 28);
  ctx.fillText(p.title, 56, 164);
  ctx.fillStyle = '#9a9a9a'; ctx.font = '400 26px "JetBrains Mono"';
  let y = wrapText(ctx, p.sub, 56, 214, textW, 36, 2) + 30;
  ctx.fillStyle = '#d0d0d0'; ctx.font = '400 28px "JetBrains Mono"';
  if (p.body) y = wrapText(ctx, p.body, 56, y, 912, 42, 5);
  if (p.list) {
    const cols = p.list.length > 10 ? 3 : 2;
    if (cols === 3) ctx.font = '400 24px "JetBrains Mono"';
    p.list.forEach((s, i) => ctx.fillText('— ' + s, 56 + (i % cols) * (912 / cols), y + Math.floor(i / cols) * 44));
  }
  if (p.tags) {
    ctx.font = '400 22px "JetBrains Mono"'; let x = 56;
    for (const t of p.tags) {
      const w = ctx.measureText(t).width + 28;
      if (x + w > 968) break;
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.strokeRect(x, 540, w, 44);
      ctx.fillStyle = '#ccc'; ctx.fillText(t, x + 14, 570); x += w + 12;
    }
  }
  if (img) {
    ctx.save(); ctx.beginPath(); ctx.arc(860, 150, 90, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(img, 770, 60, 180, 180); ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(860, 150, 90, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#555'; ctx.font = '400 18px "JetBrains Mono"'; ctx.fillText('CLICK TO OPEN', 818, 612);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const STOP = 3.4 / L, TILT = 0.35, PW = 2.4;
const meshes = panels.map((p, i) => {
  const u = (i + 0.5) / panels.length, f = frame(u), side = i % 2 ? 1 : -1;
  const pos = at(f, side * (W / 2 - 0.1 - PW / 2 * Math.sin(TILT)), EYE + 0.05);
  const dir = f.s.clone().multiplyScalar(-side * Math.cos(TILT)).addScaledVector(f.t, -Math.sin(TILT));
  const mat = new THREE.MeshBasicMaterial({ map: drawPanel(p) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PW * 0.625), mat);
  m.position.copy(pos); m.lookAt(pos.clone().add(dir));
  m.userData = { i, u };
  scene.add(m);
  if (p.avatar) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { mat.map?.dispose(); mat.map = drawPanel(p, img); };
    img.src = p.avatar;
  }
  return m;
});

// ---------- navigation ----------
let cur = 0.5 / panels.length - 3.4 / L - 0.02, target = cur, entered = false;
const delta = (u: number) => { const d = wrap(u - cur + 0.5) - 0.5; return d * L; }; // signed metres from camera
function go(dir: number) {
  // relative to target, so repeated presses keep stepping panel by panel
  const ds = meshes.map(m => wrap(m.userData.u - STOP - target + 0.5) - 0.5).filter(d => dir > 0 ? d > 0.3 / L : d < -0.3 / L);
  if (ds.length) target += dir > 0 ? Math.min(...ds) : Math.max(...ds);
}
function enter() { if (!entered) { entered = true; $('intro').classList.add('off'); } }
function leave() { entered = false; $('intro').classList.remove('off'); }

function openPanel(i: number) {
  const p = panels[i];
  $('mKind').textContent = p.kind; $('mTitle').textContent = p.title; $('mSub').textContent = p.sub;
  $('mBody').textContent = p.body || '';
  $('mTags').innerHTML = ''; for (const t of p.tags || p.list || []) $('mTags').append(Object.assign(document.createElement('li'), { textContent: t }));
  $('mLinks').innerHTML = '';
  for (const [t, u] of p.links || []) $('mLinks').append(Object.assign(document.createElement('a'), { textContent: t, href: u, target: '_blank', rel: 'noopener' }));
  $('mLinks').append(Object.assign(document.createElement('button'), { textContent: 'Close', onclick: closePanel }));
  $('modal').hidden = false; ($('mLinks').firstChild as HTMLElement).focus();
}
const closePanel = () => { $('modal').hidden = true; };
$('modal').onclick = e => { if (e.target === $('modal')) closePanel(); };
$('intro').onclick = enter;

addEventListener('wheel', e => {
  if (!$('modal').hidden) return;
  e.preventDefault(); enter(); target += e.deltaY * 0.012 / L;
}, { passive: false });
let touchY: number | null = null;
addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', e => {
  if (touchY === null || !$('modal').hidden) return;
  const y = e.touches[0].clientY; target += (touchY - y) * 0.04 / L; touchY = y; enter();
}, { passive: true });
addEventListener('keydown', e => {
  if (e.key === 'Escape') return $('modal').hidden ? leave() : closePanel();
  if (!$('modal').hidden) return;
  if (['ArrowDown', 'ArrowRight', ' ', 'PageDown'].includes(e.key)) { enter(); go(1); e.preventDefault(); }
  if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { go(-1); e.preventDefault(); }
});

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let downAt: [number, number] | null = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const hit = ray.intersectObjects(meshes)[0];
  if (hit && hit.distance < 14) return openPanel(hit.object.userData.i as number);
  enter(); go(e.clientX < innerWidth / 2 ? -1 : 1);
});
addEventListener('pointermove', e => mouse.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1));

// ---------- loop ----------
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 95 : 70; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const look = new THREE.Vector3(), clock = new THREE.Clock();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let shown = -1;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!entered && !reduced) target += dt * 0.6 / L; // idle drift behind the intro
  cur += (target - cur) * Math.min(1, dt * 5);

  const f = frame(cur), ahead = frame(cur + 4 / L);
  camera.position.set(f.p.x, EYE, f.p.z);
  const want = at(ahead, mouse.x * 0.8, EYE - mouse.y * 0.4);
  // turn slightly toward the panel you're stopped in front of
  let best: THREE.Mesh | null = null, bd = Infinity;
  for (const m of meshes) { const d = delta(m.userData.u); if (d > 0.5 && d < 9 && d < bd) { bd = d; best = m; } }
  if (best) want.lerp(best.position, (camera.aspect < 1 ? 0.8 : 0.35) * Math.max(0, 1 - Math.abs(bd - 3.4) / 5));
  look.lerp(want, Math.min(1, dt * 6));
  camera.lookAt(look);

  const idx = best && entered ? best.userData.i : -1;
  if (idx !== shown) {
    shown = idx; $('card').classList.toggle('off', idx < 0);
    if (idx >= 0) { $('card').querySelector('small')!.textContent = panels[idx].kind; $('card').querySelector('div')!.textContent = panels[idx].title; }
  }
  renderer.render(scene, camera);
});
look.copy(at(frame(cur + 4 / L), 0, EYE));
