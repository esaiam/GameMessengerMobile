import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload?.record;

    if (!record?.id || !record?.room_id || !record?.player_name) {
      return new Response('invalid payload', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: room } = await supabase
      .from('rooms')
      .select('user1_id, user2_id')
      .eq('id', record.room_id)
      .maybeSingle();

    if (!room) return new Response('room not found', { status: 404 });

    const recipientHandle =
      room.user1_id === record.player_name ? room.user2_id : room.user1_id;

    if (!recipientHandle) return new Response('no recipient', { status: 200 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('handle', recipientHandle)
      .maybeSingle();

    const pushToken = profile?.push_token;
    if (!pushToken) return new Response('no push token', { status: 200 });

    const { data: alreadySent } = await supabase
      .from('push_dedup')
      .select('id')
      .eq('message_id', record.id)
      .maybeSingle();

    if (alreadySent) return new Response('duplicate', { status: 200 });

    await supabase.from('push_dedup').insert({ message_id: record.id });

    const body =
      record.message_type === 'voice'
        ? '🎤 Голосовое сообщение'
        : record.message_type === 'video'
        ? '📹 Видеосообщение'
        : record.message_type === 'image'
        ? '🖼 Фото'
        : record.text || 'Новое сообщение';

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title: record.player_name || 'Vault',
        body,
        data: { roomId: record.room_id },
        sound: 'default',
      }),
    });

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 500 });
  }
});
