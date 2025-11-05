// API service for board save/load operations

export interface BoardMetadata {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  lastModified: number;
  elementCount: number;
}

export interface Board {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  lastModified: number;
  strokes: any[];
  shapes: any[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

export const boardAPI = {
  // Save a board
  async saveBoard(board: Board): Promise<{ success: boolean; id: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/boards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(board),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save board');
    }

    return response.json();
  },

  // List all boards
  async listBoards(): Promise<BoardMetadata[]> {
    const response = await fetch(`${API_BASE_URL}/api/boards`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list boards');
    }

    return response.json();
  },

  // Load a specific board
  async loadBoard(boardId: string): Promise<Board> {
    const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load board');
    }

    return response.json();
  },

  // Delete a board
  async deleteBoard(boardId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete board');
    }

    return response.json();
  },
};
