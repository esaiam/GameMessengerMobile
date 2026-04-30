import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ChevronDown,
  Copy,
  Forward,
  Pin,
  Reply,
  Trash2,
} from '../../icons/lucideIcons';
import { V } from '../../theme';

const REACTIONS = ['❤️', '👍', '🔥', '😁', '😢', '👏', '🙏'] as const;

/** Геометрия ряда реакций — ширина плашки = паддинги + ряд + chevron */
const REACTION_EMOJI_CELL = 30;
const REACTION_ROW_H = 34;
const REACTION_GAP_X = 1;
const REACTION_CHEVRON = 26;
const REACTION_CARD_PAD_H = 10; // paddingHorizontal карточки 5+5
/** Небольшой запас ширины плашки над расчётом по контенту */
const REACTION_BAR_EXTRA_W = 4;

/** Высота плашки для top (paddingVertical 7+7 + ряд) */
const REACTIONS_HEIGHT = 48;

/** Примерная высота меню (реакции ~56 + 5 строк * 48 + паддинги) — используется только для выбора top/bottom */
const APPROX_MENU_HEIGHT = 310;
const EDGE_PADDING = 12;
const ANCHOR_OFFSET = 8;

export type MessageContextMenuPosition = { x: number; y: number };

export type MessageContextMenuProps = {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onPin: () => void;
  onDelete: () => void;
  position: MessageContextMenuPosition;
};

const ICON_PROPS = {
  size: 20,
  color: V.textSecondary,
  strokeWidth: 1.5,
} as const;

function ScalePress({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      friction: 6,
      tension: 320,
    }).start();

  return (
    <Pressable
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
      onPress={onPress}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

export default function MessageContextMenu({
  visible,
  onClose,
  onReply,
  onCopy,
  onForward,
  onPin,
  onDelete,
  position,
}: MessageContextMenuProps) {
  const [rendered, setRendered] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 40,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (!rendered) return;
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [visible, rendered, scaleAnim, opacityAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRendered(false);
        onClose();
      }
    });
  };

  const { width, height } = Dimensions.get('window');
  const menuWidth = width * 0.5;
  const isBottomHalf = position.y > height / 2;
  const top = isBottomHalf
    ? Math.max(EDGE_PADDING, position.y - APPROX_MENU_HEIGHT - ANCHOR_OFFSET)
    : position.y + ANCHOR_OFFSET;
  /** Плашка по ширине контента (смайлики + chevron), не шире экрана */
  const reactionsContentW =
    REACTIONS.length * REACTION_EMOJI_CELL +
    REACTIONS.length * REACTION_GAP_X +
    REACTION_CHEVRON;
  const reactionsWidth = Math.min(
    width - EDGE_PADDING * 2,
    reactionsContentW + REACTION_CARD_PAD_H + REACTION_BAR_EXTRA_W,
  );
  const centerXMin = EDGE_PADDING + reactionsWidth / 2;
  const centerXMax = width - EDGE_PADDING - reactionsWidth / 2;
  const centerX = Math.min(Math.max(position.x, centerXMin), centerXMax);
  const menuLeft = centerX - menuWidth / 2;
  const reactionsLeft = centerX - reactionsWidth / 2;

  const run = (fn: () => void) => {
    fn();
    handleClose();
  };

  if (!rendered) return null;

  const animStyle = {
    opacity: opacityAnim,
    transform: [{ scale: scaleAnim }],
  };
  const menuStyle = {
    top,
    left: menuLeft,
    width: menuWidth,
  };
  const reactionsStyle = {
    top: top - REACTIONS_HEIGHT - 6,
    left: reactionsLeft,
    width: reactionsWidth,
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть меню"
          style={[StyleSheet.absoluteFillObject, styles.backdropTint]}
          onPress={handleClose}
        />
        <Animated.View style={[styles.reactionsFloat, reactionsStyle, animStyle]}>
          <View style={[styles.reactionsCard, { width: reactionsWidth }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reactionsScroll}
            >
              {REACTIONS.map((emoji) => (
                <ScalePress key={emoji} style={styles.reactionHit}>
                  <View style={styles.reactionInner}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </View>
                </ScalePress>
              ))}
              <ScalePress
                style={styles.reactionHit}
                onPress={() => {
                  /* показать все реакции */
                }}
              >
                <View style={styles.chevronCircle}>
                  <ChevronDown size={16} color={V.textSecondary} strokeWidth={1.5} />
                </View>
              </ScalePress>
            </ScrollView>
          </View>
        </Animated.View>

        <Animated.View style={[styles.sheetWrap, menuStyle, animStyle]}>
          <View style={styles.sheet}>
            <MenuRow
              icon={<Reply {...ICON_PROPS} />}
              label="Ответить"
              onPress={() => run(onReply)}
            />
            <View style={styles.rowDivider} />
            <MenuRow
              icon={<Copy {...ICON_PROPS} />}
              label="Копировать"
              onPress={() => run(onCopy)}
            />
            <View style={styles.rowDivider} />
            <MenuRow
              icon={<Forward {...ICON_PROPS} />}
              label="Переслать"
              onPress={() => run(onForward)}
            />
            <View style={styles.rowDivider} />
            <MenuRow
              icon={<Pin {...ICON_PROPS} />}
              label="Закрепить"
              onPress={() => run(onPin)}
            />
            <View style={styles.rowDivider} />
            <MenuRow
              icon={<Trash2 size={20} color={V.dangerMuted} strokeWidth={1.5} />}
              label="Удалить"
              danger
              onPress={() => run(onDelete)}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const textColor = danger ? V.dangerMuted : V.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.row, pressed && styles.rowPressed]}
    >
      {icon}
      <Text style={[styles.rowLabel, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdropTint: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: {
    position: 'absolute',
  },
  reactionsFloat: {
    position: 'absolute',
  },
  reactionsCard: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 5,
    backgroundColor: V.bgElevated,
  },
  sheet: {
    width: '100%',
    backgroundColor: V.bgElevated,
    borderRadius: 16,
    overflow: 'hidden',
  },
  reactionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: REACTION_GAP_X,
    paddingHorizontal: 0,
  },
  reactionHit: {
    minWidth: REACTION_EMOJI_CELL,
    minHeight: REACTION_ROW_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionInner: {
    width: REACTION_EMOJI_CELL,
    height: REACTION_ROW_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  chevronCircle: {
    width: REACTION_CHEVRON,
    height: REACTION_CHEVRON,
    borderRadius: REACTION_CHEVRON / 2,
    backgroundColor: V.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 14,
  },
  rowPressed: {
    backgroundColor: V.hoverBg,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '400',
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: V.border,
  },
});
