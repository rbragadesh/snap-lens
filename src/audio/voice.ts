export type VoiceFx = 'none' | 'chipmunk' | 'monster' | 'robot' | 'echo' | 'alien';

export const VOICES: { id: VoiceFx; name: string; icon: string }[] = [
  { id: 'none', name: 'My Voice', icon: '🙂' },
  { id: 'chipmunk', name: 'Chipmunk', icon: '🐿️' },
  { id: 'monster', name: 'Monster', icon: '👹' },
  { id: 'robot', name: 'Robot', icon: '🤖' },
  { id: 'alien', name: 'Alien', icon: '👽' },
  { id: 'echo', name: 'Echo', icon: '🏔️' },
];

let ctx: AudioContext | null = null;
let workletReady: Promise<boolean> | null = null;

/** Must be called from a tap/click the first time (iOS only allows audio after a gesture). */
export function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function loadWorklet(ac: AudioContext) {
  if (!workletReady) {
    workletReady = ac.audioWorklet
      ? ac.audioWorklet.addModule(new URL('./worklets/pitch.js', document.baseURI).href).then(
          () => true,
          () => false,
        )
      : Promise.resolve(false);
  }
  return workletReady;
}

/** Builds input -> effect -> output and returns the processed audio track plus a cleanup function. */
export async function voiceChain(input: AudioNode, fx: VoiceFx, monitor = false) {
  const ac = audioContext();
  const dest = ac.createMediaStreamDestination();
  const out = ac.createGain();
  out.connect(dest);
  if (monitor) out.connect(ac.destination);
  const nodes: AudioNode[] = [out];
  const pitch = async (ratio: number, vibrato = 0) => {
    if (!(await loadWorklet(ac))) return null;
    const n = new AudioWorkletNode(ac, 'pitch-shift');
    n.parameters.get('ratio')!.value = ratio;
    n.parameters.get('vibrato')!.value = vibrato;
    nodes.push(n);
    return n;
  };
  let head: AudioNode = input;
  if (fx === 'chipmunk' || fx === 'monster' || fx === 'alien') {
    const n = await pitch(fx === 'chipmunk' ? 1.7 : fx === 'monster' ? 0.62 : 1.3, fx === 'alien' ? 0.08 : 0);
    if (n) {
      head.connect(n);
      head = n;
    }
  } else if (fx === 'robot') {
    const ring = ac.createGain();
    ring.gain.value = 0;
    const osc = ac.createOscillator();
    osc.frequency.value = 55;
    osc.connect(ring.gain);
    osc.start();
    head.connect(ring);
    const boost = ac.createGain();
    boost.gain.value = 1.6;
    ring.connect(boost);
    nodes.push(ring, osc, boost);
    head = boost;
  } else if (fx === 'echo') {
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.23;
    const fb = ac.createGain();
    fb.gain.value = 0.42;
    head.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(out);
    nodes.push(delay, fb);
  }
  head.connect(out);
  return {
    track: dest.stream.getAudioTracks()[0] ?? null,
    dispose() {
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          /* already disconnected */
        }
        if (n instanceof OscillatorNode) n.stop();
      }
      try {
        input.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}
