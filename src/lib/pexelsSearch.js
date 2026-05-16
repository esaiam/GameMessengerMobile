const PER_PAGE = 15;

/**
 * @param {unknown} json
 * @param {number} page
 */
export function mapPexelsSearchResponse(json, page) {
  const photos = Array.isArray(json?.photos) ? json.photos : [];
  const total = typeof json?.total_results === 'number' ? json.total_results : 0;
  return {
    results: photos.map((p) => ({
      id: String(p.id),
      thumbUrl: p.src?.medium || p.src?.large || '',
      fullUrl: p.src?.large || p.src?.original || p.src?.medium || '',
      width: p.width ?? 0,
      height: p.height ?? 0,
      photographer: p.photographer ?? '',
    })),
    page,
    hasMore: page * PER_PAGE < total,
  };
}

/**
 * Прямой запрос к Pexels (только dev / если задан EXPO_PUBLIC_PEXELS_API_KEY).
 * @param {string} query
 * @param {number} page
 * @param {string} apiKey
 */
export async function searchPexelsDirect(query, page, apiKey) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    return { results: [], page: 1, hasMore: false };
  }
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${PER_PAGE}&page=${page}`,
    { headers: { Authorization: apiKey } },
  );
  if (!res.ok) {
    throw new Error(`Pexels: ${res.status}`);
  }
  const json = await res.json();
  return mapPexelsSearchResponse(json, page);
}
