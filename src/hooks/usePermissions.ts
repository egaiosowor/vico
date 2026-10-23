import { useState, useCallback, useEffect } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export interface PermissionStatusMap {
  camera: boolean;
  location: boolean;
  notifications: boolean;
  canAskCameraAgain: boolean;
  canAskLocationAgain: boolean;
}

export const usePermissions = () => {
  const [statuses, setStatuses] = useState<PermissionStatusMap>({
    camera: false,
    location: false,
    notifications: false,
    canAskCameraAgain: true,
    canAskLocationAgain: true,
  });

  const checkAllPermissions = useCallback(async () => {
    try {
      const [cam, loc, notif] = await Promise.all([
        Camera.getCameraPermissionsAsync().catch(() => ({ granted: false, canAskAgain: true })),
        Location.getForegroundPermissionsAsync().catch(() => ({ granted: false, canAskAgain: true })),
        Notifications.getPermissionsAsync().catch(() => ({ granted: false, canAskAgain: true })),
      ]);

      setStatuses({
        camera: cam.granted,
        location: loc.granted,
        notifications: notif.granted,
        canAskCameraAgain: cam.canAskAgain,
        canAskLocationAgain: loc.canAskAgain,
      });
    } catch (e) {
      console.warn('Error checking permissions:', e);
    }
  }, []);

  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  const requestCamera = async () => {
    const res = await Camera.requestCameraPermissionsAsync();
    setStatuses((prev) => ({
      ...prev,
      camera: res.granted,
      canAskCameraAgain: res.canAskAgain,
    }));
    return res.granted;
  };

  const requestLocation = async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    setStatuses((prev) => ({
      ...prev,
      location: res.granted,
      canAskLocationAgain: res.canAskAgain,
    }));
    return res.granted;
  };

  const requestNotifications = async () => {
    const res = await Notifications.requestPermissionsAsync();
    setStatuses((prev) => ({
      ...prev,
      notifications: res.granted,
    }));
    return res.granted;
  };

  return {
    ...statuses,
    isReady: statuses.camera && statuses.location,
    checkAllPermissions,
    requestCamera,
    requestLocation,
    requestNotifications,
  };
};
