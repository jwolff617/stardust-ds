// Copied from shop/wolffie-lessons/printables.js. Keep the two in step.
// Wolffie Games printables. Each returns { how, svg } for one printed page.
// Drawn at true size: 1 inch = 100 units, page area 7.5 x 8.6 inches.
// Solid line = cut. Dashed line = fold. Dot in a circle = hole punch.

export const P = (() => {
  const W = 750, H = 860;
  const svg = (body, w = W, h = H) =>
    `<svg class="pr" viewBox="0 0 ${w} ${h}" width="${w / 100}in" height="${h / 100}in" xmlns="http://www.w3.org/2000/svg" ` +
    `font-family="Segoe UI, Arial, sans-serif" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const cut = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const fold = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-dasharray="10 8" stroke-width="2"/>`;
  const rect = (x, y, w, h, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
  const text = (x, y, s, size = 16, anchor = "middle", weight = 600, extra = "") =>
    `<text ${extra} x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" fill="#111" stroke="none">${s}</text>`;
  const punch = (x, y) => `<circle cx="${x}" cy="${y}" r="9"/><circle cx="${x}" cy="${y}" r="2.5" fill="#111"/>`;
  const legend = (y = H - 6) =>
    cut(20, y - 5, 60, y - 5) + text(68, y, "cut", 14, "start") + fold(120, y - 5, 160, y - 5) + text(168, y, "fold", 14, "start");

  // seeded random so a printed page never changes
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  return {
    // 3 helicopters per sheet, each a 2 x 8 inch strip
    helicopter() {
      let b = "";
      [45, 280, 515].forEach(x => {
        b += rect(x, 20, 190, 800);                       // outline: cut
        b += cut(x + 95, 20, x + 95, 400);                 // split the blades
        b += fold(x, 400, x + 95, 400) + fold(x + 95, 400, x + 190, 400);
        b += text(x + 47, 220, "fold", 15) + text(x + 47, 240, "forward", 15);
        b += text(x + 142, 220, "fold", 15) + text(x + 142, 240, "back", 15);
        b += cut(x, 450, x + 50, 450) + cut(x + 140, 450, x + 190, 450);
        b += fold(x + 50, 450, x + 50, 820) + fold(x + 140, 450, x + 140, 820);
        b += text(x + 95, 640, "fold sides in", 14) + text(x + 95, 790, "paper clip here", 13);
      });
      return { how: "3 per sheet. Cut on solid lines, fold on dashed lines.", svg: svg(b + legend()) };
    },

    // 7 bracelet strips, 1 x 7 inches, punch dots at each end
    bracelet() {
      let b = "";
      for (let i = 0; i < 7; i++) {
        const y = 15 + i * 117;
        b += rect(25, y, 700, 100, 'rx="6"') + punch(60, y + 50) + punch(690, y + 50);
        b += text(375, y + 58, "decorate me", 18, "middle", 600, 'fill-opacity="0.25"');
      }
      return { how: "7 per sheet. Cut out, decorate, punch both dots, tie with string.", svg: svg(b + legend()) };
    },

    // 6 round badges, 2.4 inch circles
    badge(label) {
      let b = "";
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        const x = 200 + c * 350, y = 150 + r * 280;
        b += `<circle cx="${x}" cy="${y}" r="120"/><circle cx="${x}" cy="${y}" r="104" stroke-width="1.5"/>`;
        b += star(x, y - 40, 22) + text(x, y + 18, label.toUpperCase(), label.length > 12 ? 22 : 26, "middle", 800);
        b += text(x, y + 52, "today", 18, "middle", 500);
      }
      return { how: "6 per sheet. Cut out and tape to a shirt or a lanyard.", svg: svg(b + legend()) };
    },

    // group sticker chart, 10 circles + prize
    stickers(group) {
      let b = text(375, 60, `${group} sticker chart`, 38, "middle", 800);
      for (let i = 0; i < 10; i++) {
        const x = 115 + (i % 4) * 173, y = 170 + Math.floor(i / 4) * 200;
        b += `<circle cx="${x}" cy="${y}" r="70"/>` + text(x, y + 14, i + 1, 40, "middle", 700, 'fill-opacity="0.2"');
      }
      b += rect(461, 535, 254, 140, 'rx="14" fill="#111"') + text(588, 600, "PRIZE", 34, "middle", 800, 'fill="#fff"');
      b += text(588, 640, "write it here", 16, "middle", 500, 'fill="#fff"');
      b += rect(35, 705, 680, 140, 'rx="14"') + text(55, 745, "Our prize:", 22, "start", 700);
      return { how: "Post it. One sticker each time the group earns one.", svg: svg(b) };
    },

    wordsearch(title, words, grade, seed = 7) {
      const g = grade === "m" ? 2 : +grade;
      const n = g <= 0 ? 8 : g <= 2 ? 10 : 12;
      const dirs = g <= 0 ? [[1, 0]] : g <= 2 ? [[1, 0], [0, 1]] : [[1, 0], [0, 1], [1, 1], [1, -1]];
      const r = rng(seed * 97 + n);
      const grid = Array.from({ length: n }, () => Array(n).fill(""));
      const placed = [];
      for (const raw of words) {
        const w = raw.toUpperCase().replace(/[^A-Z]/g, "");
        if (w.length > n) continue;
        for (let t = 0; t < 300; t++) {
          const [dx, dy] = dirs[Math.floor(r() * dirs.length)];
          const x0 = Math.floor(r() * n), y0 = Math.floor(r() * n);
          const x1 = x0 + dx * (w.length - 1), y1 = y0 + dy * (w.length - 1);
          if (x1 < 0 || x1 >= n || y1 < 0 || y1 >= n) continue;
          let ok = true;
          for (let k = 0; k < w.length; k++) { const c = grid[y0 + dy * k][x0 + dx * k]; if (c && c !== w[k]) { ok = false; break; } }
          if (!ok) continue;
          for (let k = 0; k < w.length; k++) grid[y0 + dy * k][x0 + dx * k] = w[k];
          placed.push(w); break;
        }
      }
      const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const cell = Math.floor(560 / n), ox = (W - cell * n) / 2, oy = 40;
      let b = rect(ox - 10, oy - 10, cell * n + 20, cell * n + 20, 'rx="12"');
      grid.forEach((row, y) => row.forEach((c, x) =>
        b += text(ox + x * cell + cell / 2, oy + y * cell + cell * 0.68, c || A[Math.floor(r() * 26)], cell * 0.55, "middle", 700)));
      const ly = oy + cell * n + 60;
      b += text(375, ly, "Find these words", 22, "middle", 800);
      placed.forEach((w, i) => {
        const x = 110 + (i % 3) * 220, y = ly + 45 + Math.floor(i / 3) * 40;
        b += rect(x - 30, y - 18, 20, 20, 'rx="3"') + text(x, y, w, 22, "start", 600);
      });
      const how = g <= 0 ? "Words go across only." : g <= 2 ? "Words go across and down." : "Words go across, down, and diagonal.";
      return { how, svg: svg(b) };
    },

    // coloring pages: bold, simple outlines
    octopus() {
      let b = `<ellipse cx="375" cy="300" rx="190" ry="170" stroke-width="5"/>`;
      b += `<circle cx="305" cy="290" r="38" stroke-width="5"/><circle cx="445" cy="290" r="38" stroke-width="5"/>`;
      b += `<circle cx="315" cy="300" r="14" fill="#111"/><circle cx="455" cy="300" r="14" fill="#111"/>`;
      b += `<path d="M330 370 Q375 405 420 370" stroke-width="5"/>`;
      for (let i = 0; i < 8; i++) {
        const x = 205 + i * 49, s = i % 2 ? 1 : -1;
        b += `<path d="M${x} 430 C${x + s * 60} 540 ${x - s * 50} 620 ${x + s * 30} 720 S${x - s * 20} 820 ${x + s * 40} 840" stroke-width="22"/>`;
        b += `<path d="M${x} 430 C${x + s * 60} 540 ${x - s * 50} 620 ${x + s * 30} 720 S${x - s * 20} 820 ${x + s * 40} 840" stroke-width="14" stroke="#fff"/>`;
      }
      [[120, 120], [640, 90], [660, 420], [90, 520]].forEach(([x, y]) =>
        b += `<circle cx="${x}" cy="${y}" r="26" stroke-width="4"/><circle cx="${x + 12}" cy="${y - 10}" r="7" stroke-width="3"/>`);
      [[250, 230], [375, 200], [500, 230]].forEach(([x, y]) => b += heart(x, y, 0.9));
      return { how: "Three hearts are hiding on the octopus. Find them.", svg: svg(b) };
    },

    bee() {
      let b = "";
      const hex = (x, y, s) => {
        let d = "";
        for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; d += `${k ? "L" : "M"}${x + s * Math.cos(a)} ${y + s * Math.sin(a)}`; }
        return `<path d="${d}Z" stroke-width="4"/>`;
      };
      for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) b += hex(60 + c * 90, 640 + r * 104 + (c % 2) * 52, 60);
            b += `<ellipse cx="375" cy="320" rx="190" ry="130" stroke-width="5" fill="#fff"/>`;
      [300, 375, 450].forEach(x => b += `<path d="M${x} 196 Q${x - 18} 320 ${x} 444" stroke-width="16"/>`);
      b += `<ellipse cx="300" cy="170" rx="80" ry="55" stroke-width="5" fill="#fff" transform="rotate(-25 300 170)"/>`;
      b += `<ellipse cx="450" cy="170" rx="80" ry="55" stroke-width="5" fill="#fff" transform="rotate(25 450 170)"/>`;
      b += `<circle cx="595" cy="300" r="62" stroke-width="5" fill="#fff"/><circle cx="615" cy="285" r="10" fill="#111"/>`;
      b += `<path d="M590 325 Q610 342 630 325" stroke-width="4"/>`;
      b += `<path d="M600 240 Q590 180 560 160" stroke-width="4"/><circle cx="556" cy="156" r="8" fill="#111"/>`;
      b += `<path d="M630 244 Q650 185 690 170" stroke-width="4"/><circle cx="694" cy="166" r="8" fill="#111"/>`;
      b += `<path d="M185 320 L135 320" stroke-width="5"/>`;
      return { how: "Color the bee, then color the honeycomb.", svg: svg(b) };
    },

    // mandala: dense line-art style, layered lotus petals with nested echoes,
    // bead and zigzag bands, scallop rings. Made from a seed so every day gets its own.
    // PreK/K: few big shapes, thick lines. 1-2: medium. 3+: full detail, fine lines.
    mandala(seed = 1, grade = 2) {
      const g = grade === "m" ? 2 : +grade;
      const r = rng(seed * 7919 + 104729);
      for (let k = 0; k < 8; k++) r(); // close seeds start alike, so skip ahead
      const pick = a => a[Math.floor(r() * a.length)];
      const cx = 375, cy = 430, R = 368;
      const detail = g <= 0 ? 0 : g <= 2 ? 1 : 2;
      const lw = [5, 3.2, 2][detail];
      const P = (rad, ang) => [cx + rad * Math.sin(ang), cy - rad * Math.cos(ang)];
      const ring = rad => `<circle cx="${cx}" cy="${cy}" r="${rad}"/>`;
      const spin = (n, off, f) => { let o = ""; for (let k = 0; k < n; k++) o += `<g transform="rotate(${(k + off) * 360 / n} ${cx} ${cy})">${f()}</g>`; return o; };
      const count = (r0, h, m = 1) => Math.max(6, Math.min(32, Math.round(2 * Math.PI * r0 / (h * 0.9) * m / 4) * 4));
      // petal standing on ring r0, bases touching neighbors, tip at r1
      const petal = (r0, r1, n, pointy, fill = 'fill="#fff"') => {
        const a = Math.PI / n, w = r0 * Math.sin(a), b = cy - r0 * Math.cos(a), t = cy - r1, h = b - t;
        const d = pointy
          ? `M${cx - w} ${b} C${cx - w * 1.15} ${b - h * 0.55} ${cx - w * 0.3} ${t + h * 0.22} ${cx} ${t} C${cx + w * 0.3} ${t + h * 0.22} ${cx + w * 1.15} ${b - h * 0.55} ${cx + w} ${b}`
          : `M${cx - w} ${b} C${cx - w * 1.25} ${t + h * 0.15} ${cx - w * 0.55} ${t} ${cx} ${t} C${cx + w * 0.55} ${t} ${cx + w * 1.25} ${t + h * 0.15} ${cx + w} ${b}`;
        return `<path d="${d}" ${fill}/>`;
      };
      const echo = (r0, r1, n, pointy) => {
        let o = "";
        if (detail >= 1) o += petal(r0, r0 + (r1 - r0) * 0.68, n * 1.7, pointy, "");
        if (detail >= 2) {
          o += petal(r0, r0 + (r1 - r0) * 0.38, n * 3, pointy, "");
          o += `<circle cx="${cx}" cy="${cy - r0 - (r1 - r0) * 0.82}" r="${(r1 - r0) * 0.05}"/>`;
        }
        return o;
      };
      const features = {
        lotus(r0, r1) {
          const n = count(r0, r1 - r0, 1.4);
          return spin(n, 0.5, () => petal(r0, r1, n, true) + echo(r0, r1, n, true)) +
                 spin(n, 0, () => petal(r0, r0 + (r1 - r0) * 0.78, n, true) + echo(r0, r0 + (r1 - r0) * 0.78, n, true));
        },
        petals(r0, r1) {
          const n = count(r0, r1 - r0, 1.2);
          return spin(n, 0, () => petal(r0, r1, n, false) + echo(r0, r1, n, false));
        },
        scallop(r0, r1) {
          const n = count(r0, r1 - r0, 1.6), a = Math.PI / n, w = r0 * Math.sin(a), b = cy - r0 * Math.cos(a), t = cy - r1;
          return spin(n, 0, () => {
            let o = `<path d="M${cx - w} ${b} C${cx - w} ${t} ${cx + w} ${t} ${cx + w} ${b}" fill="#fff"/>`;
            if (detail >= 1) o += `<path d="M${cx - w * 0.6} ${b} C${cx - w * 0.6} ${t + (b - t) * 0.4} ${cx + w * 0.6} ${t + (b - t) * 0.4} ${cx + w * 0.6} ${b}"/>`;
            if (detail >= 2) o += `<circle cx="${cx}" cy="${t + (b - t) * 0.28}" r="${(b - t) * 0.09}"/>`;
            return o;
          });
        },
      };
      const bands = {
        beads(r0, r1) {
          const rm = (r0 + r1) / 2, rad = (r1 - r0) / 2, n = Math.floor(Math.PI * rm / rad);
          let o = ring(r0) + ring(r1);
          for (let k = 0; k < n; k++) {
            const [x, y] = P(rm, 2 * Math.PI * k / n);
            o += `<circle cx="${x}" cy="${y}" r="${rad * 0.8}"/>` + (detail >= 2 ? `<circle cx="${x}" cy="${y}" r="${rad * 0.3}"/>` : "");
          }
          return o;
        },
        zigzag(r0, r1) {
          const n = count(r0, r1 - r0, 1.5);
          let d = "";
          for (let k = 0; k <= 2 * n; k++) { const [x, y] = P(k % 2 ? r1 : r0, Math.PI * k / n); d += `${k ? "L" : "M"}${x} ${y}`; }
          return ring(r0) + ring(r1) + `<path d="${d}"/>`;
        },
      };
      // layout: core, then features with thin bands between, last feature is a big lotus
      const F = [3, 4, 5][detail];
      const seq = [];
      for (let i = 0; i < F; i++) {
        if (detail >= 1 && i > 0) seq.push(["band", pick(Object.keys(bands)), 0.7]);
        seq.push(["feat", i === F - 1 ? "lotus" : pick(["lotus", "petals", "scallop", "petals"]), i === F - 1 ? 4 : 3]);
      }
      const core = R * [0.14, 0.1, 0.08][detail];
      const unit = (R - core) / seq.reduce((s, x) => s + x[2], 0);
      // draw outside in, so inner rings sit on top of outer petals
      const layers = [];
      let r0 = core;
      for (const [kind, name, wgt] of seq) {
        const r1 = r0 + unit * wgt;
        layers.push(kind === "feat" ? features[name](r0, r1 - lw * 1.5) + `<circle cx="${cx}" cy="${cy}" r="${r0}" fill="#fff"/>` : bands[name](r0, r1));
        r0 = r1;
      }
      let b = `<g stroke-width="${lw}">` + layers.reverse().join("");
      const cn = 8;
      b += ring(core) + spin(cn, 0, () => petal(core * 0.3, core * 0.92, cn, false, "")) + ring(core * 0.3);
      if (detail >= 1) b += `<circle cx="${cx}" cy="${cy}" r="${core * 0.1}" fill="#111"/>`;
      b += "</g>";
      return { how: "Pick 3 or 4 colors. Color each ring in a pattern.", svg: svg(b) };
    },
  };

  function star(x, y, r) {
    let d = "";
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
      d += `${k ? "L" : "M"}${x + rr * Math.cos(a)} ${y + rr * Math.sin(a)}`;
    }
    return `<path d="${d}Z" fill="#111"/>`;
  }
  function heart(x, y, s) {
    return `<path d="M${x} ${y + 18 * s} C${x - 30 * s} ${y - 4 * s} ${x - 16 * s} ${y - 26 * s} ${x} ${y - 10 * s} C${x + 16 * s} ${y - 26 * s} ${x + 30 * s} ${y - 4 * s} ${x} ${y + 18 * s}Z" stroke-width="3"/>`;
  }
})();
