const API_URL = 'http://localhost:8001/api/notifications';

export const NotificationService = {
  // סיפור 35
  getNotifications: async (userId: string, isRead?: boolean) => {
    let url = `${API_URL}/${userId}`;
    if (isRead !== undefined) url += `?is_read=${isRead}`;
    const response = await fetch(url);
    return response.json();
  },

  markAsRead: async (notificationId: string) => {
    const response = await fetch(`${API_URL}/${notificationId}/read`, { method: 'PATCH' });
    return response.json();
  },

  // סיפור 36
  getPreferences: async (userId: string) => {
    const response = await fetch(`${API_URL}/${userId}/preferences`);
    return response.json();
  },

  updatePreferences: async (prefs: any) => {
    const response = await fetch(`${API_URL}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs)
    });
    return response.json();
  }
};