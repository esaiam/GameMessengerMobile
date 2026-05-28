/** @typedef {'screen' | 'modal'} MediaViewerDebugSource */

const PREFIX = '[MediaViewer]';

function ts() {
  return new Date().toISOString().slice(11, 23);
}

function round(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : n;
}

/**
 * @param {import('./mediaTransitionSource').MediaTransitionRect | null | undefined} rect
 */
export function formatRect(rect) {
  if (!rect) return 'null';
  return `{x:${round(rect.x)},y:${round(rect.y)},w:${round(rect.width)},h:${round(rect.height)}}`;
}

/**
 * @param {{
 *   frameX?: number,
 *   frameY?: number,
 *   frameW?: number,
 *   frameH?: number,
 *   pagerX?: number,
 *   viewIndexSv?: number,
 *   safeIndex?: number,
 *   backdrop?: number,
 *   axisLock?: number,
 *   isOpening?: boolean,
 *   isClosing?: boolean,
 * }} snap
 */
export function formatSnap(snap) {
  const parts = [];
  if (snap.frameX != null) parts.push(`fx=${round(snap.frameX)}`);
  if (snap.frameY != null) parts.push(`fy=${round(snap.frameY)}`);
  if (snap.frameW != null) parts.push(`fw=${round(snap.frameW)}`);
  if (snap.frameH != null) parts.push(`fh=${round(snap.frameH)}`);
  if (snap.pagerX != null) parts.push(`px=${round(snap.pagerX)}`);
  if (snap.viewIndexSv != null) parts.push(`idxSv=${snap.viewIndexSv}`);
  if (snap.safeIndex != null) parts.push(`idx=${snap.safeIndex}`);
  if (snap.backdrop != null) parts.push(`bd=${round(snap.backdrop)}`);
  if (snap.axisLock != null) parts.push(`axis=${snap.axisLock}`);
  if (snap.isOpening != null) parts.push(`open=${snap.isOpening ? 1 : 0}`);
  if (snap.isClosing != null) parts.push(`close=${snap.isClosing ? 1 : 0}`);
  return parts.join(' ');
}

/**
 * @param {MediaViewerDebugSource} source
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export function logMediaViewer(source, event, data) {
  if (!__DEV__) return;
  const payload = data && Object.keys(data).length > 0 ? data : undefined;
  if (payload) {
    console.log(`${PREFIX} ${ts()} ${source} ${event}`, payload);
  } else {
    console.log(`${PREFIX} ${ts()} ${source} ${event}`);
  }
}
