import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PER_PAGE = 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const giphyKey = Deno.env.get('GIPHY_API_KEY');
    if (!giphyKey) {
      return new Response(JSON.stringify({ error: 'GIPHY_API_KEY not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const trending = url.searchParams.get('trending') === '1';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);

    if (!trending && q.length < 2) {
      return new Response(JSON.stringify({ results: [], page: 1, hasMore: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const offset = (page - 1) * PER_PAGE;
    const giphyUrl = trending
      ? `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(giphyKey)}&limit=${PER_PAGE}&offset=${offset}&rating=g`
      : `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(q)}&limit=${PER_PAGE}&offset=${offset}&rating=g&lang=ru`;
    const giphyRes = await fetch(giphyUrl);

    if (!giphyRes.ok) {
      const detail = await giphyRes.text();
      console.error('Giphy error', giphyRes.status, detail);
      return new Response(JSON.stringify({ error: 'GIF search failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await giphyRes.json();
    const items = Array.isArray(json?.data) ? json.data : [];
    const total =
      typeof json?.pagination?.total_count === 'number' ? json.pagination.total_count : 0;

    const results = items.map((g: {
      id: string;
      images?: Record<string, { url?: string; width?: string; height?: string }>;
    }) => {
      const images = g.images ?? {};
      const thumb =
        images.fixed_height_small || images.preview_gif || images.fixed_width_small;
      const send =
        images.fixed_height ||
        images.downsized_medium ||
        images.downsized_small ||
        images.fixed_width ||
        thumb;
      return {
        id: String(g.id),
        thumbUrl: thumb?.url || '',
        fullUrl: send?.url || thumb?.url || '',
        width: Number(send?.width || thumb?.width || 0),
        height: Number(send?.height || thumb?.height || 0),
      };
    });

    return new Response(
      JSON.stringify({
        results,
        page,
        hasMore: offset + items.length < total,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
