import React from 'react';
import { FlatList, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { ARIA_ROOM_ID } from '../../lib/aria';
import { V } from '../../theme';

const ReanimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function ChatsScreenFlatList({
  listAnimatedProps,
  data,
  extraData,
  renderItem,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  overscrollProps,
  query,
  ListHeaderComponent,
}) {
  const trimmedQuery = query.trim();

  return (
    <ReanimatedFlatList
      animatedProps={listAnimatedProps}
      data={data}
      extraData={extraData}
      keyExtractor={(i) => (i.isAria ? ARIA_ROOM_ID : i.roomId)}
      renderItem={renderItem}
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      ListHeaderComponent={ListHeaderComponent}
      {...overscrollProps}
      ListEmptyComponent={
        <View style={tw`py-10`}>
          {trimmedQuery.length > 0 ? (
            <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
              Контакты не найдены
            </Text>
          ) : (
            <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
              Пока нет чатов.
            </Text>
          )}
        </View>
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
