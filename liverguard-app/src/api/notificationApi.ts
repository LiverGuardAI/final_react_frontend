import apiClient from './axiosConfig';

export interface NotificationData {
    notification_id: number;
    user: number;
    message_type: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export const getNotifications = async (userId: number): Promise<NotificationData[]> => {
    const response = await apiClient.get(`/auth/notifications/?user_id=${userId}`);
    return response.data;
};

export const markNotificationAsRead = async (notificationId: number): Promise<void> => {
    await apiClient.post(`/auth/notifications/${notificationId}/read/`);
};
