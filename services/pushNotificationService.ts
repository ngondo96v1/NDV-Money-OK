import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export const initializePushNotifications = async (userId: string | undefined) => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications are only available on native platforms');
    return;
  }

  if (!userId) return;

  // Request permission to use push notifications
  // IOS will prompt the user, Android will just return granted if target SDK < 33
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.error('User denied permissions!');
    return;
  }

  // Register with Apple / Google to receive push via APNS/FCM
  await PushNotifications.register();

  // On success, we should be able to receive notifications
  PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token: ' + token.value);
    // TODO: Gửi token này lên server (Supabase) để lưu lại cho userId này
    // Cần cập nhật bảng users thêm cột fcmToken
    saveTokenToSupabase(userId, token.value);
  });

  // Some issue with our setup and push will not work
  PushNotifications.addListener('registrationError', (error) => {
    console.error('Error on registration: ' + JSON.stringify(error));
  });

  // Show us the notification payload if the app is open on our device
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received: ' + JSON.stringify(notification));
    
    // Dispatch a custom event so the main React app can display a beautiful Sonner toast
    const event = new CustomEvent('app_push_received', {
      detail: {
        title: notification.title,
        body: notification.body,
        data: notification.data
      }
    });
    window.dispatchEvent(event);
  });

  // Method called when tapping on a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push action performed: ' + JSON.stringify(notification));
  });
};

const saveTokenToSupabase = async (userId: string, token: string) => {
  try {
    const jwtToken = localStorage.getItem('vnv_token') || sessionStorage.getItem('vnv_token');
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json' 
    };
    if (jwtToken) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    }

    const envApiUrl = (import.meta.env && import.meta.env.VITE_API_URL) || (import.meta.env && import.meta.env.VITE_APP_URL);
    const isSpecialOrigin = 
      window.location.protocol === 'capacitor:' || 
      window.location.protocol === 'file:' || 
      (window.location.hostname === 'localhost' && window.location.port !== '3000');
    
    const apiHost = isSpecialOrigin
      ? (envApiUrl || "https://ndv-money-ok.vercel.app")
      : window.location.origin;

    const url = `${apiHost.replace(/\/$/, '')}/api/update-fcm-token`;

    console.log(`[PUSH] Sending FCM token to API: ${url}`);
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, token }),
    });
  } catch (err) {
    console.error('Failed to save push token:', err);
  }
};
