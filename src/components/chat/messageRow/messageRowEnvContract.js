/**
 * Stable ref bag passed from useChatMessageListRender → MessageRow via rowEnvRef.
 * Intentionally a ref (not props) so renderItem identity stays stable for FlatList perf.
 *
 * @typedef {object} MessageRowEnv
 * @property {string} nickname — isMine via item.player_name === nickname
 * @property {number} windowWidth — bubbleMaxW = windowWidth * 0.75
 * @property {boolean} isTablet — useIsSplitLayout(); cap photo/GIF preview width
 * @property {Set<string>} selectedIds — selection mode highlight
 * @property {(replyToId: string) => object|null} getReplyMessage
 * @property {(messageId: string) => { opacity: Animated.Value, scale: Animated.Value }} ensureMessageAnims
 * @property {(item: object, isMine: boolean) => React.ReactNode} renderMessageContent — voice/location/video body
 * @property {(payload: object) => void} [setFullScreenImage]
 * @property {(event: object, item: object) => void} [handleMessagePress]
 * @property {(event: object, item: object) => void} [handleMessageLongPress]
 * @property {(messageId: string, emoji: string) => void} toggleReaction
 * @property {(item: object) => void} [replyToMessage]
 * @property {(anchor: object, dateKey: string, dateLabel: string) => void} [onDateSeparatorPress]
 * @property {import('react').MutableRefObject<boolean>} [ephemeralTickPausedRef] — GameScreen dice throw
 * @property {(messageId: string) => void} [onAriaRevealComplete] — Aria typewriter done
 * @property {(messageId: string, rating: 'up'|'down') => void} [onAriaFeedback] — 👍/👎 learning
 */

export {};
