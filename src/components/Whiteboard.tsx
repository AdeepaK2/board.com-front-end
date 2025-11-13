import { useState } from 'react';
import { Eraser, Palette, Users, LogOut, MousePointer2, Square, Circle, Minus, Triangle, PaintBucket, FolderOpen, ChevronDown, Shapes, Type, Image } from 'lucide-react';
import './Whiteboard.css';
<<<<<<< HEAD
import type { DrawingMode } from '../types';
import { ImageUploadTool } from './ImageUploadTool';
=======
import type { DrawingMode, Shape } from '../types';
>>>>>>> 858c87b3b0d977ff312f2bbe197afb604f79b708

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
<<<<<<< HEAD
  onImageUploadSuccess?: () => void;
  onImageUploadError?: (error: string) => void;
=======
  onNotify?: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void;
  onAddStickyNote?: (color?: string) => void;
  shapes?: Shape[];
  selectedShapeId?: string | null;
  onDeleteShape?: (shapeId: string) => void;
>>>>>>> 858c87b3b0d977ff312f2bbe197afb604f79b708
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
<<<<<<< HEAD
  onImageUploadSuccess,
  onImageUploadError,
=======
  onNotify,
  onAddStickyNote,
  shapes,
  selectedShapeId,
  onDeleteShape,
>>>>>>> 858c87b3b0d977ff312f2bbe197afb604f79b708
}: WhiteboardProps) => {
  // popup visibility is determined by drawingMode === 'sticky'
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);
<<<<<<< HEAD
  const [isImageUploadOpen, setIsImageUploadOpen] = useState(false);
=======
  const [downloadFilename, setDownloadFilename] = useState('');
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpeg'>('png');
  const [downloadOpen, setDownloadOpen] = useState(false);
>>>>>>> 858c87b3b0d977ff312f2bbe197afb604f79b708

  const shapeTools = [
    { mode: 'rectangle' as DrawingMode, icon: Square, label: 'Rectangle' },
    { mode: 'circle' as DrawingMode, icon: Circle, label: 'Circle' },
    { mode: 'line' as DrawingMode, icon: Minus, label: 'Line' },
    { mode: 'triangle' as DrawingMode, icon: Triangle, label: 'Triangle' },
  ];

  const isShapeMode = ['rectangle', 'circle', 'line', 'triangle'].includes(drawingMode);
  const currentShapeTool = shapeTools.find(tool => tool.mode === drawingMode) || shapeTools[0];

  // When user selects another drawing mode, any sticky popup will naturally be not shown
  // because stickyColorOpen is derived from drawingMode.

  // Download the current canvas as an image (PNG). Uses a temporary canvas to
  // ensure a white background (avoids transparent PNGs looking odd).
  const handleDownload = (filename?: string, format: 'png' | 'jpeg' = 'png') => {
    const canvas = canvasRef?.current;
    if (!canvas) return;

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      // Fill white background then draw the real canvas on top
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      ctx.drawImage(canvas, 0, 0);

      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataURL = tempCanvas.toDataURL(mime);

      // Determine filename: use provided, otherwise use default with timestamp
      let name = filename && filename.trim() ? filename.trim() : `whiteboard_${Date.now()}`;
      // If user supplied an extension, respect it; otherwise append .png/.jpg accordingly
      const lower = name.toLowerCase();
      if (!/\.(png|jpg|jpeg)$/i.test(lower)) {
        name = `${name}.${format === 'jpeg' ? 'jpg' : 'png'}`;
      }

      const link = document.createElement('a');
      link.href = dataURL;
      link.download = name;
      // Programmatically click the link to trigger download
      link.click();

      // Notify caller (if provided) that download completed
      if (onNotify) {
        onNotify(`Downloaded ${name}`, 'success', 3000);
      }
    } catch (err) {
      // Silent fail — could show a notification if desired
      // eslint-disable-next-line no-console
      console.error('Failed to download canvas image', err);
    }
  };

  return (
    <div className="whiteboard-view">
      {/* Toolbar */}
  <div className="toolbar" style={{ position: 'relative' }}>
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
<<<<<<< HEAD
          <button 
            className="tool-btn"
            onClick={() => setIsImageUploadOpen(true)}
            title="Upload Image"
          >
            <Image size={18} />
          </button>
=======
          {/* Sticky button placed next to Text tool so toolbar order remains consistent */}
          <div className="sticky-dropdown" style={{ position: 'relative' }}>
            <button
              className={`tool-btn ${drawingMode === 'sticky' ? 'active' : ''}`}
              onClick={() => {
                // Toggle sticky mode: if already in sticky mode, switch back to select, otherwise activate sticky
                if (drawingMode === 'sticky') {
                  onDrawingModeChange('select');
                } else {
                  onDrawingModeChange('sticky');
                }
              }}
              title="Sticky Note"
              aria-label="Sticky Note"
            >
              <Square size={18} />
            </button>

            {drawingMode === 'sticky' && (
              <div className="dropdown-menu" style={{ minWidth: 120, display: 'flex', gap: 6, padding: 8 }}>
                {['#fff59d', '#ffcc80', '#c8e6c9', '#bbdefb', '#f8bbd0'].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      if (onAddStickyNote) onAddStickyNote(c);
                      // after creating one sticky, return to select so the toolbar active state follows selected tool
                      onDrawingModeChange('select');
                    }}
                    title={`Create ${c} note`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      background: c,
                      padding: 0,
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
>>>>>>> 858c87b3b0d977ff312f2bbe197afb604f79b708
        </div>

  <div className="toolbar-section controls" style={{ position: 'relative' }}>
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

          {/* Keep toolbar layout unchanged: show only the Download button here. */}
          
          <button
            onClick={() => setDownloadOpen((v) => !v)}
            className="btn-download"
            title="Download Whiteboard"
          >
            ⤓
            Download
          </button>

          {/* Popup for filename & format appears only when downloadOpen is true. */}
          {downloadOpen && (
            <div
              className="download-popup"
              style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.12)',
                padding: '8px',
                borderRadius: '6px',
                boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                zIndex: 50,
                minWidth: '220px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  type="text"
                  placeholder={`whiteboard_${Date.now()}`}
                  value={downloadFilename}
                  onChange={(e) => setDownloadFilename(e.target.value)}
                  style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <select
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value as 'png' | 'jpeg')}
                  style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                </select>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      // Cancel
                      setDownloadOpen(false);
                    }}
                    style={{ padding: '6px 10px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const filename = downloadFilename.trim() ? downloadFilename.trim() : undefined;
                      handleDownload(filename, downloadFormat);
                      setDownloadOpen(false);
                      // reset filename field for next time
                      setDownloadFilename('');
                    }}
                    style={{ padding: '6px 10px' }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

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
        {/* moved sticky control into the controls section above */}
      </div>

      {/* Canvas Area */}
      <div className="canvas-container">
        <div className="canvas-wrapper">
            {/* Delete button overlay for selected sticky notes (only in select mode) */}
            {selectedShapeId && onDeleteShape && drawingMode === 'select' && (() => {
              const shape = shapes?.find((s: Shape) => s.id === selectedShapeId);
              if (shape && shape.type === 'text' && shape.width && shape.height) {
                // Position relative to canvas-wrapper (canvas coordinates)
                const left = shape.x + shape.width - 12; // slight inset for button
                const top = Math.max(0, shape.y - 12);
                return (
                  <button
                    className="sticky-delete-btn"
                    style={{ left: `${left}px`, top: `${top}px` }}
                    onClick={() => onDeleteShape(shape.id)}
                    title="Delete sticky note"
                    aria-label="Delete sticky note"
                  >
                    ×
                  </button>
                );
              }
              return null;
            })()}
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
