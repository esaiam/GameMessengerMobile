import { REWRITE_STYLES, STYLE_PROMPTS } from './stylePrompts.ts';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const MAX_SOURCE_CHARS = 4000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (!groqKey) {
    return jsonResponse({ error: 'ИИ-редактор не настроен на сервере' }, 503);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Требуется авторизация' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const apiKey =
    Deno.env.get('SUPABASE_ANON_KEY') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
    '';
  if (!supabaseUrl || !apiKey) {
    return jsonResponse({ error: 'Ошибка конфигурации сервера' }, 500);
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: apiKey,
    },
  });

  if (!userRes.ok) {
    return jsonResponse({ error: 'Сессия недействительна' }, 401);
  }

  let user: { id?: string };
  try {
    user = await userRes.json();
  } catch {
    return jsonResponse({ error: 'Сессия недействительна' }, 401);
  }

  if (!user?.id) {
    return jsonResponse({ error: 'Сессия недействительна' }, 401);
  }

  let body: { style?: string; sourceText?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Некорректный JSON' }, 400);
  }

  const style = typeof body.style === 'string' ? body.style : '';
  const sourceText = typeof body.sourceText === 'string' ? body.sourceText.trim() : '';

  if (!REWRITE_STYLES.includes(style)) {
    return jsonResponse({ error: 'Неизвестный стиль' }, 400);
  }

  if (!sourceText) {
    return jsonResponse({ error: 'Пустой текст' }, 400);
  }

  if (sourceText.length > MAX_SOURCE_CHARS) {
    return jsonResponse({ error: `Текст длиннее ${MAX_SOURCE_CHARS} символов` }, 400);
  }

  const systemPrompt = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.fix;

  const groqRes = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Текст для редактирования:\n"""\n${sourceText}\n"""`,
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  const raw = await groqRes.text();
  let groqBody: {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string } | string;
  } = {};

  try {
    groqBody = raw ? JSON.parse(raw) : {};
  } catch {
    groqBody = {};
  }

  if (!groqRes.ok) {
    const detail = groqBody?.error;
    const message =
      typeof detail === 'string'
        ? detail
        : typeof detail === 'object' && detail?.message
          ? detail.message
          : 'Ошибка upstream';
    return jsonResponse({ error: message }, 502);
  }

  const out = groqBody?.choices?.[0]?.message?.content ?? '';
  const text = typeof out === 'string' ? out.trim() : '';

  return jsonResponse({ text });
});
