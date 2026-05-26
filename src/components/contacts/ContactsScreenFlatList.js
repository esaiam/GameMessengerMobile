import React from 'react';
import { FlatList } from 'react-native';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { Text, View } from 'react-native';
import { V } from '../../theme';

const ReanimatedFlatList = Animated.createAnimatedComponent(FlatList);

export function ContactsListEmpty({ children }) {
  return (
    <View style={tw`py-10`}>
      <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>{children}</Text>
    </View>
  );
}

export default function ContactsScreenFlatList({
  listAnimatedProps,
  data,
  renderItem,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  overscrollProps,
  ListHeaderComponent,
  ListEmptyComponent,
}) {
  return (
    <ReanimatedFlatList
      animatedProps={listAnimatedProps}
      data={data}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      {...overscrollProps}
      showsVerticalScrollIndicator={false}
    />
  );
}
