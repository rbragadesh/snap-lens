import { BUTTERFLY_LENS, CUTE_LENSES } from './cute';
import { FRIEND_LENSES } from './friends';
import { FUNNY_LENSES } from './funny';
import { GAME_LENSES } from './games';
import { MAGIC_LENSES, PAINT_LENSES } from './magic';
import type { Lens, LensGroup } from './types';
import { WORLD_LENSES } from './world';

const none: Lens = {
  id: 'none',
  name: 'No Lens',
  icon: '⭕',
  group: 'cute',
  faces: 0,
  create: () => ({ frame() {} }),
};

export const LENSES: Lens[] = [
  none,
  ...CUTE_LENSES,
  ...FUNNY_LENSES,
  ...MAGIC_LENSES,
  BUTTERFLY_LENS,
  ...PAINT_LENSES,
  ...WORLD_LENSES,
  ...FRIEND_LENSES,
  ...GAME_LENSES,
];

export const GROUP_NAMES: Record<LensGroup, string> = {
  cute: 'Cute',
  funny: 'Funny Faces',
  magic: 'Magic',
  paint: 'Face Paint',
  world: 'Places & Hair',
  friends: 'Friends',
  games: 'Games',
};

export function lensById(id: string) {
  return LENSES.find((l) => l.id === id) ?? LENSES[0];
}
