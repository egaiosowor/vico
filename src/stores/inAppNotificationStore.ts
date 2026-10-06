import { create } from 'zustand';
import { IncidentCategory } from '../types';

export interface InAppAlert {
  id: string;
  incidentId?: string;
  category: IncidentCategory | 'system' | 'broadcast_success' | 'reward' | 'watch_alert';
  title: string;
  message: string;
  distanceText?: string;
  timestamp: number;
  read?: boolean;
}

interface InAppNotificationState {
  currentAlert: InAppAlert | null;
  alertHistory: InAppAlert[];
  unreadCount: number;
  showAlert: (alert: Omit<InAppAlert, 'id' | 'timestamp' | 'read'>) => void;
  dismissAlert: () => void;
  markAllAsRead: () => void;
  clearHistory: () => void;
}

const INITIAL_HISTORY: InAppAlert[] = [
  {
    id: 'welcome_alert',
    category: 'system',
    title: 'Welcome to NightWatch',
    message: 'Your neighborhood sentinel network is active. Real-time safety broadcasts appear here.',
    timestamp: Date.now() - 3600 * 1000 * 2,
    read: false,
  },
  {
    id: 'perimeter_alert',
    category: 'watch_alert',
    title: 'Perimeter Radar Active',
    message: 'Live safety monitoring is engaged within your 5 km sector radius.',
    timestamp: Date.now() - 3600 * 1000 * 1,
    read: false,
  },
];

export const useInAppNotificationStore = create<InAppNotificationState>((set) => ({
  currentAlert: null,
  alertHistory: INITIAL_HISTORY,
  unreadCount: INITIAL_HISTORY.filter((item) => !item.read).length,

  showAlert: (alertData) => {
    const newAlert: InAppAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      read: false,
    };

    set((state) => {
      const updatedHistory = [newAlert, ...state.alertHistory].slice(0, 50);
      return {
        currentAlert: newAlert,
        alertHistory: updatedHistory,
        unreadCount: updatedHistory.filter((i) => !i.read).length,
      };
    });
  },

  dismissAlert: () => {
    set({ currentAlert: null });
  },

  markAllAsRead: () => {
    set((state) => ({
      alertHistory: state.alertHistory.map((item) => ({ ...item, read: true })),
      unreadCount: 0,
    }));
  },

  clearHistory: () => {
    set({ alertHistory: [], unreadCount: 0 });
  },
}));
