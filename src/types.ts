// Types for the Whiteboard application

export interface DrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
}

export interface Shape {
  id: string;
  type: 'rectangle' | 'circle' | 'line' | 'triangle' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  endX?: number;
  endY?: number;
  color: string;
  size: number;
  fillColor?: string;
  username: string;
  text?: string;
  fontSize?: number;
}

export interface BoardData {
  boardId: string;
  boardName: string;
  creator: string;
  timestamp: number;
  shapes: Shape[];
  strokes: { points: DrawPoint[] }[];
}

export type DrawingMode = 'pen' | 'eraser' | 'select' | 'rectangle' | 'circle' | 'line' | 'triangle' | 'fill' | 'text';

export interface Room {
  roomId: string;
  roomName: string;
  isPublic: boolean;
  participants: number;
  hasPassword: boolean;
}

export interface UserCursor {
  x: number;
  y: number;
  username: string;
  isDrawing: boolean;
}
