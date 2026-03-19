import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../ThemeContext';
import CrowdCounter from './CrowdCounter';
import './Dashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

function Dashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentOccupancy, setCurrentOccupancy] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(150);
  const [entries, setEntries] = useState(0);
  const [exits, setExits] = useState(0);
  const [occupancyTrends, setOccupancyTrends] = useState([]);

  // fetch chart data from DB every 30s
  useEffect(() => {
    if (!isLoggedIn) return;
    const fetchChart = () =>
      fetch(`${API_BASE_URL}/crowd/chart?hours=24`)
        .then(r => r.json())
        .then(data => setOccupancyTrends(data.map(d => ({ time: d.time.slice(11,16), count: d.line_crossing || d.dual_camera || 0 }))))
        .catch(() => {});
    fetchChart();
    const t = setInterval(fetchChart, 30000);
    return () => clearInterval(t);
  }, [isLoggedIn]);
  const [alerts, setAlerts] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('Camera 1');
  const [selectedModel, setSelectedModel] = useState('YOLOv4');
  const [showSettings, setShowSettings] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'viewer',
    email: '',
    fullName: '',
    department: '',
    isActive: true
  });
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    if (isLoggedIn && currentOccupancy >= maxCapacity) {
      if (!alerts.some(a => a.type === 'capacity')) {
        setAlerts([{
          type: 'capacity',
          title: 'Capacity Limit Reached!',
          message: `Max Capacity of ${maxCapacity} exceeded`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        }, ...alerts]);
      }
    }
  }, [currentOccupancy, maxCapacity, isLoggedIn, alerts]);

  // Load users from localStorage on component mount
  useEffect(() => {
    const savedUsers = localStorage.getItem('crowdControlUsers');
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    } else {
      // Initialize with default admin user and some sample users
      const defaultUsers = [{
        id: 1,
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        email: 'admin@institution.com',
        fullName: 'System Administrator',
        department: 'IT',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null
      },
      {
        id: 2,
        username: 'operator1',
        password: 'op123',
        role: 'operator',
        email: 'operator@institution.com',
        fullName: 'John Operator',
        department: 'Operations',
        isActive: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        lastLogin: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        id: 3,
        username: 'security1',
        password: 'sec123',
        role: 'security',
        email: 'security@institution.com',
        fullName: 'Sarah Security',
        department: 'Security',
        isActive: true,
        createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        lastLogin: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
      }];
      setUsers(defaultUsers);
      localStorage.setItem('crowdControlUsers', JSON.stringify(defaultUsers));
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      // Check if user exists in our user database
      const user = users.find(u => u.username === username && u.password === password);
      if (user) {
        setUserRole(user.role);
        setIsLoggedIn(true);
        setCurrentOccupancy(132);
        setEntries(245);
        setExits(113);
        // Update last login
        const updatedUsers = users.map(u =>
          u.username === username
            ? { ...u, lastLogin: new Date().toISOString() }
            : u
        );
        setUsers(updatedUsers);
        localStorage.setItem('crowdControlUsers', JSON.stringify(updatedUsers));
      } else {
        alert('Invalid username or password');
      }
      setUsername('');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAlerts([]);
  };

  const acknowledgeAlert = (index) => {
    setAlerts(alerts.filter((_, i) => i !== index));
  };

  const handleSaveSettings = () => {
    setShowSettings(false);
  };

  // User Management Functions
  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.fullName) {
      alert('Please fill in all required fields');
      return;
    }

    // Check if username already exists
    if (users.some(u => u.username === newUser.username)) {
      alert('Username already exists');
      return;
    }

    const user = {
      id: Date.now(),
      ...newUser,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    const updatedUsers = [...users, user];
    setUsers(updatedUsers);
    localStorage.setItem('crowdControlUsers', JSON.stringify(updatedUsers));

    // Reset form
    setNewUser({
      username: '',
      password: '',
      role: 'viewer',
      email: '',
      fullName: '',
      department: '',
      isActive: true
    });

    alert('User created successfully!');
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      const updatedUsers = users.filter(u => u.id !== userId);
      setUsers(updatedUsers);
      localStorage.setItem('crowdControlUsers', JSON.stringify(updatedUsers));
    }
  };

  const toggleUserStatus = (userId) => {
    const updatedUsers = users.map(u =>
      u.id === userId ? { ...u, isActive: !u.isActive } : u
    );
    setUsers(updatedUsers);
    localStorage.setItem('crowdControlUsers', JSON.stringify(updatedUsers));
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return '👨‍💼';
      case 'operator': return '👤';
      case 'security': return '🛡️';
      case 'manager': return '📋';
      case 'viewer': return '👁️';
      default: return '👤';
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-box">
            <div className="login-header">
              <h1>👥 AI Crowd Control System</h1>
            </div>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Select Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="login-input role-select"
                >
                  <option value="admin">👨‍💼 Admin</option>
                  <option value="operator">👤 Operator</option>
                  <option value="security">🛡️ Security Staff</option>
                  <option value="manager">📋 Manager / Authority</option>
                  <option value="viewer">👁️ Viewer</option>
                </select>
              </div>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="login-input"
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                />
              </div>
              <button type="submit" className="login-button">Login</button>
            </form>
            <button type="button" className="forgot-password" style={{background:'none',border:'none',cursor:'pointer',color:'inherit'}}>Forgot Password?</button>
            <div className="login-footer">
              © 2025 AI Crowd Control System. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusColor = currentOccupancy >= maxCapacity ? 'full' : currentOccupancy >= maxCapacity * 0.7 ? 'warning' : 'normal';
  const statusText  = currentOccupancy >= maxCapacity ? 'FULL' : currentOccupancy >= maxCapacity * 0.7 ? 'NEAR FULL' : 'NORMAL';

  return (
    <div className="dashboard-layout">
      {/* Left Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-content">
          <div className="sidebar-header">
            <div>
              <h3>📊 Menu</h3>
              <p className="user-role-badge">
                {userRole === 'admin' && '👨‍💼 Admin'}
                {userRole === 'operator' && '👤 Operator'}
                {userRole === 'security' && '🛡️ Security'}
                {userRole === 'manager' && '📋 Manager'}
                {userRole === 'viewer' && '👁️ Viewer'}
              </p>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              🚪
            </button>
          </div>

          {/* Alert Section */}
          <div className="sidebar-alerts">
            <h4>⚠️ Alerts</h4>
            {alerts.length > 0 ? (
              <div className="alert-list">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="alert-item">
                    <div className="alert-content">
                      <p className="alert-title">{alert.title}</p>
                      <p className="alert-message">{alert.message}</p>
                      <p className="alert-time">Time: {alert.time}</p>
                    </div>
                    <button 
                      className="acknowledge-btn"
                      onClick={() => acknowledgeAlert(idx)}
                    >
                      Acknowledge
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-alerts">No active alerts</p>
            )}
          </div>

          {/* User Management Menu - Only for Admin and Manager */}
          {(userRole === 'admin' || userRole === 'manager') && (
            <div className="sidebar-menu">
              <h4>👥 User Management</h4>
              <button
                className="menu-btn"
                onClick={() => setShowUserManagement(!showUserManagement)}
              >
                {showUserManagement ? '👥 Hide Users' : '👥 Manage Users'}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <h1>🏢 AI Crowd Control Dashboard</h1>
            <span className="header-date">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} | {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="header-right">
            <button className="theme-toggle" onClick={toggleTheme}>
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button className="notification-btn">🔔</button>
          </div>
        </header>

        {/* Camera Feed Section */}
        <div className="camera-section">
          <div className="camera-wrapper">
            <CrowdCounter crowd={currentOccupancy} setCrowd={setCurrentOccupancy} maxCapacity={maxCapacity} />
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-box occupancy">
              <div className="stat-label">Current Occupancy:</div>
              <div className="stat-value">{currentOccupancy}</div>
            </div>
            <div className="stat-box capacity">
              <div className="stat-label">Max Capacity:</div>
              <div className="stat-value">{maxCapacity}</div>
            </div>
            <div className={`stat-box status status-${statusColor}`}>
              <div className="stat-label">STATUS:</div>
              <div className="stat-value">{statusText}</div>
            </div>
          </div>
        </div>

        {/* Counters and Charts Row */}
        <div className="content-row">
          <div className="counters-section">
            <div className="counter-item">
              <span className="counter-label">Entries:</span>
              <span className="counter-value entries">{entries}</span>
            </div>
            <div className="counter-item">
              <span className="counter-label">Exits:</span>
              <span className="counter-value exits">{exits}</span>
            </div>
          </div>

          <div className="chart-section">
            <h3>Occupancy Trends</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={occupancyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="time" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} />
                <Line type="monotone" dataKey="count" stroke="#667eea" strokeWidth={2} dot={{ fill: '#667eea', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visitor Stats and Settings Row */}
        <div className="content-row">
          <div className="visitor-stats">
            <div className="stat-row">
              <span className="stat-label">Total Visitors:</span>
              <span className="stat-value">{entries + exits}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Average Stay:</span>
              <span className="stat-value">18 min</span>
            </div>
            <button className="download-report-btn">📥 Download Report</button>
          </div>

          {(userRole === 'admin' || userRole === 'manager') && (
            <div className="settings-section">
              <div className="settings-header">
                <h3>⚙️ System Settings</h3>
                <button className="settings-toggle" onClick={() => setShowSettings(!showSettings)}>
                  {showSettings ? '✖️' : '⚙️'}
                </button>
              </div>
              {showSettings && (
                <div className="settings-form">
                  <div className="form-group">
                    <label>Set Maximum Capacity:</label>
                    <input
                      type="number"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(Number(e.target.value))}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Select Camera:</label>
                    <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)} className="form-input">
                      <option>Camera 1</option>
                      <option>Camera 2</option>
                      <option>Camera 3</option>
                    </select>
                </div>
                <div className="form-group">
                  <label>Model Selection:</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="form-input">
                    <option>YOLOv4</option>
                    <option>YOLOv5</option>
                    <option>YOLOv8</option>
                  </select>
                </div>
                <button className="save-settings-btn" onClick={handleSaveSettings}>Save Changes</button>
              </div>
            )}
            </div>
          )}
        </div>

        {/* User Management Section - Only for Admin and Manager */}
        {showUserManagement && (userRole === 'admin' || userRole === 'manager') && (
          <div className="user-management-section">
            <h2>👥 User Management</h2>

            {/* Create New User Form */}
            <div className="create-user-form">
              <h3>Create New User</h3>
              <form onSubmit={handleCreateUser}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      className="form-input"
                    >
                      <option value="viewer">👁️ Viewer</option>
                      <option value="operator">👤 Operator</option>
                      <option value="security">🛡️ Security Staff</option>
                      <option value="manager">📋 Manager / Authority</option>
                      <option value="admin">👨‍💼 Admin</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      value={newUser.department}
                      onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                      className="form-input"
                    />
                  </div>
                </div>
                <button type="submit" className="create-user-btn">Create User</button>
              </form>
            </div>

            {/* Users List */}
            <div className="users-list">
              <h3>Existing Users ({users.length})</h3>
              <div className="users-table">
                <div className="table-header">
                  <div className="col-username">Username</div>
                  <div className="col-role">Role</div>
                  <div className="col-name">Full Name</div>
                  <div className="col-department">Department</div>
                  <div className="col-status">Status</div>
                  <div className="col-created">Created</div>
                  <div className="col-actions">Actions</div>
                </div>
                {users.map(user => (
                  <div key={user.id} className="table-row">
                    <div className="col-username">{user.username}</div>
                    <div className="col-role">
                      <span className="role-badge">
                        {getRoleIcon(user.role)} {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </div>
                    <div className="col-name">{user.fullName}</div>
                    <div className="col-department">{user.department || '-'}</div>
                    <div className="col-status">
                      <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                        {user.isActive ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </div>
                    <div className="col-created">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                    <div className="col-actions">
                      <button
                        className="action-btn toggle-status"
                        onClick={() => toggleUserStatus(user.id)}
                        title={user.isActive ? 'Deactivate User' : 'Activate User'}
                      >
                        {user.isActive ? '🔴' : '🟢'}
                      </button>
                      {user.username !== 'admin' && (
                        <button
                          className="action-btn delete-user"
                          onClick={() => handleDeleteUser(user.id)}
                          title="Delete User"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;