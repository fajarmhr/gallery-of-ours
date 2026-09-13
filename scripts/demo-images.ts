import sharp from "sharp";

type Scene = (w: number, h: number, seed: number) => string;

const rand = (seed: number) => {
  let s = seed || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Painted placeholder scenes so every screen has something to show without real family photos. */
export const SCENES: Record<string, Scene> = {
  beach: (w, h, seed) => {
    const r = rand(seed);
    const horizon = h * (0.5 + r() * 0.1);
    return svg(w, h, `
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7b06a"/><stop offset="1" stop-color="#ef8a5c"/></linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4e7e"/><stop offset="1" stop-color="#35406a"/></linearGradient>
      <radialGradient id="sun"><stop offset="0" stop-color="#fff1c2"/><stop offset=".4" stop-color="#ffe6a8" stop-opacity=".8"/><stop offset="1" stop-color="#ffe6a8" stop-opacity="0"/></radialGradient></defs>
      <rect width="${w}" height="${horizon}" fill="url(#sky)"/>
      <circle cx="${w * (0.55 + r() * 0.2)}" cy="${horizon - h * 0.08}" r="${h * 0.22}" fill="url(#sun)"/>
      <rect y="${horizon}" width="${w}" height="${h - horizon}" fill="url(#sea)"/>
      <rect x="${w * 0.2}" y="${horizon + 12}" width="${w * 0.6}" height="6" fill="#ffe6a8" opacity=".45"/>
      <path d="M0 ${h * 0.86} Q ${w * 0.5} ${h * 0.78} ${w} ${h * 0.9} V ${h} H 0 Z" fill="#e9c79a"/>`);
  },
  terraces: (w, h, seed) => {
    const r = rand(seed);
    const bands = Array.from({ length: 9 }, (_, i) => {
      const y = h * 0.28 + i * h * 0.085;
      return `<path d="M0 ${y} Q ${w * (0.3 + r() * 0.2)} ${y - 40} ${w} ${y + 10} V ${y + 60} Q ${w * 0.5} ${y + 20} 0 ${y + 50} Z" fill="${i % 2 ? "#6a9a4a" : "#8cc06b"}"/>`;
    }).join("");
    return svg(w, h, `<rect width="${w}" height="${h}" fill="#dcebc9"/><rect y="${h * 0.3}" width="${w}" height="${h * 0.7}" fill="#4f7f3a"/>${bands}`);
  },
  lanterns: (w, h, seed) => {
    const r = rand(seed);
    const lights = Array.from({ length: 14 }, () => {
      const x = r() * w;
      const y = h * 0.15 + r() * h * 0.55;
      const size = 14 + r() * 30;
      return `<circle cx="${x}" cy="${y}" r="${size * 2.4}" fill="#ffb45e" opacity=".18"/><circle cx="${x}" cy="${y}" r="${size}" fill="${r() > 0.5 ? "#ffc66e" : "#ff9e4a"}"/>`;
    }).join("");
    return svg(w, h, `<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2444"/><stop offset="1" stop-color="#3b2e55"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#n)"/>${lights}<rect y="${h * 0.82}" width="${w}" height="${h * 0.18}" fill="#2a2238"/>`);
  },
  mountains: (w, h, seed) => {
    const r = rand(seed);
    const peak = (base: number, color: string) =>
      `<path d="M0 ${h} L0 ${base} L${w * (0.2 + r() * 0.1)} ${base - h * (0.18 + r() * 0.1)} L${w * (0.45 + r() * 0.1)} ${base - h * 0.05} L${w * (0.7 + r() * 0.1)} ${base - h * (0.22 + r() * 0.1)} L${w} ${base - h * 0.04} L${w} ${h} Z" fill="${color}"/>`;
    return svg(w, h, `<defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5d7be"/><stop offset=".45" stop-color="#e9c3b8"/><stop offset="1" stop-color="#c9d3e0"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#d)"/>${peak(h * 0.62, "#8797a8")}${peak(h * 0.78, "#5b6c7d")}${peak(h * 0.92, "#3e4a57")}`);
  },
  cake: (w, h) =>
    svg(w, h, `<defs><radialGradient id="glow" cx=".5" cy=".3"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#4a2629" stop-opacity="0"/></radialGradient></defs>
      <rect width="${w}" height="${h}" fill="#4a2629"/><rect width="${w}" height="${h}" fill="url(#glow)"/>
      <ellipse cx="${w / 2}" cy="${h * 0.85}" rx="${w * 0.42}" ry="${h * 0.1}" fill="#8e4638"/>
      <rect x="${w * 0.22}" y="${h * 0.52}" width="${w * 0.56}" height="${h * 0.3}" rx="20" fill="#f2e6da"/>
      <rect x="${w * 0.22}" y="${h * 0.52}" width="${w * 0.56}" height="${h * 0.07}" rx="20" fill="#d95d5d"/>
      ${[0.35, 0.45, 0.55, 0.65].map((x) => `<rect x="${w * x - 6}" y="${h * 0.4}" width="12" height="${h * 0.12}" fill="#ffe6a8"/><ellipse cx="${w * x}" cy="${h * 0.38}" rx="10" ry="18" fill="#ffc86b"/>`).join("")}`),
  sea: (w, h, seed) => {
    const r = rand(seed);
    return svg(w, h, `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbe8f4"/><stop offset="1" stop-color="#9fd0e6"/></linearGradient><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb3d8"/><stop offset="1" stop-color="#2c79b0"/></linearGradient></defs>
      <rect width="${w}" height="${h * 0.48}" fill="url(#s)"/><circle cx="${w * (0.2 + r() * 0.2)}" cy="${h * 0.2}" r="${h * 0.07}" fill="#ffffff" opacity=".9"/>
      <rect y="${h * 0.48}" width="${w}" height="${h * 0.52}" fill="url(#w)"/>
      ${Array.from({ length: 7 }, (_, i) => `<path d="M0 ${h * (0.56 + i * 0.06)} q ${w / 8} -14 ${w / 4} 0 t ${w / 4} 0 t ${w / 4} 0 t ${w / 4} 0" stroke="#ffffff" stroke-opacity=".25" stroke-width="4" fill="none"/>`).join("")}`);
  },
  garden: (w, h, seed) => {
    const r = rand(seed);
    const bokeh = Array.from({ length: 18 }, () => `<circle cx="${r() * w}" cy="${r() * h}" r="${20 + r() * 70}" fill="#fff4c8" opacity="${0.12 + r() * 0.25}"/>`).join("");
    return svg(w, h, `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a7c957"/><stop offset=".55" stop-color="#6a994e"/><stop offset="1" stop-color="#386641"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${bokeh}`);
  },
  rain: (w, h, seed) => {
    const r = rand(seed);
    const streaks = Array.from({ length: 60 }, () => {
      const x = r() * w;
      const y = r() * h;
      return `<line x1="${x}" y1="${y}" x2="${x - 12}" y2="${y + 60}" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>`;
    }).join("");
    return svg(w, h, `<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e7288"/><stop offset="1" stop-color="#262f3c"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#c)"/>
      <circle cx="${w * 0.3}" cy="${h * 0.78}" r="${h * 0.12}" fill="#ffc478" opacity=".35"/><circle cx="${w * 0.72}" cy="${h * 0.7}" r="${h * 0.09}" fill="#ff7878" opacity=".3"/>${streaks}`);
  },
};

export async function renderScene(scene: keyof typeof SCENES, seed: number, portrait = false) {
  const [w, h] = portrait ? [1200, 1600] : [1600, 1200];
  const buffer = await sharp(Buffer.from(SCENES[scene]!(w, h, seed)))
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  return { buffer, width: w, height: h };
}
