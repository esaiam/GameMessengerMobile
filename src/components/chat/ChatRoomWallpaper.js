import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import {
  getChatWallpaperEnabled,
  subscribeProfileSettings } from '../../lib/profileSettings';

/** Фон чата: полный экран (cover), затемняющий слой поверх обоев */
const CHAT_ROOM_WALLPAPER = require('../../../assets/chat-room-wallpaper.jpg');

export default function ChatRoomWallpaper() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getChatWallpaperEnabled().then((v) => {
      if (!cancelled) setEnabled(v);
    });
    const unsub = subscribeProfileSettings(() => {
      getChatWallpaperEnabled().then((v) => {
        if (!cancelled) setEnabled(v);
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!enabled) return null;

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
          zIndex: 0 }}
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
          backgroundColor: 'rgba(0,0,0,0.65)' }}
      />
    </>
  );
}
