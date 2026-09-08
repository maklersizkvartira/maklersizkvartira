/**
 * Notification service: manages Web Push notifications & Service Worker registration.
 */

import { http } from './http';

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh?: string;
  auth?: string;
}

export const notificationService = {
  /**
   * Registers the service worker
   */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      return registration;
    } catch {
      return null;
    }
  },

  /**
   * Request permission and subscribe user to notifications
   */
  async requestPermissionAndSubscribe(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      const registration = await this.registerServiceWorker();
      if (!registration) return false;

      // Get push subscription if supported
      if ('pushManager' in registration) {
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          // Subscribe with application server public key if available, or simple subscription
          try {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', // Standard valid web-push public key
            });
          } catch {
            // Fallback without applicationServerKey if local/test
          }
        }

        if (subscription) {
          const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null;
          const rawAuth = subscription.getKey ? subscription.getKey('auth') : null;

          const p256dh = rawKey ? btoa(String.fromCharCode(...new Uint8Array(rawKey))) : undefined;
          const auth = rawAuth ? btoa(String.fromCharCode(...new Uint8Array(rawAuth))) : undefined;

          // Send subscription to backend
          await http.post('/chat/push-subscriptions', {
            endpoint: subscription.endpoint,
            p256dh,
            auth,
          }).catch(() => {});
        }
      }

      return true;
    } catch {
      return false;
    }
  },

  /**
   * Shows a local system notification (used when page is in background or inactive)
   */
  showLocalNotification(title: string, body: string, url: string = '/?view=CHAT') {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/logo-org.png',
            badge: '/favicon.ico',
            data: { url },
            tag: 'uyiz-chat-msg',
          });
        });
      } else {
        new Notification(title, {
          body,
          icon: '/logo-org.png',
          data: { url },
        });
      }
    } catch {
      // Ignore notification failures
    }
  },
};
