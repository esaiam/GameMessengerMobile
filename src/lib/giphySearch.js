const PER_PAGE = 15;

/**
 * URL для отправки в чат — лёгкие варианты, без original/downsized (мегабайты).
 * @param {Record<string, { url?: string, width?: string, height?: string }>} images
 */
export function pickGiphySendAsset(images) {
  const thumb =
    images.fixed_height_small ||
    images.preview_gif ||
    images.fixed_width_small;
  const send =
    images.fixed_height ||
    images.downsized_medium ||
    images.downsized_small ||
    images.fixed_width ||
    thumb;
  return { thumb, send };
}

/**
 * @param {unknown} json
 * @param {number} page
 */
export function mapGiphySearchResponse(json, page) {
  const items = Array.isArray(json?.data) ? json.data : [];
  const total = typeof json?.pagination?.total_count === 'number' ? json.pagination.total_count : 0;
  const offset = typeof json?.pagination?.offset === 'number' ? json.pagination.offset : (page - 1) * PER_PAGE;

  return {
    results: items.map((g) => {
      const { thumb, send } = pickGiphySendAsset(g?.images ?? {});
      return {
        id: String(g.id),
        thumbUrl: thumb?.url || '',
        fullUrl: send?.url || thumb?.url || '',
        width: Number(send?.width || thumb?.width || 0),
        height: Number(send?.height || thumb?.height || 0) };
    }),    page,
    hasMore: offset + items.length < total };
}

/**
 * @param {string} query
 * @param {number} page
 * @param {string} apiKey
 */
export async function searchGiphyDirect(query, page, apiKey) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    return { results: [], page: 1, hasMore: false };
  }
  const offset = (page - 1) * PER_PAGE;
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&limit=${PER_PAGE}&offset=${offset}&rating=g&lang=ru`,
  );
  if (!res.ok) {
    throw new Error(`Giphy: ${res.status}`);
  }
  const json = await res.json();
  return mapGiphySearchResponse(json, page);
}

/**
 * @param {number} page
 * @param {string} apiKey
 */
export async function fetchGiphyTrendingDirect(page, apiKey) {
  const offset = (page - 1) * PER_PAGE;
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(apiKey)}&limit=${PER_PAGE}&offset=${offset}&rating=g`,
  );
  if (!res.ok) {
    throw new Error(`Giphy: ${res.status}`);
  }
  const json = await res.json();
  return mapGiphySearchResponse(json, page);
}
