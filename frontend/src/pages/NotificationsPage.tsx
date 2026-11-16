const handleNotificationClick = async (n: any) => {
  try {
    await NotificationService.markAsRead(n.id); // שליחה לשרת האמיתי
    // רענון הנתונים אחרי העדכון
    if (currentUser) {
      const updated = await NotificationService.getNotifications(currentUser.id);
      setNotifications(updated);
      refreshUnreadCount();
    }
  } catch (error) {
    console.error("Failed to mark as read:", error);
  }

  if (n.link) {
    navigate(n.link);
  }
};