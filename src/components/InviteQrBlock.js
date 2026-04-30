import React from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import tw from 'twrnc';
import { V } from '../theme';
import { buildInviteQrPayload } from '../utils/inviteDeepLink';

const QR_SIZE = 200;

/**
 * QR для одного invite code (канонический slug из БД).
 */
export default function InviteQrBlock({ code }) {
  const payload = buildInviteQrPayload(code);
  if (!payload) return null;

  return (
    <View
      style={[
        tw`items-center py-3 px-2 mb-2 rounded-[12px]`,
        {
          backgroundColor: V.bgElevated,
          borderWidth: 0.5,
          borderColor: V.border,
        },
      ]}
    >
      <Text style={[tw`text-[11px] mb-2 text-center px-1`, { color: V.textMuted, lineHeight: 16 }]}>
        Покажи другу для регистрации. В QR — ссылка вида vaultmessenger://invite?code=… (тот же код, что в
        списке).
      </Text>
      <View style={[tw`rounded-[10px] overflow-hidden p-2`, { backgroundColor: V.bgSurface }]}>
        <QRCode
          value={payload}
          size={QR_SIZE}
          backgroundColor={V.bgSurface}
          color={V.textPrimary}
        />
      </View>
    </View>
  );
}
