import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

// Set default notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationService = {
  registerForPushNotifications: async (): Promise<string | null> => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      // Android notification channel setup
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('emergency_alerts', {
          name: 'Emergency Proximity Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFAB40',
        });
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
      const token = tokenData?.data || null;

      if (token) {
        useAuthStore.getState().updateFcmToken(token);
      }

      return token;
    } catch (e) {
      console.warn('[NotificationService] Failed to register push token:', e);
      return null;
    }
  },

  setupNotificationListeners: (
    onNotificationOpened: (incidentId: string) => void
  ) => {
    // Background / killed state tap
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const incidentId = response.notification.request.content.data?.incidentId;
      if (incidentId && typeof incidentId === 'string') {
        onNotificationOpened(incidentId);
      }
    });

    return () => {
      responseSub.remove();
    };
  },
};
