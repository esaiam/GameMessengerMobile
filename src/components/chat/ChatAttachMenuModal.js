import React from 'react';
import {
  Modal,
  Pressable,
  TouchableOpacity,
  View,
  Text,
  Platform,
  StyleSheet,
} from 'react-native';
import tw from 'twrnc';
import SafeBlurView from '../SafeBlurView';
import { Camera, ImageIcon, MapPin, Timer } from '../../icons/lucideIcons';
import { V } from '../../theme';

const EPHEMERAL_OPTIONS = [
  { label: 'Выкл', value: null },
  { label: '5с', value: 5 },
  { label: '30с', value: 30 },
  { label: '1м', value: 60 },
  { label: '5м', value: 300 },
];

/** Нижний sheet: камера / галерея / гео + выбор таймера сгорающих сообщений */
export default function ChatAttachMenuModal({
  uiReady,
  visible,
  onClose,
  takePhoto,
  pickImageFromGallery,
  sendCurrentLocation,
  ephemeralSec,
  setEphemeralSec,
}) {
  if (!uiReady) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={[tw`flex-1 justify-end`, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
        onPress={onClose}
      >
        <Pressable style={[tw`rounded-t-[20px] px-6 pt-4 pb-8`, { overflow: 'hidden' }]}>
          <SafeBlurView
            intensity={20}
            tint="dark"
            blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border,
              },
            ]}
          />
          <View style={[tw`w-10 h-1 rounded-full self-center mb-5`, { backgroundColor: V.textGhost }]} />

          <View style={tw`flex-row justify-around mb-6`}>
            <TouchableOpacity onPress={takePhoto} style={tw`items-center`}>
              <View
                style={[
                  tw`w-14 h-14 rounded-full items-center justify-center mb-2`,
                  { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
                ]}
              >
                <Camera size={20} color={V.textSecondary} strokeWidth={1.5} />
              </View>
              <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>Камера</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={pickImageFromGallery} style={tw`items-center`}>
              <View
                style={[
                  tw`w-14 h-14 rounded-full items-center justify-center mb-2`,
                  { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
                ]}
              >
                <ImageIcon size={20} color={V.textSecondary} strokeWidth={1.5} />
              </View>
              <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>Галерея</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={sendCurrentLocation} style={tw`items-center`}>
              <View
                style={[
                  tw`w-14 h-14 rounded-full items-center justify-center mb-2`,
                  { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
                ]}
              >
                <MapPin size={20} color={V.textSecondary} strokeWidth={1.5} />
              </View>
              <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>Геолокация</Text>
            </TouchableOpacity>
          </View>

          <View style={[tw`pt-4`, { borderTopWidth: 0.5, borderTopColor: V.border }]}>
            <View style={tw`flex-row items-center justify-center mb-2`}>
              <Timer size={14} color={V.textSecondary} strokeWidth={1.5} style={tw`mr-1`} />
              <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>
                Сгорающие сообщения
                {ephemeralSec
                  ? ` (${EPHEMERAL_OPTIONS.find((o) => o.value === ephemeralSec)?.label})`
                  : ''}
              </Text>
            </View>
            <View style={tw`flex-row justify-center gap-2`}>
              {EPHEMERAL_OPTIONS.map((opt) => {
                const active = ephemeralSec === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    onPress={() => {
                      setEphemeralSec(opt.value);
                      onClose();
                    }}
                    style={[
                      tw`px-3 py-2 rounded-[10px]`,
                      {
                        backgroundColor: active ? V.btnPrimaryBg : V.bgSurface,
                        borderWidth: 0.5,
                        borderColor: active ? V.accentSage : V.border,
                      },
                    ]}
                  >
                    <Text style={[tw`text-[10px] font-medium`, { color: active ? V.accentSage : V.textSecondary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
