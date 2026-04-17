import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import { setAudioModeAsync } from './audioMode';

/** Громкость броска: −40% от максимума (−30%, затем ещё −10%) */
const DICE_ROLL_VOLUME = 0.6;

const DICE_ASSET = require('../../assets/sounds/dice-roll.mp3');

let player = null;
let modeReady = false;
let creatingPlayer = null;

async function ensureMode() {
  if (modeReady) return;
  await setIsAudioActiveAsync(true);
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    allowsRecording: false,
    shouldRouteThroughEarpiece: false,
  });
  modeReady = true;
}

async function ensurePlayer() {
  if (player) return;
  if (creatingPlayer) {
    await creatingPlayer;
    return;
  }
  creatingPlayer = (async () => {
    await ensureMode();
    // expo-audio expects an AudioSource (require() asset id / uri), not an expo-asset Asset instance.
    player = createAudioPlayer(DICE_ASSET, { downloadFirst: true, keepAudioSessionActive: false });
  })();
  try {
    await creatingPlayer;
  } finally {
    creatingPlayer = null;
  }
}

export async function preloadDiceSound() {
  try { await ensurePlayer(); } catch {}
}

/**
 * Звук броска кубиков (assets/sounds/dice-roll.mp3).
 */
export async function playDiceRollSound() {
  try {
    await ensurePlayer();
    player.volume = DICE_ROLL_VOLUME;
    await player.seekTo(0);
    player.play();
  } catch (e) {
    console.warn('playDiceRollSound:', e?.message || e);
  }
}

/** Пауза воспроизведения (например, на время записи голоса в чате). */
export function pauseDiceSound() {
  try {
    if (player) player.pause();
  } catch {
    /* ignore */
  }
}

export async function unloadDiceSound() {
  try {
    if (player) player.remove();
    player = null;
  } catch {
    /* ignore */
  }
}
