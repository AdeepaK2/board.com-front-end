import React, { useState, useEffect } from "react";
import { boardAPI, type BoardMetadata } from "../api/boardAPI";
import "./SaveBoardDialog.css";

interface LoadBoardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (boardId: string) => void;
}

const LoadBoardDialog: React.FC<LoadBoardDialogProps> = ({
  isOpen,
  onClose,
  onLoad,
}) => {
  const [boards, setBoards] = useState<BoardMetadata[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadBoards();
    }
  }, [isOpen]);

  const loadBoards = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const boardList = await boardAPI.listBoards();
      // Sort by last modified (newest first)
      boardList.sort((a, b) => b.lastModified - a.lastModified);
      setBoards(boardList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async () => {
    if (!selectedBoardId) {
      alert("Please select a board to load");
      return;
    }

    setIsLoadingBoard(true);
    try {
      await onLoad(selectedBoardId);
      onClose();
    } catch (error) {
      console.error("Error loading board:", error);
      setError(error instanceof Error ? error.message : "Failed to load board");
    } finally {
      setIsLoadingBoard(false);
    }
  };

  const handleDelete = async (
    boardId: string,
    boardName: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${boardName}"?`)) {
      return;
    }

    try {
      await boardAPI.deleteBoard(boardId);
      setBoards(boards.filter((b) => b.id !== boardId));
      if (selectedBoardId === boardId) {
        setSelectedBoardId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete board");
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString();
  };

  const filteredBoards = boards.filter(
    (board) =>
      board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      board.createdBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "700px" }}
      >
        <h2>📂 Load Whiteboard</h2>

        <div className="dialog-body">
          <div className="search-box">
            <input
              type="search"
              placeholder="Search boards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {error && (
            <div className="error-state">
              ❌ {error}
              <button onClick={loadBoards} style={{ marginLeft: "12px" }}>
                Retry
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="loading-state">
              <p>🔄 Loading boards...</p>
            </div>
          ) : filteredBoards.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p>
                {boards.length === 0
                  ? "No saved boards yet"
                  : "No boards match your search"}
              </p>
            </div>
          ) : (
            <div className="board-list">
              {filteredBoards.map((board) => (
                <div
                  key={board.id}
                  className={`board-item ${
                    selectedBoardId === board.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedBoardId(board.id)}
                >
                  <div className="board-item-header">
                    <h3 className="board-item-title">{board.name}</h3>
                    <button
                      className="btn-delete-small"
                      onClick={(e) => handleDelete(board.id, board.name, e)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                  <div className="board-item-meta">
                    <span>👤 {board.createdBy}</span>
                    <span>🎨 {board.elementCount} elements</span>
                    <span>🕒 {formatDate(board.lastModified)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button
            onClick={onClose}
            disabled={isLoadingBoard}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleLoad}
            disabled={!selectedBoardId || isLoadingBoard}
            className="btn-primary"
          >
            {isLoadingBoard ? "Loading..." : "Load Board"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadBoardDialog;
