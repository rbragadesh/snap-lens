# Snapchat Lenses: research notes and what this app covers

Researched October 2026.

## What Snapchat Lenses are

* **Face lenses** are the most-used kind. They track the face and add accessories (ears, glasses, hats),
  change facial features (big eyes, warps), or paint on the face (makeup, face paint).
* **World lenses** use the rear camera and place 3D objects in the room with surface tracking.
* **Triggers.** Many lenses wait for an action ("open your mouth", "raise your eyebrows") before the effect plays.
* **Generative / AI lenses** (Cartoon Kid, Cute Anime, gender swap "My Twin", Baby, aging) send the image
  through large neural networks, mostly on Snap's servers.
* **Other camera tools:** filters you swipe through, timer, flash, dual camera, voice filters, stickers,
  drawing, and Memories.

Snap's own published "top lenses" lists:

* **2016:** Flower Crown, Face Swap, Dog. ([Trusted Reviews](https://www.trustedreviews.com/news/these-were-the-most-popular-snapchat-filters-and-lenses-of-2016-2948575))
* **2022:** Crying, Shook, Cartoon Kid, Cute Anime. ([iTWire](https://itwire.com/your-it-news/entertainment/snapchat-reveals-the-most-popular-lenses-and-top-trends-of-2022))
* **2024:** Pink Dog, Soft Filter, Scribble World. ([Social Media Today](https://www.socialmediatoday.com/news/snapchat-shares-top-snap-trends-of-2024/735006/))
* **2025:** no official global list was found. User recaps mention "Baby", "Smiley Mouth" and a Bee lens.

## What iPad Safari can and can't do (the platform limits)

| Snapchat capability | In Safari on iPad, on-device? | In this app |
| --- | --- | --- |
| Face tracking, 478 landmarks plus expressions | Yes, MediaPipe Face Landmarker in WebAssembly + WebGL2 | ✅ up to 3 faces |
| Stickers that follow the head | Yes | ✅ ears, glasses, hats, crowns, horns… |
| Face warps (big eyes etc.) | Yes, with GPU shaders | ✅ 8 warp lenses |
| Face paint / makeup | Yes, with a texture on the face mesh | ✅ butterfly, tiger, panda, glitter… |
| Expression triggers | Yes, blendshapes | ✅ mouth open, smile, kiss, blink |
| Face swap | Yes, by swapping mesh textures | ✅ basic (no colour matching) |
| Background replacement | Yes, selfie segmentation model | ✅ 6 scenes + blur + own photo |
| Hair colour | Yes, multiclass segmentation (16 MB model) | ✅ 6 colours |
| Hand effects | Yes, hand landmarker | ✅ Magic Hands |
| Filters | Yes, shaders | ✅ 16 |
| Face-controlled mini game | Yes | ✅ Snack Attack |
| Video recording with voice changer | Yes, MediaRecorder + Web Audio | ✅ 5 voices |
| World lenses (3D objects on surfaces) | **No.** Safari on iPad has no WebXR AR | ❌ |
| Generative AI lenses (anime, aging, gender swap, AI cartoon) | **Not practically.** Models are far too large for a browser tab, and Snap runs them on servers | ❌ (Cartoon filter and Baby Face are classic effects, not AI) |
| Bitmoji, sharing, chat, stories, friends | Possible but needs a server, and it's exactly the part a parent wants gone | ❌ by design |

Sources: MediaPipe web setup ([guide](https://dev.to/kenzic/real-time-face-tracking-in-the-browser-with-mediapipe-22c9));
WebKit has a known GPU-process crash with a MediaPipe GPU delegate on an iOS 27 beta
([bug 321693](https://bugs.webkit.org/show_bug.cgi?id=321693)). The app therefore falls back to the CPU
automatically, and a grown-up can force it with **Compatibility mode**. WebXR is not implemented on iPadOS
Safari ([WebXR browser list](https://www.testmuai.com/learning-hub/webxr-compatible-browsers/)).

## Deliberate omissions for a kid's app

* **No beauty or face-slimming lenses.** "Soft Filter" was 2024's #2 lens, but face-reshaping beauty filters
  are a well-documented body-image concern for children. The app has a whole-frame "Dreamy" filter instead.
* **No social features, no links out of the app, no network.**
