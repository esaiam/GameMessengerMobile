import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS } from 'react-native-reanimated';
import { V } from '../../theme';
import { ChevronLeft, ChevronRight, X } from '../../icons/lucideIcons';

const SPRING_CONFIG = { damping: 24, stiffness: 300, mass: 0.7 };

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function buildDayKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** getDay() returns 0=Sun…6=Sat, convert to 0=Mon…6=Sun */
function getFirstDayOfWeek(year, month) {
  const raw = new Date(year, month, 1).getDay();
  return (raw + 6) % 7;
}

/**
 * @param {boolean} visible
 * @param {{ x: number, y: number, width: number, height: number } | null} anchor
 * @param {string | null} initialDateKey - 'YYYY-MM-DD' дата тапнутого разделителя
 * @param {Set<string>} daysWithMessages
 * @param {(dateKey: string) => void} onDayPress
 * @param {() => void} onClose
 */
export default function ChatCalendarOverlay({
  visible,
  anchor,
  initialDateKey,
  daysWithMessages,
  onDayPress,
  onClose }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Держим компонент смонтированным во время анимации закрытия
  const [mounted, setMounted] = useState(false);

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  const progress = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  // При открытии фиксируем anchor и начальный месяц
  useEffect(() => {
    if (visible) {
      const d = initialDateKey ? new Date(initialDateKey + 'T00:00:00') : new Date();
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());

      const anchorCX = anchor ? anchor.x + anchor.width / 2 : screenW / 2;
      const anchorCY = anchor ? anchor.y + anchor.height / 2 : screenH / 2;
      originX.value = anchorCX - screenW / 2;
      originY.value = anchorCY - screenH / 2;

      setMounted(true);
      progress.value = withSpring(1, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      progress.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(0, { duration: 180 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const overlayAnimStyle = useAnimatedStyle(() => {
    const tx = originX.value * (1 - progress.value);
    const ty = originY.value * (1 - progress.value);
    const s = 0.02 + 0.98 * progress.value;
    return {
      opacity: progress.value < 0.02 ? 0 : 1,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: s }] };
  });

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value }));

  const minDateKey = useMemo(() => {
    if (!daysWithMessages || daysWithMessages.size === 0) return null;
    return [...daysWithMessages].sort()[0];
  }, [daysWithMessages]);

  const isPrevAllowed = useCallback(() => {
    if (!minDateKey) return false;
    const minYear = parseInt(minDateKey.slice(0, 4), 10);
    const minMonth = parseInt(minDateKey.slice(5, 7), 10) - 1;
    if (currentYear > minYear) return true;
    return currentYear === minYear && currentMonth > minMonth;
  }, [minDateKey, currentYear, currentMonth]);

  const isNextAllowed = useCallback(() => {
    const now = new Date();
    if (currentYear < now.getFullYear()) return true;
    return currentYear === now.getFullYear() && currentMonth < now.getMonth();
  }, [currentYear, currentMonth]);

  const goPrevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }, [currentMonth]);

  const goNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }, [currentMonth]);

  if (!mounted && !visible) return null;

  const today = new Date();
  const todayKey = buildDayKey(today.getFullYear(), today.getMonth(), today.getDate());
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth);

  const prevOk = isPrevAllowed();
  const nextOk = isNextAllowed();

  // Ячейки: null = пустышка, число = день
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const cardWidth = Math.min(screenW - 32, 360);

  return (
    <Modal
      visible={visible || mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Reanimated.View
        style={[
          {
            position: 'absolute',
            left: 0, top: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.36)' },
          backdropAnimStyle]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Reanimated.View>

      {/* Карточка календаря — растёт из точки тапа */}
      <Reanimated.View
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            left: 0, top: 0, right: 0, bottom: 0,
            justifyContent: 'center',
            alignItems: 'center' },
          overlayAnimStyle]}
      >
        <View
          style={{
            width: cardWidth,
            backgroundColor: V.bgSurface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: V.border,
            overflow: 'hidden' }}
        >
          {/* Шапка: месяц + стрелки + закрыть */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingTop: 14,
              paddingBottom: 6 }}
          >
            <Pressable
              onPress={goPrevMonth}
              disabled={!prevOk}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <ChevronLeft
                size={18}
                color={prevOk ? V.textSecondary : V.textGhost}
                strokeWidth={1.5}
              />
            </Pressable>

            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                color: V.textPrimary,
                fontSize: 14,
                fontWeight: '500'}}
            >
              {MONTHS_RU[currentMonth]} {currentYear}
            </Text>

            <Pressable
              onPress={goNextMonth}
              disabled={!nextOk}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <ChevronRight
                size={18}
                color={nextOk ? V.textSecondary : V.textGhost}
                strokeWidth={1.5}
              />
            </Pressable>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{ padding: 4, marginLeft: 4 }}
            >
              <X size={16} color={V.textMuted} strokeWidth={1.5} />
            </Pressable>
          </View>

          {/* Дни недели */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 8,
              paddingBottom: 2 }}
          >
            {WEEKDAYS.map((d) => (
              <Text
                key={d}
                style={{
                  width: `${100 / 7}%`,
                  textAlign: 'center',
                  fontSize: 10,
                  color: V.textMuted,
                  fontWeight: '400',
                  paddingVertical: 4 }}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Сетка дней */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              paddingHorizontal: 8,
              paddingBottom: 14 }}
          >
            {cells.map((day, i) => {
              if (!day) {
                return (
                  <View
                    key={`e${i}`}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1 }}
                  />
                );
              }
              const key = buildDayKey(currentYear, currentMonth, day);
              const isToday = key === todayKey;
              const isSelected = key === initialDateKey;
              const hasMsg = daysWithMessages.has(key);

              return (
                <Pressable
                  key={key}
                  onPress={() => onDayPress(key)}
                  style={{
                    width: `${100 / 7}%`,
                    aspectRatio: 1,
                    justifyContent: 'center',
                    alignItems: 'center' }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: isSelected
                        ? 'rgba(90,158,154,0.18)'
                        : isToday
                        ? 'rgba(255,255,255,0.05)'
                        : 'transparent',
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: V.accentSage }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '400',
                        color: isSelected
                          ? V.accentSage
                          : isToday
                          ? V.textPrimary
                          : hasMsg
                          ? V.textPrimary
                          : V.textMuted}}
                    >
                      {day}
                    </Text>
                  </View>
                  {/* Точка — есть сообщения в этот день */}
                  {hasMsg && !isSelected && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: V.accentSage }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Нижний отступ под safe area */}
          {insets.bottom > 0 && <View style={{ height: Math.min(insets.bottom, 16) }} />}
        </View>
      </Reanimated.View>
    </Modal>
  );
}
