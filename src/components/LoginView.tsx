import { useState } from 'react';
import { Palette, Users, Lock } from 'lucide-react';
import './LoginView.css';

interface LoginViewProps {
  onLogin: (username: string) => void;
}

export const LoginView = ({ onLogin }: LoginViewProps) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="login-view">
      <div className="login-card">
        <div className="login-header">
          <Palette className="login-icon" size={48} />
          <h1>Collaborative Whiteboard</h1>
          <p>Draw together in real-time</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn-primary">
            Get Started
          </button>
        </form>

        <div className="login-features">
          <div className="feature">
            <Users size={20} />
            <span>Multi-room collaboration</span>
          </div>
          <div className="feature">
            <Lock size={20} />
            <span>Private & public rooms</span>
          </div>
          <div className="feature">
            <Palette size={20} />
            <span>Real-time drawing</span>
          </div>
        </div>
      </div>
    </div>
  );
};
