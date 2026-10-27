import type { Lens } from './types';

const faceSwap: Lens = {
  id: 'swap',
  name: 'Face Swap',
  icon: '🔄',
  group: 'friends',
  faces: 2,
  hint: 'Get a buddy in the picture!',
  create() {
    return {
      frame(c) {
        if (c.faces.length < 2) {
          c.message = 'Face Swap needs 2 faces 👯';
          return;
        }
        const [a, b] = c.faces;
        c.scene.swaps.push({ dst: a.pts, src: b.pts, opacity: 1 }, { dst: b.pts, src: a.pts, opacity: 1 });
      },
    };
  },
};

export const FRIEND_LENSES = [faceSwap];
