import type { GestureResponderEvent } from 'react-native';

export interface VideoMessageProps {
  url: string;
  messageId: string;
  activeVideoId: string | null;
  wasActivated: boolean;
  onActivate: (id: string | null) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  /** Optimistic video: upload в Supabase ещё идёт */
  isUploading?: boolean;
}
