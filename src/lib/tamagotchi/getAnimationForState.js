const EMOJI = {
  sick: '🤒',
  tired: '😴',
  bored: '😑',
  sad: '😢',
  neutral: '😐',
  excited: '🤩',
  happy: '😊' };

/** Приоритет: sick → tired → bored → sad → neutral → excited → happy */
export function resolveVisualState(state) {
  if (!state) return 'neutral';
  const mood = Number(state.mood);
  const hurt = Number(state.hurt);
  const energy = Number(state.energy);
  const trust = Number(state.trust);
  const boredom = Number(state.boredom);
  const isSick = state.is_sick === true;

  if (isSick || hurt >= 0.7) return 'sick';
  if (energy < 0.3) return 'tired';
  if (boredom > 0.8) return 'bored';
  if (mood < 0) return 'sad';
  if (trust > 0.8 && mood > 0.3) return 'excited';
  if (mood > 0.5) return 'happy';
  return 'neutral';
}

/** Placeholder emoji; позже — Lottie по `visual`. */
export function getAnimationForState(stateOrVisual) {
  const visual =
    typeof stateOrVisual === 'string'
      ? stateOrVisual
      : resolveVisualState(stateOrVisual);
  return {
    visual,
    emoji: EMOJI[visual] || EMOJI.neutral };
}

export const RELATIONSHIP_TIERS = [
  { min: 0, label: 'Незнакомцы' },
  { min: 0.2, label: 'Знакомые' },
  { min: 0.4, label: 'Друзья' },
  { min: 0.6, label: 'Близкие' },
  { min: 0.8, label: 'Неразлучные' }];

export function getRelationshipLabel(level) {
  const n = Number(level);
  const v = Number.isFinite(n) ? (n > 1 ? n / 100 : Math.max(0, Math.min(1, n))) : 0;
  let label = RELATIONSHIP_TIERS[0].label;
  for (const tier of RELATIONSHIP_TIERS) {
    if (v >= tier.min) label = tier.label;
  }
  return label;
}
