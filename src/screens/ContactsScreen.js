import React from 'react';
import ContactsDrawer from '../components/ContactsDrawer';
import TabBackground from '../components/TabBackground';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';

export default function ContactsScreen({ route, navigation }) {
  const nickname = useNicknameFromRoute(route);

  return (
    <TabBackground>
      <ContactsDrawer variant="screen" visible nickname={nickname} navigation={navigation} />
    </TabBackground>
  );
}
