import React, { useState, useEffect, useRef } from "react";
import "../styles/Chat.css";

interface ChatProps {
  ws: WebSocket | null;
  roomId: string;
  username: string;
}

interface ChatMessage {
  username: string;
  message: string;
  timestamp: number;
  isCurrentUser?: boolean;
}

const Chat: React.FC<ChatProps> = ({ ws, roomId, username }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "error"
  >("disconnected");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history when room changes
  useEffect(() => {
    if (!roomId) return;

    const loadChatHistory = async () => {
      try {
        const apiUrl = `http://${window.location.hostname}:8081/api/chat`;
        console.log("📥 Fetching chat history for room:", roomId);
        console.log("🔗 API URL:", `${apiUrl}/history/${roomId}`);

        const response = await fetch(`${apiUrl}/history/${roomId}`);
        
        if (!response.ok) {
          console.warn(`⚠️  HTTP Error: ${response.status} ${response.statusText}`);
          setHistoryLoaded(true);
          return;
        }

        const data = await response.json();

        console.log("📦 Backend response:", data);

        if (data.success && data.messages && Array.isArray(data.messages)) {
          console.log("✅ Chat history loaded:", data.messages.length, "messages");

          // Convert backend messages to frontend format
          const historyMessages: ChatMessage[] = data.messages.map(
            (msg: any) => ({
              username: msg.username || "Unknown",
              message: msg.message || "",
              timestamp: msg.timestamp || Date.now(),
              isCurrentUser: msg.username === username,
            })
          );

          console.log("📋 Converted messages:", historyMessages);
          setMessages(historyMessages);
          setHistoryLoaded(true);
        } else if (data.success && (!data.messages || data.messages.length === 0)) {
          console.log("ℹ️  No chat history found for this room (first time)");
          setMessages([]);
          setHistoryLoaded(true);
        } else {
          console.warn("⚠️  Unexpected response format:", data);
          setHistoryLoaded(true);
        }
      } catch (error) {
        console.error("❌ Error loading chat history:", error);
        console.error("📍 Error details:", {
          message: error instanceof Error ? error.message : String(error),
          roomId: roomId,
          timestamp: new Date().toISOString(),
        });
        setHistoryLoaded(true); // Still allow chat to proceed
      }
    };

    // Clear previous messages before loading new room history
    setMessages([]);
    setHistoryLoaded(false);
    
    loadChatHistory();
  }, [roomId, username]);

  useEffect(() => {
    // Check WebSocket connection status
    if (!ws) {
      console.error("❌ WebSocket is null - Chat cannot connect");
      console.log("📍 Reason: WebSocket object not passed from parent (App.tsx)");
      setConnectionStatus("disconnected");
      return;
    }

    console.log("✅ WebSocket object exists");
    console.log("📡 WebSocket State:", ws.readyState, {
      0: "CONNECTING",
      1: "OPEN",
      2: "CLOSING",
      3: "CLOSED",
    }[ws.readyState] || "UNKNOWN");
    console.log("🔗 WebSocket URL:", ws.url);

    // Check if WebSocket is already open
    if (ws.readyState === WebSocket.OPEN) {
      console.log("✅ WebSocket Already Connected!");
      setConnectionStatus("connected");
    }

    // Monitor WebSocket connection events
    const handleOpen = () => {
      console.log("✅ WebSocket Connected - Chat is ready");
      setConnectionStatus("connected");
    };

    const handleClose = () => {
      console.log("❌ WebSocket Disconnected");
      console.log("🔄 Attempting to reconnect...");
      setConnectionStatus("disconnected");
      
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.CLOSED) {
          console.log("🔄 Reconnecting WebSocket...");
          // Parent component (App.tsx) should handle reconnection
        }
      }, 3000);
    };

    const handleError = (error: Event) => {
      console.error("❌ WebSocket Error:", error);
      console.log("⚠️  Error details:", {
        type: error.type,
        readyState: ws.readyState,
        url: ws.url,
      });
      setConnectionStatus("error");
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        // Log all incoming messages
        console.log("📨 Incoming Message Type:", data.type);
        console.log("📨 Full Message Data:", JSON.stringify(data, null, 2));

        if (data.type === "chatMessage") {
          console.log("🎯 Processing chat message");
          console.log("   Sender Username:", data.username);
          console.log("   Current Username:", username);
          console.log("   Message Room:", data.roomId);
          console.log("   Current Room:", roomId);
          console.log("   Match?:", data.roomId === roomId);

          // Verify message belongs to current room
          if (data.roomId !== roomId) {
            console.log("⚠️  Message from different room (" + data.roomId + "), ignoring");
            return;
          }

          // Prevent duplicate messages if same user already added it locally
          const isDuplicate = messages.some(
            (msg) =>
              msg.username === data.username &&
              msg.message === data.message &&
              msg.timestamp === data.timestamp
          );

          if (isDuplicate) {
            console.log("⚠️  Duplicate message, ignoring");
            return;
          }

          const newMessage: ChatMessage = {
            username: data.username,
            message: data.message,
            timestamp: data.timestamp || Date.now(),
            isCurrentUser: data.username === username,
          };

          console.log("➕ Adding message to chat:", newMessage);
          setMessages((prev) => {
            console.log("📊 Previous messages count:", prev.length);
            const updated = [...prev, newMessage];
            console.log("📊 New messages count:", updated.length);
            return updated;
          });

          // Only save if not from current user (already saved on send)
          if (data.username !== username) {
            console.log("💾 Saving other user's message to history");
            saveChatMessageToHistory(newMessage);
          }
        } else if (data.type === "userJoined" || data.type === "userLeft") {
          console.log("👥 User event:", data.type, "Participants:", data.participants);
          if (data.participants) {
            setParticipantCount(data.participants);
          }
        } else {
          console.log("ℹ️  Unknown message type:", data.type);
        }
      } catch (err) {
        console.error("❌ Error parsing message:", err);
        console.error("   Raw data:", event.data);
      }
    };

    // Attach event listeners
    ws.addEventListener("open", handleOpen);
    ws.addEventListener("close", handleClose);
    ws.addEventListener("error", handleError);
    ws.addEventListener("message", handleMessage);

    return () => {
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("error", handleError);
      ws.removeEventListener("message", handleMessage);
    };
  }, [ws, roomId, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save chat message to backend history
  const saveChatMessageToHistory = async (message: ChatMessage) => {
    try {
      const apiUrl = `http://${window.location.hostname}:8081/api/chat`;

      const payload = {
        roomId: roomId,
        username: message.username,
        message: message.message,
        timestamp: message.timestamp,
      };

      console.log("💾 Saving message to history:", payload);

      const response = await fetch(`${apiUrl}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(`⚠️  Save HTTP Error: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        console.log("✅ Message saved to history with ID:", data.messageId || "unknown");
      } else {
        console.warn("⚠️  Failed to save message to history:", data.message || "Unknown error");
      }
    } catch (error) {
      console.error("❌ Error saving message to history:", error);
      console.error("📍 Error details:", {
        message: error instanceof Error ? error.message : String(error),
        roomId: roomId,
        username: message.username,
      });
    }
  };

  const sendMessage = () => {
    if (!ws) {
      console.error("❌ Cannot send message: WebSocket is null");
      alert("Chat not connected to server");
      return;
    }

    if (ws.readyState !== WebSocket.OPEN) {
      console.error(
        "❌ Cannot send message: WebSocket not open. State:",
        ws.readyState
      );
      alert("Chat not connected. Please wait for connection to establish.");
      return;
    }

    if (!input.trim()) {
      console.warn("⚠️  Cannot send empty message");
      return;
    }

    const chatData = {
      type: "chatMessage",
      roomId: roomId,
      username: username,
      message: input.trim(),
      timestamp: Date.now(),
    };

    console.log("📤 Sending message:", chatData);

    try {
      ws.send(JSON.stringify(chatData));
      console.log("✅ Message sent successfully");

      // Add message to local state immediately
      const newMessage: ChatMessage = {
        username: username,
        message: input.trim(),
        timestamp: Date.now(),
        isCurrentUser: true,
      };
      setMessages((prev) => [...prev, newMessage]);

      // Save to backend chat history
      saveChatMessageToHistory(newMessage);

      setInput("");
    } catch (error) {
      console.error("❌ Error sending message:", error);
      alert("Failed to send message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        className="chat-toggle-closed"
        onClick={() => setIsOpen(true)}
        title="Open Chat"
      >
        <span className="chat-bubble-icon">💬</span>
        <span className="chat-bubble-text">Chat</span>
      </button>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-left">
          <h3>💬 Chat Room</h3>
          <span className="participant-badge">👥 {participantCount}</span>
        </div>
        <div className="chat-header-right">
          <div className="chat-status">
            <span className={`status-indicator ${connectionStatus}`}></span>
            <span className="status-text">{connectionStatus}</span>
          </div>
          <button
            className="chat-close-btn"
            onClick={() => setIsOpen(false)}
            title="Minimize Chat"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {!historyLoaded ? (
          <div className="chat-empty">
            <p>Loading chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Start chatting!</p>
            <small style={{ color: "#999", marginTop: "8px" }}>
              Connection: {connectionStatus}
            </small>
            <div className="chat-debug-info">
              <small>📋 Debug Info:</small>
              <small>Room ID: {roomId || "N/A"}</small>
              <small>Username: {username || "N/A"}</small>
              <small>WS State: {ws?.readyState === 1 ? "OPEN" : "CLOSED"}</small>
              <small>Participants: {participantCount}</small>
              <small style={{ marginTop: "8px", fontWeight: "bold" }}>
                ✅ Try typing a message and press Enter!
              </small>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-message ${
                msg.isCurrentUser ? "current-user" : "other-user"
              }`}
            >
              <div className="message-content">
                <div className="message-header">
                  <span className="message-username">{msg.username}</span>
                  <span className="message-time">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="message-text">{msg.message}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          placeholder={
            connectionStatus === "connected"
              ? "Type a message..."
              : "Chat not connected..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={connectionStatus !== "connected"}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || connectionStatus !== "connected"}
          title="Send Message"
        >
          Send
        </button>
      </div>
    </div>
  );
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default Chat;
