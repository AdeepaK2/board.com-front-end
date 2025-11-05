import { useState, useRef, useEffect } from 'react';
import './App.css';
import { LoginView } from './components/LoginView';
import { RoomList } from './components/RoomList';
import { Whiteboard } from './components/Whiteboard';

interface DrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
}

interface Room {
  roomId: string;
  roomName: string;
  isPublic: boolean;
  participants: number;
  hasPassword: boolean;
}

interface UserCursor {
  x: number;
  y: number;
  username: string;
  isDrawing: boolean;
}

interface WebSocketMessage {
  type: string;
  username?: string;
  roomName?: string;
  roomId?: string;
  rooms?: Room[];
  points?: DrawPoint[];
  x?: number;
  y?: number;
  isDrawing?: boolean;
  participants?: number;
  message?: string;
  isPublic?: boolean;
  password?: string | null;
}

type AppView = 'login' | 'roomList' | 'whiteboard';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [view, setView] = useState<AppView>('login');
  const [username, setUsername] = useState('');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [userCursors, setUserCursors] = useState<Map<string, UserCursor>>(new Map());
  // Auto-detect WebSocket server based on current hostname
  const serverUrl = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'ws://localhost:8080';
    }
    return `ws://${hostname}:8080`;
  })();
  
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Display connection info in console
    const hostname = window.location.hostname;
    const currentUrl = window.location.href;
    
    console.log('='.repeat(50));
    console.log('🌐 WHITEBOARD APP - NETWORK INFO');
    console.log('='.repeat(50));
    console.log('📡 WebSocket Server:', serverUrl);
    console.log('🖥️  Current URL:', currentUrl);
    console.log('📱 Share URL with others:', `http://${hostname}:5173`);
    console.log('💡 Tip: Others can access from any device on same WiFi');
    console.log('='.repeat(50));
  }, [serverUrl]);

  const connectWebSocket = () => {
    const ws = new WebSocket(serverUrl || 'ws://localhost:8080');
    wsRef.current = ws;
    ws.onopen = () => setConnectionStatus('Connected');
    ws.onclose = () => setConnectionStatus('Disconnected');
    ws.onerror = () => setConnectionStatus('Connection Error');
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  };

  useEffect(() => {
    if (serverUrl) {
      connectWebSocket();
      return () => wsRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'roomList':
        setRooms(message.rooms || []);
        break;
      case 'roomCreated':
      case 'roomJoined':
        if (message.roomId && message.roomName) {
          setCurrentRoom({
            roomId: message.roomId,
            roomName: message.roomName,
            isPublic: true,
            participants: 1,
            hasPassword: false,
          });
          setView('whiteboard');
          clearCanvas();
        }
        break;
      case 'draw':
        if (message.username !== username && message.points) {
          drawPoints(message.points);
        }
        break;
      case 'cursor':
        if (message.username && message.username !== username && message.x !== undefined && message.y !== undefined) {
          setUserCursors((prev) => {
            const newCursors = new Map(prev);
            newCursors.set(message.username!, {
              x: message.x!,
              y: message.y!,
              username: message.username!,
              isDrawing: message.isDrawing || false,
            });
            return newCursors;
          });
        }
        break;
      case 'clear':
        clearCanvas();
        break;
      case 'error':
        if (message.message) {
          alert(message.message);
        }
        break;
      case 'userJoined':
      case 'userLeft':
        if (currentRoom) {
          setCurrentRoom({ ...currentRoom, participants: message.participants || currentRoom.participants });
        }
        break;
    }
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleLogin = (name: string) => {
    setUsername(name);
    sendMessage({ type: 'setUsername', username: name });
    setView('roomList');
  };

  const handleLogout = () => {
    if (currentRoom) {
      sendMessage({ type: 'leaveRoom', roomId: currentRoom.roomId });
    }
    setView('login');
    setCurrentRoom(null);
    setUsername('');
  };

  const handleCreateRoom = (roomName: string, isPublic: boolean, password?: string) => {
    sendMessage({ type: 'createRoom', roomName, isPublic, password: password || null });
  };

  const handleJoinRoom = (roomId: string, password?: string) => {
    sendMessage({ type: 'joinRoom', roomId, password: password || null });
  };

  const handleLeaveRoom = () => {
    if (currentRoom) {
      sendMessage({ type: 'leaveRoom', roomId: currentRoom.roomId });
      setCurrentRoom(null);
      setView('roomList');
      setUserCursors(new Map());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleClearClick = () => {
    if (currentRoom) {
      clearCanvas();
      sendMessage({ type: 'clear', roomId: currentRoom.roomId });
    }
  };

  const drawPoints = (points: DrawPoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      ctx.strokeStyle = start.color;
      ctx.lineWidth = start.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      lastPoint.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing || !lastPoint.current || !currentRoom) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    const points = [
      { x: lastPoint.current.x, y: lastPoint.current.y, color: brushColor, size: brushSize },
      { x, y, color: brushColor, size: brushSize },
    ];
    sendMessage({ type: 'draw', roomId: currentRoom.roomId, points });
    lastPoint.current = { x, y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && currentRoom) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      sendMessage({ type: 'cursor', roomId: currentRoom.roomId, x, y, isDrawing });
      if (isDrawing) {
        draw(e);
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPoint.current = null;
  };

  // Touch event handlers for mobile/tablet support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDrawing(true);
      lastPoint.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing || !lastPoint.current || !currentRoom) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    const points = [
      { x: lastPoint.current.x, y: lastPoint.current.y, color: brushColor, size: brushSize },
      { x, y, color: brushColor, size: brushSize },
    ];
    
    sendMessage({ type: 'draw', roomId: currentRoom.roomId, points });
    sendMessage({ type: 'cursor', roomId: currentRoom.roomId, x, y, isDrawing: true });
    
    lastPoint.current = { x, y };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
    lastPoint.current = null;
  };

  if (view === 'login') {
    return <LoginView onLogin={handleLogin} />;
  }

  if (view === 'roomList') {
    return (
      <RoomList
        rooms={rooms}
        username={username}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Whiteboard
      canvasRef={canvasRef}
      roomName={currentRoom?.roomName || 'Whiteboard'}
      username={username}
      participants={currentRoom?.participants || 1}
      brushColor={brushColor}
      brushSize={brushSize}
      connectionStatus={connectionStatus}
      userCursors={userCursors}
      onBrushColorChange={setBrushColor}
      onBrushSizeChange={setBrushSize}
      onClearCanvas={handleClearClick}
      onLeaveRoom={handleLeaveRoom}
      onMouseDown={startDrawing}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}

export default App;
