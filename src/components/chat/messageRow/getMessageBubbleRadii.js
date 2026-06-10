import { BUBBLE_RADIUS, BUBBLE_TAIL } from '../messageBubbleLayoutConstants';

export function getMessageBubbleRadii(isMine) {
  return isMine
    ? {
        borderTopLeftRadius: BUBBLE_RADIUS,
        borderTopRightRadius: BUBBLE_RADIUS,
        borderBottomLeftRadius: BUBBLE_RADIUS,
        borderBottomRightRadius: BUBBLE_TAIL,
      }
    : {
        borderTopLeftRadius: BUBBLE_RADIUS,
        borderTopRightRadius: BUBBLE_RADIUS,
        borderBottomLeftRadius: BUBBLE_TAIL,
        borderBottomRightRadius: BUBBLE_RADIUS,
      };
}
