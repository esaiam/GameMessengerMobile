import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const pexelsKey = Deno.env.get('PEXELS_API_KEY');
    if (!pexelsKey) {
      return new Response(JSON.stringify({ error: 'PEXELS_API_KEY not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);

    if (q.length < 2) {
      return new Response(JSON.stringify({ results: [], page: 1, hasMore: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const perPage = 15;
    const pexelsRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`,
      { headers: { Authorization: pexelsKey } },
    );

    if (!pexelsRes.ok) {
      const detail = await pexelsRes.text();
      console.error('Pexels error', pexelsRes.status, detail);
      return new Response(JSON.stringify({ error: 'Image search failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await pexelsRes.json();
    const photos = Array.isArray(json?.photos) ? json.photos : [];
    const total = typeof json?.total_results === 'number' ? json.total_results : 0;

    const results = photos.map((p: {
      id: number;
      width: number;
      height: number;
      photographer?: string;
      src?: { medium?: string; large?: string; original?: string };
    }) => ({
      id: String(p.id),
      thumbUrl: p.src?.medium || p.src?.large || '',
      fullUrl: p.src?.large || p.src?.original || p.src?.medium || '',
      width: p.width ?? 0,
      height: p.height ?? 0,
      photographer: p.photographer ?? '',
    }));

    return new Response(
      JSON.stringify({
        results,
        page,
        hasMore: page * perPage < total,
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
