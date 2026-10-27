import { FACE_TRIANGLES, FACE_UVS } from './faceMeshData';
import { FACE_OVAL, type FrameMap } from './face';
import { MASK_SIZE } from './tracker';
import type { PaintMode, Scene, SpriteCmd } from './scene';
import {
  BASE_FS,
  FULLSCREEN_VS,
  MAX_WARPS,
  MESH_VS,
  PAINT_FS,
  SPRITE_FS,
  SPRITE_VS,
  SWAP_FS,
  filterSource,
} from './shaders';

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
}

export type TextureProvider = (key: string) => TexImageSource | null;

const MESH_VERTS = 468;
const SPRITE_FLOATS = 8; // x, y, u, v, r, g, b, a

/** Distance-to-edge feather so swapped/painted faces blend in smoothly. */
function meshFeather(): Float32Array {
  const out = new Float32Array(MESH_VERTS);
  const oval = FACE_OVAL.map((i) => [FACE_UVS[i * 2], FACE_UVS[i * 2 + 1]]);
  for (let v = 0; v < MESH_VERTS; v++) {
    const x = FACE_UVS[v * 2];
    const y = FACE_UVS[v * 2 + 1];
    let d = Infinity;
    for (let i = 0; i < oval.length; i++) {
      const [ax, ay] = oval[i];
      const [bx, by] = oval[(i + 1) % oval.length];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    out[v] = Math.min(1, d / 0.09);
  }
  return out;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  W = 2;
  H = 2;
  private base!: Prog;
  private paint!: Prog;
  private swap!: Prog;
  private sprite!: Prog;
  private filters = new Map<string, Prog>();
  private fsVao!: WebGLVertexArrayObject;
  private meshVao!: WebGLVertexArrayObject;
  private meshPos!: WebGLBuffer;
  private meshUv!: WebGLBuffer;
  private meshUvStatic!: WebGLBuffer;
  private spriteVao!: WebGLVertexArrayObject;
  private spriteBuf!: WebGLBuffer;
  private spriteData = new Float32Array(SPRITE_FLOATS * 6 * 512);
  private srcTex!: WebGLTexture;
  private maskTex!: WebGLTexture;
  private srcW = 0;
  private srcH = 0;
  private maskVersion = -1;
  private A?: Target;
  private B?: Target;
  private textures = new Map<string, { tex: WebGLTexture; w: number; h: number; version: number; used: number }>();
  private lastSweep = 0;
  private white!: WebGLTexture;
  private warpA = new Float32Array(MAX_WARPS * 4);
  private warpB = new Float32Array(MAX_WARPS * 4);

  constructor(
    readonly canvas: HTMLCanvasElement,
    private provider: TextureProvider,
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.init();
  }

  private compile(vs: string, fs: string): Prog {
    const gl = this.gl;
    const make = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.bindAttribLocation(p, 1, 'a_uv');
    gl.bindAttribLocation(p, 2, 'a_alpha');
    gl.bindAttribLocation(p, 3, 'a_col');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    const u: Prog['u'] = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)!;
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  private newTexture(filter: number = this.gl.LINEAR) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private init() {
    const gl = this.gl;
    this.base = this.compile(FULLSCREEN_VS, BASE_FS);
    this.paint = this.compile(MESH_VS, PAINT_FS);
    this.swap = this.compile(MESH_VS, SWAP_FS);
    this.sprite = this.compile(SPRITE_VS, SPRITE_FS);

    this.fsVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.fsVao);
    const fsBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Face mesh: positions change every frame, canonical UVs and feather are static.
    this.meshVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.meshVao);
    this.meshPos = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPos);
    gl.bufferData(gl.ARRAY_BUFFER, MESH_VERTS * 2 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.meshUvStatic = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUvStatic);
    gl.bufferData(gl.ARRAY_BUFFER, FACE_UVS, gl.STATIC_DRAW);
    this.meshUv = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUv);
    gl.bufferData(gl.ARRAY_BUFFER, MESH_VERTS * 2 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    const feather = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, feather);
    gl.bufferData(gl.ARRAY_BUFFER, meshFeather(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    const idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, FACE_TRIANGLES, gl.STATIC_DRAW);

    this.spriteVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.spriteVao);
    this.spriteBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.spriteData.byteLength, gl.DYNAMIC_DRAW);
    const stride = SPRITE_FLOATS * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 16);
    gl.bindVertexArray(null);

    this.srcTex = this.newTexture();
    this.maskTex = this.newTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MASK_SIZE, MASK_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.white = this.newTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  }

  private target(old?: Target): Target {
    const gl = this.gl;
    if (old) {
      gl.deleteTexture(old.tex);
      gl.deleteFramebuffer(old.fb);
    }
    const tex = this.newTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.W, this.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb };
  }

  setSize(W: number, H: number) {
    W = Math.max(2, Math.round(W));
    H = Math.max(2, Math.round(H));
    if (W === this.W && H === this.H && this.A) return;
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.A = this.target(this.A);
    this.B = this.target(this.B);
  }

  uploadSource(src: TexImageSource, w: number, h: number) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (w !== this.srcW || h !== this.srcH) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      this.srcW = w;
      this.srcH = h;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    }
  }

  uploadMask(mask: Uint8Array, version: number) {
    if (version === this.maskVersion) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MASK_SIZE, MASK_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    this.maskVersion = version;
  }

  /** Replace (or create) a texture whose content changes, e.g. a chosen background photo. */
  setTexture(key: string, img: TexImageSource, version = 0) {
    const t = this.textures.get(key);
    if (t && t.version === version) return;
    this.uploadTexture(key, img, version, t?.tex);
  }

  dropTexture(key: string) {
    const t = this.textures.get(key);
    if (t) {
      this.gl.deleteTexture(t.tex);
      this.textures.delete(key);
    }
  }

  private uploadTexture(key: string, img: TexImageSource, version: number, existing?: WebGLTexture) {
    const gl = this.gl;
    const tex = existing ?? this.newTexture(gl.LINEAR_MIPMAP_LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const w = (img as { width: number }).width;
    const h = (img as { height: number }).height;
    const entry = { tex, w, h, version, used: performance.now() };
    this.textures.set(key, entry);
    return entry;
  }

  private tex(key: string) {
    const t = this.textures.get(key);
    if (t) {
      t.used = performance.now();
      return t;
    }
    const img = this.provider(key);
    if (!img) return null;
    return this.uploadTexture(key, img, 0);
  }

  /** Aspect ratio (w/h) of a texture, loading it if needed. */
  aspect(key: string) {
    const t = this.tex(key);
    return t ? t.w / t.h : 1;
  }

  private filterProg(id: string) {
    let p = this.filters.get(id);
    if (!p) {
      p = this.compile(FULLSCREEN_VS, filterSource(id));
      this.filters.set(id, p);
    }
    return p;
  }

  /** Free artwork textures that no lens has drawn for a while (they are redrawn on demand). */
  private sweep() {
    const now = performance.now();
    if (now - this.lastSweep < 5000) return;
    this.lastSweep = now;
    for (const [key, t] of this.textures) {
      if (key.startsWith('__') || key === 'userbg') continue;
      if (now - t.used > 30000) {
        this.gl.deleteTexture(t.tex);
        this.textures.delete(key);
      }
    }
  }

  render(scene: Scene, map: FrameMap, filter: string, time: number, hasMask: boolean) {
    const gl = this.gl;
    const { W, H } = this;
    if (!this.A || !this.B) return;
    this.sweep();
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // ---- Pass 1: camera image, warps, background and hair -> A
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.A.fb);
    const b = this.base;
    gl.useProgram(b.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    const blur = scene.bg?.kind === 'blur';
    if (blur && this.srcW > 0) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.uniform1i(b.u.u_src, 0);
    gl.uniform2f(b.u.u_srcScale, W / (map.k * map.sw), H / (map.k * map.sh));
    gl.uniform1f(b.u.u_mirror, map.mirror ? 1 : 0);
    gl.uniform2f(b.u.u_out, W, H);
    const nw = Math.min(MAX_WARPS, scene.warps.length);
    for (let i = 0; i < nw; i++) {
      const w = scene.warps[i];
      this.warpA.set([w.x, w.y, Math.max(1, w.r), w.type === 'bulge' ? 0 : 1], i * 4);
      this.warpB.set([w.k ?? 0, w.vx ?? 0, w.vy ?? 0, 0], i * 4);
    }
    gl.uniform1i(b.u.u_nw, nw);
    gl.uniform4fv(b.u.u_wa, this.warpA);
    gl.uniform4fv(b.u.u_wb, this.warpB);

    const useMask = hasMask && (!!scene.bg || !!scene.hair);
    gl.uniform1i(b.u.u_useMask, useMask ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.uniform1i(b.u.u_mask, 1);
    let bgMode = 0;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.white);
    if (scene.bg?.kind === 'tex') {
      const t = this.tex(scene.bg.tex);
      if (t) {
        bgMode = 1;
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        const aOut = W / H;
        const aBg = t.w / t.h;
        gl.uniform2f(b.u.u_bgScale, aOut > aBg ? 1 : aOut / aBg, aOut > aBg ? aBg / aOut : 1);
      }
    } else if (blur) bgMode = 2;
    gl.uniform1i(b.u.u_bg, 2);
    gl.uniform1i(b.u.u_bgMode, bgMode);
    gl.uniform1i(b.u.u_hairMode, scene.hair ? (scene.hair.rainbow ? 2 : 1) : 0);
    gl.uniform3fv(b.u.u_hairColor, scene.hair?.color ?? [1, 1, 1]);
    gl.uniform1f(b.u.u_hairAmt, scene.hair?.amount ?? 0);
    gl.uniform3fv(b.u.u_tint, scene.grade.tint);
    gl.uniform1f(b.u.u_tintAmt, scene.grade.amount);
    gl.uniform1f(b.u.u_sat, scene.grade.sat);
    gl.uniform1f(b.u.u_bright, scene.grade.bright);
    gl.uniform1f(b.u.u_time, time);
    gl.bindVertexArray(this.fsVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- Pass 2: copy A -> B, then face paint / swap (reading A) and stickers on B
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.A.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.B.fb);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.B.fb);

    if (scene.paints.length || scene.swaps.length) {
      gl.bindVertexArray(this.meshVao);
      gl.enable(gl.CULL_FACE);
      // Triangles are counter-clockwise as seen by the camera; mirroring flips them on screen.
      gl.frontFace(map.mirror ? gl.CW : gl.CCW);
      gl.cullFace(gl.BACK);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.A.tex);
      for (const pc of scene.paints) {
        const t = this.tex(pc.tex);
        if (!t) continue;
        this.setMeshPositions(pc.pts);
        this.setMeshUv(null);
        gl.useProgram(this.paint.p);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.uniform1i(this.paint.u.u_paint, 0);
        gl.uniform1i(this.paint.u.u_under, 1);
        gl.uniform2f(this.paint.u.u_out, W, H);
        gl.uniform1i(this.paint.u.u_mode, paintMode(pc.mode));
        gl.uniform1f(this.paint.u.u_opacity, pc.opacity);
        gl.drawElements(gl.TRIANGLES, FACE_TRIANGLES.length, gl.UNSIGNED_SHORT, 0);
      }
      for (const sc of scene.swaps) {
        this.setMeshPositions(sc.dst);
        this.setMeshUv(sc.src);
        gl.useProgram(this.swap.p);
        gl.uniform1i(this.swap.u.u_under, 1);
        gl.uniform2f(this.swap.u.u_out, W, H);
        gl.uniform1f(this.swap.u.u_opacity, sc.opacity);
        gl.drawElements(gl.TRIANGLES, FACE_TRIANGLES.length, gl.UNSIGNED_SHORT, 0);
      }
      gl.disable(gl.CULL_FACE);
      this.setMeshUv(null);
    }

    if (scene.sprites.length) {
      const sorted = scene.sprites.slice().sort((a, b) => a.layer - b.layer);
      this.drawSprites(sorted);
    }

    // ---- Pass 3: colour filter -> screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    const f = this.filterProg(filter);
    gl.useProgram(f.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.B.tex);
    gl.uniform1i(f.u.u_tex, 0);
    gl.uniform2f(f.u.u_out, W, H);
    gl.uniform1f(f.u.u_time, time);
    gl.bindVertexArray(this.fsVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (scene.hud) {
      this.setTexture('__hud', scene.hud, scene.hudVersion);
      this.drawSprites([
        {
          tex: '__hud',
          q: new Float32Array([0, 0, W, 0, W, H, 0, H]),
          alpha: 1,
          additive: false,
          layer: 0,
          tint: [1, 1, 1],
        },
      ]);
    }
    gl.bindVertexArray(null);
  }

  private setMeshPositions(pts: Float32Array) {
    const gl = this.gl;
    const pos = new Float32Array(MESH_VERTS * 2);
    for (let i = 0; i < MESH_VERTS; i++) {
      pos[i * 2] = pts[i * 3];
      pos[i * 2 + 1] = pts[i * 3 + 1];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPos);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
  }

  /** null = canonical UVs (for paints); otherwise use another face's points as sample positions (swap). */
  private setMeshUv(pts: Float32Array | null) {
    const gl = this.gl;
    if (!pts) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUvStatic);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      return;
    }
    const uv = new Float32Array(MESH_VERTS * 2);
    for (let i = 0; i < MESH_VERTS; i++) {
      uv[i * 2] = pts[i * 3];
      uv[i * 2 + 1] = pts[i * 3 + 1];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUv);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, uv);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  }

  private drawSprites(list: SpriteCmd[]) {
    const gl = this.gl;
    gl.useProgram(this.sprite.p);
    gl.uniform2f(this.sprite.u.u_out, this.W, this.H);
    gl.uniform1i(this.sprite.u.u_tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    gl.enable(gl.BLEND);
    const data = this.spriteData;
    const cap = data.length / (SPRITE_FLOATS * 6);
    let n = 0;
    let curTex: string | null = null;
    let curAdd = false;
    const flush = () => {
      if (!n || !curTex) return;
      const t = this.tex(curTex);
      if (t) {
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        if (curAdd) gl.blendFunc(gl.ONE, gl.ONE);
        else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * SPRITE_FLOATS * 6);
        gl.drawArrays(gl.TRIANGLES, 0, n * 6);
      }
      n = 0;
    };
    for (const s of list) {
      if (s.alpha <= 0.003) continue;
      if (s.tex !== curTex || s.additive !== curAdd || n >= cap) {
        flush();
        curTex = s.tex;
        curAdd = s.additive;
      }
      const [u0, v0, u1, v1] = s.uv ?? [0, 0, 1, 1];
      const a = s.alpha;
      const r = s.tint[0] * a;
      const g = s.tint[1] * a;
      const bl = s.tint[2] * a;
      const q = s.q;
      const corners = [
        [q[0], q[1], u0, v0],
        [q[2], q[3], u1, v0],
        [q[4], q[5], u1, v1],
        [q[6], q[7], u0, v1],
      ];
      let o = n * SPRITE_FLOATS * 6;
      for (const ci of [0, 1, 2, 0, 2, 3]) {
        const c = corners[ci];
        data[o++] = c[0];
        data[o++] = c[1];
        data[o++] = c[2];
        data[o++] = c[3];
        data[o++] = r;
        data[o++] = g;
        data[o++] = bl;
        data[o++] = a;
      }
      n++;
    }
    flush();
    gl.disable(gl.BLEND);
  }

  /** Copy of the current frame as a 2D canvas (for photos). */
  snapshot(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    c.getContext('2d')!.drawImage(this.canvas, 0, 0);
    return c;
  }
}

function paintMode(m: PaintMode) {
  return m === 'normal' ? 0 : m === 'multiply' ? 1 : 2;
}
