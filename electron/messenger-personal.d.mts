export function createMessengerReceiptCache(now?: () => number): (deliveryKey: string | undefined, send: () => Promise<void>) => Promise<void>;
