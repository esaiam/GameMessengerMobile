import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ContactsDrawer from '../components/ContactsDrawer';
import TabBackground from '../components/TabBackground';

const NICKNAME_KEY = '@backgammon_nickname';

export default function ContactsScreen({ route, navigation }) {
  const [nickname, setNickname] = useState(route.params?.nickname || '');

  useEffect(() => {
    if (route.params?.nickname && route.params.nickname !== nickname) {
      setNickname(route.params.nickname);
      return;
    }
    if (!route.params?.nickname && !nickname) {
      AsyncStorage.getItem(NICKNAME_KEY).then((stored) => {
        if (stored) setNickname(stored);
      });
    }
  }, [route.params?.nickname, nickname]);

  return (
    <TabBackground>
      <ContactsDrawer variant="screen" visible nickname={nickname} navigation={navigation} />
    </TabBackground>
  );
}
