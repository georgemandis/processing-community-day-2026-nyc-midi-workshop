// grayscott.js — Gray-Scott reaction-diffusion on a wrapping grid. Pure, no p5.
//
//   U + 2V → 3V   (activator V eats substrate U)
//   V → ∅         (kill rate k)
//   ∅ → U         (feed rate F)
//
//   u' = u + (Du ∇²u − u v² + F (1 − u)) dt
//   v' = v + (Dv ∇²v + u v² − (F + k) v) dt
//
// Units follow the common p5 / Karl Sims convention (Du = 1, Dv = 0.5, dt = 1,
// 9-point Laplacian) rather than the dx-based ones on the pycellchem page, so F
// and k carry the same meaning as in Pearson's map and the presets below.

export const PRESETS = [
  { name: "mitosis",        F: 0.0367, k: 0.0645 },   // k 0.065 is the cliff: nothing survives past it
  { name: "coral",          F: 0.0545, k: 0.062  },
  { name: "solitons",       F: 0.030,  k: 0.062  },
  { name: "pulsing spots",  F: 0.025,  k: 0.060  },
  { name: "worms",          F: 0.078,  k: 0.061  },
  { name: "mazes",          F: 0.029,  k: 0.057  },
  { name: "holes",          F: 0.039,  k: 0.058  },
  { name: "chaos",          F: 0.026,  k: 0.051  },
  { name: "moving spots",   F: 0.018,  k: 0.054  },
  { name: "spots & loops",  F: 0.018,  k: 0.051  },
  { name: "waves",          F: 0.018,  k: 0.045  },
  { name: "u-skate",        F: 0.062,  k: 0.0609 },
];

export const RANGE = { F: [0.0, 0.1], k: [0.03, 0.075] };

export function nearestPreset(F, k) {
  let best = null, bd = Infinity;
  for (const p of PRESETS) {
    const d = Math.hypot((p.F - F) / (RANGE.F[1] - RANGE.F[0]), (p.k - k) / (RANGE.k[1] - RANGE.k[0]));
    if (d < bd) { bd = d; best = p; }
  }
  return { ...best, distance: bd };
}

export class GrayScott {
  constructor(width, height, { F = 0.04, k = 0.06, Du = 1.0, Dv = 0.5, dt = 1.0 } = {}) {
    this.width = width; this.height = height;
    this.F = F; this.k = k; this.Du = Du; this.Dv = Dv; this.dt = dt;
    this.u = new Float32Array(width * height);
    this.v = new Float32Array(width * height);
    this._u = new Float32Array(width * height);
    this._v = new Float32Array(width * height);
    this.reset();
  }

  index(x, y) { return x + y * this.width; }

  // Uniform substrate, empty of activator, then a small square of V in the middle.
  reset({ seed = true } = {}) {
    this.u.fill(1); this.v.fill(0);
    if (seed) this.seed(this.width / 2, this.height / 2, Math.max(2, Math.round(this.width / 25)));
  }

  // Drop activator in a disc. amount 1 = saturate; smaller values paint gently.
  seed(cx, cy, r = 3, amount = 1) {
    const { width: w, height: h } = this;
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = (((Math.round(cx) + dx) % w) + w) % w, y = (((Math.round(cy) + dy) % h) + h) % h;
      const i = x + y * w;
      this.v[i] = Math.min(1, this.v[i] + amount);   // leave U alone: depleting it too kills marginal regimes like mitosis
    }
  }

  step(n = 1) {
    const { width: w, height: h, F, k, Du, Dv, dt } = this;
    const kf = F + k;
    for (let s = 0; s < n; s++) {
      const u = this.u, v = this.v, nu = this._u, nv = this._v;
      for (let y = 0; y < h; y++) {
        const yu = (y === 0 ? h - 1 : y - 1) * w, yd = (y === h - 1 ? 0 : y + 1) * w, yc = y * w;
        for (let x = 0; x < w; x++) {
          const xl = x === 0 ? w - 1 : x - 1, xr = x === w - 1 ? 0 : x + 1;
          const i = yc + x;
          const lu = 0.2 * (u[yc + xl] + u[yc + xr] + u[yu + x] + u[yd + x])
                   + 0.05 * (u[yu + xl] + u[yu + xr] + u[yd + xl] + u[yd + xr]) - u[i];
          const lv = 0.2 * (v[yc + xl] + v[yc + xr] + v[yu + x] + v[yd + x])
                   + 0.05 * (v[yu + xl] + v[yu + xr] + v[yd + xl] + v[yd + xr]) - v[i];
          const uvv = u[i] * v[i] * v[i];
          let a = u[i] + (Du * lu - uvv + F * (1 - u[i])) * dt;
          let b = v[i] + (Dv * lv + uvv - kf * v[i]) * dt;
          nu[i] = a < 0 ? 0 : a > 1 ? 1 : a;
          nv[i] = b < 0 ? 0 : b > 1 ? 1 : b;
        }
      }
      this._u = u; this._v = v; this.u = nu; this.v = nv;
    }
  }
}

// Nudge F/k by a stick deflection (x → k, y → F, as on Pearson's map), scaled by
// elapsed seconds and a rate in parameter units per second, clamped to RANGE.
export function drift({ F, k }, { x, y }, seconds, rate) {
  const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
  return { F: clamp(F + y * rate * seconds, RANGE.F), k: clamp(k + x * rate * seconds, RANGE.k) };
}
