/** Open Aria chat panel from push tap (registered by ChatsScreen). */

let openAriaHandler = null;
let pendingOpenAria = false;

export function registerOpenAriaFromPush(handler) {
  openAriaHandler = typeof handler === 'function' ? handler : null;
  if (openAriaHandler && pendingOpenAria) {
    pendingOpenAria = false;
    openAriaHandler();
  }
  return () => {
    if (openAriaHandler === handler) {
      openAriaHandler = null;
    }
  };
}

export function openAriaFromPush() {
  if (openAriaHandler) {
    openAriaHandler();
    pendingOpenAria = false;
    return true;
  }
  pendingOpenAria = true;
  return false;
}
