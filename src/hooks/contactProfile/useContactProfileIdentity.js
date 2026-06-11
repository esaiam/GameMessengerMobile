import { useEffect, useMemo, useState } from 'react';
import { isBlocked } from '../../lib/blockedContacts';
import { getContactAlias } from '../../lib/contactAliases';
import { usePeerAvatar } from '../usePeerAvatar';

/**
 * Идентичность контакта: блокировка, alias, display name, avatar.
 */
export function useContactProfileIdentity({ nickname, peerName }) {
  const [blocked, setBlocked] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState('');
  const { avatarUri: peerAvatarUri } = usePeerAvatar(peerName, { refreshOnFocus: true });

  useEffect(() => {
    if (!nickname || !peerName) return;
    isBlocked(nickname, peerName).then(setBlocked);
  }, [nickname, peerName]);

  useEffect(() => {
    if (!nickname || !peerName) {
      setLocalDisplayName('');
      return;
    }
    getContactAlias(nickname, peerName).then(setLocalDisplayName);
  }, [nickname, peerName]);

  const displayName = useMemo(
    () => localDisplayName || peerName || '—',
    [localDisplayName, peerName],
  );

  return {
    blocked,
    setBlocked,
    localDisplayName,
    setLocalDisplayName,
    displayName,
    peerAvatarUri,
  };
}
