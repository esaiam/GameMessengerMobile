import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { V, SEARCH_FIELD_LAYOUT, SEARCH_CHATS_CAPSULE_RADIUS } from '../theme';
import TabOverscrollFlatList from '../components/TabOverscrollFlatList';
import TabBackground from '../components/TabBackground';
import { ArrowLeft, Trash2 } from '../icons/lucideIcons';
import { useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';
import { profileStackGoBack, useProfileStackBackHandler } from '../lib/profileStackGoBack';
import {
  getCacheSizeInfo,
  listCacheEntriesSorted,
  manualClearCache,
} from '../storage/CacheManager';

const BTN_H = SEARCH_FIELD_LAYOUT.chatsHeight;
const BTN_RADIUS = SEARCH_CHATS_CAPSULE_RADIUS;
const CARD_RADIUS = 12;

function formatBytes(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  const mb = n / (1024 * 1024);
  return mb < 0.01 ? mb.toFixed(3) : mb.toFixed(2);
}

function formatTs(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function CacheEntryRow({ item }) {
  return (
    <View style={styles.entryRow}>
      <Text style={styles.entryUri} numberOfLines={2}>
        {item.uri}
      </Text>
      <Text style={styles.entryMeta}>
        {formatBytes(item.size)} МБ · последний доступ {formatTs(item.lastAccessed)}
      </Text>
    </View>
  );
}

export default function StorageScreen({ navigation }) {
  useProfileStackBackHandler(navigation);
  const headerLayout = useMessengerHeaderLayout();
  const [info, setInfo] = useState({ usedMB: 0, limitMB: 500, percentUsed: 0 });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [i, list] = await Promise.all([getCacheSizeInfo(), listCacheEntriesSorted()]);
      setInfo(i);
      setEntries(list);
    } catch {
      setInfo({ usedMB: 0, limitMB: 500, percentUsed: 0 });
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onManualClear = () => {
    Alert.alert(
      'Очистить кэш?',
      'Будут удалены сохранённые голосовые файлы и превью видео из кэша (до следующего просмотра). Файлы во время воспроизведения не трогаем.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              const r = await manualClearCache();
              await refresh();
              Alert.alert(
                'Готово',
                `Удалено записей: ${r.removedCount}. Освобождено около ${formatBytes(r.freedBytes)} МБ.`,
              );
            } catch (e) {
              Alert.alert('Ошибка', e?.message || 'Не удалось очистить кэш.');
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  const usedRounded = Number.isFinite(info.usedMB) ? info.usedMB.toFixed(2) : '0';
  const percentRounded = Math.round(info.percentUsed);

  return (
    <TabBackground>
      <View style={styles.screen}>
        <View style={[headerLayout.containerStyle, styles.header]}>
          <TouchableOpacity
            onPress={() => profileStackGoBack(navigation)}
            style={[styles.backBtn, { minHeight: headerLayout.contentMinHeight }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} color={V.textSecondary} strokeWidth={1.5} />
            <Text style={styles.backText}>Назад</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Хранилище</Text>
          <Text style={styles.lead}>
            Кэш голосовых сообщений и превью видео. Лимит {info.limitMB} МБ; при уходе приложения в фон
            удаляются файлы старше 14 дней и лишнее по LRU.
          </Text>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color={V.textMuted} />
            </View>
          ) : (
            <>
              <View style={styles.usageCard}>
                <Text style={styles.usageLabel}>Размер кэша</Text>
                <Text style={styles.usageValue}>
                  {usedRounded} МБ из {info.limitMB} МБ
                </Text>
                <View style={styles.usageBarTrack}>
                  <View
                    style={[
                      styles.usageBarFill,
                      { width: `${Math.min(100, Math.max(0, percentRounded))}%` },
                    ]}
                  />
                </View>
                <Text style={styles.usagePercent}>{percentRounded}%</Text>
              </View>

              <TouchableOpacity
                onPress={onManualClear}
                disabled={clearing}
                style={[styles.clearBtn, clearing && styles.clearBtnBusy]}
                activeOpacity={0.85}
              >
                {clearing ? (
                  <ActivityIndicator color={V.dangerMuted} />
                ) : (
                  <>
                    <Trash2 size={18} color={V.dangerMuted} strokeWidth={1.5} />
                    <Text style={styles.clearBtnText}>Очистить кэш сейчас</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>Файлы в кэше ({entries.length})</Text>
              <TabOverscrollFlatList
                style={styles.list}
                data={entries}
                keyExtractor={(item, index) => `${item.uri}-${index}`}
                renderItem={({ item }) => <CacheEntryRow item={item} />}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    Пока нет записей — откройте чат с голосом или видео.
                  </Text>
                }
              />
            </>
          )}
        </View>
      </View>
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: 'transparent',
  },
  backBtn: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: V.textSecondary,
    marginLeft: 8,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: V.textPrimary,
    marginBottom: 8,
  },
  lead: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: V.textSecondary,
    marginBottom: 20,
  },
  loaderWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  usageCard: {
    borderRadius: CARD_RADIUS,
    backgroundColor: V.glassNeutralBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  usageLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: V.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  usageValue: {
    fontSize: 15,
    fontWeight: '500',
    color: V.textPrimary,
    marginBottom: 10,
  },
  usageBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: V.bgSurface,
    overflow: 'hidden',
    marginBottom: 6,
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: V.accentSage,
  },
  usagePercent: {
    fontSize: 12,
    fontWeight: '400',
    color: V.textSecondary,
  },
  clearBtn: {
    height: BTN_H,
    borderRadius: BTN_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.hoverBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    marginBottom: 20,
  },
  clearBtnBusy: {
    opacity: 0.6,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: V.dangerMuted,
    marginLeft: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: V.textSecondary,
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
    color: V.textMuted,
    paddingVertical: 16,
    lineHeight: 20,
  },
  entryRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V.sectionBorder,
  },
  entryUri: {
    fontSize: 11,
    fontWeight: '400',
    color: V.textMuted,
  },
  entryMeta: {
    fontSize: 11,
    fontWeight: '400',
    color: V.textSecondary,
    marginTop: 4,
  },
});
