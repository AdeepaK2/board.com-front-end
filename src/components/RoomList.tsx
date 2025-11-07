import { useState } from 'react';
import { Plus, Globe, Lock, Users, LogOut } from 'lucide-react';
import './RoomList.css';

interface Room {
  roomId: string;
  roomName: string;
  isPublic: boolean;
  participants: number;
  hasPassword: boolean;
}

interface RoomListProps {
  rooms: Room[];
  username: string;
  onCreateRoom: (roomName: string, isPublic: boolean, password?: string, invitedUsers?: string[]) => void;
  onJoinRoom: (roomId: string, password?: string) => void;
  onLogout: () => void;
  activeUsers: string[];
  onRequestActiveUsers: () => void;
}

export const RoomList = ({ rooms, username, onCreateRoom, onJoinRoom, onLogout, activeUsers, onRequestActiveUsers }: RoomListProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [roomPassword, setRoomPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const handleOpenCreateModal = () => {
    onRequestActiveUsers(); // Request fresh list of active users
    setShowCreateModal(true);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      onCreateRoom(
        newRoomName.trim(), 
        isPublic, 
        roomPassword || undefined,
        !isPublic ? selectedUsers : undefined
      );
      setNewRoomName('');
      setRoomPassword('');
      setSelectedUsers([]);
      setShowCreateModal(false);
    }
  };

  const toggleUserSelection = (user: string) => {
    setSelectedUsers(prev =>
      prev.includes(user)
        ? prev.filter(u => u !== user)
        : [...prev, user]
    );
  };

  const handleJoinClick = (room: Room) => {
    if (room.hasPassword) {
      setSelectedRoomId(room.roomId);
      setShowPasswordPrompt(true);
    } else {
      onJoinRoom(room.roomId);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinPassword) {
      onJoinRoom(selectedRoomId, joinPassword);
      setJoinPassword('');
      setShowPasswordPrompt(false);
    }
  };

  return (
    <div className="room-list-view">
      <div className="room-list-container">
        <header className="room-list-header">
          <div className="header-content">
            <h1>Available Rooms</h1>
            <p>Welcome, <strong>{username}</strong></p>
          </div>
          <div className="header-actions">
            <button onClick={handleOpenCreateModal} className="btn-create">
              <Plus size={20} />
              Create Room
            </button>
            <button onClick={onLogout} className="btn-logout">
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </header>

        <div className="rooms-grid">
          {rooms.length === 0 ? (
            <div className="empty-state">
              <Users size={64} />
              <h3>No rooms available</h3>
              <p>Create a new room to get started</p>
            </div>
          ) : (
            rooms.map((room) => (
              <div key={room.roomId} className="room-card">
                <div className="room-header">
                  <h3>{room.roomName}</h3>
                  {room.isPublic ? (
                    <Globe className="room-icon public" size={20} />
                  ) : (
                    <Lock className="room-icon private" size={20} />
                  )}
                </div>
                <div className="room-info">
                  <span className="participants">
                    <Users size={16} />
                    {room.participants} {room.participants === 1 ? 'participant' : 'participants'}
                  </span>
                  <span className={`badge ${room.isPublic ? 'public' : 'private'}`}>
                    {room.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <button onClick={() => handleJoinClick(room)} className="btn-join">
                  Join Room
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            <h2>Create New Room</h2>
            <form onSubmit={handleCreateRoom}>
              <div className="form-group">
                <label htmlFor="roomName">Room Name</label>
                <input
                  id="roomName"
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Enter room name"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Room Type</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      checked={isPublic}
                      onChange={() => setIsPublic(true)}
                    />
                    <Globe size={18} />
                    <span>Public</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      checked={!isPublic}
                      onChange={() => setIsPublic(false)}
                    />
                    <Lock size={18} />
                    <span>Private</span>
                  </label>
                </div>
              </div>

              {!isPublic && (
                <>
                  <div className="form-group">
                    <label htmlFor="password">Password (optional)</label>
                    <input
                      id="password"
                      type="password"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </div>

                  <div className="form-group">
                    <label>Invite Users (optional)</label>
                    <div className="user-selection">
                      {activeUsers
                        .filter(user => user !== username)
                        .map(user => (
                          <label key={user} className="user-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user)}
                              onChange={() => toggleUserSelection(user)}
                            />
                            <span>{user}</span>
                          </label>
                        ))
                      }
                      {activeUsers.filter(user => user !== username).length === 0 && (
                        <p className="no-users">No other users online</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="modal-overlay" onClick={() => setShowPasswordPrompt(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPasswordPrompt(false)}>×</button>
            <h2>Enter Password</h2>
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label htmlFor="joinPassword">Room Password</label>
                <input
                  id="joinPassword"
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="Enter room password"
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowPasswordPrompt(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
