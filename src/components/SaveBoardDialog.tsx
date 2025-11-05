import React, { useState } from "react";
import "./SaveBoardDialog.css";

interface SaveBoardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (boardName: string) => void;
  username: string;
}

const SaveBoardDialog: React.FC<SaveBoardDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  username,
}) => {
  const [boardName, setBoardName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!boardName.trim()) {
      alert("Please enter a board name");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(boardName.trim());
      setBoardName("");
      onClose();
    } catch (error) {
      console.error("Error saving board:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h2>💾 Save Whiteboard</h2>
        <div className="dialog-body">
          <label htmlFor="board-name">Board Name:</label>
          <input
            id="board-name"
            type="text"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSave()}
            placeholder="Enter board name..."
            autoFocus
            disabled={isSaving}
          />
          <p className="save-info">
            Saving as: <strong>{username}</strong>
          </p>
        </div>
        <div className="dialog-actions">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? "Saving..." : "Save Board"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveBoardDialog;
