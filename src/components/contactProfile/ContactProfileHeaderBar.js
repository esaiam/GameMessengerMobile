import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import SafeBlurView from '../SafeBlurView';
import {
  CHAT_HEADER_BLUR_INTENSITY_ANDROID,
  CHAT_HEADER_BLUR_INTENSITY_IOS,
  ICON_SELECTION_ACTION,
} from '../ChatRoomHeader';
import { ArrowLeft, EllipsisVertical, X, Trash2 } from '../../icons/lucideIcons';
import { V } from '../../theme';
import { styles } from '../../screens/contactProfile/contactProfileScreenStyles';

export default function ContactProfileHeaderBar({
  headerLayout,
  mediaSelectionMode,
  selectedCount,
  busy,
  onBack,
  onOpenMenu,
  onExitSelection,
  onDeleteSelected,
}) {
  return (
    <View style={[headerLayout.containerStyle, styles.headerBar]}>
      <SafeBlurView
        intensity={
          Platform.OS === 'ios' ? CHAT_HEADER_BLUR_INTENSITY_IOS : CHAT_HEADER_BLUR_INTENSITY_ANDROID
        }
        tint="dark"
        blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.headerBarFrostTint,
        ]}
      />
      <View
        style={[
          styles.headerNavRow,
          { minHeight: headerLayout.contentMinHeight },
        ]}
      >
        {mediaSelectionMode ? (
          <>
            <TouchableOpacity
              onPress={onExitSelection}
              disabled={busy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Отменить выделение"
              style={styles.headerBackTouch}
            >
              <View style={styles.headerIconWrap}>
                <X size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.headerSelectionCount, { color: V.textPrimary }]}>
              {selectedCount}
            </Text>
            <TouchableOpacity
              onPress={onDeleteSelected}
              disabled={busy || selectedCount === 0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Удалить выбранное"
              style={[
                styles.headerSelectionDeleteTouch,
                (busy || selectedCount === 0) && styles.headerActionDisabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={V.accentSage} />
              ) : (
                <Trash2 size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={onBack}
              disabled={busy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Назад"
              style={[styles.headerBackTouch, busy && styles.headerActionDisabled]}
            >
              <View style={styles.headerIconWrap}>
                <ArrowLeft
                  size={ICON_SELECTION_ACTION}
                  color={V.textPrimary}
                  strokeWidth={1.5}
                />
              </View>
            </TouchableOpacity>
            <View style={styles.headerMenuSlot}>
              <TouchableOpacity
                onPress={onOpenMenu}
                disabled={busy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Меню профиля"
                style={[
                  styles.headerMenuTouch,
                  busy && styles.headerActionDisabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={V.accentSage} />
                ) : (
                  <EllipsisVertical
                    size={ICON_SELECTION_ACTION}
                    color={V.textPrimary}
                    strokeWidth={1.5}
                  />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
