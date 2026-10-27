const TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function recordingMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

/** Records the canvas (plus optional audio) into a video file kept in memory. */
export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private done: Promise<Blob> | null = null;
  startedAt = 0;

  get active() {
    return !!this.rec;
  }

  start(canvas: HTMLCanvasElement, audio: MediaStreamTrack | null) {
    const mime = recordingMime();
    if (mime === null) throw new Error('Recording is not supported on this device');
    const video = canvas.captureStream(30).getVideoTracks()[0];
    const stream = new MediaStream(audio ? [video, audio] : [video]);
    const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 5_000_000 });
    this.chunks = [];
    this.done = new Promise((resolve) => {
      rec.ondataavailable = (e) => {
        if (e.data.size) this.chunks.push(e.data);
      };
      rec.onstop = () => {
        video.stop();
        resolve(new Blob(this.chunks, { type: rec.mimeType || mime || 'video/mp4' }));
      };
    });
    rec.start(500);
    this.rec = rec;
    this.startedAt = performance.now();
  }

  async stop(): Promise<Blob | null> {
    const rec = this.rec;
    if (!rec || !this.done) return null;
    this.rec = null;
    if (rec.state !== 'inactive') rec.stop();
    return this.done;
  }
}
