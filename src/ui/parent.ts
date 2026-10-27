import { clearAll, listItems, usage } from '../storage/db';
import { checkPin, saveSettings, setPin, type Settings } from '../storage/settings';
import { $, ask, el, toast } from './dom';

/** Shows the PIN pad and resolves with the 4 digits entered, or null if cancelled. */
function pinPad(title: string, subtitle: string): Promise<string | null> {
  const root = $('#pinpad');
  root.replaceChildren();
  let digits = '';
  const dots = el('div', { className: 'pin-dots' }, [el('i'), el('i'), el('i'), el('i')]);
  const keys = el('div', { className: 'keys' });
  root.append(el('div', { className: 'pin-box' }, [el('h3', { textContent: title }), el('p', { textContent: subtitle }), dots, keys]));
  root.hidden = false;
  return new Promise((resolve) => {
    const done = (v: string | null) => {
      root.hidden = true;
      root.replaceChildren();
      resolve(v);
    };
    const update = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < digits.length));
    const press = (k: string) => {
      if (k === '✖') return done(null);
      if (k === '⌫') digits = digits.slice(0, -1);
      else if (digits.length < 4) digits += k;
      update();
      if (digits.length === 4) setTimeout(() => done(digits), 120);
    };
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '✖', '0', '⌫']) {
      keys.append(el('button', { textContent: k, onclick: () => press(k) }));
    }
  });
}

function shake() {
  const d = $('#pinpad .pin-dots');
  d?.classList.add('shake');
}

export async function createPin(settings: Settings) {
  const a = await pinPad('Create a grown-up PIN', 'Pick 4 numbers your child does not know.');
  if (!a) return false;
  const b = await pinPad('Type it again', 'Just to be sure.');
  if (!b) return false;
  if (a !== b) {
    toast('PINs did not match — try again');
    return false;
  }
  await setPin(settings, a);
  toast('PIN saved 🔒');
  return true;
}

export async function requirePin(settings: Settings, subtitle = 'Grown-ups only'): Promise<boolean> {
  for (let tries = 0; tries < 3; tries++) {
    const p = await pinPad('Enter PIN', tries ? 'That was not right. Try again.' : subtitle);
    if (!p) return false;
    if (await checkPin(settings, p)) return true;
    shake();
  }
  toast('Wrong PIN');
  return false;
}

export interface ParentHooks {
  offline: () => string;
  apply: () => void;
}

export async function openParent(settings: Settings, hooks: ParentHooks) {
  if (!settings.pinHash) {
    if (!(await createPin(settings))) return;
  } else if (!(await requirePin(settings))) return;

  const root = $('#parent');
  root.hidden = false;

  const render = async () => {
    const items = await listItems().catch(() => []);
    const u = await usage();
    const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
    const wrap = el('div', { className: 'wrap' });

    const toggle = (label: string, sub: string, get: () => boolean, set: (v: boolean) => void) => {
      const t = el('button', { className: `toggle${get() ? ' on' : ''}`, ariaLabel: label });
      t.onclick = () => {
        set(!get());
        t.classList.toggle('on', get());
        saveSettings(settings);
        hooks.apply();
      };
      return el('div', { className: 'item' }, [el('div', { className: 'label' }, [label, el('small', { textContent: sub })]), t]);
    };
    const seg = <T extends string | number>(label: string, sub: string, opts: [T, string][], get: () => T, set: (v: T) => void) => {
      const s = el('div', { className: 'seg' });
      for (const [v, name] of opts) {
        const b = el('button', { textContent: name, className: get() === v ? 'sel' : '' });
        b.onclick = () => {
          set(v);
          s.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
          saveSettings(settings);
          hooks.apply();
        };
        s.append(b);
      }
      return el('div', { className: 'item' }, [el('div', { className: 'label' }, [label, el('small', { textContent: sub })]), s]);
    };
    const action = (label: string, sub: string, btn: string, onclick: () => void, danger = false) =>
      el('div', { className: 'item' }, [
        el('div', { className: 'label' }, [label, el('small', { textContent: sub })]),
        el('button', { className: `pill${danger ? ' danger' : ''}`, textContent: btn, onclick }),
      ]);

    wrap.append(
      el('div', { className: 'sheet-head flush' }, [
        el('button', { className: 'round', textContent: '✖', ariaLabel: 'Close', onclick: close }),
        el('h2', { textContent: 'Grown-ups' }),
      ]),
      el('h4', { textContent: 'Privacy' }),
      el('div', { className: 'set' }, [
        el('div', { className: 'item' }, [
          el('div', { className: 'label' }, [
            'Camera, microphone and face tracking run on this iPad',
            el('small', {
              textContent:
                'The app has no server and no accounts, analytics or ads. Its security policy blocks connections to any other website, so frames and recordings cannot be sent anywhere.',
            }),
          ]),
        ]),
        el('div', { className: 'item' }, [
          el('div', { className: 'label' }, [
            'Memories stay inside this app',
            el('small', {
              textContent:
                'Saved pictures live in this app’s private storage on this iPad. They only leave when a grown-up taps 📤 and saves them to Photos — and if iCloud Photos is on, Photos will sync them.',
            }),
          ]),
        ]),
        el('div', { className: 'item' }, [el('div', { className: 'label' }, ['Offline', el('small', { textContent: hooks.offline() })])]),
      ]),
      el('h4', { textContent: 'Settings' }),
      el('div', { className: 'set' }, [
        toggle('Record sound with videos', 'Uses the microphone only while the record button is held.', () => settings.recordSound, (v) => (settings.recordSound = v)),
        toggle('Allow saving to Photos', 'Shows the 📤 button in Memories. Always asks for this PIN.', () => settings.allowExport, (v) => (settings.allowExport = v)),
        seg('Faces at once', 'More faces needs a faster iPad.', [
          [1, '1'],
          [2, '2'],
          [3, '3'],
        ], () => settings.maxFaces, (v) => (settings.maxFaces = v)),
        seg('Picture quality', 'Battery saver is smoother on older iPads.', [
          ['high', 'Sharp'],
          ['saver', 'Battery saver'],
        ], () => settings.quality, (v) => (settings.quality = v)),
        toggle('Compatibility mode', 'Turn on if lenses look broken. Slower. Restarts the app.', () => settings.cpuOnly, (v) => {
          settings.cpuOnly = v;
          saveSettings(settings);
          location.reload();
        }),
      ]),
      el('h4', { textContent: 'Storage' }),
      el('div', { className: 'set' }, [
        el('div', { className: 'item' }, [
          el('div', { className: 'label' }, [
            `${items.length} memories`,
            el('small', { textContent: u ? `Using ${mb(u.used)} (app + memories)` : 'Storage size not available' }),
          ]),
        ]),
        action('Delete all memories', 'Removes every saved picture and video from this app.', 'Delete all', async () => {
          if (await ask('Delete everything?', 'All memories in this app will be erased. This cannot be undone.', 'Delete all', 'Cancel', true)) {
            await clearAll();
            toast('All memories deleted');
            await rerender();
          }
        }, true),
        action('Change PIN', '', 'Change', async () => {
          await createPin(settings);
        }),
      ]),
      el('h4', { textContent: 'Keep it kid-safe' }),
      el('p', {
        className: 'info',
        innerHTML:
          '<b>Add to Home Screen:</b> in Safari tap Share → “Add to Home Screen”. The app then opens full-screen, works in Airplane Mode, and Safari can’t clear its memories after 7 days of not using it.<br><br>' +
          '<b>Lock the iPad to this app (Guided Access):</b> Settings → Accessibility → Guided Access → On and set a passcode. Open Snap Lens and triple-click the top (or Home) button → Start. Your child can’t leave the app until you triple-click and enter the passcode.<br><br>' +
          '<b>Prove it stays offline:</b> after the first launch, turn on Airplane Mode — every lens still works.',
      }),
    );
    root.replaceChildren(wrap);
  };

  const rerender = render;
  function close() {
    root.hidden = true;
    root.replaceChildren();
  }
  await render();
}
