import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Animated,
  Alert,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import SafeBlurView from './SafeBlurView';
import { Camera, Image as ImageIcon, Trash2 } from '../icons/lucideIcons';
import { V } from '../theme';
import { UserAvatar } from './UserAvatar';
import { useLocalAvatar } from '../context/LocalAvatarContext';

const ROW_PAD = { paddingVertical: 14 };
const DIVIDER = { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' };

export default function ProfileAvatarModal({ visible, onClose, nickname }) {
  const insets = useSafeAreaInsets();
  const { avatarUri, savePickedUri, removeAvatar } = useLocalAvatar();
  const slideAnim = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(320);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
    }
  }, [visible, slideAnim]);

  const pick = async (fromCamera) => {
    const options = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    };
    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        await savePickedUri(asset.uri);
        onClose();
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить фото.');
    }
  };

  const handleRemove = async () => {
    await removeAvatar();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <SafeBlurView
            intensity={20}
            tint="dark"
            style={[
              tw`w-full`,
              {
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border,
                paddingHorizontal: 16,
                paddingTop: 20,
                paddingBottom: 16,
              },
            ]}
          >
            <Text
              style={[
                tw`text-center mb-5`,
                { color: V.textPrimary, fontSize: 15, fontWeight: '500' },
              ]}
            >
              Фото профиля
            </Text>

            <View style={tw`items-center mb-5`}>
              <UserAvatar name={nickname} uri={avatarUri} size={80} />
            </View>

            <TouchableOpacity
              style={[tw`flex-row items-center`, ROW_PAD, DIVIDER]}
              onPress={() => pick(true)}
              activeOpacity={0.7}
            >
              <Camera size={16} color={V.accentSage} strokeWidth={1.5} />
              <Text style={[tw`ml-3 flex-1`, { color: V.textPrimary, fontSize: 14, fontWeight: '400' }]}>
                Сделать фото
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[tw`flex-row items-center`, ROW_PAD, DIVIDER]}
              onPress={() => pick(false)}
              activeOpacity={0.7}
            >
              <ImageIcon size={16} color={V.accentSage} strokeWidth={1.5} />
              <Text style={[tw`ml-3 flex-1`, { color: V.textPrimary, fontSize: 14, fontWeight: '400' }]}>
                Выбрать из галереи
              </Text>
            </TouchableOpacity>

            {!!avatarUri && (
              <TouchableOpacity
                style={[tw`flex-row items-center`, ROW_PAD]}
                onPress={handleRemove}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#E24B4A" strokeWidth={1.5} />
                <Text style={[tw`ml-3 flex-1`, { color: V.textPrimary, fontSize: 14, fontWeight: '400' }]}>
                  Удалить фото
                </Text>
              </TouchableOpacity>
            )}
          </SafeBlurView>

          <TouchableOpacity onPress={onClose} style={tw`py-3 items-center`} activeOpacity={0.7}>
            <Text style={{ color: V.textSecondary, fontSize: 13, fontWeight: '400' }}>Отмена</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    width: '100%',
  },
});
