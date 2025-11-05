import { Eraser, Palette, Users, LogOut, MousePointer2, Square, Circle, Minus, Triangle, PaintBucket } from 'lucide-react';
import './Whiteboard.css';
import type { DrawingMode } from '../types';

interface WhiteboardProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  roomName: string;
  username: string;
  participants: number;
  brushColor: string;
  brushSize: number;
  connectionStatus: string;
  drawingMode: DrawingMode;
  userCursors: Map<string, { username: string; x: number; y: number; isDrawing: boolean }>;
  onBrushColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onDrawingModeChange: (mode: DrawingMode) => void;
  onClearCanvas: () => void;
  onLeaveRoom: () => void;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void;
}

export const Whiteboard = ({
  canvasRef,
  roomName,
  username,
  participants,
  brushColor,
  brushSize,
  connectionStatus,
  drawingMode,
  userCursors,
  onBrushColorChange,
  onBrushSizeChange,
  onDrawingModeChange,
  onClearCanvas,
  onLeaveRoom,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: WhiteboardProps) => {
  return (
    <div className="whiteboard-view">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-section">
          <h2 className="room-title">
            <Palette size={24} />
            {roomName}
          </h2>
          <span className="user-badge">
            👤 {username}
          </span>
        </div>

        <div className="toolbar-section drawing-tools">
          <button 
            className={`tool-btn ${drawingMode === 'pen' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('pen')}
            title="Pen Tool"
          >
            <Palette size={18} />
          </button>
          <button 
            className={`tool-btn ${drawingMode === 'select' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('select')}
            title="Select Tool"
          >
            <MousePointer2 size={18} />
          </button>
          <button 
            className={`tool-btn ${drawingMode === 'rectangle' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('rectangle')}
            title="Rectangle"
          >
            <Square size={18} />
          </button>
          <button 
            className={`tool-btn ${drawingMode === 'circle' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('circle')}
            title="Circle"
          >
            <Circle size={18} />
          </button>
          <button 
            className={`tool-btn ${drawingMode === 'line' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('line')}
            title="Line"
          >
            <Minus size={18} />
          </button>
          <button 
            className={`tool-btn ${drawingMode === 'triangle' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('triangle')}
            title="Triangle"
          >
            <Triangle size={18} />
          </button>
          <button 
            className={`tool-btn ${drawingMode === 'fill' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('fill')}
            title="Fill Tool"
          >
            <PaintBucket size={18} />
          </button>
        </div>

        <div className="toolbar-section controls">
          <label className="control-item">
            <span>Color:</span>
            <input
              type="color"
              value={brushColor}
              onChange={(e) => onBrushColorChange(e.target.value)}
              className="color-picker"
            />
          </label>

          <label className="control-item">
            <span>Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="size-slider"
            />
            <span className="size-value">{brushSize}px</span>
          </label>

          <button onClick={onClearCanvas} className="btn-clear">
            <Eraser size={18} />
            Clear
          </button>

          <button onClick={onLeaveRoom} className="btn-leave">
            <LogOut size={18} />
            Leave
          </button>
        </div>

        <div className="toolbar-section">
          <span className="participants-badge">
            <Users size={18} />
            {participants} online
          </span>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="canvas-container">
        <div className="canvas-wrapper">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="drawing-canvas"
            style={{ touchAction: 'none' }}
          />

          {/* User Cursors */}
          {Array.from(userCursors.values()).map((cursor) => (
            <div
              key={cursor.username}
              className={`user-cursor ${cursor.isDrawing ? 'drawing' : ''}`}
              style={{
                left: cursor.x,
                top: cursor.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="cursor-pointer">✏️</div>
              <div className="cursor-label">{cursor.username}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <span className="status">{connectionStatus}</span>
        <span className="instructions">
          💡 Draw with mouse or touch • Change colors and sizes • Real-time collaboration
        </span>
      </div>
    </div>
  );
};
