import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import tw from 'twrnc';
import { V } from '../theme';
import TabOverscrollFlatList from '../components/TabOverscrollFlatList';
import TabBackground from '../components/TabBackground';
import { ArrowLeft, Trash2 } from '../icons/lucideIcons';
import { useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';
import { profileStackGoBack, useProfileStackBackHandler } from '../lib/profileStackGoBack';
import {
  getCacheSizeInfo,
  listCacheEntriesSorted,
  manualClearCache } from '../storage/CacheManager';

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
      minute: '2-digit' });
  } catch {
    return '—';
  }
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
    }, [refresh])
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
                `Удалено записей: ${r.removedCount}. Освобождено около ${formatBytes(r.freedBytes)} МБ.`
              );
            } catch (e) {
              Alert.alert('Ошибка', e?.message || 'Не удалось очистить кэш.');
            } finally {
              setClearing(false);
            }
          } }]
    );
  };

  const renderEntry = ({ item }) => (
    <View
      style={[
        tw`py-2 border-b`,
        { borderBottomWidth: 0.5, borderBottomColor: V.border }]}
    >
      <Text style={[tw`text-[11px]`, { color: V.textMuted }]} numberOfLines={2}>
        {item.uri}
      </Text>
      <Text style={[tw`text-[11px] mt-1`, { color: V.textSecondary }]}>
        {formatBytes(item.size)} МБ · последний доступ {formatTs(item.lastAccessed)}
      </Text>
    </View>
  );

  const usedRounded = Number.isFinite(info.usedMB) ? info.usedMB.toFixed(2) : '0';

  return (
    <TabBackground>
      <View style={[tw`flex-1`, {backgroundColor: 'transparent'}]}>
        <View style={[headerLayout.containerStyle, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity
            onPress={() => profileStackGoBack(navigation)}
            style={{
              minHeight: headerLayout.contentMinHeight,
              justifyContent: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={18} color={V.textSecondary} strokeWidth={1.5} />
            <Text style={[tw`text-[14px] font-medium ml-2`, { color: V.textSecondary }]}>Назад</Text>
          </TouchableOpacity>
        </View>

        <View style={tw`flex-1 px-4`}>
          <Text style={[tw`text-[17px] font-medium mb-2`, { color: V.textPrimary }]}>Хранилище</Text>
          <Text style={[tw`text-[13px] mb-4`, { color: V.textSecondary, lineHeight: 18 }]}>
            Кэш голосовых сообщений и превью видео. Лимит {info.limitMB} МБ; при уходе приложения в фон
            удаляются файлы старше 14 дней и лишнее по LRU.
          </Text>

          {loading ? (
            <View style={tw`py-6 items-center`}>
              <ActivityIndicator color={V.textMuted} />
            </View>
          ) : (
            <>
              <Text style={[tw`text-[14px] mb-1`, { color: V.textPrimary }]}>
                Размер кэша: {usedRounded} МБ из {info.limitMB} МБ ({Math.round(info.percentUsed)}%)
              </Text>

              <TouchableOpacity
                onPress={onManualClear}
                disabled={clearing}
                style={[
                  tw`rounded-[10px] py-3.5 items-center flex-row justify-center mt-4 mb-5`,
                  {
                    backgroundColor: V.bgSurface,
                    borderWidth: 0.5,
                    borderColor: V.border,
                    opacity: clearing ? 0.6 : 1 }]}
              >
                {clearing ? (
                  <ActivityIndicator color={V.accentSage} />
                ) : (
                  <>
                    <Trash2 size={20} color={V.accentSage} strokeWidth={1.5} />
                    <Text style={[tw`text-[13px] font-medium ml-2`, { color: V.accentSage }]}>
                      Очистить кэш сейчас
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={[tw`text-[12px] font-medium mb-2`, { color: V.textSecondary }]}>
                Файлы в кэше ({entries.length})
              </Text>
              <TabOverscrollFlatList
                style={tw`flex-1`}
                data={entries}
                keyExtractor={(item, index) => `${item.uri}-${index}`}
                renderItem={renderEntry}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={[tw`text-[13px] py-4`, { color: V.textMuted }]}>
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
