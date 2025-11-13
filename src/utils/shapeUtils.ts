import type { Shape } from '../types';

/**
 * Draw a shape on the canvas
 */
export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shape.type) {
    case 'rectangle':
      if (shape.width && shape.height) {
        ctx.beginPath();
        ctx.rect(shape.x, shape.y, shape.width, shape.height);
        if (shape.fillColor) {
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        ctx.stroke();
      }
      break;

    case 'circle':
      if (shape.radius) {
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        if (shape.fillColor) {
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        ctx.stroke();
      }
      break;

    case 'line':
      if (shape.endX !== undefined && shape.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
      }
      break;

    case 'triangle':
      if (shape.width && shape.height) {
        ctx.beginPath();
        // Top point
        ctx.moveTo(shape.x + shape.width / 2, shape.y);
        // Bottom left
        ctx.lineTo(shape.x, shape.y + shape.height);
        // Bottom right
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.closePath();
        if (shape.fillColor) {
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
        }
        ctx.stroke();
      }
      break;

    case 'text': {
      const fontSize = shape.fontSize || 16;
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = shape.color;
      ctx.textBaseline = 'top';

      // If this text shape has width/height and a fillColor, draw a sticky-note style box
      if (shape.fillColor && shape.width && shape.height) {
        ctx.beginPath();
        ctx.fillStyle = shape.fillColor;
        ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        // Use a dashed black border for sticky notes
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, shape.size || 1);
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        ctx.setLineDash([]); // reset dash

        // Draw text inside with padding and proper wrapping
        ctx.fillStyle = shape.color;
        const padding = 8;
        if (shape.text) {
          const maxTextWidth = shape.width - padding * 2;
          const lines = wrapText(ctx, shape.text, maxTextWidth);
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], shape.x + padding, shape.y + padding + i * (fontSize + 4));
          }
        }
      } else {
        if (shape.text) {
          // Draw text only
          ctx.fillText(shape.text, shape.x, shape.y);
        } else {
          // Show cursor for empty text being edited
          ctx.fillStyle = shape.color;
          const cursorHeight = fontSize;
          const cursorWidth = 2;
          ctx.fillRect(shape.x, shape.y, cursorWidth, cursorHeight);
        }
      }
      break;
    }

    case 'image': {
      if (shape.url && shape.width && shape.height) {
        // Try to get image from cache (managed by App component)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imageCache = (window as any).__imageCache;
        
        if (imageCache) {
          const cachedImg = imageCache.get(shape.url);
          
          if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
            // Image is loaded, draw it
            try {
              ctx.drawImage(cachedImg, shape.x, shape.y, shape.width, shape.height);
            } catch (e) {
              // Fallback if drawImage fails
              console.error('Error drawing image:', e);
              drawImagePlaceholder(ctx, shape);
            }
          } else {
            // Draw placeholder while loading
            drawImagePlaceholder(ctx, shape);
          }
        } else {
          // Cache not available, draw placeholder
          drawImagePlaceholder(ctx, shape);
        }
      }
      break;
    }
  }

  ctx.restore();
}

/**
 * Draw placeholder for image while loading
 */
function drawImagePlaceholder(ctx: CanvasRenderingContext2D, shape: Shape) {
  if (!shape.width || !shape.height) return;
  
  // Draw placeholder rectangle
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
  
  // Draw loading text
  ctx.fillStyle = '#999';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading...', shape.x + shape.width / 2, shape.y + shape.height / 2);
}

/**
 * Wrap text into lines that fit within maxWidth using the provided canvas context.
 * Returns an array of lines.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const test = current ? current + ' ' + word : word;
    const metrics = ctx.measureText(test);
    if (metrics.width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      // If single word longer than maxWidth, break the word by characters
      if (ctx.measureText(word).width > maxWidth) {
        let partial = '';
        for (let j = 0; j < word.length; j++) {
          const testPart = partial + word[j];
          if (ctx.measureText(testPart).width <= maxWidth) {
            partial = testPart;
          } else {
            if (partial) lines.push(partial);
            partial = word[j];
          }
        }
        if (partial) {
          current = partial;
        } else {
          current = '';
        }
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Draw a preview shape while dragging
 */
export function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  type: 'rectangle' | 'circle' | 'line' | 'triangle',
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  color: string,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.setLineDash([5, 5]); // Dotted line for preview
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const width = currentX - startX;
  const height = currentY - startY;

  switch (type) {
    case 'rectangle':
      ctx.strokeRect(startX, startY, width, height);
      break;

    case 'circle': {
      const radius = Math.sqrt(width * width + height * height);
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'line':
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
      break;

    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(startX + width / 2, startY);
      ctx.lineTo(startX, startY + height);
      ctx.lineTo(startX + width, startY + height);
      ctx.closePath();
      ctx.stroke();
      break;
  }

  ctx.restore();
}

/**
 * Check if a point is inside a shape (for selection)
 */
export function isPointInShape(x: number, y: number, shape: Shape): boolean {
  switch (shape.type) {
    case 'rectangle':
      if (shape.width && shape.height) {
        return (
          x >= shape.x &&
          x <= shape.x + shape.width &&
          y >= shape.y &&
          y <= shape.y + shape.height
        );
      }
      break;

    case 'circle':
      if (shape.radius) {
        const dx = x - shape.x;
        const dy = y - shape.y;
        return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
      }
      break;

    case 'line':
      if (shape.endX !== undefined && shape.endY !== undefined) {
        // Check if point is near the line (within 5 pixels)
        const distance = distanceToLine(x, y, shape.x, shape.y, shape.endX, shape.endY);
        return distance <= 5;
      }
      break;

    case 'triangle':
      if (shape.width && shape.height) {
        // Use barycentric coordinates to check if point is inside triangle
        const x1 = shape.x + shape.width / 2;
        const y1 = shape.y;
        const x2 = shape.x;
        const y2 = shape.y + shape.height;
        const x3 = shape.x + shape.width;
        const y3 = shape.y + shape.height;
        return isPointInTriangle(x, y, x1, y1, x2, y2, x3, y3);
      }
      break;

    case 'text':
      // If this is a sticky-style text with explicit width/height, treat it like a rectangle
      if (shape.width !== undefined && shape.height !== undefined) {
        return (
          x >= shape.x &&
          x <= shape.x + shape.width &&
          y >= shape.y &&
          y <= shape.y + shape.height
        );
      }

      if (shape.text) {
        // Create a temporary canvas to measure text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const fontSize = shape.fontSize || 16;
          ctx.font = `${fontSize}px Arial`;
          const textWidth = ctx.measureText(shape.text).width;
          const textHeight = fontSize;
          
          // Check if point is within text bounds (with some padding)
          return (
            x >= shape.x - 5 &&
            x <= shape.x + textWidth + 100 && // Extra space for username
            y >= shape.y - 5 &&
            y <= shape.y + textHeight + 5
          );
        }
      }
      break;

    case 'image':
      if (shape.width && shape.height) {
        return (
          x >= shape.x &&
          x <= shape.x + shape.width &&
          y >= shape.y &&
          y <= shape.y + shape.height
        );
      }
      break;
  }
  return false;
}

/**
 * Calculate distance from point to line segment
 */
function distanceToLine(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx: number, yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if point is inside triangle using barycentric coordinates
 */
function isPointInTriangle(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number
): boolean {
  const area = 0.5 * (-y2 * x3 + y1 * (-x2 + x3) + x1 * (y2 - y3) + x2 * y3);
  const s = (1 / (2 * area)) * (y1 * x3 - x1 * y3 + (y3 - y1) * px + (x1 - x3) * py);
  const t = (1 / (2 * area)) * (x1 * y2 - y1 * x2 + (y1 - y2) * px + (x2 - x1) * py);
  return s >= 0 && t >= 0 && 1 - s - t >= 0;
}

/**
 * Draw selection highlight around a shape
 */
export function drawSelectionHighlight(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save();
  ctx.strokeStyle = '#0066FF';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  switch (shape.type) {
    case 'rectangle':
      if (shape.width && shape.height) {
        ctx.strokeRect(shape.x - 5, shape.y - 5, shape.width + 10, shape.height + 10);
      }
      break;

    case 'image':
      if (shape.width && shape.height) {
        ctx.strokeRect(shape.x - 5, shape.y - 5, shape.width + 10, shape.height + 10);
      }
      break;

    case 'circle':
      if (shape.radius) {
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;

    case 'line':
      if (shape.endX !== undefined && shape.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
      }
      break;

    case 'triangle':
      if (shape.width && shape.height) {
        ctx.beginPath();
        ctx.moveTo(shape.x + shape.width / 2, shape.y - 5);
        ctx.lineTo(shape.x - 5, shape.y + shape.height + 5);
        ctx.lineTo(shape.x + shape.width + 5, shape.y + shape.height + 5);
        ctx.closePath();
        ctx.stroke();
      }
      break;

    case 'text':
      if (shape.width && shape.height) {
        ctx.strokeRect(shape.x - 5, shape.y - 5, shape.width + 10, shape.height + 10);
      }
      break;
  }

  ctx.restore();
}

/**
 * Generate a unique ID for shapes
 */
export function generateShapeId(): string {
  return `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Draw resize handles for selected shape
 */
export function drawResizeHandles(ctx: CanvasRenderingContext2D, shape: Shape): void {
  const handleSize = 8;
  const handles: {x: number, y: number}[] = [];

  if ((shape.type === 'rectangle' || shape.type === 'text') && shape.width && shape.height) {
    handles.push(
      {x: shape.x, y: shape.y},
      {x: shape.x + shape.width, y: shape.y},
      {x: shape.x, y: shape.y + shape.height},
      {x: shape.x + shape.width, y: shape.y + shape.height},
      {x: shape.x + shape.width / 2, y: shape.y},
      {x: shape.x + shape.width / 2, y: shape.y + shape.height},
      {x: shape.x, y: shape.y + shape.height / 2},
      {x: shape.x + shape.width, y: shape.y + shape.height / 2}
    );
  } else if (shape.type === 'image' && shape.width && shape.height) {
    // Image shapes use same handles as rectangles
    handles.push(
      {x: shape.x, y: shape.y},
      {x: shape.x + shape.width, y: shape.y},
      {x: shape.x, y: shape.y + shape.height},
      {x: shape.x + shape.width, y: shape.y + shape.height},
      {x: shape.x + shape.width / 2, y: shape.y},
      {x: shape.x + shape.width / 2, y: shape.y + shape.height},
      {x: shape.x, y: shape.y + shape.height / 2},
      {x: shape.x + shape.width, y: shape.y + shape.height / 2}
    );
  } else if (shape.type === 'circle' && shape.radius) {
    handles.push(
      {x: shape.x, y: shape.y - shape.radius},
      {x: shape.x + shape.radius, y: shape.y},
      {x: shape.x, y: shape.y + shape.radius},
      {x: shape.x - shape.radius, y: shape.y}
    );
  } else if (shape.type === 'line' && shape.endX !== undefined && shape.endY !== undefined) {
    handles.push(
      {x: shape.x, y: shape.y},
      {x: shape.endX, y: shape.endY}
    );
  } else if (shape.type === 'triangle' && shape.width && shape.height) {
    handles.push(
      {x: shape.x + shape.width / 2, y: shape.y},
      {x: shape.x, y: shape.y + shape.height},
      {x: shape.x + shape.width, y: shape.y + shape.height}
    );
  }

  // Draw handles
  ctx.save();
  handles.forEach(handle => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
  });
  ctx.restore();
}

/**
 * Get resize handle at point
 */
export function getResizeHandle(shape: Shape, x: number, y: number): string | null {
  const handleSize = 8;
  const tolerance = handleSize / 2;

  if ((shape.type === 'rectangle' || shape.type === 'image' || shape.type === 'text') && shape.width && shape.height) {
    const handles = [
      {key: 'tl', x: shape.x, y: shape.y},
      {key: 'tr', x: shape.x + shape.width, y: shape.y},
      {key: 'bl', x: shape.x, y: shape.y + shape.height},
      {key: 'br', x: shape.x + shape.width, y: shape.y + shape.height},
      {key: 't', x: shape.x + shape.width / 2, y: shape.y},
      {key: 'b', x: shape.x + shape.width / 2, y: shape.y + shape.height},
      {key: 'l', x: shape.x, y: shape.y + shape.height / 2},
      {key: 'r', x: shape.x + shape.width, y: shape.y + shape.height / 2}
    ];
    for (const handle of handles) {
      if (Math.abs(x - handle.x) <= tolerance && Math.abs(y - handle.y) <= tolerance) {
        return handle.key;
      }
    }
  } else if (shape.type === 'circle' && shape.radius) {
    const handles = [
      {key: 't', x: shape.x, y: shape.y - shape.radius},
      {key: 'r', x: shape.x + shape.radius, y: shape.y},
      {key: 'b', x: shape.x, y: shape.y + shape.radius},
      {key: 'l', x: shape.x - shape.radius, y: shape.y}
    ];
    for (const handle of handles) {
      if (Math.abs(x - handle.x) <= tolerance && Math.abs(y - handle.y) <= tolerance) {
        return handle.key;
      }
    }
  } else if (shape.type === 'line' && shape.endX !== undefined && shape.endY !== undefined) {
    if (Math.abs(x - shape.x) <= tolerance && Math.abs(y - shape.y) <= tolerance) {
      return 'start';
    }
    if (Math.abs(x - shape.endX) <= tolerance && Math.abs(y - shape.endY) <= tolerance) {
      return 'end';
    }
  }
  return null;
}
