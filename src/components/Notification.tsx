import React, { useEffect } from "react";
import "./SaveBoardDialog.css";

interface NotificationProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

const Notification: React.FC<NotificationProps> = ({
  message,
  type,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
  };

  return (
    <div className={`notification ${type}`}>
      <span style={{ marginRight: "8px" }}>{icons[type]}</span>
      {message}
    </div>
  );
};

export default Notification;
