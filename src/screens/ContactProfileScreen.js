import React from 'react';
import ContactProfileView from './contactProfile/ContactProfileView';
import { useContactProfileController } from './contactProfile/useContactProfileController';

export default function ContactProfileScreen({ route, navigation }) {
  const viewProps = useContactProfileController({ route, navigation });
  return <ContactProfileView {...viewProps} />;
}
