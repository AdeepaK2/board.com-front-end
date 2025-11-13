import { useState, useEffect } from "react";
import {
  Save,
  FolderOpen,
  Download,
  Upload,
  X,
  Trash2,
  Calendar,
  User,
  Film,
} from "lucide-react";
import type { Shape, DrawPoint } from "../types";
import "./BoardManager.css";
import { TimelapseModal } from "./TimelapseModal";

interface BoardMetadata {
  boardId: string;
  boardName: string;
  savedBy: string;
  savedAt: string;
  shapeCount: number;
}

interface BoardManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  username: string;
  onLoadBoard: (boardId: string) => void;
  shapes: Shape[];
  strokes: { points: DrawPoint[] }[];
  eraserStrokes: { points: DrawPoint[] }[];
}

const API_URL = "http://" + window.location.hostname + ":8081/api/boards";

export const BoardManager = ({
  isOpen,
  onClose,
  currentRoomId,
  username,
  onLoadBoard,
  shapes,
  strokes,
  eraserStrokes,
}: BoardManagerProps) => {
  const [view, setView] = useState<"main" | "save" | "load" | "import">("main");
  const [boards, setBoards] = useState<BoardMetadata[]>([]);
  const [boardName, setBoardName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [timelapseOpen, setTimelapseOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<BoardMetadata | null>(
    null
  );

  useEffect(() => {
    if (isOpen && view === "load") {
      loadBoardsList();
    }
  }, [isOpen, view]);

  const loadBoardsList = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/list`);
      const data = await response.json();
      if (data.success) {
        setBoards(data.boards);
      }
    } catch (error) {
      console.error("Failed to load boards:", error);
      setMessage("Failed to load boards list");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBoard = async () => {
    if (!boardName.trim()) {
      setMessage("Please enter a board name");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardName: boardName.trim(),
          roomId: currentRoomId,
          username: username,
          shapes: shapes,
          strokes: strokes,
          eraserStrokes: eraserStrokes,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`Board saved successfully! ID: ${data.boardId}`);
        setBoardName("");
        setTimeout(() => {
          setView("main");
          setMessage("");
        }, 2000);
      } else {
        setMessage(data.error || "Failed to save board");
      }
    } catch (error) {
      console.error("Save error:", error);
      setMessage("Failed to save board");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBoard = async (boardId: string) => {
    setLoading(true);
    try {
      onLoadBoard(boardId);
      setMessage("Board loaded successfully!");
      setTimeout(() => {
        onClose();
        setView("main");
        setMessage("");
      }, 1000);
    } catch (error) {
      console.error("Load error:", error);
      setMessage("Failed to load board");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBoard = async (boardId: string, boardName: string) => {
    if (!confirm(`Delete board "${boardName}"? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/delete/${boardId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        setMessage("Board deleted successfully");
        loadBoardsList();
      } else {
        setMessage(data.error || "Failed to delete board");
      }
    } catch (error) {
      console.error("Delete error:", error);
      setMessage("Failed to delete board");
    } finally {
      setLoading(false);
    }
  };

  const handleExportBoard = async (boardId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });

      const data = await response.json();
      if (data.success) {
        // Download as JSON file
        const blob = new Blob([data.data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `board-${boardId}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage("Board exported successfully!");
      }
    } catch (error) {
      console.error("Export error:", error);
      setMessage("Failed to export board");
    } finally {
      setLoading(false);
    }
  };

  const handleImportBoard = async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const response = await fetch(`${API_URL}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardName: boardName.trim() || file.name.replace(".json", ""),
          data: text,
          username: username,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`Board imported successfully! ID: ${data.boardId}`);
        setBoardName("");
        setTimeout(() => {
          setView("main");
          setMessage("");
        }, 2000);
      } else {
        setMessage(data.error || "Failed to import board");
      }
    } catch (error) {
      console.error("Import error:", error);
      setMessage("Failed to import board");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="board-manager-overlay">
      <div className="board-manager-modal">
        <div className="modal-header">
          <h2>
            {view === "main" && "📋 Board Manager"}
            {view === "save" && "💾 Save Board"}
            {view === "load" && "📂 Load Board"}
            {view === "import" && "📥 Import Board"}
          </h2>
          <button onClick={onClose} className="btn-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {message && (
            <div
              className={`message ${
                message.includes("success") ? "success" : "error"
              }`}
            >
              {message}
            </div>
          )}

          {view === "main" && (
            <div className="main-menu">
              <button onClick={() => setView("save")} className="menu-btn">
                <Save size={24} />
                <span>Save Current Board</span>
              </button>
              <button onClick={() => setView("load")} className="menu-btn">
                <FolderOpen size={24} />
                <span>Load Saved Board</span>
              </button>
              <button onClick={() => setView("import")} className="menu-btn">
                <Upload size={24} />
                <span>Import Board from File</span>
              </button>
            </div>
          )}

          {view === "save" && (
            <div className="save-view">
              <label>
                Board Name:
                <input
                  type="text"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Enter board name..."
                  className="input-text"
                  disabled={loading}
                  autoFocus
                />
              </label>
              <div className="button-group">
                <button
                  onClick={handleSaveBoard}
                  disabled={loading || !boardName.trim()}
                  className="btn-primary"
                >
                  {loading ? "Saving..." : "Save Board"}
                </button>
                <button
                  onClick={() => setView("main")}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {view === "load" && (
            <div className="load-view">
              {loading ? (
                <div className="loading">Loading boards...</div>
              ) : boards.length === 0 ? (
                <div className="empty-state">No saved boards found</div>
              ) : (
                <div className="boards-list">
                  {boards.map((board) => (
                    <div key={board.boardId} className="board-card">
                      <div className="board-info">
                        <h3>{board.boardName}</h3>
                        <div className="board-meta">
                          <span>
                            <User size={14} /> {board.savedBy}
                          </span>
                          <span>
                            <Calendar size={14} /> {formatDate(board.savedAt)}
                          </span>
                          <span>🎨 {board.shapeCount} shapes</span>
                        </div>
                      </div>
                      <div className="board-actions">
                        <button
                          onClick={() => handleLoadBoard(board.boardId)}
                          className="btn-load"
                          title="Load"
                        >
                          <FolderOpen size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBoard(board);
                            setTimelapseOpen(true);
                          }}
                          className="btn-timelapse"
                          title="Generate Timelapse"
                        >
                          <Film size={18} />
                        </button>
                        <button
                          onClick={() => handleExportBoard(board.boardId)}
                          className="btn-export"
                          title="Export"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteBoard(board.boardId, board.boardName)
                          }
                          className="btn-delete"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setView("main")} className="btn-secondary">
                Back
              </button>
            </div>
          )}

          {view === "import" && (
            <div className="import-view">
              <label>
                Board Name (optional):
                <input
                  type="text"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Auto-generated from filename..."
                  className="input-text"
                  disabled={loading}
                  autoFocus
                />
              </label>
              <label className="file-input-label">
                <Upload size={20} />
                <span>Choose JSON file</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportBoard(file);
                  }}
                  disabled={loading}
                  className="file-input"
                />
              </label>
              <button onClick={() => setView("main")} className="btn-secondary">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedBoard && (
        <TimelapseModal
          isOpen={timelapseOpen}
          onClose={() => {
            setTimelapseOpen(false);
            setSelectedBoard(null);
          }}
          boardId={selectedBoard.boardId}
          boardName={selectedBoard.boardName}
        />
      )}
    </div>
  );
};
