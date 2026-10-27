# Snap Lens

A kid-friendly, Snapchat-Lens-style camera for the iPad that runs **entirely on the device**.
It's a web app (PWA): you open it once in Safari, add it to the Home Screen, and from then on it works
offline, even in Airplane Mode.

There are no accounts, friends, chat, feeds, ads or analytics, and no server receives anything.

## What's inside

**39 lenses** (about 75 looks counting their colour/style variants) in 7 groups, plus **16 colour filters**
that can be combined with any lens.

| Group | Lenses |
| --- | --- |
| Cute | Puppy (brown / **pink dog**), Kitty, Bunny, Teddy / Panda / Mouse, Flower Crown (3 styles), Royal crown (gold / ice / pink), Glasses (cool / hearts / stars / smart / round), Unicorn, Party, Busy Bee, Alien, Super Hero (5 colours), Angel / Devil, Pirate, Fancy, Clown, Spooky (witch / sugar skull / ghosts) |
| Funny Faces | Big Eyes (big / wonky / tiny), Big Head / Tiny Face, Shook, Cry Baby, Big Smile, Baby Face, Jelly Face, Funhouse (tall / wide) |
| Magic | Rainbow Mouth, Dragon fire breath, Love Eyes, Bubbles, Snow Queen, Magic Hands (hand tracking) |
| Face Paint | Butterfly, Tiger, Glitter & freckles, Panda / Zebra / Robot / Clown |
| Places & Hair | Teleport background (space, ocean, rainbow, candy, snow, beach, blur, **your own photo**), Magic Hair colour (6 colours incl. rainbow) |
| Friends | Face Swap (two people) |
| Games | Snack Attack (catch falling food with your mouth, 30-second rounds) |

Triggers work like Snapchat's: open your mouth (rainbow, dragon fire, puppy tongue, confetti), smile (hearts),
make a kissy face (bubbles), blink (ice magic), open your palm (stars).

**Camera features:** tap to take a photo, hold to record a video (up to 60 s), front/back camera,
3 s / 10 s timer, front "screen flash", voice changer for videos (chipmunk, monster, robot, alien, echo),
apply lenses to **an existing photo or video** from the iPad, draw and add emoji stickers on photos,
and a **Memories** gallery stored inside the app.

**Grown-ups area (⚙️, PIN-protected):** saving to the Photos app is gated by the PIN; record sound on/off;
faces at once (1–3); battery saver; compatibility mode; delete all memories; offline status; setup tips.

## Privacy: what "stays on the iPad" actually means

* The camera image, face tracking (Google's MediaPipe, compiled to WebAssembly) and all effects run in the
  browser on the iPad. All the code and the ML model files are served from this app's own origin; nothing
  is loaded from a CDN.
* A Content-Security-Policy (`connect-src 'self'`) stops the page from connecting to any other site, and the
  service worker refuses every request that isn't for one of the app's own files. The host is static
  (GitHub Pages), so even the app's own origin has nowhere to receive uploads.
* **Third-party telemetry was found and removed.** Google's MediaPipe 1.x quietly sends usage statistics
  to `odml.pa.googleapis.com` every 60 seconds (task type and timings, not images). The CSP blocked it
  during testing. The app now pins MediaPipe **0.10.35**, which contains no telemetry or hard-coded URLs.
  The CSP and service worker stay in place as a second layer. Don't upgrade to 1.x without re-checking.
  `scripts/e2e.mjs` fails if anything tries to leave the origin.
* Memories are stored in the app's private IndexedDB storage on the iPad.
* **Caveats:**
  * The app's files have to be downloaded once (about 50 MB, mostly ML models) from wherever it's hosted.
    After that, the service worker serves everything locally.
  * If a grown-up saves a picture to the Photos app and iCloud Photos is on, Photos syncs it to iCloud.
    That happens outside this app.
  * iPad backups (iCloud or computer) may include the app's stored data, just like any other app data.
  * A web app in Safari can't stop a child from switching to another app or website. Use
    **Guided Access** (Settings → Accessibility → Guided Access) to lock the iPad to this app.

**Check it yourself:** after the first launch, turn on Airplane Mode and use the app. Every lens still works.

## Putting it on the iPad

1. Push this repo to GitHub. In **Settings → Pages**, set **Source: GitHub Actions**. The included workflow
   (`.github/workflows/deploy.yml`) builds and publishes the app on every push to `main`.
   (GitHub Pages needs either a public repo or a paid plan. Any static HTTPS host works too:
   upload the `dist/` folder.)
2. On the iPad, open `https://<user>.github.io/<repo>/` in Safari, tap **Share → Add to Home Screen**.
3. Open it from the Home Screen, tap **Let's go!** and allow the camera.
4. Tap ⚙️ and set a grown-up PIN.
5. Optional: turn on Guided Access, as above.

Camera access only works over HTTPS, so opening `dist/index.html` straight from Files won't work.

## Requirements and honest limits

* iPadOS 17 or newer is recommended. The face tracker needs WebAssembly SIMD and WebGL2.
  It's smooth on A12 or newer iPads (2018+); older ones will be choppy. Use *Battery saver* there.
* It isn't Snapchat. Snapchat has a huge lens library built with Lens Studio, server-side generative AI
  lenses (aging, gender swap, anime/cartoon "AI" styles) and world-tracking AR. None of that can run inside
  Safari on an iPad with no server: Safari on iPad has no WebXR AR, and generative models are too big. This
  app's "Cartoon" and "Baby Face" are classic image effects, not AI.
* The hair-colour lens uses a 16 MB segmentation model and is the heaviest effect.
* Face Swap is deliberately simple: it blends the two faces' textures, with no colour matching.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (camera works on localhost)
npm run build      # production build in dist/ with CSP + service worker
npm run preview    # serve dist/ on http://localhost:4173
```

To test on an iPad from a computer, you need HTTPS. The simplest route is to deploy to Pages.

Automated smoke test (headless Chromium with a fake camera made from any face photo):

```bash
ffmpeg -loop 1 -i face.jpg -frames:v 60 -vf scale=1280:960,format=yuv420p face.y4m
npm run build && npx vite preview --port 4173 &
node scripts/e2e.mjs face.y4m test-results [two-faces.jpg]
```

It selects every lens and variant, saves a screenshot of each, takes and saves a photo and a video, opens
Memories, runs Face Swap on an uploaded photo, sets a PIN, checks that no request leaves the origin, and
reloads with the network turned off.

### Layout

```
src/engine/   tracker (MediaPipe), face geometry, WebGL2 renderer + shaders, particles, recorder, studio loop
src/lenses/   lens definitions (one small function per lens)
src/art/      all artwork, drawn in code: stickers, face paints (in face-mesh UV space), background scenes
src/ui/       camera screen, photo editor, memories, grown-ups area
public/models MediaPipe models (Apache-2.0)
sw/           service worker template (the build fills in the file list)
```

### Credits

Face, hand and segmentation models and the WebAssembly runtime are from Google's
[MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0). `src/engine/faceMeshData.ts` is
generated from MediaPipe's canonical face model by `scripts/gen-face-mesh.py`.
