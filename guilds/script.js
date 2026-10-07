// Guilds: a scroll story in beats. One person is a cloud of scrambled glyphs. As others
// join, glyphs inside two clouds settle into a shared line (gray), and glyphs inside three
// or more resolve (black). Everything is driven by BEATS below.
// The glyph atlas, DPR cap, canvas sizing, frame-time clamp and smoothstep follow ../script.js.

function smoothstep(edge0, edge1, x) {
  let t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const params = new URLSearchParams(location.search);
function param(name, fallback, min, max) {
  const v = parseFloat(params.get(name));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

// ---- Tuning ----

// How many people form the group from beat 7 on (?clouds=3|4).
const CLOUD_COUNT = params.get('clouds') === '4' ? 4 : 3;
// Scramble rate: character changes per second per glyph (?scramble=, 0 freezes them).
// Each beat scales it with its own `scramble`.
const SCRAMBLE = param('scramble', 6, 0, 60);
// U, the unit every BEATS position and radius is measured in, in logical px (?radius=).
// Unset, it is fitted so the group and its container (EXTENT units from center, lift
// included) fit the stage.
const RADIUS_MAX = 160;
const EXTENT = 2;
// Overlap depth, as a fraction of U, at which a glyph counts as fully inside a cloud.
// Settling and resolving both ease in over this depth, so edges flicker in.
const CONTAIN_DEPTH = 0.14;
// Scroll length of one unit of beat `span`, in vh.
const SCROLL_PER_SPAN = 85;
// Share of each beat's scroll range spent blending into its neighbors (each side).
const TRANSITION = 0.35;
// Easing time constants (ms): the scene following scroll, glyphs following their targets.
const SCENE_EASE = 160;
const GLYPH_EASE = 220;
// Drift at motion 1: wander amplitude (fraction of U) and cloud rotation (rad/s).
const WANDER = 0.07;
const SPIN = 0.04;
// Noise glyphs per glyph cell of a radius-U cloud, and a cap per cloud.
const NOISE_DENSITY = 0.3;
const MAX_NOISE = 200;
// How far noise fades where clouds overlap, so the shared line reads clearly.
const LENS_FADE = 0.85;
// Echoes: chance per second (at echo 1) that a fragment of a person's own words
// gathers and reads almost-legibly, and how long it holds (ms).
const ECHO_RATE = 0.9;
const ECHO_HOLD = 900;
// Loop mode: the fragments that repeat, seconds per phrase, and the share of each period
// spent scrambling between phrases.
const LOOP_FRAGMENTS = ['what if', 'not yet', 'maybe'];
const LOOP_PERIOD = 1.1;
const LOOP_SCRAMBLE = 0.3;
// Synchronized sway amplitude (fraction of U) at sway 1.
const SWAY = 0.05;
// Container: radius beyond the group's outer edge, and drawing speed (circles per second).
const CONTAINER_PAD = 1.08;
const CONTAINER_SPEED = 0.6;
// Edge clusters: mini-cloud radius (fraction of U), max opacity, and how fast they fade in
// and drift together (per second).
const CLUSTER_RADIUS = 0.3;
const CLUSTER_ALPHA = 0.4;
const CLUSTER_SPEED = 0.2;
const FONT_MAX = 22;
const FONT_MIN = 9;
const LINE_HEIGHT = 1.4;
// Top share of the viewport the clouds live in; the captions take the rest (see style.css).
const CLOUD_BOX = 0.7;

const COLORS = ['#3a3a3a', '#6a6a6a', '#505050', '#7a7a7a']; // one per person
const SETTLED_COLOR = '#3a3a3a';
const RESOLVED_COLOR = '#000';
const CONTAINER_COLOR = '#3a3a3a';

const LINE = "what's possible together";
// Scrambling draws its characters from the homepage curtain's text (WORDS_TEXT in
// ../script.js), so the clouds are made of the same letters. Each person's WORDS still
// surface in echoes.
const FIELD_TEXT = `we would sit at diners and on front porches and meander from philosophy to religion to our interpersonal lives. we developed metaphors that became our own internal language, so unique that if someone was listening in it would be indecipherable to them what we were talking about. it felt like entering a field of resonance where we were chipping away at a block of marble in between us to try to reveal something that already existed. the metaphors would carry over into the next conversation, and the next would weave from those metaphors and concepts and experiences and books we were reading, until it became something completely unique to us. from that state of coherence we found conviction. from conviction we made art. every step was an overflow from the one before. the gardener does not produce the plant. the gardener curates the conditions: the soil, the water, the protection. you cannot control what grows. not the individuals but what forms between them, the life between us, something new with its own set of possibilities. you cannot shortcut the emergence. islands sharing an ocean floor, separate, distinctive, connected by what is beneath. three rings linked so that removing any one causes all three to fall apart. `;
const WORDS = [
  ['what if', 'someday', 'I keep wondering', 'I want to build', 'maybe', 'not yet', "I can't stop thinking about"],
  ['why not', 'bigger than me', 'I noticed', "let's make", 'it could be'],
  ['I know how to', 'I could help with', "I've seen this before", 'show me', 'a place where'],
  ['count me in', 'what about', "I'd love to", "let's try"],
];

// ---- Beats ----
// span: share of the scroll. scene: where things are while the beat holds.
// Cloud x, y (from stage center) and r are in units of U; a is opacity. motion scales the
// drift, scramble scales SCRAMBLE, echo and loop are 0–1 amounts, lift raises the group
// (U), sway 0–1, container and clusters are on (1) or off (0).

const cloud = (x, y, r, a = 1) => ({ x, y, r, a });
// Where each person waits, faded out, before drifting in.
const AWAY = [cloud(0, 0, 0.9, 0), cloud(2.8, 0.2, 1, 0), cloud(0.3, 2.6, 1, 0), cloud(-2.8, -0.6, 1, 0)];
const people = (...present) => AWAY.map((away, i) => present[i] || away);
// Even arrangement: equilateral for 3, square for 4.
function balanced(s, r) {
  const angles = CLOUD_COUNT === 4 ? [225, 315, 45, 135] : [210, 330, 90];
  return people(...angles.map(deg => cloud(s * Math.cos(deg * Math.PI / 180), s * Math.sin(deg * Math.PI / 180), r)));
}
const gathered = CLOUD_COUNT === 4
  ? people(cloud(-0.45, -0.38, 1.12), cloud(0.5, -0.32, 1.05), cloud(0.42, 0.45, 1.0), cloud(-0.36, 0.42, 1.05))
  : people(cloud(-0.42, -0.22, 1.12), cloud(0.48, -0.17, 1.05), cloud(0.04, 0.5, 1.0));

const BEATS = [
  { span: 1, text: 'Everyone has something to do in this world. Something to contribute.',
    scene: { clouds: people(cloud(0, 0, 0.95, 0.22)), motion: 0.15, scramble: 0.25 } },
  { span: 1, text: 'Call it ambition, call it a dream: you have a strong wish to achieve something in this life.',
    scene: { clouds: people(cloud(0, 0, 1.1, 0.6)), motion: 0.5, scramble: 0.6 } },
  { span: 1, text: "The problem is we've bought the story that ambition is a solo player game. Sure, it can be, but at a cost.",
    scene: { clouds: people(cloud(0, 0, 0.5, 0.65)), motion: 0.6, scramble: 0.8 } },
  { span: 1.2, text: "This is you in solo mode. A cloud of ideas and possibilities, but you're talking to yourself.",
    scene: { clouds: people(cloud(-0.95, 0, 0.75), cloud(0.95, 0.05, 0.75)), echo: 1 } },
  { span: 1.3, text: 'We fall into traps. Endless loops. Bad thinking.',
    scene: { clouds: people(cloud(-0.95, 0, 0.6), cloud(0.95, 0.05, 0.75)), loop: 1, motion: 0.4, scramble: 1.3 } },
  { span: 1.3, text: "We think better together. In relationship, exploring what's possible, what could be.",
    scene: { clouds: people(cloud(-0.5, 0, 1.05), cloud(0.55, 0.05, 1.05)) } },
  { span: 1.3, text: 'Ambition is better when shared with a few others.',
    scene: { clouds: gathered } },
  { span: 1, text: 'In service of the greater good.',
    scene: { clouds: gathered, lift: 0.08, motion: 0.8 } },
  { span: 1.2, text: 'Held in balance.',
    scene: { clouds: balanced(0.5, 1.15), lift: 0.08, sway: 1, motion: 0.7 } },
  { span: 1.3, text: 'Guilds are a container to hold shared ambition.',
    scene: { clouds: balanced(0.5, 1.15), lift: 0.08, sway: 1, motion: 0.7, container: 1 } },
  { span: 1.3, text: "Dialect's mission is to help guilds form and grow,",
    scene: { clouds: balanced(0.5, 1.15), lift: 0.08, sway: 1, motion: 0.7, container: 1, clusters: 1, echo: 0.3 } },
  { span: 1.5, text: "to rescope ambition to what's possible together.",
    scene: { clouds: balanced(0.5, 1.15), lift: 0.08, sway: 1, motion: 0.7, container: 1, clusters: 1, echo: 0.3 } },
];
// The beat whose scene reduced motion shows, statically.
const STILL_BEAT = 9;

const SCENE_DEFAULTS = { motion: 1, scramble: 1, echo: 0, loop: 0, lift: 0, sway: 0, container: 0, clusters: 0 };
{
  const total = BEATS.reduce((sum, b) => sum + b.span, 0);
  let acc = 0;
  for (const b of BEATS) {
    b.scene = { ...SCENE_DEFAULTS, ...b.scene };
    b.from = acc / total;
    acc += b.span;
    b.to = acc / total;
  }
}

function mixScene(a, b, t) {
  const out = { clouds: a.clouds.map((ca, i) => {
    const cb = b.clouds[i];
    return { x: ca.x + (cb.x - ca.x) * t, y: ca.y + (cb.y - ca.y) * t, r: ca.r + (cb.r - ca.r) * t, a: ca.a + (cb.a - ca.a) * t };
  }) };
  for (const key in SCENE_DEFAULTS) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

// Each beat holds its scene through the middle of its range and blends into the next
// across the boundary.
function sceneAt(p) {
  for (let i = 0; i < BEATS.length; i++) {
    const b = BEATS[i], next = BEATS[i + 1];
    if (!next) return b.scene;
    const holdEnd = b.to - TRANSITION * (b.to - b.from);
    if (p <= holdEnd) return b.scene;
    const nextStart = next.from + TRANSITION * (next.to - next.from);
    if (p < nextStart) return mixScene(b.scene, next.scene, smoothstep(holdEnd, nextStart, p));
  }
}

// ---- Modes and sizing (computed once, like the root; a resize only resizes the canvas) ----

const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('still', STILL);

// Phones get a tighter group that fills the width with 16px gutters, and no edge clusters.
const narrow = innerWidth < 600;
const boxW = narrow ? innerWidth - 32 : Math.min(innerWidth - 100, 1000);
const U = param('radius', Math.round(Math.min(RADIUS_MAX, boxW / 2 / EXTENT, innerHeight * CLOUD_BOX / 2 / EXTENT)), 30, 600);
const EDGE = CONTAIN_DEPTH * U;

// DPR - Cap at 2 to protect fill-rate on 3x screens.
const dpr = Math.min(window.devicePixelRatio || 1, 2);

// How far inside each cloud a point sits, eased over EDGE, keeping the top three.
// Counting containing clouds: ranked[1] is "in two", ranked[2] is "in three or more".
const ranked = [0, 0, 0];
function containment(x, y, list, edge) {
  ranked[0] = ranked[1] = ranked[2] = 0;
  for (const c of list) {
    const v = smoothstep(0, edge, c.r - Math.hypot(x - c.x, y - c.y)) * smoothstep(0.4, 0.9, c.a);
    if (v > ranked[0]) { ranked[2] = ranked[1]; ranked[1] = ranked[0]; ranked[0] = v; }
    else if (v > ranked[1]) { ranked[2] = ranked[1]; ranked[1] = v; }
    else if (v > ranked[2]) ranked[2] = v;
  }
  return ranked;
}

// ---- The line: wrapped and sized to resolve fully wherever three clouds are present ----

const measure = document.createElement('canvas').getContext('2d');
measure.font = 'bold 100px monospace';
const ADVANCE = measure.measureText('m').width / 100;

function wrap(text, max) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  lines.push(line);
  return lines;
}

// Home offsets of each non-space character, relative to the group center.
function place(lines, cw, lh) {
  const homes = [];
  lines.forEach((line, i) => {
    for (let j = 0; j < line.length; j++) {
      if (line[j] === ' ') continue;
      homes.push({ ch: line[j], x: (j - (line.length - 1) / 2) * cw, y: (i - (lines.length - 1) / 2) * lh });
    }
  });
  return homes;
}

// Largest font, then fewest rows, whose every glyph sits deep enough in three clouds, with
// a margin, in every beat that has three or more people present.
function fitLine() {
  const groups = BEATS
    .map(b => b.scene.clouds.slice(0, CLOUD_COUNT).filter(c => c.a > 0.5).map(c => ({ x: c.x * U, y: c.y * U, r: c.r * U, a: 1 })))
    .filter(list => list.length >= 3);
  for (let font = FONT_MAX; font >= FONT_MIN; font -= 0.5) {
    for (let max = LINE.length; max >= 4; max--) {
      const homes = place(wrap(LINE, max), font * ADVANCE, font * LINE_HEIGHT);
      if (groups.every(list => homes.every(h => containment(h.x, h.y, list, EDGE * 1.15)[2] >= 1))) return { font, homes };
    }
  }
  return { font: FONT_MIN, homes: place(wrap(LINE, 16), FONT_MIN * ADVANCE, FONT_MIN * LINE_HEIGHT) };
}

const { font: FONT, homes: HOMES } = fitLine();
const CW = FONT * ADVANCE;
const LH = FONT * LINE_HEIGHT;

// ---- Glyph atlases: each character pre-rendered once per color at device resolution ----

const ALL_POOL = [...FIELD_TEXT].filter(ch => ch !== ' ');
const POOLS = WORDS.map(() => ALL_POOL);
const LOOP_POOL = [...LOOP_FRAGMENTS.join('')].filter(ch => ch !== ' ');
const BOX = Math.ceil(FONT * 1.4); // logical px, glyph cell size

function makeAtlas(color) {
  const atlas = {};
  for (const ch of new Set([...ALL_POOL, ...WORDS.flat().join(''), ...LINE])) {
    if (ch === ' ') continue;
    const off = document.createElement('canvas');
    off.width = off.height = BOX * dpr;            // device-res backing store
    const octx = off.getContext('2d');
    octx.scale(dpr, dpr);                          // draw below in logical px
    octx.font = `bold ${FONT}px monospace`;
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillStyle = color;
    octx.fillText(ch, BOX / 2, BOX / 2);
    atlas[ch] = off;
  }
  return atlas;
}
const ATLAS = COLORS.map(makeAtlas);
const SETTLED = makeAtlas(SETTLED_COLOR);
const RESOLVED = makeAtlas(RESOLVED_COLOR);

// ---- People, glyphs and clusters ----

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Live geometry, in logical px, refreshed each frame from the scene.
const clouds = WORDS.map((words, i) => ({ index: i, x: 0, y: 0, r: 0, a: 0, fragments: [], echo: null }));

function makeGlyph(kind, owner, pool) {
  return {
    kind, owner,
    rr: 0.96 * Math.sqrt(Math.random()), // drift spot, as a fraction of the cloud radius
    ang: Math.random() * Math.PI * 2,
    p1: Math.random() * Math.PI * 2, p2: Math.random() * Math.PI * 2,
    w1: 0.2 + Math.random() * 0.4, w2: 0.2 + Math.random() * 0.4,
    x: NaN, y: NaN,
    ch: pick(pool),
    next: Math.random() / Math.max(SCRAMBLE, 0.001),
    s2: 0, s3: 0, blank: 0, alpha: 0,
  };
}

// The line's glyphs; their owners are reassigned each frame among the people present.
const lineGlyphs = HOMES.map((home, k) => Object.assign(makeGlyph('line', 0, POOLS[0]), { home, k }));
const noiseGlyphs = [];

// Noise glyphs carry fragments of their owner's words, each with a row where it can gather
// and read for a moment (an echo).
const chunkMax = Math.max(6, Math.floor(U * 0.9 / CW));
const noisePerCloud = Math.min(MAX_NOISE, Math.round(NOISE_DENSITY * Math.PI * U * U / (CW * LH)));
for (const c of clouds) {
  if (c.index >= CLOUD_COUNT) continue;
  const chunks = WORDS[c.index].flatMap(w => wrap(w, chunkMax));
  let count = noisePerCloud;
  for (let k = 0; count > 0; k++) {
    const text = chunks[k % chunks.length];
    const ang = Math.random() * Math.PI * 2, dist = 0.45 * Math.sqrt(Math.random());
    const frag = { ax: Math.cos(ang) * dist, ay: Math.sin(ang) * dist, glyphs: [], complete: true };
    for (let j = 0; j < text.length; j++) {
      if (text[j] === ' ') continue;
      if (count-- <= 0) { frag.complete = false; break; }
      const g = Object.assign(makeGlyph('noise', c.index, POOLS[c.index]), { frag, sx: (j - (text.length - 1) / 2) * CW, own: text[j], slot: null });
      frag.glyphs.push(g);
      noiseGlyphs.push(g);
    }
    c.fragments.push(frag);
  }
}

// Loop mode: slots in rows of seven inside cloud 1 at its loop-beat radius. Each row shows
// one loop fragment, and the rows cycle through them.
const LOOP_COLS = Math.max(...LOOP_FRAGMENTS.map(f => f.length));
const loopBeat = BEATS.find(b => b.scene.loop > 0);
const LOOP_R = (loopBeat ? loopBeat.scene.clouds[0].r : 0.6) * U;
{
  const slots = [];
  let row = 0;
  for (let y = -LOOP_R + LH; y <= LOOP_R - LH / 2; y += LH) {
    const half = Math.sqrt(LOOP_R * LOOP_R - y * y) - CW / 2;
    const groups = Math.floor((2 * half + CW) / ((LOOP_COLS + 1) * CW));
    for (let gi = 0; gi < groups; gi++, row++) {
      const left = -((groups * (LOOP_COLS + 1) - 1) * CW) / 2 + gi * (LOOP_COLS + 1) * CW;
      for (let col = 0; col < LOOP_COLS; col++) slots.push({ x: left + (col + 0.5) * CW, y, row, col });
    }
  }
  const own = noiseGlyphs.filter(g => g.owner === 0);
  slots.forEach((slot, i) => { if (own[i]) own[i].slot = slot; });
}

// Edge clusters: 2–3 mini-clouds near each corner that drift together on their own.
const MINI_R = CLUSTER_RADIUS * U;
const clusters = narrow ? [] : [[-1, -1, 3], [1, -1, 2], [1, 1, 3], [-1, 1, 2]].map(([sx, sy, n]) => {
  const minis = Array.from({ length: n }, (_, i) => ({
    ang: (i / n) * Math.PI * 2 + Math.random(), x: 0, y: 0, r: MINI_R, a: 1, phase: Math.random() * 6,
  }));
  const glyphs = minis.flatMap((m, mi) => Array.from({ length: 16 }, () =>
    Object.assign(makeGlyph('mini', 1 + (mi % 3), ALL_POOL), { mini: m })));
  return { sx, sy, minis, glyphs, x: 0, y: 0, on: true };
});
const miniGlyphs = clusters.flatMap(cl => cl.glyphs);

// ---- Canvas and captions ----

const c = document.querySelector('canvas');
const ctx = c.getContext('2d');
const track = document.querySelector('.track');
const captionsEl = document.querySelector('.captions');

for (const b of BEATS) {
  b.el = document.createElement('p');
  b.el.className = 'beat';
  b.el.textContent = b.text;
  captionsEl.append(b.el);
}
// The line itself, for screen readers, after the beat where it first resolves.
{
  const line = document.createElement('p');
  line.className = 'sr-only';
  line.textContent = LINE;
  BEATS[6].el.after(line);
}
if (!STILL) track.style.height = `${BEATS.reduce((sum, b) => sum + b.span, 0) * SCROLL_PER_SPAN + 100}vh`;

// CSS sets the canvas's size; this matches the backing store to it.
function sizeCanvas() {
  c.width = Math.round(c.clientWidth * dpr);
  c.height = Math.round(c.clientHeight * dpr);
}

function scrollProgress() {
  const rect = track.getBoundingClientRect();
  const distance = rect.height - innerHeight;
  return distance > 0 ? Math.min(1, Math.max(0, -rect.top / distance)) : 0;
}

let shown = -1;
function updateCaptions(p) {
  let i = BEATS.findIndex(b => p < b.to);
  if (i < 0) i = BEATS.length - 1;
  if (i === shown) return;
  shown = i;
  BEATS.forEach((b, j) => b.el.classList.toggle('on', j === i));
}

// ---- Update ----

let progress = 0;      // eased scroll progress
let time = 0;          // seconds of animation, built from clamped frame times
let turn = 0;          // accumulated cloud rotation
let containerP = 0;    // how much of the container circle is drawn
let clusterP = 0;      // edge clusters: fade-in, then drawing together
let scene = BEATS[0].scene;
const group = { x: 0, y: 0, cx: 0, cy: 0, R: 0 };
const present = [];

function drift(g, cl, motion) {
  const a = g.ang + turn * (cl.index % 2 ? -1 : 1); // neighbors turn in opposite directions
  const amp = WANDER * U * motion;
  return [
    cl.x + Math.cos(a) * g.rr * cl.r + amp * Math.sin(time * g.w1 + g.p1),
    cl.y + Math.sin(a) * g.rr * cl.r + amp * Math.cos(time * g.w2 + g.p2),
  ];
}

function ease(g, tx, ty, k) {
  if (k >= 1 || Number.isNaN(g.x)) { g.x = tx; g.y = ty; return; }
  g.x += (tx - g.x) * k;
  g.y += (ty - g.y) * k;
}

// Advance a glyph's character: lock when sure, otherwise change on its scramble tick,
// landing on `want` with probability pWant.
function tick(g, want, pWant, pool, rate) {
  if (pWant > 0.98) { g.ch = want; return; }
  if (STILL || rate <= 0 || time < g.next) return;
  g.next = time + (0.5 + Math.random()) / rate;
  g.ch = want && Math.random() < pWant ? want : pick(pool);
}

// An echo only plays where its whole row is inside its own cloud and clear of the others.
function echoFits(frag, cl) {
  return frag.complete && frag.glyphs.every(g => {
    const x = cl.x + frag.ax * cl.r + g.sx, y = cl.y + frag.ay * cl.r;
    if (Math.hypot(x - cl.x, y - cl.y) > cl.r * 0.92) return false;
    return clouds.every(o => o === cl || o.a < 0.1 || Math.hypot(x - o.x, y - o.y) > o.r);
  });
}

function update(dt, snap) {
  const kScene = snap ? 1 : 1 - Math.exp(-dt / SCENE_EASE);
  const kGlyph = snap ? 1 : 1 - Math.exp(-dt / GLYPH_EASE);
  const W = c.clientWidth;
  const boxH = Math.min(c.clientHeight, innerHeight * CLOUD_BOX);
  const mx = W / 2, my = boxH / 2;

  if (STILL) {
    scene = BEATS[STILL_BEAT].scene;
    containerP = scene.container;
    clusterP = scene.clusters;
  } else {
    const p = scrollProgress();
    progress += (p - progress) * kScene;
    scene = sceneAt(progress);
    updateCaptions(p);
    const step = dt / 1000;
    containerP += Math.max(-step * CONTAINER_SPEED * 2, Math.min(step * CONTAINER_SPEED, scene.container - containerP));
    clusterP += Math.max(-step * CLUSTER_SPEED * 3, Math.min(step * CLUSTER_SPEED, scene.clusters - clusterP));
    turn += SPIN * scene.motion * step;
  }

  // Group offset: lift plus a synchronized sway.
  group.x = scene.sway * SWAY * U * Math.sin(time * 0.6);
  group.y = -scene.lift * U + scene.sway * SWAY * 0.5 * U * Math.sin(time * 0.9);
  present.length = 0;
  clouds.forEach((cl, i) => {
    const s = scene.clouds[i];
    cl.x = mx + group.x + s.x * U;
    cl.y = my + group.y + s.y * U;
    cl.r = s.r * U;
    cl.a = i < CLOUD_COUNT ? s.a : 0;
    if (cl.a > 0.5) present.push(cl);
  });
  if (!present.length) present.push(clouds[0]);

  // The container: centered on the group, just outside its outer edge.
  group.cx = present.reduce((s, cl) => s + cl.x, 0) / present.length;
  group.cy = present.reduce((s, cl) => s + cl.y, 0) / present.length;
  group.R = Math.max(...present.map(cl => Math.hypot(cl.x - group.cx, cl.y - group.cy) + cl.r)) * CONTAINER_PAD;

  // Echoes.
  if (!STILL) {
    for (const cl of clouds) {
      if (cl.echo && time > cl.echo.until) cl.echo = null;
      if (cl.echo || cl.a < 0.5 || !cl.fragments.length) continue;
      if (Math.random() < ECHO_RATE * scene.echo * dt / 1000) {
        const frag = pick(cl.fragments);
        if (echoFits(frag, cl)) cl.echo = { frag, until: time + ECHO_HOLD / 1000 };
      }
    }
  }

  const rate = SCRAMBLE * scene.scramble;
  const homeX = mx + group.x, homeY = my + group.y;

  for (const g of lineGlyphs) {
    const owner = present[g.k % present.length];
    g.owner = owner.index;
    let [tx, ty] = drift(g, owner, scene.motion);
    const hx = homeX + g.home.x, hy = homeY + g.home.y;
    const [, s2, s3] = containment(hx, hy, clouds, EDGE);
    g.s2 = s2;
    g.s3 = s3;
    const w = Math.min(1, s2 * 3); // travel home early, then flicker in as overlap deepens
    tx += (hx - tx) * w;
    ty += (hy - ty) * w;
    ease(g, tx, ty, kGlyph);
    // Settling: mostly locked with occasional flicker. Resolved: locked.
    tick(g, g.home.ch, 0.9 * s2 + 0.1 * s3, POOLS[owner.index], rate);
  }

  const loop = scene.loop;
  for (const g of noiseGlyphs) {
    const cl = clouds[g.owner];
    let [tx, ty] = drift(g, cl, scene.motion);
    let want = '', pWant = 0, pool = POOLS[g.owner];
    g.blank = 0;
    if (cl.echo && cl.echo.frag === g.frag) {
      tx = cl.x + g.frag.ax * cl.r + g.sx;
      ty = cl.y + g.frag.ay * cl.r;
      if (Math.hypot(tx - g.x, ty - g.y) < CW / 2) { want = g.own; pWant = 0.75; }
    } else if (loop > 0.01 && g.owner === 0) {
      if (g.slot) {
        const k = cl.r / LOOP_R;
        tx += (cl.x + g.slot.x * k - tx) * loop;
        ty += (cl.y + g.slot.y * k - ty) * loop;
        const cycle = time / LOOP_PERIOD + g.slot.row * 0.37;
        const phrase = LOOP_FRAGMENTS[(g.slot.row + Math.floor(cycle)) % LOOP_FRAGMENTS.length];
        const ch = phrase[g.slot.col - Math.floor((LOOP_COLS - phrase.length) / 2)];
        if (!ch || ch === ' ') g.blank = loop;
        else if (cycle % 1 >= LOOP_SCRAMBLE) { want = ch; pWant = loop; }
      } else {
        g.blank = loop * 0.85;
      }
      if (loop > 0.5) pool = LOOP_POOL;
    }
    ease(g, tx, ty, kGlyph);
    tick(g, want, pWant, pool, rate * (1 + loop));
  }

  // Edge clusters, placed in the corners and only where they clear the container.
  const fade = smoothstep(0, 0.3, clusterP);
  const together = smoothstep(0.2, 1, clusterP);
  for (const cl of clusters) {
    const ext = MINI_R * 2.4;
    cl.x = mx + cl.sx * (W / 2 - ext);
    cl.y = my + cl.sy * (boxH / 2 - ext);
    cl.on = Math.hypot(cl.x - group.cx, cl.y - group.cy) > group.R + ext;
    const n = cl.minis.length;
    for (const m of cl.minis) {
      const sep = MINI_R * (2.3 + (1.25 - 2.3) * together + 0.1 * Math.sin(time * 0.4 + m.phase));
      const d = sep / (2 * Math.sin(Math.PI / n));
      m.x = cl.x + Math.cos(m.ang) * d;
      m.y = cl.y + Math.sin(m.ang) * d;
    }
    for (const g of cl.glyphs) {
      const [tx, ty] = drift(g, { x: g.mini.x, y: g.mini.y, r: MINI_R, index: g.owner }, 1);
      ease(g, tx, ty, kGlyph);
      g.s2 = containment(g.x, g.y, cl.minis, MINI_R * 0.35)[1];
      g.alpha = cl.on ? fade * CLUSTER_ALPHA : 0;
      tick(g, '', 0, ALL_POOL, rate * (1 - 0.85 * g.s2));
    }
  }
}

// ---- Draw ----

function drawGlyph(img, x, y, alpha) {
  ctx.globalAlpha = alpha;
  ctx.setTransform(dpr, 0, 0, dpr, dpr * x, dpr * y); // scale(dpr) . translate(x, y)
  ctx.drawImage(img, -BOX / 2, -BOX / 2, BOX, BOX);
}

// Scramble opacity: the cloud's own opacity, a soft edge, thinned where clouds overlap.
function cloudAlpha(g) {
  const cl = clouds[g.owner];
  let alpha = cl.a * (1 - 0.5 * smoothstep(0.7 * cl.r, cl.r, Math.hypot(g.x - cl.x, g.y - cl.y)));
  const [, s2, s3] = containment(g.x, g.y, clouds, EDGE / 2);
  return alpha * (1 - LENS_FADE * Math.max(s2, s3));
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, c.width, c.height);

  for (const g of miniGlyphs) {
    if (g.alpha < 0.01) continue;
    drawGlyph(ATLAS[g.owner][g.ch], g.x, g.y, g.alpha * (1 - 0.5 * g.s2));
    if (g.s2 > 0.01) drawGlyph(SETTLED[g.ch], g.x, g.y, g.alpha * g.s2 * 0.8);
  }

  for (const g of noiseGlyphs) {
    const alpha = cloudAlpha(g) * (1 - g.blank);
    if (alpha > 0.01) drawGlyph(ATLAS[g.owner][g.ch], g.x, g.y, alpha);
  }

  // The line: scramble in the owner's color, settling in gray, resolved in black.
  // In loop mode its glyphs fade back so the loop rows read.
  const loopFade = 1 - 0.85 * scene.loop;
  for (const g of lineGlyphs) {
    const locked = g.ch === g.home.ch;
    const base = locked ? cloudAlpha(g) * loopFade * (1 - g.s2) : Math.max(cloudAlpha(g) * loopFade, g.s2);
    if (base > 0.01) drawGlyph(ATLAS[g.owner][g.ch], g.x, g.y, base);
    if (!locked) continue;
    if (g.s2 * (1 - g.s3) > 0.01) drawGlyph(SETTLED[g.ch], g.x, g.y, g.s2 * (1 - g.s3));
    if (g.s3 > 0.01) drawGlyph(RESOLVED[g.ch], g.x, g.y, g.s3);
  }

  // The container, the only line drawn in the piece.
  if (containerP > 0.002) {
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = CONTAINER_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(group.cx, group.cy, group.R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, containerP));
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---- Run ----

sizeCanvas();

if (STILL) {
  // Reduced motion: beat 10's state, drawn once and redrawn on resize.
  const render = () => { sizeCanvas(); update(0, true); draw(); };
  render();
  window.addEventListener('resize', render);
} else {
  window.addEventListener('resize', sizeCanvas);

  let last = 0;
  function runloop(now) {
    requestAnimationFrame(runloop);
    // Clamp the frame time: a repeated timestamp gives dt = 0, and a long pause (tab switch)
    // would make everything jump.
    const dt = Math.min(Math.max(now - last, 8), 33);
    last = now;
    time += dt / 1000;
    update(dt, false);
    draw();
  }
  requestAnimationFrame(runloop);
}
