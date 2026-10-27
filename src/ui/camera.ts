import { audioContext, voiceChain, VOICES, type VoiceFx } from '../audio/voice';
import { Recorder } from '../engine/recorder';
import type { Studio } from '../engine/studio';
import { FILTERS } from '../filters';
import { GROUP_NAMES, LENSES } from '../lenses';
import type { Lens, LensGroup } from '../lenses/types';
import type { Settings } from '../storage/settings';
import { $, blobToImage, el, sfx, thumbnail, toast } from './dom';
import { openMemories } from './memories';
import { openParent } from './parent';
import { openReview } from './review';

const HOLD_MS = 320;
const MAX_REC_S = 60;

export class CameraUI {
  private lensIdx = 0;
  private variantFor = new Map<string, number>();
  private timer = 0;
  private flash = false;
  private voice: VoiceFx = 'none';
  private recorder = new Recorder();
  private recStop: (() => Promise<void>) | null = null;
  private busy = false;
  private hintUntil = 0;
  private hintText = '';
  private noFaceSince = 0;
  private scrollTimer = 0;
  private lensButtons: HTMLButtonElement[] = [];

  constructor(
    private studio: Studio,
    private settings: Settings,
    private offline: () => string,
    private applySettings: () => void,
  ) {}

  mount() {
    this.buildCarousel();
    this.buildGroups();
    this.buildFilters();
    this.bindSide();
    this.bindShutter();
    this.selectLens(0, false);
    this.studio.onFrame = () => this.onFrame();
    $('#view').addEventListener('pointerdown', (e) => this.studio.tap(e.offsetX, e.offsetY));
    document.addEventListener('visibilitychange', () => this.onVisibility());
  }

  // ---------- lens carousel ----------

  private buildCarousel() {
    const car = $('#carousel');
    this.lensButtons = LENSES.map((lens, i) => {
      const b = el('button', { className: 'lens', textContent: lens.icon, ariaLabel: lens.name });
      b.dataset.id = lens.id;
      b.onclick = () => this.scrollTo(i);
      car.append(b);
      return b;
    });
    car.addEventListener('scroll', () => {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = window.setTimeout(() => this.pickCentered(), 110);
    });
  }

  private scrollTo(i: number, smooth = true) {
    const b = this.lensButtons[i];
    const car = $('#carousel');
    car.scrollTo({ left: b.offsetLeft - car.clientWidth / 2 + b.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
  }

  private pickCentered() {
    const car = $('#carousel');
    const mid = car.scrollLeft + car.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    this.lensButtons.forEach((b, i) => {
      const d = Math.abs(b.offsetLeft + b.clientWidth / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best !== this.lensIdx) this.selectLens(best, true, true);
  }

  private get lens(): Lens {
    return LENSES[this.lensIdx];
  }

  selectLens(i: number, sound = true, fromScroll = false) {
    this.lensIdx = i;
    const lens = this.lens;
    this.lensButtons.forEach((b, j) => b.classList.toggle('sel', j === i));
    if (!fromScroll) this.scrollTo(i, false);
    const variant = this.variantFor.get(lens.id) ?? 0;
    this.studio.setLens(lens.id, variant);
    $('#lens-name').textContent = lens.id === 'none' ? '' : lens.name;
    this.buildVariants();
    this.showHint(lens.hint ?? '');
    this.noFaceSince = 0;
    $('#groups')
      .querySelectorAll<HTMLElement>('.chip')
      .forEach((c) => c.classList.toggle('sel', c.dataset.group === lens.group && lens.id !== 'none'));
    if (sound) sfx('tick');
  }

  private buildGroups() {
    const row = $('#groups');
    const seen = new Set<LensGroup>();
    LENSES.forEach((lens, i) => {
      if (lens.id === 'none' || seen.has(lens.group)) return;
      seen.add(lens.group);
      const c = el('button', { className: 'chip', textContent: GROUP_NAMES[lens.group] });
      c.dataset.group = lens.group;
      c.onclick = () => this.scrollTo(i);
      row.append(c);
    });
  }

  private buildVariants() {
    const row = $('#variants');
    row.replaceChildren();
    const lens = this.lens;
    if (!lens.variants) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    const cur = this.variantFor.get(lens.id) ?? 0;
    lens.variants.forEach((v, i) => {
      const isColour = v.swatch.startsWith('#') || v.swatch.startsWith('linear');
      const sw = el('span', { className: 'sw', textContent: isColour ? '' : v.swatch });
      if (isColour) sw.style.background = v.swatch;
      const c = el('button', { className: `chip${i === cur ? ' sel' : ''}` }, [sw, v.name]);
      c.onclick = () => {
        this.variantFor.set(lens.id, i);
        this.studio.setLens(lens.id, i);
        row.querySelectorAll('.chip').forEach((x) => x.classList.toggle('sel', x === c));
        if (lens.id === 'teleport' && v.name === 'My Photo') $<HTMLInputElement>('#file-bg').click();
        sfx('tick');
      };
      row.append(c);
    });
  }

  private buildFilters() {
    const row = $('#filters');
    FILTERS.forEach((f) => {
      const c = el('button', { className: `chip${f.id === 'none' ? ' sel' : ''}` }, [el('span', { className: 'sw', textContent: f.icon }), f.name]);
      c.onclick = () => {
        this.studio.filter = f.id;
        row.querySelectorAll('.chip').forEach((x) => x.classList.toggle('sel', x === c));
        $('#btn-filter').classList.toggle('active', f.id !== 'none');
        sfx('tick');
      };
      row.append(c);
    });
  }

  // ---------- side buttons ----------

  private bindSide() {
    $('#btn-flip').onclick = async () => {
      if (this.studio.sourceKind !== 'camera' || this.busy) return;
      try {
        await this.studio.startCamera(this.studio.facing === 'user' ? 'environment' : 'user');
      } catch {
        toast('Could not switch camera');
      }
    };
    $('#btn-flash').onclick = () => {
      this.flash = !this.flash;
      $('#btn-flash').classList.toggle('active', this.flash);
      $('#btn-flash b').textContent = this.flash ? 'on' : '';
    };
    $('#btn-timer').onclick = () => {
      this.timer = this.timer === 0 ? 3 : this.timer === 3 ? 10 : 0;
      $('#btn-timer b').textContent = this.timer ? `${this.timer}s` : '';
      $('#btn-timer').classList.toggle('active', this.timer > 0);
    };
    $('#btn-voice').onclick = () => this.openVoices();
    $('#btn-filter').onclick = () => {
      const f = $('#filters');
      f.hidden = !f.hidden;
      if (!f.hidden) $('#voices').hidden = true;
    };
    $('#btn-upload').onclick = () => $<HTMLInputElement>('#file-media').click();
    $('#btn-back').onclick = () => this.backToCamera();
    $('#btn-memories').onclick = async () => {
      if (this.busy) return;
      await openMemories(this.settings);
    };
    $('#btn-parent').onclick = async () => {
      if (this.busy) return;
      await openParent(this.settings, { offline: this.offline, apply: this.applySettings });
    };
    $<HTMLInputElement>('#file-media').onchange = (e) => this.onMediaPicked(e.target as HTMLInputElement);
    $<HTMLInputElement>('#file-bg').onchange = async (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      try {
        this.studio.setUserBackground(await loadImage(file, 1600));
      } catch {
        toast('Could not open that picture');
      }
    };
  }

  private openVoices() {
    const sheet = $('#voices');
    if (!sheet.hidden) {
      sheet.hidden = true;
      return;
    }
    $('#filters').hidden = true;
    sheet.replaceChildren();
    for (const v of VOICES) {
      const b = el('button', { className: `opt${v.id === this.voice ? ' sel' : ''}` }, [el('span', { textContent: v.icon }), v.name]);
      b.onclick = () => {
        this.voice = v.id;
        $('#btn-voice b').textContent = v.id === 'none' ? '' : v.icon;
        sheet.hidden = true;
        toast(v.id === 'none' ? 'Normal voice' : `${v.name} voice for videos ${v.icon}`);
      };
      sheet.append(b);
    }
    sheet.hidden = false;
  }

  private async onMediaPicked(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.type.startsWith('video/')) {
        await this.studio.setVideoFile(URL.createObjectURL(file));
      } else {
        this.studio.setImage(await loadImage(file, 1920));
      }
      this.setMediaMode(true);
    } catch (e) {
      console.error(e);
      toast('Could not open that file 😕');
      void this.backToCamera();
    }
  }

  private setMediaMode(on: boolean) {
    $('#btn-back').hidden = !on;
    for (const id of ['#btn-flip', '#btn-flash', '#btn-timer']) $(id).hidden = on;
    $('#shutter').classList.toggle('video-mode', on && this.studio.sourceKind === 'video');
  }

  private async backToCamera() {
    this.setMediaMode(false);
    try {
      await this.studio.startCamera();
    } catch {
      toast('Camera is not available');
    }
  }

  // ---------- capture ----------

  private bindShutter() {
    const btn = $('#shutter');
    let downAt = 0;
    let holdTimer = 0;
    let holding = false;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audioContext();
      if (this.busy && !this.recorder.active) return;
      if (this.recorder.active) return;
      if (this.studio.sourceKind === 'video') return;
      if (this.studio.sourceKind !== 'camera') return;
      downAt = performance.now();
      holding = true;
      btn.setPointerCapture(e.pointerId);
      holdTimer = window.setTimeout(() => {
        if (holding) void this.startCameraRecording(() => holding);
      }, HOLD_MS);
    });
    const release = () => {
      if (!holding) return;
      holding = false;
      clearTimeout(holdTimer);
      if (this.recStop) void this.recStop();
      else if (performance.now() - downAt < HOLD_MS + 50) void this.takePhoto();
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('click', () => {
      audioContext();
      const kind = this.studio.sourceKind;
      if (kind === 'image') void this.takePhoto();
      else if (kind === 'video') {
        if (this.recStop) void this.recStop();
        else void this.recordUploadedVideo();
      }
    });
  }

  private async takePhoto() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (this.timer && this.studio.sourceKind === 'camera') await this.countdown(this.timer);
      const flashEl = $('#flash');
      if (this.flash && this.studio.sourceKind === 'camera') {
        flashEl.classList.add('on');
        await sleep(280);
      }
      sfx('shutter');
      this.studio.frame();
      const shot = this.studio.renderer.snapshot();
      flashEl.classList.remove('on');
      this.busy = false;
      await openReview({ kind: 'photo', canvas: shot, lens: this.lens.id });
    } finally {
      this.busy = false;
      $('#flash').classList.remove('on');
    }
  }

  private async countdown(n: number) {
    const c = $('#countdown');
    for (let i = n; i > 0; i--) {
      c.textContent = String(i);
      sfx('tick');
      await sleep(1000);
    }
    c.textContent = '';
  }

  private async micTrack(): Promise<{ track: MediaStreamTrack | null; stop: () => void }> {
    if (!this.settings.recordSound) return { track: null, stop: () => {} };
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ac = audioContext();
      const src = ac.createMediaStreamSource(mic);
      const chain = await voiceChain(src, this.voice);
      return {
        track: chain.track,
        stop: () => {
          chain.dispose();
          mic.getTracks().forEach((t) => t.stop());
        },
      };
    } catch (e) {
      console.warn('No microphone', e);
      return { track: null, stop: () => {} };
    }
  }

  private async startCameraRecording(stillHolding: () => boolean) {
    if (this.busy) return;
    this.busy = true;
    const mic = await this.micTrack();
    if (!stillHolding()) {
      // the permission prompt can steal the touch; ask to try again
      mic.stop();
      this.busy = false;
      toast('Hold the button to record 🎥');
      return;
    }
    const thumbCanvas = this.studio.renderer.snapshot();
    try {
      this.recorder.start(this.studio.canvas, mic.track);
    } catch (e) {
      console.error(e);
      mic.stop();
      this.busy = false;
      toast('Video recording is not supported here');
      return;
    }
    this.setRecordingUi(true);
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const s = (performance.now() - this.recorder.startedAt) / 1000;
      this.setProgress(s / MAX_REC_S);
      if (s >= MAX_REC_S) void this.recStop?.();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    this.recStop = async () => {
      if (stopped) return;
      stopped = true;
      this.recStop = null;
      const blob = await this.recorder.stop();
      mic.stop();
      this.setRecordingUi(false);
      this.busy = false;
      if (blob && blob.size > 0 && performance.now() - this.recorder.startedAt > 600) {
        const thumb = await thumbnail(thumbCanvas, thumbCanvas.width, thumbCanvas.height);
        await openReview({ kind: 'video', blob, thumb, lens: this.lens.id });
      }
    };
  }

  private async recordUploadedVideo() {
    const v = this.studio.video;
    if (!v || this.busy) return;
    this.busy = true;
    const ac = audioContext();
    const el = v as HTMLVideoElement & { _src?: MediaElementAudioSourceNode };
    let chain: Awaited<ReturnType<typeof voiceChain>> | null = null;
    try {
      el._src ??= ac.createMediaElementSource(v);
      chain = await voiceChain(el._src, this.voice, true);
    } catch (e) {
      console.warn('No audio from video', e);
    }
    v.pause();
    v.loop = false;
    v.currentTime = 0;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    v.muted = false;
    const thumbCanvas = this.studio.renderer.snapshot();
    this.recorder.start(this.studio.canvas, chain?.track ?? null);
    this.setRecordingUi(true);
    await v.play().catch(() => undefined);
    const limit = Math.min(v.duration || MAX_REC_S, MAX_REC_S);
    let stopped = false;
    const finish = async () => {
      if (stopped) return;
      stopped = true;
      this.recStop = null;
      v.removeEventListener('ended', onEnded);
      const blob = await this.recorder.stop();
      chain?.dispose();
      v.muted = true;
      v.loop = true;
      void v.play();
      this.setRecordingUi(false);
      this.busy = false;
      if (blob && blob.size > 0) {
        const thumb = await thumbnail(thumbCanvas, thumbCanvas.width, thumbCanvas.height);
        await openReview({ kind: 'video', blob, thumb, lens: this.lens.id });
      }
    };
    const onEnded = () => void finish();
    v.addEventListener('ended', onEnded);
    this.recStop = finish;
    const tick = () => {
      if (stopped) return;
      this.setProgress(v.currentTime / limit);
      if (v.currentTime >= limit) void finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private setRecordingUi(on: boolean) {
    $('#shutter').classList.toggle('recording', on);
    $('#rec-badge').hidden = !on;
    $('#carousel').style.pointerEvents = on ? 'none' : '';
    if (!on) this.setProgress(0);
  }

  private setProgress(f: number) {
    const p = $('#shutter .progress') as unknown as SVGCircleElement;
    p.style.strokeDashoffset = String(283 * (1 - Math.min(1, Math.max(0, f))));
  }

  // ---------- status ----------

  private showHint(text: string) {
    this.hintText = text;
    this.hintUntil = text ? performance.now() + 3500 : 0;
  }

  private onFrame() {
    const st = this.studio.status;
    const loading = $('#loading');
    loading.hidden = !st.loading;
    if (st.loading) loading.textContent = `✨ ${st.loading}`;

    const lens = this.lens;
    const needsFace = lens.faces !== 0 && lens.id !== 'none';
    const now = performance.now();
    if (needsFace && st.faces === 0) {
      if (!this.noFaceSince) this.noFaceSince = now;
    } else this.noFaceSince = 0;

    let text: string | null = null;
    if (st.message) text = st.message;
    else if (this.noFaceSince && now - this.noFaceSince > 1500 && !this.recorder.active) text = 'Where is your face? 🙂';
    else if (now < this.hintUntil) text = this.hintText;
    const tip = $('#tip');
    if (text) {
      if (tip.textContent !== text) tip.textContent = text;
      tip.hidden = false;
    } else tip.hidden = true;
  }

  private async onVisibility() {
    if (document.hidden) {
      if (this.recStop) await this.recStop();
      return;
    }
    if (this.studio.sourceKind === 'camera' && !this.studio.cameraAlive()) {
      try {
        await this.studio.startCamera();
      } catch {
        /* camera may be in use by another app */
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Decode a picked image (an <img> applies EXIF rotation), scaled down to keep memory low. */
export async function loadImage(file: Blob, maxSide: number): Promise<HTMLCanvasElement> {
  const img = await blobToImage(file);
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const k = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
