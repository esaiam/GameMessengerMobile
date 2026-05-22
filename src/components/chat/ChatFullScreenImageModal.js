import React from 'react';
import { Modal, Pressable, Image, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { X } from '../../icons/lucideIcons';
import { V } from '../../theme';

export default function ChatFullScreenImageModal({ uiReady, uri, onClose }) {
  if (!uiReady) return null;

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tw`flex-1 bg-black items-center justify-center`} onPress={onClose}>
        {uri ? (
          <Image source={{ uri }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
        ) : null}
        <TouchableOpacity
          style={[
            tw`absolute top-12 right-4 rounded-full p-2`,
            { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={onClose}
        >
          <X size={18} color={V.textPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}
