import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Trash2 } from '../icons/lucideIcons';
import { V } from '../theme';
import { UserAvatar } from './UserAvatar';
import { useLocalAvatar } from '../context/LocalAvatarContext';
import { profileAvatarSaveErrorMessage } from '../lib/profileAvatarUpload';
import ProfileGlassModal from './ProfileGlassModal';
import { profileModalBtnStyles as btn } from './profileModalButtonStyles';

export default function ProfileAvatarModal({ visible, onClose, nickname }) {
  const { avatarUri, savePickedUri, removeAvatar, uploading } = useLocalAvatar();

  const pick = async (fromCamera) => {
    if (uploading) return;
    const options = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9 };
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
    } catch (e) {
      Alert.alert('Ошибка', profileAvatarSaveErrorMessage(e?.message));
    }
  };

  const handleRemove = async () => {
    await removeAvatar();
    onClose();
  };

  return (
    <ProfileGlassModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>Фото профиля</Text>

      <View style={styles.avatarWrap}>
        <UserAvatar name={nickname} uri={avatarUri} size={64} />
      </View>

      <View style={btn.stack}>
        <TouchableOpacity
          style={[btn.btn, btn.btnRow, uploading && { opacity: 0.5 }]}
          onPress={() => pick(true)}
          disabled={uploading}
          activeOpacity={0.7}
        >
          <Camera size={16} color={V.accentSage} strokeWidth={1.5} />
          <Text style={btn.btnText}>Сделать фото</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[btn.btn, btn.btnRow, uploading && { opacity: 0.5 }]}
          onPress={() => pick(false)}
          disabled={uploading}
          activeOpacity={0.7}
        >
          <ImageIcon size={16} color={V.accentSage} strokeWidth={1.5} />
          <Text style={btn.btnText}>Выбрать из галереи</Text>
        </TouchableOpacity>

        {!!avatarUri && (
          <TouchableOpacity
            style={[btn.btn, btn.btnRow]}
            onPress={handleRemove}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color={V.dangerMuted} strokeWidth={1.5} />
            <Text style={btn.btnTextDanger}>Удалить фото</Text>
          </TouchableOpacity>
        )}
      </View>
    </ProfileGlassModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: V.textPrimary,
    textAlign: 'center',
    marginBottom: 10 },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 10 } });
