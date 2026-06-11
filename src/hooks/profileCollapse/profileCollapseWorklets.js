import { Extrapolation, interpolate } from 'react-native-reanimated';
import {
  AVATAR_GLOW_HEADER_PEAK_SCROLL,
  NAME_HEADER_SCROLL_END,
  NAME_HEADER_SCROLL_START,
  PROFILE_COLLAPSE_DISTANCE,
} from './profileCollapseConstants';

/** Fade свечения вместе с появлением имени в шапке (профиль контакта). */
export function glowHeaderNameFade(y) {
  'worklet';
  return interpolate(
    y,
    [NAME_HEADER_SCROLL_START, NAME_HEADER_SCROLL_END],
    [1, 0],
    Extrapolation.CLAMP,
  );
}

/** Яркость подсветки: ноль в покое, максимум в середине захода под шапку, fade в конце. */
export function avatarGlowIntensity(y) {
  'worklet';
  return interpolate(
    y,
    [0, 24, AVATAR_GLOW_HEADER_PEAK_SCROLL, PROFILE_COLLAPSE_DISTANCE],
    [0, 0.34, 1, 0],
    Extrapolation.CLAMP,
  );
}

/** Хвост: гасим только когда аватар почти скрыт за шапкой. */
export function avatarGlowTailFade(p) {
  'worklet';
  return interpolate(p, [0.84, 1], [1, 0], Extrapolation.CLAMP);
}
