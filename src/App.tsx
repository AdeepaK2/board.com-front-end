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
  isPublic?: boolean;
  password?: string | null;
  shape?: Shape;
  shapeId?: string;
  updates?: Partial<Shape>;
  creator?: string;
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
  const [eraserSize, setEraserSize] = useState(2); // 1=small, 2=medium, 3=large, 4=extra-large
  const [isDrawing, setIsDrawing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [userCursors, setUserCursors] = useState<Map<string, UserCursor>>(new Map());
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Shape-related states
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('pen');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [strokes, setStrokes] = useState<{ points: DrawPoint[] }[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [shapeStart, setShapeStart] = useState<{x: number, y: number} | null>(null);
  const [dragOffset, setDragOffset] = useState<{x: number, y: number} | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null); // 'tl', 'tr', 'bl', 'br', 'l', 'r', 't', 'b'
  const [boardManagerOpen, setBoardManagerOpen] = useState(false);
  const [editingText, setEditingText] = useState<string>('');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [currentStroke, setCurrentStroke] = useState<DrawPoint[]>([]);
  
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
          // Store incoming stroke points (they come in small segments)
          // We'll append them to the last stroke or create new one
          setStrokes(prev => {
            if (prev.length === 0 || !message.points) {
              return message.points ? [{ points: message.points }] : prev;
            }
            // Append to last stroke
            const last = prev[prev.length - 1];
            const updated = [...prev];
            updated[updated.length - 1] = { points: [...last.points, ...message.points] };
            return updated;
          });
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
    // Clear strokes as well
    setStrokes([]);
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
        
        if (start.color === 'eraser') {
          // Apply eraser stroke
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
  }, [shapes, strokes, selectedShapeId]);

  // Auto-redraw when shapes or strokes change
  useEffect(() => {
    redrawCanvas();
  }, [shapes, strokes, redrawCanvas]);

  const updateTextShape = useCallback((newText: string) => {
    if (!editingTextId) return;
    setShapes(prev => prev.map(shape => 
      shape.id === editingTextId ? { ...shape, text: newText } : shape
    ));
    redrawCanvas();
  }, [editingTextId, redrawCanvas]);

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
          }
          setEditingTextId(null);
          setEditingText('');
          redrawCanvas();
        } else if (e.key === 'Enter' && !e.shiftKey) {
          // Finish text editing
          if (editingText.trim() && currentRoom) {
            const shape = shapes.find(s => s.id === editingTextId);
            if (shape) {
              const updatedShape = { ...shape, text: editingText.trim() };
              setShapes(prev => prev.map(s => s.id === editingTextId ? updatedShape : s));
              sendMessage({
                type: 'addShape',
                roomId: currentRoom.roomId,
                shapeId: editingTextId,
                shape: updatedShape
              });
            }
          } else if (!editingText.trim()) {
            // Remove empty text
            setShapes(prev => prev.filter(s => s.id !== editingTextId));
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
      // Start eraser stroke - don't add to currentStroke since we don't save eraser strokes
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
      // Eraser mode: use destination-out to actually erase
      const eraserWidth = getEraserSize();
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
      
      // Don't store eraser strokes - just erase visually
      // Send erase message to other users
      const points = [
        { x: lastPoint.current.x, y: lastPoint.current.y, color: 'eraser', size: eraserWidth },
        { x, y, color: 'eraser', size: eraserWidth },
      ];
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

    if (drawingMode === 'pen' && isDrawing && lastPoint.current) {
      // Draw freehand
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
      // Start pen stroke only (eraser doesn't need currentStroke)
      if (drawingMode === 'pen') {
        setCurrentStroke([{ x, y, color: brushColor, size: brushSize }]);
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
      // Eraser mode: use destination-out to actually erase
      const eraserWidth = getEraserSize();
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
    return <LoginView onLogin={handleLogin} />;
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
