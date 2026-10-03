// Pure analysis for PipSqueak recording sessions.
// Runs in the browser (ES module) and in Bun. No DOM, no MIDI, just math.
//
// Session shape:
// {
//   device: string,
//   recordedAt: ISO string,
//   button: { key } | null,
//   steps: [{ id, name, startedAt, endedAt }],   // ms, relative to session start
//   messages: [{ t, step, data: [status, d1, d2] }]
// }

export const STEP_IDS = ["learn", "rest1", "cw", "ccw", "left", "right", "up", "down", "rest2"];

export function decode(data) {
  const [status, d1 = 0, d2 = 0] = data;
  const type = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  switch (type) {
    case 0xb0:
      return { key: `cc:${d1}`, type: "cc", number: d1, value: d2, channel };
    case 0x90:
      if (d2 > 0) return { key: `note:${d1}`, type: "note", number: d1, value: d2, on: true, channel };
      return { key: `note:${d1}`, type: "note", number: d1, value: 0, on: false, channel };
    case 0x80:
      return { key: `note:${d1}`, type: "note", number: d1, value: 0, on: false, channel };
    case 0xe0:
      return { key: "pb", type: "pb", number: 0, value: d1 | (d2 << 7), channel };
    case 0xd0:
      return { key: "pressure", type: "pressure", number: 0, value: d1, channel };
    case 0xa0:
      return { key: `polyat:${d1}`, type: "polyat", number: d1, value: d2, channel };
    default:
      return null;
  }
}

function stats(samples) {
  // samples: [{t, value}] sorted by t
  const n = samples.length;
  if (n === 0) return null;
  let min = Infinity, max = -Infinity, sum = 0, travel = 0;
  for (let i = 0; i < n; i++) {
    const v = samples[i].value;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    if (i > 0) travel += Math.abs(v - samples[i - 1].value);
  }
  const mean = sum / n;
  let sq = 0;
  for (const s of samples) sq += (s.value - mean) ** 2;
  const stdev = Math.sqrt(sq / n);
  const first = samples[0].value, last = samples[n - 1].value;
  const span = (samples[n - 1].t - samples[0].t) / 1000;
  // linear regression slope, value units per second
  let slope = 0;
  if (n > 1 && span > 0) {
    const tm = samples.reduce((a, s) => a + s.t, 0) / n;
    let num = 0, den = 0;
    for (const s of samples) {
      num += (s.t - tm) * (s.value - mean);
      den += (s.t - tm) ** 2;
    }
    slope = den > 0 ? (num / den) * 1000 : 0;
  }
  return {
    count: n, min, max, range: max - min, mean, stdev, first, last,
    delta: last - first, travel, slope,
    rate: span > 0 ? n / span : n,
  };
}

// Sum of cross products of successive centered (a, b) points.
// Positive means counter-clockwise in a plane where a is right and b is up.
function rotation(samplesA, samplesB, ca, cb) {
  const merged = [];
  let ia = 0, ib = 0, a = null, b = null;
  while (ia < samplesA.length || ib < samplesB.length) {
    const ta = ia < samplesA.length ? samplesA[ia].t : Infinity;
    const tb = ib < samplesB.length ? samplesB[ib].t : Infinity;
    if (ta <= tb) { a = samplesA[ia++].value; } else { b = samplesB[ib++].value; }
    if (a !== null && b !== null) merged.push([a - ca, b - cb]);
  }
  let cross = 0;
  for (let i = 1; i < merged.length; i++) {
    const [x0, y0] = merged[i - 1], [x1, y1] = merged[i];
    cross += x0 * y1 - x1 * y0;
  }
  return { cross, sign: Math.sign(cross), points: merged.length };
}

export function analyzeSession(session, opts = {}) {
  const trimStartMs = opts.trimStartMs ?? 250;
  const trimEndMs = opts.trimEndMs ?? 250;

  const keys = {};
  const perStep = {};
  for (const step of session.steps) perStep[step.id] = { step, series: {} };

  for (const m of session.messages) {
    const d = decode(m.data);
    if (!d) continue;
    keys[d.key] ??= { type: d.type, number: d.number, total: 0 };
    keys[d.key].total++;
    const bucket = perStep[m.step];
    if (!bucket) continue;
    const { startedAt, endedAt } = bucket.step;
    if (endedAt != null && (m.t < startedAt + trimStartMs || m.t > endedAt - trimEndMs)) continue;
    (bucket.series[d.key] ??= []).push({ t: m.t, value: d.value });
  }

  const steps = session.steps.map((step) => {
    const series = perStep[step.id].series;
    const out = {};
    for (const [key, samples] of Object.entries(series)) out[key] = stats(samples);
    return {
      id: step.id, name: step.name,
      durationMs: step.endedAt != null ? step.endedAt - step.startedAt : null,
      keys: out, series,
    };
  });
  const byId = Object.fromEntries(steps.map((s) => [s.id, s]));

  // Continuous keys only (ignore the button) for axis detection.
  const buttonKey = session.button?.key ?? Object.keys(keys).find((k) => keys[k].type === "note") ?? null;
  const isContinuous = (key) => keys[key] && keys[key].type !== "note" && key !== buttonKey;

  // Rest: jitter and center per key across all rest steps.
  const rest = {};
  for (const id of ["rest1", "rest2"]) {
    const s = byId[id];
    if (!s) continue;
    for (const [key, st] of Object.entries(s.keys)) {
      if (!isContinuous(key)) continue;
      const r = (rest[key] ??= { min: Infinity, max: -Infinity, count: 0, sum: 0 });
      r.min = Math.min(r.min, st.min);
      r.max = Math.max(r.max, st.max);
      r.count += st.count;
      r.sum += st.mean * st.count;
    }
  }
  for (const r of Object.values(rest)) {
    r.range = r.max - r.min;
    r.center = r.sum / r.count;
  }

  const travelIn = (ids, key) => ids.reduce((a, id) => a + (byId[id]?.keys[key]?.travel ?? 0), 0);
  const continuousKeys = Object.keys(keys).filter(isContinuous);
  const pickAxis = (ids) => {
    let best = null, bestTravel = 0;
    for (const key of continuousKeys) {
      const t = travelIn(ids, key);
      if (t > bestTravel) { best = key; bestTravel = t; }
    }
    return best;
  };

  const xKey = pickAxis(["left", "right"]);
  const yKey = pickAxis(["up", "down"]);

  // Direction: where did the step's mean sit relative to the rest center?
  // Falls back to first→last delta when there is no rest data.
  const dirWord = (id, key) => {
    const st = byId[id]?.keys[key];
    if (!st) return "unchanged";
    const c = rest[key]?.center;
    const off = c != null ? st.mean - c : st.delta;
    return off < -2 ? "low" : off > 2 ? "high" : "unchanged";
  };
  const mapping = {
    x: xKey ? { key: xKey, leftIs: dirWord("left", xKey), rightIs: dirWord("right", xKey) } : null,
    y: yKey ? { key: yKey, upIs: dirWord("up", yKey), downIs: dirWord("down", yKey) } : null,
    sameKey: xKey != null && xKey === yKey,
    center: { x: xKey ? rest[xKey]?.center ?? null : null, y: yKey ? rest[yKey]?.center ?? null : null },
    deadzone: Math.max(xKey ? rest[xKey]?.range ?? 0 : 0, yKey ? rest[yKey]?.range ?? 0 : 0) + 1,
    button: buttonKey,
    fullRange: {
      x: xKey ? { min: Math.min(byId.left?.keys[xKey]?.min ?? Infinity, byId.right?.keys[xKey]?.min ?? Infinity), max: Math.max(byId.left?.keys[xKey]?.max ?? -Infinity, byId.right?.keys[xKey]?.max ?? -Infinity) } : null,
      y: yKey ? { min: Math.min(byId.up?.keys[yKey]?.min ?? Infinity, byId.down?.keys[yKey]?.min ?? Infinity), max: Math.max(byId.up?.keys[yKey]?.max ?? -Infinity, byId.down?.keys[yKey]?.max ?? -Infinity) } : null,
    },
  };

  // Spin analysis, using the chosen axes (or the two busiest keys if axes unknown).
  const spin = {};
  for (const id of ["cw", "ccw"]) {
    const s = byId[id];
    if (!s) continue;
    let a = xKey, b = yKey;
    if (!a || !b || a === b) {
      const ranked = continuousKeys.map((k) => [k, s.keys[k]?.travel ?? 0]).sort((p, q) => q[1] - p[1]);
      a = ranked[0]?.[0]; b = ranked[1]?.[0];
    }
    if (!a || !b || !s.series[a] || !s.series[b]) { spin[id] = null; continue; }
    const r = rotation(s.series[a], s.series[b], rest[a]?.center ?? s.keys[a].mean, rest[b]?.center ?? s.keys[b].mean);
    spin[id] = { pair: [a, b], ...r };
  }
  const spinsDistinguishable = spin.cw && spin.ccw && spin.cw.sign !== 0 && spin.cw.sign === -spin.ccw.sign;

  // 14-bit pair hint: cc N and cc N+32 both busy.
  const pairs14 = [];
  for (const key of continuousKeys) {
    const k = keys[key];
    if (k.type === "cc" && k.number < 32 && keys[`cc:${k.number + 32}`]) pairs14.push([key, `cc:${k.number + 32}`]);
  }

  const result = { device: session.device, keys, steps, rest, mapping, spin, spinsDistinguishable, pairs14 };
  result.text = summarize(result);
  return result;
}

const f = (n, d = 1) => (n == null || Number.isNaN(n) ? "-" : Number(n).toFixed(d));

export function summarize(r) {
  const lines = [];
  lines.push(`PipSqueak session — ${r.device ?? "unknown device"}`);
  lines.push("");
  lines.push("Messages seen:");
  for (const [key, k] of Object.entries(r.keys).sort((a, b) => b[1].total - a[1].total)) {
    lines.push(`  ${key.padEnd(10)} ${String(k.total).padStart(6)} msgs`);
  }
  if (r.pairs14.length) lines.push(`  possible 14-bit pairs: ${r.pairs14.map((p) => p.join("+")).join(", ")}`);
  lines.push("");
  lines.push("Per step (trimmed around button presses):");
  for (const s of r.steps) {
    lines.push(`  [${s.id}] ${s.name} — ${f(s.durationMs / 1000)}s`);
    const entries = Object.entries(s.keys).sort((a, b) => b[1].travel - a[1].travel);
    if (!entries.length) lines.push("      (no messages)");
    for (const [key, st] of entries) {
      lines.push(
        `      ${key.padEnd(10)} n=${String(st.count).padStart(4)}  ${f(st.rate, 0).padStart(4)}/s` +
        `  min=${String(st.min).padStart(5)} max=${String(st.max).padStart(5)} mean=${f(st.mean).padStart(7)}` +
        `  first→last ${st.first}→${st.last} (Δ${st.delta > 0 ? "+" : ""}${st.delta})  travel=${st.travel}  slope=${f(st.slope, 0)}/s`
      );
    }
  }
  lines.push("");
  lines.push("At rest (jitter):");
  for (const [key, rs] of Object.entries(r.rest)) {
    lines.push(`  ${key.padEnd(10)} center≈${f(rs.center)}  wobble ${rs.min}..${rs.max} (range ${rs.range})`);
  }
  lines.push("");
  lines.push("Spin:");
  for (const id of ["cw", "ccw"]) {
    const sp = r.spin[id];
    lines.push(sp ? `  ${id.padEnd(4)} pair ${sp.pair.join(" × ")}  cross=${f(sp.cross, 0)}  sign=${sp.sign > 0 ? "+" : sp.sign < 0 ? "-" : "0"}  (${sp.points} points)` : `  ${id.padEnd(4)} (no data)`);
  }
  lines.push(`  cw and ccw have opposite sign: ${r.spinsDistinguishable ? "yes" : "NO"}`);
  lines.push("");
  lines.push("Proposed mapping:");
  const m = r.mapping;
  lines.push(m.x ? `  X axis   = ${m.x.key}   left→${m.x.leftIs}, right→${m.x.rightIs}   range ${m.fullRange.x.min}..${m.fullRange.x.max}   center≈${f(m.center.x)}` : "  X axis   = (not found)");
  lines.push(m.y ? `  Y axis   = ${m.y.key}   up→${m.y.upIs}, down→${m.y.downIs}   range ${m.fullRange.y.min}..${m.fullRange.y.max}   center≈${f(m.center.y)}` : "  Y axis   = (not found)");
  if (m.sameKey) lines.push("  ! X and Y resolved to the same key — the device may encode direction differently. Look at the per-step table.");
  lines.push(`  deadzone = ±${m.deadzone} around center (from rest wobble)`);
  lines.push(`  button   = ${m.button ?? "(not seen)"}`);
  return lines.join("\n");
}
