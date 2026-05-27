import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet } from 'react-native';
import { V } from '../theme';
import { useAuthGate } from '../context/AuthGateContext';
import { writeNicknameToStorage } from '../lib/nicknameStorage';
import {
  HANDLE_MAX,
  sanitizeHandleSlug,
  validateHandleFormat,
  saveUpdatedProfileHandle } from '../lib/handleProfile';
import ProfileGlassModal from './ProfileGlassModal';
import { profileModalBtnStyles as btn } from './profileModalButtonStyles';

export default function ProfileEditHandleModal({ visible, onClose, currentHandle, onSaved }) {
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

      await writeNicknameToStorage(slug);
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
    <ProfileGlassModal visible={visible} onClose={onClose} keyboardAvoiding>
      <Text style={styles.title}>Изменить @handle</Text>
      <Text style={styles.hint}>
        Латиница в нижнем регистре, цифры и _, до {HANDLE_MAX} символов.
      </Text>
      <View style={styles.inputWrap}>
        <Text style={styles.at}>@</Text>
        <TextInput
          style={styles.input}
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
        style={[btn.btn, (busy || !slug) && styles.saveBtnDisabled]}
        onPress={save}
        disabled={busy || !slug}
        activeOpacity={0.7}
      >
        {busy ? (
          <ActivityIndicator color={V.textSecondary} />
        ) : (
          <Text style={btn.btnText}>Сохранить</Text>
        )}
      </TouchableOpacity>
    </ProfileGlassModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: V.textPrimary,
    textAlign: 'center',
    marginBottom: 6 },
  hint: {
    fontSize: 12,
    fontWeight: '400',
    color: V.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: V.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border },
  at: {
    color: V.textMuted,
    fontSize: 13,
    fontWeight: '500' },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    color: V.textPrimary,
    fontSize: 16 },
  saveBtnDisabled: {
    opacity: 0.5 } });
