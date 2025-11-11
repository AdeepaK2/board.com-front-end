import { useState } from 'react';
import { Eraser, Palette, Users, LogOut, MousePointer2, Square, Circle, Minus, Triangle, PaintBucket, FolderOpen, ChevronDown, Shapes, Type, Image } from 'lucide-react';
import './Whiteboard.css';
import type { DrawingMode } from '../types';
import { ImageUploadTool } from './ImageUploadTool';

interface WhiteboardProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  roomName: string;
  username: string;
  participants: number;
  brushColor: string;
  brushSize: number;
  eraserSize: number;
  connectionStatus: string;
  drawingMode: DrawingMode;
  userCursors: Map<string, { username: string; x: number; y: number; isDrawing: boolean }>;
  onBrushColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onEraserSizeChange: (size: number) => void;
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
  onOpenBoardManager: () => void;
  onImageUploadSuccess?: () => void;
  onImageUploadError?: (error: string) => void;
}

export const Whiteboard = ({
  canvasRef,
  roomName,
  username,
  participants,
  brushColor,
  brushSize,
  eraserSize,
  connectionStatus,
  drawingMode,
  userCursors,
  onBrushColorChange,
  onBrushSizeChange,
  onEraserSizeChange,
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
  onOpenBoardManager,
  onImageUploadSuccess,
  onImageUploadError,
}: WhiteboardProps) => {
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);
  const [isImageUploadOpen, setIsImageUploadOpen] = useState(false);

  const shapeTools = [
    { mode: 'rectangle' as DrawingMode, icon: Square, label: 'Rectangle' },
    { mode: 'circle' as DrawingMode, icon: Circle, label: 'Circle' },
    { mode: 'line' as DrawingMode, icon: Minus, label: 'Line' },
    { mode: 'triangle' as DrawingMode, icon: Triangle, label: 'Triangle' },
  ];

  const isShapeMode = ['rectangle', 'circle', 'line', 'triangle'].includes(drawingMode);
  const currentShapeTool = shapeTools.find(tool => tool.mode === drawingMode) || shapeTools[0];

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
            className={`tool-btn ${drawingMode === 'eraser' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('eraser')}
            title="Eraser Tool"
          >
            <Eraser size={18} />
          </button>
          <button 
            className={`tool-btn ${drawingMode === 'select' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('select')}
            title="Select Tool"
          >
            <MousePointer2 size={18} />
          </button>
          
          {/* Shapes Dropdown */}
          <div className="shapes-dropdown">
            <button 
              className={`tool-btn ${isShapeMode ? 'active' : ''}`}
              onClick={() => setShowShapesDropdown(!showShapesDropdown)}
              title="Shapes"
            >
              {isShapeMode ? <currentShapeTool.icon size={18} /> : <Shapes size={18} />}
              <ChevronDown size={14} className="dropdown-icon" />
            </button>
            {showShapesDropdown && (
              <div className="dropdown-menu">
                {shapeTools.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    className={`dropdown-item ${drawingMode === mode ? 'active' : ''}`}
                    onClick={() => {
                      onDrawingModeChange(mode);
                      setShowShapesDropdown(false);
                    }}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            className={`tool-btn ${drawingMode === 'fill' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('fill')}
            title="Fill Tool"
          >
            <PaintBucket size={18} />
          </button>
          
          <button 
            className={`tool-btn ${drawingMode === 'text' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('text')}
            title="Text Tool"
          >
            <Type size={18} />
          </button>
          <button 
            className="tool-btn"
            onClick={() => setIsImageUploadOpen(true)}
            title="Upload Image"
          >
            <Image size={18} />
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
              disabled={drawingMode === 'eraser'}
            />
          </label>

          {drawingMode === 'eraser' ? (
            <label className="control-item">
              <span>Eraser Size:</span>
              <div className="eraser-size-buttons">
                <button 
                  className={`size-btn ${eraserSize === 1 ? 'active' : ''}`}
                  onClick={() => onEraserSizeChange(1)}
                  title="Small (10px)"
                >
                  S
                </button>
                <button 
                  className={`size-btn ${eraserSize === 2 ? 'active' : ''}`}
                  onClick={() => onEraserSizeChange(2)}
                  title="Medium (20px)"
                >
                  M
                </button>
                <button 
                  className={`size-btn ${eraserSize === 3 ? 'active' : ''}`}
                  onClick={() => onEraserSizeChange(3)}
                  title="Large (40px)"
                >
                  L
                </button>
                <button 
                  className={`size-btn ${eraserSize === 4 ? 'active' : ''}`}
                  onClick={() => onEraserSizeChange(4)}
                  title="Extra Large (80px)"
                >
                  XL
                </button>
              </div>
            </label>
          ) : (
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
          )}

          <button onClick={onClearCanvas} className="btn-clear">
            <Eraser size={18} />
            Clear
          </button>

          <button onClick={onOpenBoardManager} className="btn-boards">
            <FolderOpen size={18} />
            Boards
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

      {/* Image Upload Tool */}
      <ImageUploadTool
        isOpen={isImageUploadOpen}
        onClose={() => setIsImageUploadOpen(false)}
        roomName={roomName}
        onUploadSuccess={onImageUploadSuccess}
        onUploadError={onImageUploadError}
      />
    </div>
  );
};
