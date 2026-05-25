import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Alert } from 'react-native';
import TabOverscrollFlatList from './TabOverscrollFlatList';
import tw from 'twrnc';
import { V } from '../theme';
import { useMessengerHeaderLayout } from './MessengerHeaderLayout';
import useContactsList from './contacts/useContactsList';
import useContactsHandleSearch from './contacts/useContactsHandleSearch';
import { openOrCreateContactRoom } from './contacts/openOrCreateContactRoom';
import { navigateToProfileScreen } from '../lib/navigateToProfileScreen';
import ContactsSearchHeader from './contacts/ContactsSearchHeader';
import ContactsDrawerRow from './contacts/ContactsDrawerRow';

/** Список контактов и поиск (@handle) для вкладки «Контакты». */
export default function ContactsDrawer({ nickname, navigation }) {
  const headerLayout = useMessengerHeaderLayout();
  const [searchQ, setSearchQ] = useState('');

  const { contacts, filterContacts } = useContactsList(nickname);
  const { handleResults, handleSearchLoading, handlePrefixForUi } = useContactsHandleSearch(
    nickname,
    searchQ,
  );

  const filteredContacts = useMemo(
    () => filterContacts(searchQ),
    [filterContacts, searchQ],
  );

  const openInviteFriends = useCallback(() => {
    if (navigateToProfileScreen('InviteFriends', undefined, navigation)) return;
    Alert.alert('Приглашения', 'Откройте вкладку «Профиль» → приглашения.');
  }, [navigation]);

  const onOpenContact = useCallback(
    (contactName) => {
      openOrCreateContactRoom({ nickname, contactName, navigation });
    },
    [nickname, navigation],
  );

  const renderContact = useCallback(
    ({ item }) => <ContactsDrawerRow name={item} onOpen={() => onOpenContact(item)} />,
    [onOpenContact],
  );

  const screenListEmpty =
    searchQ.trimStart().startsWith('@') ? null : (
      <View style={tw`py-10`}>
        {contacts.length === 0 ? (
          <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
            Пока нет контактов. Сыграй с кем-нибудь!
          </Text>
        ) : (
          <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
            Контакты не найдены
          </Text>
        )}
      </View>
    );

  const listHeader = (
    <ContactsSearchHeader
      headerLayout={headerLayout}
      searchQ={searchQ}
      onSearchChange={setSearchQ}
      onOpenInvite={openInviteFriends}
      handleSearchLoading={handleSearchLoading}
      handlePrefixForUi={handlePrefixForUi}
      handleResults={handleResults}
      onOpenContact={onOpenContact}
    />
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: 'transparent' }]}>
      <TabOverscrollFlatList
        style={tw`flex-1`}
        data={filteredContacts}
        keyExtractor={(item) => item}
        renderItem={renderContact}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={screenListEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
