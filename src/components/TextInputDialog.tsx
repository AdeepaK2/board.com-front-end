import { useState, useEffect, useRef } from 'react';
import { Type, X } from 'lucide-react';
import './TextInputDialog.css';

interface TextInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string, fontSize: number) => void;
  initialText?: string;
  initialFontSize?: number;
}

export const TextInputDialog = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialText = '', 
  initialFontSize = 16 
}: TextInputDialogProps) => {
  const [text, setText] = useState(initialText);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setFontSize(initialFontSize);
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialText, initialFontSize]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim(), fontSize);
      setText('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="text-input-overlay" onClick={onClose}>
      <div className="text-input-modal" onClick={(e) => e.stopPropagation()}>
        <div className="text-input-header">
          <div className="text-input-title">
            <Type size={20} />
            <h3>Add Text</h3>
          </div>
          <button onClick={onClose} className="btn-close-text">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="text-input-form">
          <div className="form-group">
            <label>Text</label>
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your text here..."
              rows={3}
              className="text-input-textarea"
            />
            <span className="input-hint">Press Enter to add, Shift+Enter for new line</span>
          </div>

          <div className="form-group">
            <label>Font Size: {fontSize}px</label>
            <input
              type="range"
              min="12"
              max="48"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="font-size-slider"
            />
            <div className="font-size-preview" style={{ fontSize: `${fontSize}px` }}>
              {text || 'Preview text'}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={!text.trim()} className="btn-add-text">
              Add Text
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
