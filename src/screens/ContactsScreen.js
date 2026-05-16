import React, { useMemo } from 'react';
import ContactsDrawer from '../components/ContactsDrawer';
import TabBackground from '../components/TabBackground';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import { useIsSplitLayout } from '../hooks/useIsSplitLayout';
import { useSplitDetail } from '../context/SplitDetailContext';

export default function ContactsScreen({ route, navigation }) {
  const nickname = useNicknameFromRoute(route);
  const isSplit = useIsSplitLayout();
  const { setDetailParams } = useSplitDetail();

  // В split-режиме перехватываем navigate('Room') → открываем в detail-панели.
  // Остальные навигации (InviteFriends и т.д.) пропускаем через реальный navigation.
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

  return (
    <TabBackground>
      <ContactsDrawer nickname={nickname} navigation={effectiveNavigation} />
    </TabBackground>
  );
}
