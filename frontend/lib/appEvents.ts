export const PROFILE_UPDATED_EVENT = 'financeai:profile-updated';
export const TRANSACTIONS_UPDATED_EVENT = 'financeai:transactions-updated';

const dispatchAppEvent = (eventName: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(eventName));
  }
};

const listenForAppEvent = (eventName: string, listener: EventListener) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
};

export const dispatchProfileUpdated = () => dispatchAppEvent(PROFILE_UPDATED_EVENT);
export const dispatchTransactionsUpdated = () => dispatchAppEvent(TRANSACTIONS_UPDATED_EVENT);
export const onProfileUpdated = (listener: EventListener) => listenForAppEvent(PROFILE_UPDATED_EVENT, listener);
export const onTransactionsUpdated = (listener: EventListener) => listenForAppEvent(TRANSACTIONS_UPDATED_EVENT, listener);
