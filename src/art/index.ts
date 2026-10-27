import { PAINTS } from './paints';
import { SCENES } from './scenes';
import { SPRITES } from './sprites';
import { emoji } from './util';

/**
 * Texture provider for the renderer: sprite name, `paint:x`, `scene:x` or `emoji:🍓`.
 * Not cached here: the renderer keeps the GPU texture and asks again only after freeing it.
 */
export function art(key: string): HTMLCanvasElement | null {
  const [kind, name] = key.includes(':') ? (key.split(/:(.*)/s) as [string, string]) : ['', key];
  if (kind === 'emoji') return emoji(name);
  if (kind === 'paint') return PAINTS[name]?.() ?? null;
  if (kind === 'scene') return SCENES[name]?.() ?? null;
  return SPRITES[key]?.() ?? null;
}
