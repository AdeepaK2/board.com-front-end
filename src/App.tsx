import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { LoginView } from './components/LoginView';
import { RoomList } from './components/RoomList';
import { Whiteboard } from './components/Whiteboard';
import { BoardManager } from './components/BoardManager';
import Notification from './components/Notification';
import type { DrawingMode, Shape } from './types';
import { drawShape, drawShapePreview, isPointInShape, drawSelectionHighlight, generateShapeId, drawResizeHandles, getResizeHandle } from './utils/shapeUtils';

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
  success?: boolean;
  isPublic?: boolean;
  password?: string | null;
  shape?: Shape;
  shapeId?: string;
  updates?: Partial<Shape>;
  creator?: string;
  users?: string[];
  invitedUsers?: string[];
}

type AppView = 'login' | 'roomList' | 'whiteboard';

// Helper function to check if eraser is touching a shape
function isShapeTouchedByEraser(eraserX: number, eraserY: number, eraserRadius: number, shape: Shape): boolean {
  switch (shape.type) {
    case 'text': {
      if (shape.text) {
        // Measure text bounds
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const fontSize = shape.fontSize || 16;
          ctx.font = `${fontSize}px Arial`;
          const textWidth = ctx.measureText(shape.text).width;
          const textHeight = fontSize;
          
          // Check if eraser circle intersects with text rectangle
          const rectLeft = shape.x;
          const rectRight = shape.x + textWidth;
          const rectTop = shape.y;
          const rectBottom = shape.y + textHeight;
          
          // Find closest point on rectangle to eraser center
          const closestX = Math.max(rectLeft, Math.min(eraserX, rectRight));
          const closestY = Math.max(rectTop, Math.min(eraserY, rectBottom));
          
          // Check distance from eraser center to closest point
          const dx = eraserX - closestX;
          const dy = eraserY - closestY;
          return (dx * dx + dy * dy) <= (eraserRadius * eraserRadius);
        }
      }
      return false;
    }
    
    case 'rectangle': {
      if (shape.width && shape.height) {
        const rectLeft = Math.min(shape.x, shape.x + shape.width);
        const rectRight = Math.max(shape.x, shape.x + shape.width);
        const rectTop = Math.min(shape.y, shape.y + shape.height);
        const rectBottom = Math.max(shape.y, shape.y + shape.height);
        
        const closestX = Math.max(rectLeft, Math.min(eraserX, rectRight));
        const closestY = Math.max(rectTop, Math.min(eraserY, rectBottom));
        
        const dx = eraserX - closestX;
        const dy = eraserY - closestY;
        return (dx * dx + dy * dy) <= (eraserRadius * eraserRadius);
      }
      return false;
    }
    
    case 'circle': {
      if (shape.radius) {
        const dx = eraserX - shape.x;
        const dy = eraserY - shape.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Eraser touches circle if distance between centers is less than sum of radii
        return distance <= (eraserRadius + shape.radius);
      }
      return false;
    }
    
    case 'line': {
      if (shape.endX !== undefined && shape.endY !== undefined) {
        // Calculate distance from eraser center to line segment
        const dx = shape.endX - shape.x;
        const dy = shape.endY - shape.y;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
          // Line is a point
          const pdx = eraserX - shape.x;
          const pdy = eraserY - shape.y;
          return Math.sqrt(pdx * pdx + pdy * pdy) <= eraserRadius;
        }
        
        const t = Math.max(0, Math.min(1, ((eraserX - shape.x) * dx + (eraserY - shape.y) * dy) / lengthSquared));
        const projX = shape.x + t * dx;
        const projY = shape.y + t * dy;
        
        const pdx = eraserX - projX;
        const pdy = eraserY - projY;
        return Math.sqrt(pdx * pdx + pdy * pdy) <= eraserRadius;
      }
      return false;
    }
    
    case 'triangle': {
      if (shape.width && shape.height) {
        // Triangle vertices
        const x1 = shape.x + shape.width / 2;
        const y1 = shape.y;
        const x2 = shape.x;
        const y2 = shape.y + shape.height;
        const x3 = shape.x + shape.width;
        const y3 = shape.y + shape.height;
        
        // Check if eraser center is inside triangle
        const area = 0.5 * (-y2 * x3 + y1 * (-x2 + x3) + x1 * (y2 - y3) + x2 * y3);
        const s = (1 / (2 * area)) * (y1 * x3 - x1 * y3 + (y3 - y1) * eraserX + (x1 - x3) * eraserY);
        const t = (1 / (2 * area)) * (x1 * y2 - y1 * x2 + (y1 - y2) * eraserX + (x2 - x1) * eraserY);
        
        if (s >= 0 && t >= 0 && 1 - s - t >= 0) {
          return true; // Center is inside triangle
        }
        
        // Check if eraser intersects any of the three edges
        const distToEdge1 = distanceToLineSegment(eraserX, eraserY, x1, y1, x2, y2);
        const distToEdge2 = distanceToLineSegment(eraserX, eraserY, x2, y2, x3, y3);
        const distToEdge3 = distanceToLineSegment(eraserX, eraserY, x3, y3, x1, y1);
        
        return Math.min(distToEdge1, distToEdge2, distToEdge3) <= eraserRadius;
      }
      return false;
    }
    
    default:
      return false;
  }
}

function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared === 0) {
    const pdx = px - x1;
    const pdy = py - y1;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }
  
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  
  const pdx = px - projX;
  const pdy = py - projY;
  return Math.sqrt(pdx * pdx + pdy * pdy);
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [view, setView] = useState<AppView>('login');
  const [username, setUsername] = useState('');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(2); // 1=small, 2=medium, 3=large, 4=extra-large
  const [isDrawing, setIsDrawing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [userCursors, setUserCursors] = useState<Map<string, UserCursor>>(new Map());
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  
  // Shape-related states
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('pen');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [strokes, setStrokes] = useState<{ points: DrawPoint[] }[]>([]);
  const [eraserStrokes, setEraserStrokes] = useState<{ points: DrawPoint[] }[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [shapeStart, setShapeStart] = useState<{x: number, y: number} | null>(null);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number} | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null); // 'tl', 'tr', 'bl', 'br', 'l', 'r', 't', 'b'
  const [boardManagerOpen, setBoardManagerOpen] = useState(false);
  const [editingText, setEditingText] = useState<string>('');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [currentStroke, setCurrentStroke] = useState<DrawPoint[]>([]);
  const [currentEraserStroke, setCurrentEraserStroke] = useState<DrawPoint[]>([]);
  
  // Auto-detect WebSocket server based on current hostname
  const serverUrl = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'ws://localhost:8080';
    }
    return `ws://${hostname}:8080`;
  })();
  
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Calculate eraser size based on selection (1-4)
  const getEraserSize = () => {
    const sizes = [10, 20, 40, 80]; // small, medium, large, extra-large
    return sizes[eraserSize - 1] || 20;
  };

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
    console.log('Received message:', message.type, message);
    
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
          // Check if this is an eraser stroke or pen stroke
          const isEraserStroke = message.points.length > 0 && message.points[0].color === 'eraser';
          
          if (isEraserStroke) {
            // Store incoming eraser stroke - always append to create continuous eraser path
            if (message.points) {
              setEraserStrokes(prev => [...prev, { points: message.points! }]);
            }
          } else {
            // Store incoming pen stroke - always append to create continuous pen path
            if (message.points) {
              setStrokes(prev => [...prev, { points: message.points! }]);
            }
          }
        }
        break;
      case 'addShape':
        if (message.shape) {
          setShapes(prev => [...prev, message.shape as Shape]);
          redrawCanvas();
        }
        break;
      case 'updateShape':
        if (message.shapeId && message.updates) {
          setShapes(prev => prev.map(shape => 
            shape.id === message.shapeId 
              ? { ...shape, ...message.updates }
              : shape
          ));
          redrawCanvas();
        }
        break;
      case 'deleteShape':
        if (message.shapeId) {
          setShapes(prev => prev.filter(shape => shape.id !== message.shapeId));
          redrawCanvas();
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
        setShapes([]);
        setSelectedShapeId(null);
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
      case 'newPublicRoom':
        // Show notification when a new public room is created (but not to the creator)
        if (message.roomName && message.creator && message.creator !== username) {
          setNotification({
            message: `🎨 ${message.creator} created a new room: "${message.roomName}"`,
            type: 'info'
          });
        }
        break;
      case 'activeUsers':
        if (message.users) {
          setActiveUsers(message.users);
        }
        break;
      case 'newPrivateRoomInvite':
        // Show notification when invited to a private room
        if (message.roomName && message.creator) {
          setNotification({
            message: `🔒 ${message.creator} invited you to private room: "${message.roomName}"`,
            type: 'info'
          });
        }
        break;
    }
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleLogin = async (name: string, password: string, isNewUser: boolean) => {
    setUsername(name);
    
    console.log('handleLogin called:', { name, isNewUser });
    
    const API_BASE_URL = `http://${window.location.hostname}:8081/api/auth`;
    
    try {
      if (isNewUser) {
        // Register via REST API
        console.log('Sending register request');
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: name, password })
        });
        
        const data = await response.json();
        console.log('Register response:', data);
        
        if (data.success) {
          setNotification({ message: '✅ Registration successful! You can now login.', type: 'success' });
        } else {
          setNotification({ message: `❌ ${data.message || 'Registration failed'}`, type: 'error' });
        }
      } else {
        // Login via REST API
        console.log('Sending login request');
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: name, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success) {
          // Save username to localStorage for next visit
          localStorage.setItem('whiteboard_username', name);
          // Send setUsername to WebSocket to join the server
          sendMessage({ type: 'setUsername', username: name });
          setView('roomList');
          setNotification({ message: '✅ Login successful!', type: 'success' });
        } else {
          setNotification({ message: `❌ ${data.message || 'Login failed'}`, type: 'error' });
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      setNotification({ message: '❌ Connection error. Please try again.', type: 'error' });
    }
  };

  const requestActiveUsers = () => {
    sendMessage({ type: 'getActiveUsers' });
  };

  const handleLogout = () => {
    if (currentRoom) {
      sendMessage({ type: 'leaveRoom', roomId: currentRoom.roomId });
    }
    setView('login');
    setCurrentRoom(null);
    setUsername('');
  };

  const handleCreateRoom = (roomName: string, isPublic: boolean, password?: string, invitedUsers?: string[]) => {
    sendMessage({ 
      type: 'createRoom', 
      roomName, 
      isPublic, 
      password: password || null,
      invitedUsers: invitedUsers || []
    });
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
    // Clear strokes and eraser strokes
    setStrokes([]);
    setEraserStrokes([]);
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw all strokes (pencil drawings)
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const start = stroke.points[i];
        const end = stroke.points[i + 1];
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = start.color;
        ctx.lineWidth = start.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    });
    
    // Apply eraser strokes
    eraserStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const start = stroke.points[i];
        const end = stroke.points[i + 1];
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = start.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    });
    
    ctx.globalCompositeOperation = 'source-over'; // Reset
    
    // Redraw all shapes
    shapes.forEach(shape => {
      drawShape(ctx, shape);
      if (shape.id === selectedShapeId) {
        drawSelectionHighlight(ctx, shape);
        drawResizeHandles(ctx, shape);
      }
    });
  }, [shapes, strokes, eraserStrokes, selectedShapeId]);

  // Auto-redraw when shapes or strokes change
  useEffect(() => {
    redrawCanvas();
  }, [shapes, strokes, redrawCanvas]);

  const updateTextShape = useCallback((newText: string) => {
    if (!editingTextId || !currentRoom) return;
    setShapes(prev => prev.map(shape => 
      shape.id === editingTextId ? { ...shape, text: newText } : shape
    ));
    
    // Send update to server so other clients see it in real-time
    sendMessage({
      type: 'updateShape',
      roomId: currentRoom.roomId,
      shapeId: editingTextId,
      updates: { text: newText }
    });
    
    redrawCanvas();
  }, [editingTextId, currentRoom, redrawCanvas]);

  // Handle keyboard events for delete and text editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle text editing
      if (editingTextId) {
        e.preventDefault(); // Prevent default browser behavior while editing
        
        if (e.key === 'Escape') {
          // Cancel text editing - remove empty text or keep existing
          const shape = shapes.find(s => s.id === editingTextId);
          if (shape && !shape.text) {
            setShapes(prev => prev.filter(s => s.id !== editingTextId));
            if (currentRoom) {
              sendMessage({
                type: 'deleteShape',
                roomId: currentRoom.roomId,
                shapeId: editingTextId
              });
            }
          }
          setEditingTextId(null);
          setEditingText('');
          redrawCanvas();
        } else if (e.key === 'Enter' && !e.shiftKey) {
          // Finish text editing
          if (editingText.trim()) {
            const shape = shapes.find(s => s.id === editingTextId);
            if (shape) {
              const updatedShape = { ...shape, text: editingText.trim() };
              setShapes(prev => prev.map(s => s.id === editingTextId ? updatedShape : s));
              // No need to send addShape - shape was already sent when created,
              // and updates were sent while typing
            }
          } else if (!editingText.trim()) {
            // Remove empty text
            setShapes(prev => prev.filter(s => s.id !== editingTextId));
            if (currentRoom) {
              sendMessage({
                type: 'deleteShape',
                roomId: currentRoom.roomId,
                shapeId: editingTextId
              });
            }
          }
          setEditingTextId(null);
          setEditingText('');
          redrawCanvas();
        } else if (e.key === 'Backspace') {
          const newText = editingText.slice(0, -1);
          setEditingText(newText);
          updateTextShape(newText);
        } else if (e.key.length === 1 || e.key === ' ') {
          const newText = editingText + e.key;
          setEditingText(newText);
          updateTextShape(newText);
        }
        return;
      }
      
      // Handle delete for selected shapes
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId && currentRoom) {
        // Delete selected shape
        setShapes(prev => prev.filter(shape => shape.id !== selectedShapeId));
        sendMessage({
          type: 'deleteShape',
          roomId: currentRoom.roomId,
          shapeId: selectedShapeId
        });
        setSelectedShapeId(null);
        redrawCanvas();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, currentRoom, redrawCanvas, editingTextId, editingText, shapes, updateTextShape]);

  const handleClearClick = () => {
    if (currentRoom) {
      clearCanvas();
      setShapes([]);
      setSelectedShapeId(null);
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
      
      if (start.color === 'eraser') {
        // Draw eraser stroke
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = start.color;
      }
      
      ctx.lineWidth = start.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; // Reset
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !currentRoom) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawingMode === 'pen') {
      setIsDrawing(true);
      lastPoint.current = { x, y };
      // Start a new stroke
      setCurrentStroke([{ x, y, color: brushColor, size: brushSize }]);
    } else if (drawingMode === 'eraser') {
      setIsDrawing(true);
      lastPoint.current = { x, y };
      // Start eraser stroke
      const eraserWidth = getEraserSize();
      setCurrentEraserStroke([{ x, y, color: 'eraser', size: eraserWidth }]);
    } else if (drawingMode === 'fill' && currentRoom) {
      // Fill clicked shape
      const clickedShape = [...shapes].reverse().find(shape => isPointInShape(x, y, shape));
      if (clickedShape) {
        const updatedShape = { ...clickedShape, fillColor: brushColor };
        setShapes(prev => prev.map(s => s.id === clickedShape.id ? updatedShape : s));
        sendMessage({
          type: 'updateShape',
          roomId: currentRoom.roomId,
          shapeId: clickedShape.id,
          updates: updatedShape
        });
        redrawCanvas();
      }
    } else if (drawingMode === 'select') {
      // Check if clicking on a shape
      const clickedShape = [...shapes].reverse().find(shape => isPointInShape(x, y, shape));
      if (clickedShape) {
        setSelectedShapeId(clickedShape.id);
        // Check if clicking on a resize handle
        const handle = getResizeHandle(clickedShape, x, y);
        if (handle) {
          setResizeHandle(handle);
        } else {
          setDragOffset({ x: x - clickedShape.x, y: y - clickedShape.y });
        }
        setIsDrawing(true);
      } else {
        setSelectedShapeId(null);
      }
      redrawCanvas();
    } else if (['rectangle', 'circle', 'line', 'triangle'].includes(drawingMode)) {
      setIsDrawingShape(true);
      setShapeStart({ x, y });
    } else if (drawingMode === 'text' && currentRoom) {
      console.log('Text mode activated at:', x, y);
      // Create text shape immediately and start editing
      const shapeId = generateShapeId();
      const newShape: Shape = {
        id: shapeId,
        type: 'text',
        x,
        y,
        color: brushColor,
        size: brushSize,
        username: username,
        text: '',
        fontSize: 16
      };
      
      console.log('Creating text shape:', newShape);
      setShapes(prev => {
        const updated = [...prev, newShape];
        console.log('Updated shapes:', updated);
        return updated;
      });
      setEditingTextId(shapeId);
      setEditingText('');
      
      // Send the shape to server immediately so other clients can see it
      sendMessage({
        type: 'addShape',
        roomId: currentRoom.roomId,
        shapeId: shapeId,
        shape: newShape
      });
      
      // Force redraw after a short delay to ensure state is updated
      setTimeout(() => {
        redrawCanvas();
      }, 0);
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
    
    if (drawingMode === 'eraser') {
      // Eraser mode: check if erasing over any shapes and delete them
      const eraserWidth = getEraserSize();
      const eraserRadius = eraserWidth / 2;
      
      // Check for shapes intersecting with the eraser path
      const shapesToDelete: string[] = [];
      shapes.forEach(shape => {
        // Check multiple points along the eraser stroke
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const checkX = lastPoint.current!.x + (x - lastPoint.current!.x) * t;
          const checkY = lastPoint.current!.y + (y - lastPoint.current!.y) * t;
          
          // Check if this point of the eraser is touching the shape
          if (isShapeTouchedByEraser(checkX, checkY, eraserRadius, shape)) {
            if (!shapesToDelete.includes(shape.id)) {
              shapesToDelete.push(shape.id);
            }
            break;
          }
        }
      });
      
      // Delete shapes that were erased
      if (shapesToDelete.length > 0) {
        setShapes(prev => prev.filter(shape => !shapesToDelete.includes(shape.id)));
        shapesToDelete.forEach(shapeId => {
          sendMessage({
            type: 'deleteShape',
            roomId: currentRoom.roomId,
            shapeId: shapeId
          });
        });
        redrawCanvas();
      }
      
      // Also erase pen strokes visually
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = eraserWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; // Reset to normal
      
      // Send erase message to other users for pen strokes
      const points = [
        { x: lastPoint.current.x, y: lastPoint.current.y, color: 'eraser', size: eraserWidth },
        { x, y, color: 'eraser', size: eraserWidth },
      ];
      
      // Add points to current eraser stroke
      setCurrentEraserStroke(prev => [...prev, ...points]);
      
      sendMessage({ type: 'draw', roomId: currentRoom.roomId, points });
    } else {
      // Normal pen mode
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
      
      // Add points to current stroke
      setCurrentStroke(prev => [...prev, ...points]);
      
      sendMessage({ type: 'draw', roomId: currentRoom.roomId, points });
    }
    
    lastPoint.current = { x, y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !currentRoom) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    sendMessage({ type: 'cursor', roomId: currentRoom.roomId, x, y, isDrawing });

    if ((drawingMode === 'pen' || drawingMode === 'eraser') && isDrawing && lastPoint.current) {
      // Draw freehand or erase
      draw(e);
    } else if (drawingMode === 'select' && isDrawing && selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (!shape) return;

      if (resizeHandle) {
        // Resize shape
        const updatedShape = { ...shape };

        if (shape.type === 'rectangle' && shape.width && shape.height) {
          if (resizeHandle.includes('t')) {
            const newHeight = (shape.y + shape.height) - y;
            if (newHeight > 5) {
              updatedShape.y = y;
              updatedShape.height = newHeight;
            }
          }
          if (resizeHandle.includes('b')) {
            updatedShape.height = Math.max(5, y - shape.y);
          }
          if (resizeHandle.includes('l')) {
            const newWidth = (shape.x + shape.width) - x;
            if (newWidth > 5) {
              updatedShape.x = x;
              updatedShape.width = newWidth;
            }
          }
          if (resizeHandle.includes('r')) {
            updatedShape.width = Math.max(5, x - shape.x);
          }
        } else if (shape.type === 'circle' && shape.radius) {
          const dx = x - shape.x;
          const dy = y - shape.y;
          updatedShape.radius = Math.max(5, Math.sqrt(dx * dx + dy * dy));
        } else if (shape.type === 'line' && shape.endX !== undefined && shape.endY !== undefined) {
          if (resizeHandle === 'start') {
            updatedShape.x = x;
            updatedShape.y = y;
          } else if (resizeHandle === 'end') {
            updatedShape.endX = x;
            updatedShape.endY = y;
          }
        } else if (shape.type === 'triangle' && shape.width && shape.height) {
          const dx = x - (shape.x + shape.width / 2);
          const dy = y - (shape.y + shape.height / 2);
          updatedShape.width = Math.max(10, Math.abs(dx) * 2);
          updatedShape.height = Math.max(10, Math.abs(dy) * 2);
        }

        setShapes(prev => prev.map(s => s.id === selectedShapeId ? updatedShape : s));
        sendMessage({
          type: 'updateShape',
          roomId: currentRoom.roomId,
          shapeId: selectedShapeId,
          updates: updatedShape
        });
        redrawCanvas();
      } else if (dragOffset) {
        // Drag selected shape
        const newX = x - dragOffset.x;
        const newY = y - dragOffset.y;
        
        setShapes(prev => prev.map(s =>
          s.id === selectedShapeId
            ? { ...s, x: newX, y: newY }
            : s
        ));
        
        sendMessage({
          type: 'updateShape',
          roomId: currentRoom.roomId,
          shapeId: selectedShapeId,
          updates: { x: newX, y: newY }
        });
        
        redrawCanvas();
      }
    } else if (isDrawingShape && shapeStart) {
      // Preview shape while dragging
      redrawCanvas();
      drawShapePreview(
        ctx,
        drawingMode as 'rectangle' | 'circle' | 'line' | 'triangle',
        shapeStart.x,
        shapeStart.y,
        x,
        y,
        brushColor,
        brushSize
      );
    }
  };

  const stopDrawing = () => {
    // Save current stroke if drawing with pen
    if (isDrawing && drawingMode === 'pen' && currentStroke.length > 0) {
      setStrokes(prev => [...prev, { points: currentStroke }]);
      setCurrentStroke([]);
    }
    
    // Save current eraser stroke if erasing
    if (isDrawing && drawingMode === 'eraser' && currentEraserStroke.length > 0) {
      setEraserStrokes(prev => [...prev, { points: currentEraserStroke }]);
      setCurrentEraserStroke([]);
    }
    
    if (isDrawingShape && shapeStart && canvasRef.current && currentRoom) {
      const rect = canvasRef.current.getBoundingClientRect();
      const event = (window.event as MouseEvent);
      const currentX = event.clientX - rect.left;
      const currentY = event.clientY - rect.top;
      
      // Create the final shape
      const shapeId = generateShapeId();
      const newShape: Shape = {
        id: shapeId,
        type: drawingMode as 'rectangle' | 'circle' | 'line' | 'triangle',
        x: shapeStart.x,
        y: shapeStart.y,
        color: brushColor,
        size: brushSize,
        username: username
      };
      
      // Calculate dimensions based on shape type
      if (drawingMode === 'rectangle' || drawingMode === 'triangle') {
        newShape.width = currentX - shapeStart.x;
        newShape.height = currentY - shapeStart.y;
      } else if (drawingMode === 'circle') {
        const width = currentX - shapeStart.x;
        const height = currentY - shapeStart.y;
        newShape.radius = Math.sqrt(width * width + height * height);
      } else if (drawingMode === 'line') {
        newShape.endX = currentX;
        newShape.endY = currentY;
      }
      
      // Add to local state
      setShapes(prev => [...prev, newShape]);
      
      // Send to server
      sendMessage({
        type: 'addShape',
        roomId: currentRoom.roomId,
        shapeId: shapeId,
        shape: newShape
      });
      
      redrawCanvas();
      setIsDrawingShape(false);
      setShapeStart(null);
    }
    
    setIsDrawing(false);
    setDragOffset(null);
    setResizeHandle(null);
    lastPoint.current = null;
  };

  // Touch event handlers for mobile/tablet support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      setIsDrawing(true);
      lastPoint.current = { x, y };
      
      // Start pen stroke
      if (drawingMode === 'pen') {
        setCurrentStroke([{ x, y, color: brushColor, size: brushSize }]);
      } else if (drawingMode === 'eraser') {
        // Start eraser stroke
        const eraserWidth = getEraserSize();
        setCurrentEraserStroke([{ x, y, color: 'eraser', size: eraserWidth }]);
      }
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
    
    if (drawingMode === 'eraser') {
      // Eraser mode: check if erasing over any shapes and delete them
      const eraserWidth = getEraserSize();
      const eraserRadius = eraserWidth / 2;
      
      // Check for shapes intersecting with the eraser path
      const shapesToDelete: string[] = [];
      shapes.forEach(shape => {
        // Check multiple points along the eraser stroke
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const checkX = lastPoint.current!.x + (x - lastPoint.current!.x) * t;
          const checkY = lastPoint.current!.y + (y - lastPoint.current!.y) * t;
          
          // Check if this point of the eraser is touching the shape
          if (isShapeTouchedByEraser(checkX, checkY, eraserRadius, shape)) {
            if (!shapesToDelete.includes(shape.id)) {
              shapesToDelete.push(shape.id);
            }
            break;
          }
        }
      });
      
      // Delete shapes that were erased
      if (shapesToDelete.length > 0) {
        setShapes(prev => prev.filter(shape => !shapesToDelete.includes(shape.id)));
        shapesToDelete.forEach(shapeId => {
          sendMessage({
            type: 'deleteShape',
            roomId: currentRoom.roomId,
            shapeId: shapeId
          });
        });
        redrawCanvas();
      }
      
      // Also erase pen strokes visually
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = eraserWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; // Reset to normal
      
      const points = [
        { x: lastPoint.current.x, y: lastPoint.current.y, color: 'eraser', size: eraserWidth },
        { x, y, color: 'eraser', size: eraserWidth },
      ];
      
      // Add points to current eraser stroke
      setCurrentEraserStroke(prev => [...prev, ...points]);
      
      sendMessage({ type: 'draw', roomId: currentRoom.roomId, points });
    } else {
      // Normal pen mode
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
      
      // Add points to current stroke
      setCurrentStroke(prev => [...prev, ...points]);
      sendMessage({ type: 'draw', roomId: currentRoom.roomId, points });
    }
    
    sendMessage({ type: 'cursor', roomId: currentRoom.roomId, x, y, isDrawing: true });
    
    lastPoint.current = { x, y };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // Save current stroke if drawing with pen
    if (isDrawing && drawingMode === 'pen' && currentStroke.length > 0) {
      setStrokes(prev => [...prev, { points: currentStroke }]);
      setCurrentStroke([]);
    }
    
    // Save current eraser stroke if erasing
    if (isDrawing && drawingMode === 'eraser' && currentEraserStroke.length > 0) {
      setEraserStrokes(prev => [...prev, { points: currentEraserStroke }]);
      setCurrentEraserStroke([]);
    }
    
    setIsDrawing(false);
    lastPoint.current = null;
  };

  const handleLoadBoard = async (boardId: string) => {
    try {
      const apiUrl = `http://${window.location.hostname}:8081/api/boards`;
      const response = await fetch(`${apiUrl}/load/${boardId}`);
      const data = await response.json();
      
      if (data.success && data.board) {
        // Load shapes and strokes
        setShapes(data.board.shapes || []);
        setStrokes(data.board.strokes || []);
        // Clear existing drawings
        clearCanvas();
        // Redraw with loaded shapes and strokes
        redrawCanvas();
      }
    } catch (error) {
      console.error('Failed to load board:', error);
      alert('Failed to load board');
    }
  };

  if (view === 'login') {
    return (
      <>
        <LoginView onLogin={handleLogin} />
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </>
    );
  }

  if (view === 'roomList') {
    return (
      <>
        <RoomList
          rooms={rooms}
          username={username}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onLogout={handleLogout}
          activeUsers={activeUsers}
          onRequestActiveUsers={requestActiveUsers}
        />
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
            duration={5000}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Whiteboard
        canvasRef={canvasRef}
        roomName={currentRoom?.roomName || 'Whiteboard'}
        username={username}
        participants={currentRoom?.participants || 1}
        brushColor={brushColor}
        brushSize={brushSize}
        eraserSize={eraserSize}
        connectionStatus={connectionStatus}
        drawingMode={drawingMode}
        userCursors={userCursors}
        onBrushColorChange={setBrushColor}
        onBrushSizeChange={setBrushSize}
        onEraserSizeChange={setEraserSize}
        onDrawingModeChange={setDrawingMode}
        onClearCanvas={handleClearClick}
        onLeaveRoom={handleLeaveRoom}
        onMouseDown={startDrawing}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onOpenBoardManager={() => setBoardManagerOpen(true)}
      />
      <BoardManager
        isOpen={boardManagerOpen}
        onClose={() => setBoardManagerOpen(false)}
        currentRoomId={currentRoom?.roomId || ''}
        username={username}
        onLoadBoard={handleLoadBoard}
        shapes={shapes}
        strokes={strokes}
      />
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
          duration={5000}
        />
      )}
    </>
  );
}

export default App;
