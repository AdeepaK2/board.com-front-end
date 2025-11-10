import { useState, useEffect } from 'react';
import { Palette, Users, Lock } from 'lucide-react';
import './LoginView.css';

interface LoginViewProps {
  onLogin: (username: string, password: string, isNewUser: boolean) => void;
}

export const LoginView = ({ onLogin }: LoginViewProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  // Load saved username from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem('whiteboard_username');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      onLogin(username.trim(), password.trim(), isNewUser);
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

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={4}
            />
          </div>

          <div className="form-toggle">
            <label>
              <input
                type="checkbox"
                checked={isNewUser}
                onChange={(e) => setIsNewUser(e.target.checked)}
              />
              <span>New user? Create account</span>
            </label>
          </div>

          <button type="submit" className="btn-primary">
            {isNewUser ? 'Register' : 'Login'}
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
