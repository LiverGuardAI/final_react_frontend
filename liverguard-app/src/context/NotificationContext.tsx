import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useWebSocketContext } from './WebSocketContext';
import { getNotifications, markNotificationAsRead } from '../api/notificationApi';
import type { NotificationData } from '../api/notificationApi';

interface NotificationContextType {
    notifications: NotificationData[];
    unreadCount: number;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>; // Use loop if no bulk endpoint
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { lastMessage } = useWebSocketContext();
    const [notifications, setNotifications] = useState<NotificationData[]>([]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const fetchNotificationsList = async () => {
        if (!user) return;
        try {
            // Assuming user.id corresponds to user_id in backend
            // Check if user object has id (based on AuthContext logic it should)
            const userId = user.id || user.user_id;
            if (userId) {
                const data = await getNotifications(userId);
                setNotifications(data);
            }
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        }
    };

    // Initial Fetch
    useEffect(() => {
        if (user) {
            fetchNotificationsList();
        } else {
            setNotifications([]);
        }
    }, [user]);

    // WebSocket Listener
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'schedule_update') {
            // The WS message content structure from views.py:
            // "message": { "type": "...", "content": "..." }

            // We can optimistic update OR refetch.
            // Since the backend creates the notification BEFORE sending WS, refetching is safe.
            // Or we can append manually if we trust the WS content matches Notification model.
            // Refetch is safer to get the correct 'notification_id'.
            fetchNotificationsList();
        }
    }, [lastMessage]);

    const markAsRead = async (id: number) => {
        try {
            await markNotificationAsRead(id);
            setNotifications(prev => prev.map(n =>
                n.notification_id === id ? { ...n, is_read: true } : n
            ));
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const markAllAsRead = async () => {
        // Naive implementation: loop. Better: backend endpoint.
        const unread = notifications.filter(n => !n.is_read);
        for (const n of unread) {
            markNotificationAsRead(n.notification_id); // Fire and forget mostly
        }
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications: fetchNotificationsList, markAsRead, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
}
