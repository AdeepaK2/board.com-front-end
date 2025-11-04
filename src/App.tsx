import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface DrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
}

interface DrawMessage {
  type: 'draw';
  points: DrawPoint[];
  username: string;
}

interface CursorMessage {
  type: 'cursor';
  x: number;
  y: number;
  username: string;
  isDrawing: boolean;
}

interface UserMessage {
  type: 'userJoined' | 'userLeft';
  username: string;
  roomId: string;
}

interface ClearMessage {
  type: 'clear';
  username: string;
}

interface RoomInfo {
  roomId: string;
  roomName: string;
  creator: string;
  participants: number;
  maxParticipants: number;
}

interface RoomListMessage {
  type: 'roomList';
  rooms: RoomInfo[];
}

interface RoomCreatedMessage {
  type: 'roomCreated';
  roomId: string;
  roomName: string;
}

interface RoomJoinedMessage {
  type: 'roomJoined';
  roomId: string;
  roomName: string;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WebSocketMessage = DrawMessage | UserMessage | ClearMessage | CursorMessage | 
                        RoomListMessage | RoomCreatedMessage | RoomJoinedMessage | ErrorMessage;

interface UserCursor {
  x: number;
  y: number;
  username: string;
  isDrawing: boolean;
  lastUpdate: number;
}

type AppView = 'login' | 'roomList' | 'whiteboard';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [view, setView] = useState<AppView>('login');
  const [isDrawing, setIsDrawing] = useState(false);
  const [username, setUsername] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<DrawPoint[]>([]);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [userCursors, setUserCursors] = useState<Map<string, UserCursor>>(new Map());
  
  // Room management
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  // Auto-detect WebSocket URL based on current page URL
  useEffect(() => {
    const autoDetectUrl = () => {
      // If VITE_WEBSOCKET_URL is set, use it
      if (import.meta.env.VITE_WEBSOCKET_URL) {
        return import.meta.env.VITE_WEBSOCKET_URL;
      }
      
      // Auto-detect from current page URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = '8080';
      
      return `${protocol}//${host}:${port}`;
    };
    
    setServerUrl(autoDetectUrl());
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Clean up old cursors
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setUserCursors(prev => {
        const newCursors = new Map(prev);
        for (const [username, cursor] of newCursors.entries()) {
          if (now - cursor.lastUpdate > 3000) { // Remove after 3 seconds of inactivity
            newCursors.delete(username);
          }
        }
        return newCursors;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const connectToServer = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    const wsUrlToUse = serverUrl || 'ws://localhost:8080';
    
    setConnectionStatus('Connecting...');
    console.log('Connecting to:', wsUrlToUse);
    
    const ws = new WebSocket(wsUrlToUse);
    
    ws.onopen = () => {
      console.log('Connected to server');
      setIsConnected(true);
      setConnectionStatus('Connected');
      setView('roomList');
      
      // Request room list
      ws.send(JSON.stringify({ type: 'getRooms' }));
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        
        switch (data.type) {
          case 'roomList':
            handleRoomList(data);
            break;
          case 'roomCreated':
            handleRoomCreated(data);
            break;
          case 'roomJoined':
            handleRoomJoined(data);
            break;
          case 'draw':
            drawOnCanvas(data.points);
            break;
          case 'cursor':
            handleCursorUpdate(data);
            break;
          case 'userJoined':
            setConnectionStatus(`${data.username} joined`);
            setTimeout(() => setConnectionStatus('Connected'), 2000);
            break;
          case 'userLeft':
            setUserCursors(prev => {
              const newCursors = new Map(prev);
              newCursors.delete(data.username);
              return newCursors;
            });
            setConnectionStatus(`${data.username} left`);
            setTimeout(() => setConnectionStatus('Connected'), 2000);
            break;
          case 'clear':
            clearCanvas();
            setConnectionStatus(`Canvas cleared by ${data.username}`);
            setTimeout(() => setConnectionStatus('Connected'), 2000);
            break;
          case 'error':
            alert(data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      setView('login');
      setCurrentRoom(null);
      setUserCursors(new Map());
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('Connection error');
    };

    wsRef.current = ws;
  };

  const handleRoomList = (data: RoomListMessage) => {
    setRooms(data.rooms);
  };

  const handleRoomCreated = (data: RoomCreatedMessage) => {
    const newRoom: RoomInfo = {
      roomId: data.roomId,
      roomName: data.roomName,
      creator: username,
      participants: 1,
      maxParticipants: 50
    };
    setCurrentRoom(newRoom);
    setView('whiteboard');
    setShowCreateRoom(false);
    setNewRoomName('');
  };

  const handleRoomJoined = (data: RoomJoinedMessage) => {
    const room = rooms.find(r => r.roomId === data.roomId);
    if (room) {
      setCurrentRoom(room);
    } else {
      setCurrentRoom({
        roomId: data.roomId,
        roomName: data.roomName,
        creator: '',
        participants: 1,
        maxParticipants: 50
      });
    }
    setView('whiteboard');
    clearCanvas(); // Clear canvas when joining new room
  };

  const createRoom = () => {
    if (!newRoomName.trim()) {
      alert('Please enter a room name');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'createRoom',
        username: username,
        roomName: newRoomName.trim()
      }));
    }
  };

  const joinRoom = (roomId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'joinRoom',
        username: username,
        roomId: roomId
      }));
    }
  };

  const leaveRoom = () => {
    setView('roomList');
    setCurrentRoom(null);
    clearCanvas();
    
    // Request updated room list
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'getRooms' }));
    }
  };

  const handleCursorUpdate = (data: CursorMessage) => {
    if (data.username !== username) {
      setUserCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.set(data.username, {
          x: data.x,
          y: data.y,
          username: data.username,
          isDrawing: data.isDrawing,
          lastUpdate: Date.now()
        });
        return newCursors;
      });
    }
  };

  const drawOnCanvas = (points: DrawPoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = points[0].color;
    ctx.lineWidth = points[0].size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const sendCursorUpdate = (x: number, y: number, isDrawing: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor',
        x: x,
        y: y,
        username: username,
        isDrawing: isDrawing
      }));
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isConnected) return;
    
    setIsDrawing(true);
    const pos = getCanvasCoordinates(e);
    const newPoint = { x: pos.x, y: pos.y, color: brushColor, size: brushSize };
    setCurrentPoints([newPoint]);
    
    sendCursorUpdate(pos.x, pos.y, true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoordinates(e);
    
    // Always send cursor updates for real-time tracking
    if (isConnected) {
      sendCursorUpdate(pos.x, pos.y, isDrawing);
    }
    
    if (!isDrawing || !isConnected) return;

    const newPoint = { x: pos.x, y: pos.y, color: brushColor, size: brushSize };
    
    setCurrentPoints(prev => {
      const newPoints = [...prev, newPoint];
      
      // Draw locally
      if (newPoints.length >= 2) {
        drawOnCanvas(newPoints.slice(-2));
      }
      
      return newPoints;
    });
  };

  const stopDrawing = () => {
    if (!isDrawing || currentPoints.length === 0) return;
    
    setIsDrawing(false);
    
    // Send drawing data to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message: DrawMessage = {
        type: 'draw',
        points: currentPoints,
        username
      };
      wsRef.current.send(JSON.stringify(message));
    }
    
    setCurrentPoints([]);
    
    // Update cursor state
    const lastPoint = currentPoints[currentPoints.length - 1];
    if (lastPoint) {
      sendCursorUpdate(lastPoint.x, lastPoint.y, false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    draw(e);
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      stopDrawing();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearClick = () => {
    if (!isConnected) return;
    
    clearCanvas();
    
    // Send clear command to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear', username }));
    }
  };

  if (!isConnected) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>🎨 Collaborative Whiteboard</h1>
          <p>Create or join whiteboard rooms on your local network</p>
          <div className="login-form">
            <input
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && connectToServer()}
              maxLength={20}
            />
            <div className="server-url-input">
              <label>Server Address:</label>
              <input
                type="text"
                placeholder="ws://server-ip:8080"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
            </div>
            <button onClick={connectToServer} disabled={!username.trim()}>
              Connect to Server
            </button>
          </div>
          <div className="connection-status">
            {connectionStatus}
          </div>
          <div className="instructions">
            <h3>How it works:</h3>
            <p>� Other devices can access using your network IP</p>
            <p>🎨 Create your own whiteboard room or join existing ones</p>
            <p>👥 See everyone drawing in real-time</p>
            <p>🖱️ Draw with different colors and brush sizes</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'roomList') {
    return (
      <div className="room-list-container">
        <div className="room-list-header">
          <h1>🎨 Whiteboard Rooms</h1>
          <span className="username-badge">👤 {username}</span>
        </div>
        
        <div className="room-list-content">
          <div className="create-room-section">
            {!showCreateRoom ? (
              <button className="create-room-btn" onClick={() => setShowCreateRoom(true)}>
                ➕ Create New Room
              </button>
            ) : (
              <div className="create-room-form">
                <input
                  type="text"
                  placeholder="Enter room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                  maxLength={50}
                  autoFocus
                />
                <button onClick={createRoom}>Create</button>
                <button onClick={() => { setShowCreateRoom(false); setNewRoomName(''); }}>Cancel</button>
              </div>
            )}
          </div>

          <div className="rooms-grid">
            <h2>Available Rooms ({rooms.length})</h2>
            {rooms.length === 0 ? (
              <div className="no-rooms">
                <p>No rooms available. Create one to get started!</p>
              </div>
            ) : (
              <div className="room-cards">
                {rooms.map((room) => (
                  <div key={room.roomId} className="room-card">
                    <div className="room-info">
                      <h3>{room.roomName}</h3>
                      <p className="room-creator">Created by: {room.creator}</p>
                      <p className="room-participants">
                        👥 {room.participants}/{room.maxParticipants} participants
                      </p>
                    </div>
                    <button 
                      className="join-room-btn"
                      onClick={() => joinRoom(room.roomId)}
                      disabled={room.participants >= room.maxParticipants}
                    >
                      {room.participants >= room.maxParticipants ? 'Full' : 'Join Room'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="toolbar">
        <div className="user-info">
          <h2>🎨 {currentRoom?.roomName || 'Whiteboard'}</h2>
          <span className="username">👤 {username}</span>
        </div>
        
        <div className="controls">
          <label className="color-control">
            Color:
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
            />
          </label>
          
          <label className="size-control">
            Size:
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
            <span className="size-display">{brushSize}px</span>
          </label>
          
          <button className="clear-btn" onClick={handleClearClick}>
            Clear Canvas
          </button>

          <button className="leave-btn" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
        
        <div className="room-info-panel">
          <p className="room-participants">
            👥 {currentRoom?.participants || 1} participants
          </p>
        </div>
      </div>
      
      <div className="canvas-container">
        <div className="canvas-wrapper">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            onMouseDown={startDrawing}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrawing}
            onMouseLeave={handleMouseLeave}
            className="drawing-canvas"
          />
          
          {/* Render user cursors */}
          {Array.from(userCursors.values()).map((cursor) => (
            <div
              key={cursor.username}
              className={`user-cursor ${cursor.isDrawing ? 'drawing' : ''}`}
              style={{
                left: cursor.x,
                top: cursor.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="cursor-pointer">✏️</div>
              <div className="cursor-label">{cursor.username}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="status-bar">
        <span className="status">{connectionStatus}</span>
        <span className="instructions">
          💡 Draw by clicking and dragging • Change colors and sizes • Real-time collaboration
        </span>
      </div>
    </div>
  );
}

export default App;
