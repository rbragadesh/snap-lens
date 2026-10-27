// GLSL for the render pipeline. Conventions:
//  * "output uv" (v_uv) has y pointing down, matching canvas/image space.
//  * Framebuffer textures are sampled with gl_FragCoord-based coordinates.

export const FULLSCREEN_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const MAX_WARPS = 16;

export const BASE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_src;
uniform vec2 u_srcScale;
uniform float u_mirror;
uniform vec2 u_out;
uniform int u_nw;
uniform vec4 u_wa[${MAX_WARPS}];
uniform vec4 u_wb[${MAX_WARPS}];
uniform int u_useMask;
uniform sampler2D u_mask;
uniform int u_bgMode;
uniform sampler2D u_bg;
uniform vec2 u_bgScale;
uniform int u_hairMode;
uniform vec3 u_hairColor;
uniform float u_hairAmt;
uniform vec3 u_tint;
uniform float u_tintAmt;
uniform float u_sat;
uniform float u_bright;
uniform float u_time;

vec2 srcUV(vec2 uv) {
  vec2 p = vec2(mix(uv.x, 1.0 - uv.x, u_mirror), uv.y);
  return (p - 0.5) * u_srcScale + 0.5;
}

vec2 applyWarps(vec2 p) {
  for (int i = 0; i < ${MAX_WARPS}; i++) {
    if (i >= u_nw) break;
    vec4 a = u_wa[i];
    vec4 b = u_wb[i];
    vec2 d = p - a.xy;
    float r = length(d) / a.z;
    if (r < 1.0) {
      float f = 1.0 - r * r;
      f *= f;
      if (a.w < 0.5) p = a.xy + d * (1.0 - b.x * f);
      else p -= b.yz * f;
    }
  }
  return p;
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec3 blurSrc(vec2 s) {
  vec3 c = vec3(0.0);
  c += textureLod(u_src, s, 5.0).rgb;
  c += textureLod(u_src, s + vec2(0.02, 0.0), 5.0).rgb;
  c += textureLod(u_src, s - vec2(0.02, 0.0), 5.0).rgb;
  c += textureLod(u_src, s + vec2(0.0, 0.02), 5.0).rgb;
  c += textureLod(u_src, s - vec2(0.0, 0.02), 5.0).rgb;
  return c / 5.0;
}

void main() {
  vec2 p = v_uv * u_out;
  vec2 uv = applyWarps(p) / u_out;
  // letterbox areas (contain mode) are decided before warping; warps that reach past
  // the picture edge just stretch the edge pixels
  vec2 s0 = srcUV(v_uv);
  bool outside = s0.x < 0.0 || s0.x > 1.0 || s0.y < 0.0 || s0.y > 1.0;
  vec2 s = clamp(srcUV(uv), vec2(0.0), vec2(1.0));
  vec3 col = texture(u_src, s).rgb;
  if (outside) col = vec3(0.07, 0.06, 0.1);
  if (u_useMask == 1 && !outside) {
    vec4 m = texture(u_mask, s);
    if (u_hairMode > 0) {
      float h = smoothstep(0.3, 0.75, m.g) * u_hairAmt;
      vec3 tint = u_hairMode == 2
        ? hsv2rgb(vec3(fract(uv.y * 1.3 + uv.x * 0.4 - u_time * 0.15), 0.8, 1.0))
        : u_hairColor;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 dyed = tint * (0.3 + 1.25 * l) + 0.12 * tint;
      col = mix(col, dyed, h);
    }
    if (u_bgMode > 0) {
      float a = smoothstep(0.35, 0.75, m.r);
      vec3 bg = u_bgMode == 1 ? texture(u_bg, (v_uv - 0.5) * u_bgScale + 0.5).rgb : blurSrc(s);
      col = mix(bg, col, a);
    }
  }
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, u_sat);
  col = mix(col, col * u_tint, u_tintAmt);
  col *= u_bright;
  o = vec4(col, 1.0);
}`;

export const MESH_VS = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
in float a_alpha;
uniform vec2 u_out;
out vec2 v_uv;
out float v_a;
void main() {
  v_uv = a_uv;
  v_a = a_alpha;
  gl_Position = vec4(a_pos.x / u_out.x * 2.0 - 1.0, 1.0 - a_pos.y / u_out.y * 2.0, 0.0, 1.0);
}`;

export const PAINT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_a;
out vec4 o;
uniform sampler2D u_paint;
uniform sampler2D u_under;
uniform vec2 u_out;
uniform int u_mode;
uniform float u_opacity;
void main() {
  vec4 pnt = texture(u_paint, v_uv) * u_opacity;
  vec3 under = texture(u_under, gl_FragCoord.xy / u_out).rgb;
  vec3 c = pnt.a > 0.001 ? pnt.rgb / pnt.a : vec3(0.0);
  vec3 res;
  if (u_mode == 0) {
    res = mix(under, c, pnt.a);
  } else if (u_mode == 1) {
    res = mix(under, under * c, pnt.a);
  } else {
    float l = dot(under, vec3(0.299, 0.587, 0.114));
    res = mix(under, c * (0.45 + 0.85 * l), pnt.a);
  }
  o = vec4(res, 1.0);
}`;

export const SWAP_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_a;
out vec4 o;
uniform sampler2D u_under;
uniform vec2 u_out;
uniform float u_opacity;
void main() {
  vec3 under = texture(u_under, gl_FragCoord.xy / u_out).rgb;
  vec3 other = texture(u_under, vec2(v_uv.x / u_out.x, 1.0 - v_uv.y / u_out.y)).rgb;
  o = vec4(mix(under, other, clamp(v_a, 0.0, 1.0) * u_opacity), 1.0);
}`;

export const SPRITE_VS = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
in vec4 a_col;
uniform vec2 u_out;
out vec2 v_uv;
out vec4 v_col;
void main() {
  v_uv = a_uv;
  v_col = a_col;
  gl_Position = vec4(a_pos.x / u_out.x * 2.0 - 1.0, 1.0 - a_pos.y / u_out.y * 2.0, 0.0, 1.0);
}`;

export const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_col;
out vec4 o;
uniform sampler2D u_tex;
void main() {
  o = texture(u_tex, v_uv) * v_col;
}`;

const FILTER_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tex;
uniform vec2 u_out;
uniform float u_time;
vec3 S(vec2 uv) { return texture(u_tex, vec2(uv.x, 1.0 - uv.y)).rgb; }
float L(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
float edge(vec2 uv, float w) {
  vec2 px = w / u_out;
  float tl = L(S(uv + vec2(-px.x, -px.y))), t = L(S(uv + vec2(0.0, -px.y))), tr = L(S(uv + vec2(px.x, -px.y)));
  float l = L(S(uv + vec2(-px.x, 0.0))), r = L(S(uv + vec2(px.x, 0.0)));
  float bl = L(S(uv + vec2(-px.x, px.y))), b = L(S(uv + vec2(0.0, px.y))), br = L(S(uv + vec2(px.x, px.y)));
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  return length(vec2(gx, gy));
}
vec3 soft(vec2 uv, float rad) {
  vec2 px = rad / u_out;
  vec3 c = S(uv) * 0.2;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    c += S(uv + vec2(cos(a), sin(a)) * px) * 0.1;
  }
  return c;
}
float vignette(vec2 uv, float k) { vec2 d = uv - 0.5; return 1.0 - k * dot(d, d) * 2.2; }
`;

/** Each filter is a GLSL body for `vec3 filt(vec2 uv)`. */
export const FILTER_BODIES: Record<string, string> = {
  none: `return S(uv);`,
  oldmovie: `
    vec2 j = uv + vec2(0.0, (hash(vec2(floor(u_time * 12.0))) - 0.5) * 0.004);
    float l = L(S(j));
    l = (l - 0.5) * 1.25 + 0.5;
    l += (hash(uv * u_out + floor(u_time * 24.0)) - 0.5) * 0.12;
    float scratch = step(0.997, hash(vec2(floor(uv.x * 300.0), floor(u_time * 8.0)))) * 0.25;
    return vec3(l + scratch) * vec3(1.05, 1.0, 0.92) * vignette(uv, 1.0);`,
  vintage: `
    vec3 c = S(uv);
    vec3 sep = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
    c = mix(c, sep, 0.65);
    c = c * 0.85 + vec3(0.08, 0.05, 0.02);
    return c * vignette(uv, 0.9);`,
  dreamy: `
    vec3 c = S(uv);
    vec3 b = soft(uv, 9.0);
    c = 1.0 - (1.0 - c) * (1.0 - b * 0.55);
    c = mix(c, vec3(1.0, 0.85, 0.95), 0.12);
    return c;`,
  cartoon: `
    vec3 c = soft(uv, 1.5);
    c = floor(c * 5.0 + 0.5) / 5.0;
    c = mix(vec3(L(c)), c, 1.35);
    float e = smoothstep(0.25, 0.6, edge(uv, 1.5));
    return mix(c, vec3(0.05), e);`,
  comic: `
    vec3 c = S(uv);
    c = mix(vec3(L(c)), c, 1.5);
    float cell = 7.0;
    vec2 g = uv * u_out / cell;
    vec2 f = fract(g) - 0.5;
    float l = L(c);
    float dotR = (1.0 - l) * 0.75;
    float d = smoothstep(dotR, dotR - 0.1, length(f));
    c = floor(c * 4.0 + 0.5) / 4.0;
    c = mix(c, c * 0.55, d * 0.7);
    float e = smoothstep(0.3, 0.7, edge(uv, 1.5));
    return mix(c, vec3(0.0), e);`,
  scribble: `
    vec2 w = uv + vec2(sin(uv.y * 80.0 + u_time * 2.0), cos(uv.x * 80.0 + u_time * 2.0)) * 0.0015;
    float e = smoothstep(0.15, 0.5, edge(w, 1.4));
    vec3 ink = hsv2rgb(vec3(fract(uv.x * 0.7 + uv.y * 0.9 + floor(u_time * 3.0) * 0.13), 0.75, 0.85));
    float paper = 0.96 + hash(floor(uv * u_out / 3.0)) * 0.04;
    vec3 c = vec3(paper);
    vec3 fill = mix(vec3(1.0), S(uv), 0.18);
    c *= fill;
    return mix(c, ink, e);`,
  neon: `
    float e = smoothstep(0.1, 0.5, edge(uv, 1.5));
    vec3 glow = hsv2rgb(vec3(fract(uv.y * 0.8 + u_time * 0.2), 0.9, 1.0));
    return S(uv) * 0.15 + glow * e * 1.4;`,
  thermal: `
    float l = L(soft(uv, 2.0));
    vec3 a = vec3(0.0, 0.0, 0.4), b = vec3(0.6, 0.0, 0.8), c = vec3(1.0, 0.2, 0.0), d = vec3(1.0, 0.9, 0.0), e = vec3(1.0);
    if (l < 0.25) return mix(a, b, l / 0.25);
    if (l < 0.5) return mix(b, c, (l - 0.25) / 0.25);
    if (l < 0.75) return mix(c, d, (l - 0.5) / 0.25);
    return mix(d, e, (l - 0.75) / 0.25);`,
  pixel: `
    float cols = 72.0;
    vec2 cell = vec2(cols, cols * u_out.y / u_out.x);
    vec2 q = (floor(uv * cell) + 0.5) / cell;
    vec3 c = S(q);
    c = floor(c * 4.0 + 0.5) / 4.0;
    vec2 f = fract(uv * cell);
    float grid = step(0.08, f.x) * step(0.08, f.y);
    return c * (0.85 + 0.15 * grid);`,
  popart: `
    vec2 q = fract(uv * 2.0);
    vec2 id = floor(uv * 2.0);
    float l = L(S(q));
    l = smoothstep(0.25, 0.65, l);
    int k = int(id.x + id.y * 2.0);
    vec3 dark = k == 0 ? vec3(0.9, 0.1, 0.5) : k == 1 ? vec3(0.1, 0.3, 0.9) : k == 2 ? vec3(0.1, 0.6, 0.3) : vec3(0.95, 0.4, 0.0);
    vec3 light = k == 0 ? vec3(1.0, 0.9, 0.2) : k == 1 ? vec3(1.0, 0.6, 0.8) : k == 2 ? vec3(1.0, 0.95, 0.4) : vec3(0.4, 0.9, 1.0);
    return mix(dark, light, l);`,
  kaleido: `
    vec2 p = uv - 0.5;
    p.x *= u_out.x / u_out.y;
    float r = length(p);
    float a = atan(p.y, p.x) + u_time * 0.15;
    float seg = 3.14159265 / 4.0;
    a = mod(a, 2.0 * seg);
    a = abs(a - seg);
    vec2 q = vec2(cos(a), sin(a)) * r;
    q.x *= u_out.y / u_out.x;
    return S(clamp(q + 0.5, 0.0, 1.0));`,
  mirror: `
    vec2 q = uv;
    if (q.x > 0.5) q.x = 1.0 - q.x;
    return S(q);`,
  disco: `
    vec3 c = S(uv);
    vec3 h = hsv2rgb(vec3(fract(u_time * 0.25 + uv.x * 0.5), 0.6, 1.0));
    return c * mix(vec3(1.0), h * 1.3, 0.55);`,
  glitch: `
    float band = floor(uv.y * 24.0);
    float t = floor(u_time * 10.0);
    float off = (hash(vec2(band, t)) - 0.5) * 0.04 * step(0.8, hash(vec2(t, band * 0.3)));
    vec2 q = uv + vec2(off, 0.0);
    float sh = 0.006;
    return vec3(S(q + vec2(sh, 0.0)).r, S(q).g, S(q - vec2(sh, 0.0)).b);`,
  underwater: `
    vec2 q = uv + vec2(sin(uv.y * 18.0 + u_time * 2.0), cos(uv.x * 14.0 + u_time * 1.6)) * 0.006;
    vec3 c = S(q);
    float caust = pow(abs(sin(uv.x * 40.0 + u_time) * sin(uv.y * 34.0 - u_time * 1.3)), 6.0) * 0.25;
    return c * vec3(0.55, 0.85, 1.1) + caust;`,
};

export function filterSource(id: string) {
  const body = FILTER_BODIES[id] ?? FILTER_BODIES.none;
  return `${FILTER_HEADER}
vec3 filt(vec2 uv) {
${body}
}
void main() { o = vec4(filt(v_uv), 1.0); }`;
}
