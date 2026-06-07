import { supabase } from './supabase';

/** Уведомить подписчиков комнаты (если чат открыт у собеседника). */
export async function broadcastThreadClear(roomId) {
  if (!roomId) return;
  const channel = supabase.channel(`chat-${roomId}`);
  try {
    await new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
      });
    });
    await channel.send({
      type: 'broadcast',
      event: 'vault_thread_clear',
      payload: {},
    });
  } finally {
    supabase.removeChannel(channel);
  }
}
