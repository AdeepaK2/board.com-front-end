# Whiteboard Save/Load Feature - Frontend Integration

## Overview

This update adds save/load functionality to the collaborative whiteboard frontend, enabling users to:

- 💾 Save whiteboards to the server
- 📂 Load previously saved whiteboards
- 🗑️ Delete saved whiteboards
- ✏️ Continue editing after loading

## New Components

### 1. API Service (`src/api/boardAPI.ts`)

Handles HTTP REST API calls to the Java backend (port 8081):

- `saveBoard()` - POST /api/boards
- `listBoards()` - GET /api/boards
- `loadBoard(id)` - GET /api/boards/{id}
- `deleteBoard(id)` - DELETE /api/boards/{id}

### 2. SaveBoardDialog (`src/components/SaveBoardDialog.tsx`)

Modal dialog for saving the current whiteboard:

- Input field for board name
- Shows username who's saving
- Async save operation with loading state

### 3. LoadBoardDialog (`src/components/LoadBoardDialog.tsx`)

Modal dialog for browsing and loading saved boards:

- Lists all saved boards (sorted by last modified)
- Search functionality
- Shows metadata: creator, element count, date
- Delete button for each board
- Selection and load functionality

### 4. Notification (`src/components/Notification.tsx`)

Toast notification component for user feedback:

- Success, error, and info types
- Auto-dismisses after 3 seconds
- Positioned top-right

## UI Updates

### New Buttons in Toolbar

```tsx
<div className="board-controls">
  <button className="save-btn">💾 Save</button>
  <button className="load-btn">📂 Load</button>
  <button className="clear-btn">🗑️ Clear</button>
</div>
```

### Status Bar Enhancement

Shows current board name when a board is loaded:

```
Status: Connected • Board: My Whiteboard
```

## How It Works

### Saving a Board

1. User clicks "💾 Save" button
2. Save dialog opens
3. User enters board name
4. Frontend collects all strokes and shapes
5. Creates Board object:
   ```typescript
   {
     id: "board-1699200000",
     name: "My Whiteboard",
     createdBy: "Alice",
     createdAt: timestamp,
     lastModified: timestamp,
     strokes: [...all strokes...],
     shapes: [...all shapes...]
   }
   ```
6. POST request to `http://localhost:8081/api/boards`
7. Backend saves JSON file using NIO
8. Success notification shown

### Loading a Board

1. User clicks "📂 Load" button
2. Load dialog opens
3. Frontend fetches board list: GET `/api/boards`
4. User searches/selects a board
5. User clicks "Load Board"
6. Frontend fetches full board: GET `/api/boards/{id}`
7. Current canvas is cleared
8. Strokes and shapes are loaded into state
9. Canvas redraws automatically
10. Success notification shown

### Editing After Load

**Full editing capability remains:**

- ✅ Draw new strokes
- ✅ Add new shapes (rectangle, circle)
- ✅ Select and drag elements
- ✅ Resize shapes
- ✅ Fill shapes with color
- ✅ Delete elements
- ✅ Clear canvas
- ✅ Real-time collaboration continues

All changes are synced via WebSocket to other users in the same session.

### Re-saving

When you modify a loaded board and save again:

- If you loaded board "A", saving keeps the same ID (updates the file)
- You can also change the name to create a new version

## Network Communication

### HTTP REST API (Port 8081)

```
Frontend                  Backend
   │                         │
   ├─ POST /api/boards ─────>│ Save board (TCP)
   │                         │ (Thread pool handles request)
   │                         │ (NIO saves to disk)
   │<──── JSON response ─────┤
   │                         │
   ├─ GET /api/boards ───────>│ List all boards
   │<──── JSON array ────────┤
   │                         │
   ├─ GET /api/boards/123 ───>│ Load specific board
   │<──── Board JSON ────────┤
```

### WebSocket (Port 8080)

Real-time drawing sync continues as before.

## Environment Configuration

Create `.env` file in frontend root:

```env
VITE_API_URL=http://localhost:8081
VITE_WEBSOCKET_URL=ws://localhost:8080
```

## Running the Full System

### 1. Start HTTP REST Server

```bash
cd board.com-collaborative-whiteboard-with-java-networking
mvn compile
mvn exec:java -Dexec.mainClass="org.example.server.HTTPRestServer"
```

Output:

```
Starting HTTP REST Server on port 8081
Endpoints:
  POST   http://localhost:8081/api/boards       - Save a board
  GET    http://localhost:8081/api/boards       - List all boards
  GET    http://localhost:8081/api/boards/{id}  - Load a board by ID
  DELETE http://localhost:8081/api/boards/{id}  - Delete a board
```

### 2. Start WebSocket Server

```bash
mvn exec:java -Dexec.mainClass="org.example.server.WebSocketWhiteboardServer"
```

Output:

```
Starting Whiteboard WebSocket Server on port 8080
```

Or use the room-based version:

```bash
mvn exec:java -Dexec.mainClass="org.example.server.WebSocketWhiteboardServerRooms"
```

### 3. Start Frontend

```bash
cd board.com-front-end
npm install  # First time only
npm run dev
```

Output:

```
VITE ready in 500 ms
➜  Local:   http://localhost:5173/
```

### 4. Test Save/Load

1. Open `http://localhost:5173`
2. Enter username and join
3. Draw something
4. Click "💾 Save" → Enter name → Save
5. Check `saved_boards/` folder - you'll see JSON file
6. Click "📂 Load" → Select board → Load
7. Board loads and you can continue editing!

## File Storage

Boards are saved in:

```
board.com-collaborative-whiteboard-with-java-networking/
  saved_boards/
    board-1699200000.json
    board-1699300000.json
    ...
```

Each file is a JSON representation of the entire board state.

## API Response Examples

### Save Response

```json
{
  "success": true,
  "message": "Board saved successfully",
  "id": "board-1699200000"
}
```

### List Response

```json
[
  {
    "id": "board-1699200000",
    "name": "My Whiteboard",
    "createdBy": "Alice",
    "createdAt": 1699200000000,
    "lastModified": 1699200500000,
    "elementCount": 25
  }
]
```

### Load Response

```json
{
  "id": "board-1699200000",
  "name": "My Whiteboard",
  "createdBy": "Alice",
  "createdAt": 1699200000000,
  "lastModified": 1699200500000,
  "strokes": [...],
  "shapes": [...]
}
```

## Troubleshooting

### "Failed to save board"

- Ensure HTTP REST Server is running on port 8081
- Check browser console for CORS errors
- Verify `saved_boards/` directory exists and is writable

### "Failed to load board"

- Ensure board ID exists in `saved_boards/` folder
- Check file permissions
- Verify JSON file is not corrupted

### Boards not showing in list

- Ensure files are in `saved_boards/` directory
- Check file extension is `.json`
- Verify files contain valid JSON

## Future Enhancements

Possible improvements:

- Export board as PNG image
- Import/export Excalidraw format
- Board thumbnails in load dialog
- Search and filter boards
- Tags/categories for boards
- Share board via link
- User authentication and private boards

## Network Programming Concepts Demonstrated

✅ **TCP** - HTTP server accepting connections
✅ **URI** - RESTful resource identification  
✅ **Multithreading** - Thread pool handling concurrent requests
✅ **NIO** - Non-blocking file I/O operations
✅ **WebSocket** - Real-time bidirectional communication
✅ **JSON** - Structured data format
✅ **REST API** - Resource-oriented architecture
