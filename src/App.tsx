import React, { useState, useRef, useEffect } from "react";
import "./App.css";

interface DrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
}

interface DrawStroke {
  id: string;
  points: DrawPoint[];
  username: string;
}

interface ShapeData {
  id: string;
  type: "rectangle" | "circle";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  size: number;
  fillColor?: string;
  username: string;
}

interface DrawMessage {
  type: "draw";
  stroke: DrawStroke;
}

interface ShapeMessage {
  type: "shape";
  shape: ShapeData;
}

interface UpdateMessage {
  type: "update";
  elementId: string;
  elementType: "stroke" | "shape";
  data: Partial<DrawStroke> | Partial<ShapeData>;
}

interface DeleteMessage {
  type: "delete";
  elementId: string;
}

interface CursorMessage {
  type: "cursor";
  x: number;
  y: number;
  username: string;
  isDrawing: boolean;
}

interface UserMessage {
  type: "userJoined" | "userLeft";
  username: string;
}

interface ClearMessage {
  type: "clear";
  username: string;
}

type WebSocketMessage =
  | DrawMessage
  | UserMessage
  | ClearMessage
  | CursorMessage
  | ShapeMessage
  | UpdateMessage
  | DeleteMessage;

interface UserCursor {
  x: number;
  y: number;
  username: string;
  isDrawing: boolean;
  lastUpdate: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [username, setUsername] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<string[]>([]);
  const [currentPoints, setCurrentPoints] = useState<DrawPoint[]>([]);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(2);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [userCursors, setUserCursors] = useState<Map<string, UserCursor>>(
    new Map()
  );
  const [drawMode, setDrawMode] = useState<
    "free" | "rectangle" | "circle" | "select" | "fill"
  >("free");
  const [shapeStartPos, setShapeStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [previewShape, setPreviewShape] = useState<ShapeData | null>(null);

  // Store all drawing elements
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [shapes, setShapes] = useState<ShapeData[]>([]);

  // Selection and interaction
  const [selectedElement, setSelectedElement] = useState<{
    type: "stroke" | "shape";
    id: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [fillColor, setFillColor] = useState("#ff0000");

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
      setUserCursors((prev) => {
        const newCursors = new Map(prev);
        for (const [username, cursor] of newCursors.entries()) {
          if (now - cursor.lastUpdate > 3000) {
            // Remove after 3 seconds of inactivity
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
      alert("Please enter a username");
      return;
    }

    setConnectionStatus("Connecting...");
    // Use environment variable for WebSocket URL, fallback to same domain for production
    const wsUrl =
      import.meta.env.VITE_WEBSOCKET_URL ||
      (window.location.protocol === "https:"
        ? `wss://${window.location.host}/ws`
        : "ws://localhost:8080");
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Connected to server");
      setIsConnected(true);
      setConnectionStatus("Connected");
      ws.send(JSON.stringify({ type: "join", username: username.trim() }));
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);

        switch (data.type) {
          case "draw":
            setStrokes((prev) => [...prev, data.stroke]);
            redrawCanvas();
            break;
          case "shape":
            setShapes((prev) => [...prev, data.shape]);
            redrawCanvas();
            break;
          case "update":
            handleUpdateMessage(data);
            break;
          case "delete":
            handleDeleteMessage(data);
            break;
          case "cursor":
            handleCursorUpdate(data);
            break;
          case "userJoined":
            setUsers((prev) => [
              ...prev.filter((u) => u !== data.username),
              data.username,
            ]);
            setConnectionStatus(`${data.username} joined`);
            setTimeout(() => setConnectionStatus("Connected"), 2000);
            break;
          case "userLeft":
            setUsers((prev) => prev.filter((u) => u !== data.username));
            setUserCursors((prev) => {
              const newCursors = new Map(prev);
              newCursors.delete(data.username);
              return newCursors;
            });
            setConnectionStatus(`${data.username} left`);
            setTimeout(() => setConnectionStatus("Connected"), 2000);
            break;
          case "clear":
            setStrokes([]);
            setShapes([]);
            clearCanvas();
            setConnectionStatus(`Canvas cleared by ${data.username}`);
            setTimeout(() => setConnectionStatus("Connected"), 2000);
            break;
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from server");
      setIsConnected(false);
      setConnectionStatus("Disconnected");
      setUsers([]);
      setUserCursors(new Map());
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus("Connection error");
    };

    wsRef.current = ws;
  };

  const handleCursorUpdate = (data: CursorMessage) => {
    if (data.username !== username) {
      setUserCursors((prev) => {
        const newCursors = new Map(prev);
        newCursors.set(data.username, {
          x: data.x,
          y: data.y,
          username: data.username,
          isDrawing: data.isDrawing,
          lastUpdate: Date.now(),
        });
        return newCursors;
      });
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;
      ctx.strokeStyle = stroke.points[0].color;
      ctx.lineWidth = stroke.points[0].size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    });

    // Draw all shapes
    shapes.forEach((shape) => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Fill if has fillColor
      if (shape.fillColor) {
        ctx.fillStyle = shape.fillColor;
      }

      ctx.beginPath();
      if (
        shape.type === "rectangle" &&
        shape.width !== undefined &&
        shape.height !== undefined
      ) {
        ctx.rect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === "circle" && shape.radius !== undefined) {
        ctx.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
      }

      if (shape.fillColor) {
        ctx.fill();
      }
      ctx.stroke();
    });

    // Draw selection highlight if any
    if (selectedElement) {
      drawSelectionHighlight();
    }
  };

  // Effect to redraw whenever strokes or shapes change
  useEffect(() => {
    redrawCanvas();
  }, [strokes, shapes, selectedElement]);

  const drawOnCanvas = (points: DrawPoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = points[0].color;
    ctx.lineWidth = points[0].size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

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

  const drawSelectionHighlight = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedElement) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#0080ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    if (selectedElement.type === "shape") {
      const shape = shapes.find((s) => s.id === selectedElement.id);
      if (!shape) return;

      ctx.beginPath();
      if (shape.type === "rectangle" && shape.width && shape.height) {
        const padding = 10;
        ctx.rect(
          shape.x - padding,
          shape.y - padding,
          shape.width + padding * 2,
          shape.height + padding * 2
        );

        // Draw resize handles
        drawResizeHandles(shape);
      } else if (shape.type === "circle" && shape.radius) {
        ctx.arc(shape.x, shape.y, shape.radius + 10, 0, 2 * Math.PI);

        // Draw resize handles
        drawResizeHandles(shape);
      }
      ctx.stroke();
    }

    ctx.setLineDash([]);
  };

  const drawResizeHandles = (shape: ShapeData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0080ff";
    const handleSize = 8;

    if (shape.type === "rectangle" && shape.width && shape.height) {
      // Corner handles
      const handles = [
        { x: shape.x, y: shape.y }, // top-left
        { x: shape.x + shape.width, y: shape.y }, // top-right
        { x: shape.x, y: shape.y + shape.height }, // bottom-left
        { x: shape.x + shape.width, y: shape.y + shape.height }, // bottom-right
      ];

      handles.forEach((handle) => {
        ctx.fillRect(
          handle.x - handleSize / 2,
          handle.y - handleSize / 2,
          handleSize,
          handleSize
        );
      });
    } else if (shape.type === "circle" && shape.radius) {
      // Right handle for radius
      ctx.fillRect(
        shape.x + shape.radius - handleSize / 2,
        shape.y - handleSize / 2,
        handleSize,
        handleSize
      );
    }
  };

  const handleUpdateMessage = (data: UpdateMessage) => {
    if (data.elementType === "shape") {
      setShapes((prev) =>
        prev.map((shape) =>
          shape.id === data.elementId ? { ...shape, ...data.data } : shape
        )
      );
    } else if (data.elementType === "stroke") {
      setStrokes((prev) =>
        prev.map((stroke) =>
          stroke.id === data.elementId ? { ...stroke, ...data.data } : stroke
        )
      );
    }
    redrawCanvas();
  };

  const handleDeleteMessage = (data: DeleteMessage) => {
    setShapes((prev) => prev.filter((shape) => shape.id !== data.elementId));
    setStrokes((prev) => prev.filter((stroke) => stroke.id !== data.elementId));
    redrawCanvas();
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const sendCursorUpdate = (x: number, y: number, isDrawing: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "cursor",
          x: x,
          y: y,
          username: username,
          isDrawing: isDrawing,
        })
      );
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isConnected) return;

    const pos = getCanvasCoordinates(e);

    // Handle fill mode
    if (drawMode === "fill") {
      const clickedShape = findShapeAtPosition(pos.x, pos.y);
      if (clickedShape) {
        // Fill the shape
        const updatedShape = { ...clickedShape, fillColor };
        setShapes((prev) =>
          prev.map((s) => (s.id === clickedShape.id ? updatedShape : s))
        );

        // Send update to server
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message: UpdateMessage = {
            type: "update",
            elementId: clickedShape.id,
            elementType: "shape",
            data: { fillColor },
          };
          wsRef.current.send(JSON.stringify(message));
        }
      }
      return;
    }

    // Handle select mode
    if (drawMode === "select") {
      const clickedShape = findShapeAtPosition(pos.x, pos.y);
      const clickedStroke = findStrokeAtPosition(pos.x, pos.y);

      if (clickedShape) {
        setSelectedElement({ type: "shape", id: clickedShape.id });
        setIsDragging(true);
        setDragStart(pos);
      } else if (clickedStroke) {
        setSelectedElement({ type: "stroke", id: clickedStroke.id });
        setIsDragging(true);
        setDragStart(pos);
      } else {
        setSelectedElement(null);
      }
      return;
    }

    // Drawing modes
    setIsDrawing(true);

    if (drawMode === "free") {
      const newPoint = {
        x: pos.x,
        y: pos.y,
        color: brushColor,
        size: brushSize,
      };
      setCurrentPoints([newPoint]);
    } else {
      // For shapes, store the starting position
      setShapeStartPos(pos);
    }

    sendCursorUpdate(pos.x, pos.y, true);
  };

  const findShapeAtPosition = (x: number, y: number): ShapeData | null => {
    // Check shapes in reverse order (topmost first)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      if (shape.type === "rectangle" && shape.width && shape.height) {
        if (
          x >= shape.x &&
          x <= shape.x + shape.width &&
          y >= shape.y &&
          y <= shape.y + shape.height
        ) {
          return shape;
        }
      } else if (shape.type === "circle" && shape.radius) {
        const distance = Math.sqrt(
          Math.pow(x - shape.x, 2) + Math.pow(y - shape.y, 2)
        );
        if (distance <= shape.radius) {
          return shape;
        }
      }
    }
    return null;
  };

  const findStrokeAtPosition = (x: number, y: number): DrawStroke | null => {
    const threshold = 10; // pixels
    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i];
      for (const point of stroke.points) {
        const distance = Math.sqrt(
          Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2)
        );
        if (distance <= threshold) {
          return stroke;
        }
      }
    }
    return null;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoordinates(e);

    // Always send cursor updates for real-time tracking
    if (isConnected) {
      sendCursorUpdate(pos.x, pos.y, isDrawing);
    }

    // Handle dragging selected elements
    if (isDragging && dragStart && selectedElement && drawMode === "select") {
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;

      if (selectedElement.type === "shape") {
        setShapes((prev) =>
          prev.map((shape) => {
            if (shape.id === selectedElement.id) {
              return { ...shape, x: shape.x + deltaX, y: shape.y + deltaY };
            }
            return shape;
          })
        );
      } else if (selectedElement.type === "stroke") {
        setStrokes((prev) =>
          prev.map((stroke) => {
            if (stroke.id === selectedElement.id) {
              return {
                ...stroke,
                points: stroke.points.map((p) => ({
                  ...p,
                  x: p.x + deltaX,
                  y: p.y + deltaY,
                })),
              };
            }
            return stroke;
          })
        );
      }

      setDragStart(pos);
      return;
    }

    if (!isDrawing || !isConnected) return;

    if (drawMode === "free") {
      const newPoint = {
        x: pos.x,
        y: pos.y,
        color: brushColor,
        size: brushSize,
      };

      setCurrentPoints((prev) => {
        const newPoints = [...prev, newPoint];

        // Draw locally
        if (newPoints.length >= 2) {
          drawOnCanvas(newPoints.slice(-2));
        }

        return newPoints;
      });
    } else if (shapeStartPos) {
      // Update preview shape
      let shape: ShapeData | null = null;

      if (drawMode === "rectangle") {
        const width = pos.x - shapeStartPos.x;
        const height = pos.y - shapeStartPos.y;
        shape = {
          id: Date.now().toString(),
          type: "rectangle",
          x: shapeStartPos.x,
          y: shapeStartPos.y,
          width,
          height,
          color: brushColor,
          size: brushSize,
          username,
        };
      } else if (drawMode === "circle") {
        const radius = Math.sqrt(
          Math.pow(pos.x - shapeStartPos.x, 2) +
            Math.pow(pos.y - shapeStartPos.y, 2)
        );
        shape = {
          id: Date.now().toString(),
          type: "circle",
          x: shapeStartPos.x,
          y: shapeStartPos.y,
          radius,
          color: brushColor,
          size: brushSize,
          username,
        };
      }

      setPreviewShape(shape);
    }
  };

  const stopDrawing = () => {
    // Handle drag stop
    if (isDragging && selectedElement) {
      setIsDragging(false);
      setDragStart(null);

      // Send update to server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const element =
          selectedElement.type === "shape"
            ? shapes.find((s) => s.id === selectedElement.id)
            : strokes.find((s) => s.id === selectedElement.id);

        if (element) {
          const message: UpdateMessage = {
            type: "update",
            elementId: selectedElement.id,
            elementType: selectedElement.type,
            data: element,
          };
          wsRef.current.send(JSON.stringify(message));
        }
      }
      return;
    }

    if (!isDrawing) return;

    setIsDrawing(false);

    if (drawMode === "free" && currentPoints.length > 0) {
      // Create stroke with ID
      const newStroke: DrawStroke = {
        id: `${username}-${Date.now()}`,
        points: currentPoints,
        username,
      };

      // Add to local strokes
      setStrokes((prev) => [...prev, newStroke]);

      // Send drawing data to server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const message: DrawMessage = {
          type: "draw",
          stroke: newStroke,
        };
        wsRef.current.send(JSON.stringify(message));
      }

      setCurrentPoints([]);

      // Update cursor state
      const lastPoint = currentPoints[currentPoints.length - 1];
      if (lastPoint) {
        sendCursorUpdate(lastPoint.x, lastPoint.y, false);
      }
    } else if (
      (drawMode === "rectangle" || drawMode === "circle") &&
      previewShape
    ) {
      // Add to local shapes
      setShapes((prev) => [...prev, previewShape]);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const message: ShapeMessage = {
          type: "shape",
          shape: previewShape,
        };
        wsRef.current.send(JSON.stringify(message));
      }

      setPreviewShape(null);
      setShapeStartPos(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    draw(e);
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      stopDrawing();
    }
    // Clear preview when mouse leaves canvas
    setPreviewShape(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearClick = () => {
    if (!isConnected) return;

    clearCanvas();

    // Send clear command to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clear", username }));
    }
  };

  if (!isConnected) {
    return (
      <div className="login-container">
        <h1>🎨 Live Whiteboard</h1>
        <p>Enter your name to join the collaborative whiteboard</p>
        <div className="login-form">
          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && connectToServer()}
            maxLength={20}
          />
          <button onClick={connectToServer} disabled={!username.trim()}>
            Join Whiteboard
          </button>
        </div>
        <div className="connection-status">Status: {connectionStatus}</div>
        <div className="instructions">
          <p>💡 Make sure the Java WebSocket server is running on port 8080</p>
          <p>🖱️ Use mouse to draw, select colors and brush sizes</p>
          <p>👥 See other users draw in real-time with their cursors</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="toolbar">
        <div className="user-info">
          <h2>🎨 Whiteboard</h2>
          <span className="username">👤 {username}</span>
        </div>

        <div className="controls">
          <label className="color-control">
            🎨 Color:
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
            />
          </label>

          <div className="shape-selector">
            <label>🔧 Tool:</label>
            <button
              className={`shape-btn ${drawMode === "free" ? "active" : ""}`}
              onClick={() => setDrawMode("free")}
              title="Free draw"
            >
              ✏️
            </button>
            <button
              className={`shape-btn ${
                drawMode === "rectangle" ? "active" : ""
              }`}
              onClick={() => setDrawMode("rectangle")}
              title="Rectangle"
            >
              ▭
            </button>
            <button
              className={`shape-btn ${drawMode === "circle" ? "active" : ""}`}
              onClick={() => setDrawMode("circle")}
              title="Circle"
            >
              ⭕
            </button>
            <button
              className={`shape-btn ${drawMode === "select" ? "active" : ""}`}
              onClick={() => setDrawMode("select")}
              title="Select & Move"
            >
              👆
            </button>
            <button
              className={`shape-btn ${drawMode === "fill" ? "active" : ""}`}
              onClick={() => setDrawMode("fill")}
              title="Fill shapes"
            >
              🪣
            </button>
          </div>

          {drawMode === "fill" && (
            <label className="color-control">
              🪣 Fill:
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
              />
            </label>
          )}

          <label className="size-control">
            ✏️ Size:
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
            🗑️ Clear All
          </button>
        </div>

        <div className="users-panel">
          <h3>👥 Online ({users.length + 1})</h3>
          <div className="users-list">
            <div className="user current-user">👤 {username} (You)</div>
            {users.map((user, index) => (
              <div key={index} className="user">
                👤 {user}
              </div>
            ))}
          </div>
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

          {/* Preview canvas for shapes */}
          {previewShape && (
            <canvas
              width={1200}
              height={700}
              className="preview-canvas"
              ref={(canvas) => {
                if (canvas && previewShape) {
                  const ctx = canvas.getContext("2d");
                  if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.strokeStyle = previewShape.color;
                    ctx.lineWidth = previewShape.size;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    if (
                      previewShape.type === "rectangle" &&
                      previewShape.width !== undefined &&
                      previewShape.height !== undefined
                    ) {
                      ctx.rect(
                        previewShape.x,
                        previewShape.y,
                        previewShape.width,
                        previewShape.height
                      );
                    } else if (
                      previewShape.type === "circle" &&
                      previewShape.radius !== undefined
                    ) {
                      ctx.arc(
                        previewShape.x,
                        previewShape.y,
                        previewShape.radius,
                        0,
                        2 * Math.PI
                      );
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                  }
                }
              }}
            />
          )}

          {/* Render user cursors */}
          {Array.from(userCursors.values()).map((cursor) => (
            <div
              key={cursor.username}
              className={`user-cursor ${cursor.isDrawing ? "drawing" : ""}`}
              style={{
                left: cursor.x,
                top: cursor.y,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="cursor-pointer">✏️</div>
              <div className="cursor-label">{cursor.username}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="status-bar">
        <span className="status">Status: {connectionStatus}</span>
        <span className="instructions">
          💡 Click and drag to draw • Select colors and brush sizes • See
          others' cursors in real-time
        </span>
      </div>
    </div>
  );
}

export default App;
