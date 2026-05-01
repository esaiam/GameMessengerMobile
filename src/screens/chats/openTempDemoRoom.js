import { supabase } from '../../lib/supabase';
import { normalizeUserPair } from '../../utils/roomIds';

/**
 * Создаёт или открывает демо-комнату с peer `demo` ( нарды self-play ).
 */
export async function openTempDemoRoom({ nickname, navigation, generateRoomCode }) {
  const demoId = 'demo';
  const { user1Id, user2Id, roomId } = normalizeUserPair(nickname, demoId);
  const code = generateRoomCode();

  try {
    const { data: existing, error: selErr } = await supabase
      .from('rooms')
      .select('id, code, user1_id, user2_id')
      .eq('id', roomId)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);

    let room = existing;
    if (!room) {
      const { data: created, error: insErr } = await supabase
        .from('rooms')
        .upsert({ id: roomId, code, user1_id: user1Id, user2_id: user2Id }, { onConflict: 'id' })
        .select('id, code, user1_id, user2_id')
        .single();
      if (insErr) throw new Error(insErr.message);
      room = created;
    }

    navigation.navigate('Room', {
      roomId: room.id,
      nickname,
      peerName: demoId,
      playerNumber: room.user1_id === nickname ? 1 : 2,
      selfPlay: true,
    });
  } catch (modernErr) {
    const { data: createdLegacy, error: legacyErr } = await supabase
      .from('rooms')
      .insert({
        code,
        player1_name: nickname,
        player2_name: demoId,
        status: 'playing',
      })
      .select('id, code, player1_name, player2_name')
      .single();
    if (legacyErr) throw new Error(legacyErr.message || modernErr?.message);

    navigation.navigate('Room', {
      roomId: createdLegacy.id,
      nickname,
      peerName: demoId,
      playerNumber: createdLegacy.player1_name === nickname ? 1 : 2,
      selfPlay: true,
    });
  }
}
