import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import SafeBlurView from './SafeBlurView';
import { V } from '../theme';
import { useAuthGate, NICKNAME_STORAGE_KEY } from '../context/AuthGateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HANDLE_MAX,
  sanitizeHandleSlug,
  validateHandleFormat,
  saveUpdatedProfileHandle } from '../lib/handleProfile';

export default function ProfileEditHandleModal({ visible, onClose, currentHandle, onSaved }) {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile } = useAuthGate();
  const [slug, setSlug] = useState(currentHandle || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setSlug(currentHandle || '');
  }, [visible, currentHandle]);

  const onChangeSlug = (t) => {
    setSlug(sanitizeHandleSlug(t));
  };

  const save = async () => {
    const uid = session?.user?.id;
    if (!uid) {
      Alert.alert('Ошибка', 'Нет сессии. Войдите снова.');
      return;
    }

    const check = validateHandleFormat(slug);
    if (!check.ok) {
      Alert.alert(check.title, check.message);
      return;
    }

    setBusy(true);
    try {
      const result = await saveUpdatedProfileHandle(uid, slug, currentHandle);
      if (result === 'unchanged') {
        onClose();
        return;
      }
      if (result === 'taken') {
        Alert.alert('Занято', 'Этот @handle уже выбран. Придумай другой.');
        return;
      }

      await AsyncStorage.setItem(NICKNAME_STORAGE_KEY, slug);
      await refreshProfile();
      onSaved?.(slug);
      onClose();
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <SafeBlurView
            intensity={20}
            tint="dark"
            style={[
              tw`w-full px-4 pt-5 pb-4`,
              {
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border
              }]}
          >
            <Text style={[tw`text-center mb-4`, { color: V.textPrimary, fontSize: 15, fontWeight: '500' }]}>
              Изменить @handle
            </Text>
            <Text style={[tw`text-center mb-4`, { color: V.textSecondary, fontSize: 12, fontWeight: '400', lineHeight: 18 }]}>
              Латиница в нижнем регистре, цифры и _, до {HANDLE_MAX} символов.
            </Text>
            <View
              style={[
                tw`flex-row items-center rounded-[10px] px-3 mb-4`,
                { backgroundColor: V.bgElevated, borderWidth: 0.5, borderColor: V.border }]}
            >
              <Text style={{ color: V.textMuted, fontSize: 13, fontWeight: '500' }}>@</Text>
              <TextInput
                style={[tw`flex-1 py-3 px-1`, { color: V.textPrimary, fontSize: 16 }]}
                placeholder="username"
                placeholderTextColor={V.textGhost}
                value={slug}
                onChangeText={onChangeSlug}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={HANDLE_MAX}
                editable={!busy}
              />
            </View>
            <TouchableOpacity
              style={[
                tw`rounded-[10px] py-3.5 items-center`,
                {
                  backgroundColor: V.btnPrimaryBg,
                  borderWidth: 0.5,
                  borderColor: V.accentSage,
                  opacity: busy || !slug ? 0.5 : 1,
                },
              ]}
              onPress={save}
              disabled={busy || !slug}
              activeOpacity={0.7}
            >
              {busy ? (
                <ActivityIndicator color={V.accentSage} />
              ) : (
                <Text style={{ color: V.accentSage, fontSize: 13, fontWeight: '500' }}>Сохранить</Text>
              )}
            </TouchableOpacity>
          </SafeBlurView>
          <TouchableOpacity onPress={onClose} style={tw`py-3 items-center`} activeOpacity={0.7}>
            <Text style={{ color: V.textSecondary, fontSize: 13, fontWeight: '400' }}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    width: '100%',
    paddingHorizontal: 16 } });
