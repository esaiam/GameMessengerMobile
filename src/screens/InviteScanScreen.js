import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import tw from 'twrnc';
import { V } from '../theme';
import { ArrowLeft } from '../icons/lucideIcons';
import { parseInviteQrPayload } from '../utils/inviteDeepLink';

export default function InviteScanScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [hint, setHint] = useState(null);

  const finishWithCode = useCallback(
    (code) => {
      if (!code) {
        setHint('Не удалось извлечь код из QR.');
        scannedRef.current = false;
        return;
      }
      navigation.navigate({
        name: 'Auth',
        params: { scannedCode: code },
        merge: true });
      navigation.goBack();
    },
    [navigation]
  );

  const onBarcodeScanned = useCallback(
    (result) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      const raw = result?.data ?? '';
      const code = parseInviteQrPayload(raw);
      finishWithCode(code);
    },
    [finishWithCode]
  );

  const askPermission = async () => {
    const r = await requestPermission();
    if (!r?.granted) {
      Alert.alert('Камера', 'Нужен доступ к камере, чтобы сканировать QR.');
    }
  };

  if (!permission) {
    return (
      <View style={[styles.fill, { backgroundColor: V.bgApp, paddingTop: insets.top + 12 }]}>
        <Text style={[tw`text-[13px] px-4`, { color: V.textSecondary }]}>Проверка доступа к камере…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fill, { backgroundColor: V.bgApp, paddingTop: insets.top + 12, paddingHorizontal: 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={tw`flex-row items-center mb-6 py-2`}>
          <ArrowLeft size={18} color={V.textSecondary} strokeWidth={1.5} />
          <Text style={[tw`text-[14px] font-medium ml-2`, { color: V.textSecondary }]}>Назад</Text>
        </TouchableOpacity>
        <Text style={[tw`text-[15px] font-medium mb-2`, { color: V.textPrimary }]}>Доступ к камере</Text>
        <Text style={[tw`text-[13px] mb-6`, { color: V.textSecondary, lineHeight: 20 }]}>
          Разрешите камеру, чтобы считать QR с кодом приглашения.
        </Text>
        <TouchableOpacity
          onPress={askPermission}
          style={[
            tw`rounded-[10px] py-3.5 items-center`,
            { backgroundColor: V.btnPrimaryBg, borderWidth: 0.5, borderColor: V.accentSage }]}
        >
          <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>Разрешить камеру</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onBarcodeScanned}
      />
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 12 }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            tw`self-start flex-row items-center py-2 px-3 rounded-[10px]`,
            { backgroundColor: 'rgba(13,15,20,0.65)' }]}
        >
          <ArrowLeft size={18} color={V.textPrimary} strokeWidth={1.5} />
          <Text style={[tw`text-[14px] font-medium ml-2`, { color: V.textPrimary }]}>Назад</Text>
        </TouchableOpacity>
        <View style={tw`flex-1`} />
        <View
          style={[
            tw`rounded-[12px] px-3 py-3`,
            { backgroundColor: 'rgba(13,15,20,0.75)' }]}
        >
          <Text style={[tw`text-[12px] text-center`, { color: V.textSecondary, lineHeight: 18 }]}>
            Наведи на QR приглашения. Поддерживается ссылка vaultmessenger://invite?code=… или просто код.
          </Text>
          {hint ? (
            <Text style={[tw`text-[12px] text-center mt-2`, { color: V.accentGold }]}>{hint}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: V.bgApp } });
