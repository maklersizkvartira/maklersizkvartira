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
        const VAPID_PUBLIC_KEY = 'BCZzmQm2-JRxUQrL_PWOHJh66m7va4mYFTTH17F5whUz9M72di00zBs0tPDRfQC4wr24LbeEAc8hQkC4W31KAcU';

        // Helper: base64url string to Uint8Array required by pushManager.subscribe
        const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
          const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        let subscription = await registration.pushManager.getSubscription();

        // If existing subscription was created with an old/different key, renew it
        try {
          const storedKey = localStorage.getItem('uyiz_vapid_key');
          if (subscription && storedKey !== VAPID_PUBLIC_KEY) {
            await subscription.unsubscribe();
            subscription = null;
          }
        } catch {}

        if (!subscription) {
          try {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            });
            localStorage.setItem('uyiz_vapid_key', VAPID_PUBLIC_KEY);
          } catch (subErr) {
            console.warn('[Push] pushManager.subscribe error:', subErr);
          }
        }

        if (subscription) {
          const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null;
          const rawAuth = subscription.getKey ? subscription.getKey('auth') : null;

          const p256dh = rawKey ? btoa(String.fromCharCode(...new Uint8Array(rawKey))) : undefined;
          const auth = rawAuth ? btoa(String.fromCharCode(...new Uint8Array(rawAuth))) : undefined;

          // Persistent guest identifier for visitors without an account
          let guestId = '';
          if (typeof window !== 'undefined') {
            try {
              guestId = localStorage.getItem('uyiz_guest_id') || '';
              if (!guestId) {
                guestId = `guest_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
                localStorage.setItem('uyiz_guest_id', guestId);
              }
            } catch {}
          }

          // Send subscription to backend
          await http.post('/chat/push-subscriptions', {
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            guest_id: guestId || undefined,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
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
