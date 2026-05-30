import {
  loadRoomMessagesDisk,
  saveRoomMessagesDisk,
  clearRoomMessagesDisk,
} from './roomMessagesDiskCache';

/** In-memory слой; set() также пишет на диск (AsyncStorage). */
const memory = new Map();

const roomMessagesCache = {
  get(roomId) {
    return memory.get(roomId) ?? null;
  },

  set(roomId, messages) {
    if (!roomId) return;
    memory.set(roomId, messages);
    void saveRoomMessagesDisk(roomId, messages);
  },

  clear(roomId) {
    if (!roomId) return;
    memory.delete(roomId);
    void clearRoomMessagesDisk(roomId);
  },

  /** Диск → memory, если in-memory пуст. */
  async hydrateFromDisk(roomId) {
    if (!roomId) return null;
    const existing = memory.get(roomId);
    if (existing?.length) return existing;
    const disk = await loadRoomMessagesDisk(roomId);
    if (disk?.length) {
      memory.set(roomId, disk);
      return disk;
    }
    return null;
  },
};

export default roomMessagesCache;
