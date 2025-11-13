import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import './ChatPanel.css';
import { MessageCircle, Send, Minimize2 } from 'lucide-react';

interface ChatPanelProps {
  socket: WebSocket | null;
  username: string;
  isVisible?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ socket, username, isVisible = true }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for chat messages from WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chatMessage') {
          const chatMessage: ChatMessage = {
            type: 'CHAT',
            username: data.username,
            message: data.message,
            timestamp: data.timestamp
          };
          setMessages(prev => [...prev, chatMessage]);
        } else if (data.type === 'chatHistory') {
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Error parsing chat message:', error);
      }
    };

    socket.addEventListener('message', handleMessage);

    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);

  // Request chat history when component mounts
  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'getChatHistory' }));
    }
  }, [socket]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Send chat message to server
    socket.send(JSON.stringify({
      type: 'chatMessage',
      message: inputMessage.trim()
    }));

    setInputMessage('');
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const renderMessage = (msg: ChatMessage, index: number) => {
    const isOwnMessage = msg.username === username;
    const isSystemMessage = msg.type === 'USER_JOINED' || msg.type === 'USER_LEFT' || msg.type === 'SYSTEM';

    if (isSystemMessage) {
      return (
        <div key={index} className="chat-system-message">
          {msg.message}
        </div>
      );
    }

    return (
      <div 
        key={index} 
        className={`chat-message ${isOwnMessage ? 'chat-message-own' : 'chat-message-other'}`}
      >
        <div className="chat-message-header">
          <span className="chat-message-username">{msg.username}</span>
          <span className="chat-message-time">{formatTimestamp(msg.timestamp)}</span>
        </div>
        <div className="chat-message-content">{msg.message}</div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className={`chat-panel ${isMinimized ? 'chat-panel-minimized' : ''}`}>
      <div className="chat-header">
        <div className="chat-header-title">
          <MessageCircle size={18} />
          <span>Chat</span>
        </div>
        <div className="chat-header-actions">
          <button 
            className="chat-header-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <MessageCircle size={16} /> : <Minimize2 size={16} />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <MessageCircle size={48} opacity={0.3} />
                <p>No messages yet. Start chatting!</p>
              </div>
            ) : (
              messages.map((msg, idx) => renderMessage(msg, idx))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-container" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              maxLength={500}
            />
            <button 
              type="submit" 
              className="chat-send-btn"
              disabled={!inputMessage.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
