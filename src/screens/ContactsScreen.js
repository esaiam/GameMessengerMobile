import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { useAndroidTabOverscroll } from '../hooks/useAndroidTabOverscroll';
import { useMainTabsNavigationOptional } from '../context/MainTabsNavigationContext';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import TabBackground from '../components/TabBackground';
import {
  useChatsSearchReveal,
  CHATS_SEARCH_BOTTOM_SPACING_PX,
} from '../hooks/useChatsSearchReveal';
import { useChatsScreenPagerScroll } from '../hooks/useChatsScreenPagerScroll';
import ContactsCollapsibleSearchField from '../components/contacts/ContactsCollapsibleSearchField';
import ContactsListRow from '../components/contacts/ContactsListRow';
import ContactsScreenHeader from '../components/contacts/ContactsScreenHeader';
import ContactsScreenFlatList, {
  ContactsListEmpty,
} from '../components/contacts/ContactsScreenFlatList';
import useContactsList from '../components/contacts/useContactsList';
import useContactsHandleSearch from '../components/contacts/useContactsHandleSearch';
import { openOrCreateContactRoom } from '../components/contacts/openOrCreateContactRoom';
import { navigateToProfileScreen } from '../lib/navigateToProfileScreen';
import { HANDLE_RE } from '../lib/handleProfile';
import {
  MESSENGER_HEADER_PADDING_HORIZONTAL,
  useMessengerHeaderLayout,
} from '../components/MessengerHeaderLayout';
import { useIsSplitLayout } from '../hooks/useIsSplitLayout';
import { useSplitDetail } from '../context/SplitDetailContext';
import { V } from '../theme';

function ContactsListTopInset({ style }) {
  return <Animated.View style={style} />;
}

export default function ContactsScreen({ route, navigation }) {
  const nickname = useNicknameFromRoute(route);
  const isSplit = useIsSplitLayout();
  const { setDetailParams } = useSplitDetail();

  const effectiveNavigation = useMemo(() => {
    if (!isSplit) return navigation;
    return {
      ...navigation,
      navigate: (name, params) => {
        if (name === 'Room') {
          setDetailParams({ type: 'Room', params });
        } else {
          navigation.navigate(name, params);
        }
      },
    };
  }, [isSplit, navigation, setDetailParams]);

  const [q, setQ] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const headerLayout = useMessengerHeaderLayout();

  const { contacts, filterContacts } = useContactsList(nickname);
  const { handleResults, handleSearchLoading, handlePrefixForUi } = useContactsHandleSearch(
    nickname,
    q,
  );

  const mainTabsNav = useMainTabsNavigationOptional();
  const acquirePagerLock = mainTabsNav?.acquirePagerInteractionLock;
  const releasePagerLock = mainTabsNav?.releasePagerInteractionLock;
  const resetPagerLock = mainTabsNav?.resetPagerInteractionLock;

  const {
    SEARCH_FIELD_H,
    setSearchShown,
    listScrollY,
    listMaxScrollY,
    searchDragActive,
    searchDragActiveRef,
    pullGesture,
    topPullBounceStyle,
    scrollHandler,
    searchBarWrapStyle,
    searchBarWrapAnimatedProps,
    searchBarInnerStyle,
    iconStyle,
    listScrollAnimatedProps,
    listTopInsetStyle,
  } = useChatsSearchReveal(q, searchFocused, headerLayout.minHeight);

  const {
    onListScrollBeginDrag,
    onListScrollEndDrag,
    onListMomentumScrollEnd,
  } = useChatsScreenPagerScroll({
    acquirePagerLock,
    releasePagerLock,
    resetPagerLock,
    searchDragActiveRef,
  });

  const { animatedStyle: bottomBounceStyle, wrapGesture, overscrollProps } =
    useAndroidTabOverscroll({
      scrollY: listScrollY,
      maxScrollY: listMaxScrollY,
      suppressTopBounce: true,
      acquirePagerLock,
      releasePagerLock,
      searchDragActive,
    });

  const listScrollGesture = wrapGesture(Gesture.Native()) ?? Gesture.Native();
  const contactsGesture = useMemo(
    () => Gesture.Simultaneous(pullGesture, listScrollGesture),
    [pullGesture, listScrollGesture],
  );

  const isHandleMode = q.trimStart().startsWith('@');

  const filteredContacts = useMemo(() => filterContacts(q), [filterContacts, q]);

  const listData = useMemo(() => {
    if (isHandleMode) {
      return handleResults.map((row) => ({
        key: `handle:${row.id}`,
        displayName: `@${row.handle}`,
        contactName: row.handle,
      }));
    }
    return filteredContacts.map((name) => ({
      key: `contact:${name}`,
      displayName: name,
      contactName: name,
    }));
  }, [isHandleMode, handleResults, filteredContacts]);

  const showHandleEmpty =
    isHandleMode &&
    !handleSearchLoading &&
    handlePrefixForUi.length >= 2 &&
    HANDLE_RE.test(handlePrefixForUi) &&
    handleResults.length === 0;

  const onOpenContact = useCallback(
    (contactName) => {
      openOrCreateContactRoom({ nickname, contactName, navigation: effectiveNavigation });
    },
    [nickname, effectiveNavigation],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <ContactsListRow
        name={item.displayName}
        onPress={() => onOpenContact(item.contactName)}
      />
    ),
    [onOpenContact],
  );

  const listEmpty = useMemo(() => {
    if (isHandleMode) {
      if (handleSearchLoading) {
        return <ContactsListEmpty>Поиск…</ContactsListEmpty>;
      }
      if (showHandleEmpty) {
        return <ContactsListEmpty>Пользователи не найдены</ContactsListEmpty>;
      }
      return null;
    }
    if (contacts.length === 0) {
      return <ContactsListEmpty>Пока нет контактов. Сыграй с кем-нибудь!</ContactsListEmpty>;
    }
    if (q.trim()) {
      return <ContactsListEmpty>Контакты не найдены</ContactsListEmpty>;
    }
    return null;
  }, [isHandleMode, handleSearchLoading, showHandleEmpty, contacts.length, q]);

  const onOpenSearch = useCallback(() => {
    setSearchShown(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus?.();
    });
  }, [setSearchShown]);

  const onSearchBlur = useCallback(() => {
    setSearchFocused(false);
    if (!q.trim()) setSearchShown(false);
  }, [q, setSearchShown]);

  const openInviteFriends = useCallback(() => {
    if (navigateToProfileScreen('InviteFriends', undefined, navigation)) return;
    Alert.alert('Приглашения', 'Откройте вкладку «Профиль» → приглашения.');
  }, [navigation]);

  const searchWrapStyle = useMemo(
    () => [{ marginHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL }, searchBarWrapStyle],
    [searchBarWrapStyle],
  );

  const listTopInset = useMemo(
    () => <ContactsListTopInset style={listTopInsetStyle} />,
    [listTopInsetStyle],
  );

  return (
    <TabBackground>
      <GestureDetector gesture={contactsGesture}>
        <Animated.View style={[tw`flex-1`, topPullBounceStyle]}>
          <Animated.View
            style={[StyleSheet.absoluteFillObject, styles.listLayer, bottomBounceStyle]}
          >
            <View
              style={[
                tw`flex-1`,
                { paddingHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL },
              ]}
            >
              <ContactsScreenFlatList
                listAnimatedProps={listScrollAnimatedProps}
                data={listData}
                renderItem={renderItem}
                onScroll={scrollHandler}
                onScrollBeginDrag={onListScrollBeginDrag}
                onScrollEndDrag={onListScrollEndDrag}
                onMomentumScrollEnd={onListMomentumScrollEnd}
                overscrollProps={overscrollProps}
                ListHeaderComponent={listTopInset}
                ListEmptyComponent={listEmpty}
              />
            </View>
          </Animated.View>

          <View
            style={[styles.searchOverlay, { top: headerLayout.minHeight }]}
            pointerEvents="box-none"
          >
            <ContactsCollapsibleSearchField
              searchFieldHeight={SEARCH_FIELD_H}
              searchBottomSpacingPx={CHATS_SEARCH_BOTTOM_SPACING_PX}
              wrapAnimatedProps={searchBarWrapAnimatedProps}
              wrapStyle={searchWrapStyle}
              innerStyle={searchBarInnerStyle}
              inputRef={searchInputRef}
              query={q}
              onChangeQuery={setQ}
              onFocus={() => setSearchFocused(true)}
              onBlur={onSearchBlur}
              onOpenInvite={openInviteFriends}
            />
          </View>

          <View style={styles.headerOverlay} pointerEvents="box-none">
            <ContactsScreenHeader
              containerStyle={headerLayout.containerStyle}
              searchIconStyle={iconStyle}
              onOpenSearch={onOpenSearch}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  listLayer: {
    zIndex: 0,
  },
  searchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: V.bgChatsScreen,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
});
