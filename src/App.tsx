import React, { useState, useRef, useEffect } from "react";
import "./App.css";

interface DrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
}

interface ShapeData {
  type: "rectangle" | "circle";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  size: number;
}

interface DrawMessage {
  type: "draw";
  points: DrawPoint[];
  username: string;
}

interface ShapeMessage {
  type: "shape";
  shape: ShapeData;
  username: string;
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
  | ShapeMessage;

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
  const [drawMode, setDrawMode] = useState<"free" | "rectangle" | "circle">(
    "free"
  );
  const [shapeStartPos, setShapeStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [previewShape, setPreviewShape] = useState<ShapeData | null>(null);

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
            drawOnCanvas(data.points);
            break;
          case "shape":
            drawShapeOnCanvas(data.shape);
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

  const drawShapeOnCanvas = (shape: ShapeData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

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

    setIsDrawing(true);
    const pos = getCanvasCoordinates(e);

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

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoordinates(e);

    // Always send cursor updates for real-time tracking
    if (isConnected) {
      sendCursorUpdate(pos.x, pos.y, isDrawing);
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
          type: "rectangle",
          x: shapeStartPos.x,
          y: shapeStartPos.y,
          width,
          height,
          color: brushColor,
          size: brushSize,
        };
      } else if (drawMode === "circle") {
        const radius = Math.sqrt(
          Math.pow(pos.x - shapeStartPos.x, 2) +
            Math.pow(pos.y - shapeStartPos.y, 2)
        );
        shape = {
          type: "circle",
          x: shapeStartPos.x,
          y: shapeStartPos.y,
          radius,
          color: brushColor,
          size: brushSize,
        };
      }

      setPreviewShape(shape);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    setIsDrawing(false);

    if (drawMode === "free" && currentPoints.length > 0) {
      // Send drawing data to server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const message: DrawMessage = {
          type: "draw",
          points: currentPoints,
          username,
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
      // Finalize and send shape
      drawShapeOnCanvas(previewShape);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const message: ShapeMessage = {
          type: "shape",
          shape: previewShape,
          username,
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
          </div>

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
