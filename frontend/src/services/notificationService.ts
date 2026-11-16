const API_URL = 'http://localhost:8001/api/notifications';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  // שליפת התראות (עם אופציה לסינון לפי סטטוס קריאה)
  getNotifications: async (userId: string, isRead?: boolean): Promise<Notification[]> => {
    let url = `${API_URL}/${userId}`;
    if (isRead !== undefined) {
      url += `?is_read=${isRead}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }
    return response.json();
  },

  // עדכון סטטוס התראה לנקראה
  markAsRead: async (notificationId: string): Promise<Notification> => {
    const response = await fetch(`${API_URL}/${notificationId}/read`, {
      method: 'PATCH',
    });
    
    if (!response.ok) {
      throw new Error('Failed to mark notification as read');
    }
    return response.json();
  }
};