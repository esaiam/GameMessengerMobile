import React from 'react';
import { View, Image } from 'react-native';

/** Фон чата: полный экран (cover), затемняющий слой поверх обоев */
const CHAT_ROOM_WALLPAPER = require('../../../assets/chat-room-wallpaper.jpg');

export default function ChatRoomWallpaper() {
  return (
    <>
      <Image
        pointerEvents="none"
        source={CHAT_ROOM_WALLPAPER}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
        resizeMode="cover"
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
        }}
      />
    </>
  );
}
