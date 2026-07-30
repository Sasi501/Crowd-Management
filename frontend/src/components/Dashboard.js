import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import HomePage    from '../pages/HomePage';
import CameraPage  from '../pages/CameraPage';
import ProfilePage from '../pages/ProfilePage';
import UsersPage   from '../pages/UsersPage';
import SettingsPage from '../pages/SettingsPage';
import MultiViewPage from '../pages/MultiViewPage';
import {
  MdDashboard, MdVideocam, MdPerson, MdPeople,
  MdLogout, MdLightMode, MdDarkMode, MdNotifications,
  MdLock, MdMail, MdLogin, MdWarning, MdSettings,
  MdVisibility, MdVisibilityOff, MdGridView
} from 'react-icons/md';
import './Dashboard.css';
import '../pages/pages.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/v1';

export default function Dashboard() {
  const [isLoggedIn, setIsLoggedIn]       = useState(false);
  const [userRole, setUserRole]           = useState('admin');
  const [loggedInUser, setLoggedInUser]   = useState(null);
  const [username, setUsername]           = useState('');
  const [password, setPassword]           = useState('');
  const [loginError, setLoginError]       = useState('');
  const [currentOccupancy, setCurrentOccupancy] = useState(0);

  // ── Settings state — owned here so SettingsPage can update them globally ──
  const [maxCapacity, setMaxCapacity]         = useState(150);
  const [alertThreshold, setAlertThreshold]   = useState(70); // percentage (e.g. 70 = 70%)

  const [entries, setEntries]             = useState(0);
  const [exits, setExits]                 = useState(0);
  const [chartData, setChartData]         = useState([]);
  const [alerts, setAlerts]               = useState([]);

  // ── Use a ref to track whether the capacity alert has already fired.
  //    This avoids putting `alerts` in the useEffect dependency array,
  //    which caused an infinite re-render loop.
  const capacityAlertFiredRef = useRef(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotRole, setForgotRole]       = useState('viewer');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotEmail, setForgotEmail]     = useState('');
  const [forgotMsg, setForgotMsg]         = useState('');
  const [forgotError, setForgotError]     = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetToken, setResetToken]       = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [resetMsg, setResetMsg]           = useState('');
  const [inactiveInfo, setInactiveInfo]   = useState(null);
  const [activationEmail, setActivationEmail] = useState('');
  const [activationMsg, setActivationMsg] = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const { isDarkMode, toggleTheme }       = useTheme();

  const fetchChart = useCallback(() => {
    if (!isLoggedIn) return;
    fetch(`${API_BASE_URL}/crowd/chart?hours=24`)
      .then(r => r.json())
      .then(data => setChartData(data.map(d => ({
        time: d.time.slice(11, 16),
        in_count: d.in_count,
        out_count: d.out_count,
        crowd_count: d.crowd_count
      }))))
      .catch(() => {});
  }, [isLoggedIn]);

  // Poll chart every 5 seconds
  useEffect(() => {
    fetchChart();
    const t = setInterval(fetchChart, 5000);
    return () => clearInterval(t);
  }, [fetchChart]);

  // Refresh chart whenever occupancy changes
  useEffect(() => {
    if (isLoggedIn) fetchChart();
  }, [currentOccupancy]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Capacity alert — uses a ref so the alerts array is never a dependency ──
  useEffect(() => {
    if (!isLoggedIn) return;
    const threshold = maxCapacity * (alertThreshold / 100);

    if (currentOccupancy >= maxCapacity) {
      if (!capacityAlertFiredRef.current) {
        capacityAlertFiredRef.current = true;
        setAlerts(prev => [
          {
            type: 'capacity',
            title: 'Capacity Limit Reached!',
            message: `Occupancy (${currentOccupancy}) has hit max capacity of ${maxCapacity}`,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ]);
      }
    } else if (currentOccupancy >= threshold) {
      // Near-capacity warning (only once per threshold crossing)
      const warningKey = `warning-${alertThreshold}`;
      setAlerts(prev => {
        if (prev.some(a => a.type === warningKey)) return prev;
        return [
          {
            type: warningKey,
            title: `Approaching Capacity (${alertThreshold}%)`,
            message: `Occupancy is at ${currentOccupancy} of ${maxCapacity}`,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ];
      });
    } else {
      // Below threshold — reset so alerts can fire again when needed
      capacityAlertFiredRef.current = false;
    }
  }, [currentOccupancy, maxCapacity, alertThreshold, isLoggedIn]);

  const validEmail = e => /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(e);

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError('');
    try {
      const res = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const user = await res.json();
        if (user.role !== userRole) {
          setLoginError(`Access denied. Your role is "${user.role}", not "${userRole}".`);
        } else {
          setLoggedInUser(user);
          setUserRole(user.role);
          setIsLoggedIn(true);
          setEntries(0);
          setExits(0);
        }
      } else if (res.status === 403) {
        const err = await res.json();
        if (err.detail?.startsWith('INACTIVE:')) {
          setInactiveInfo({ adminEmail: err.detail.split(':')[1], username });
        } else {
          setLoginError('Account is inactive.');
        }
      } else {
        setLoginError('Invalid username or password');
      }
    } catch (_) {
      setLoginError('Cannot connect to server.');
    }
    setUsername(''); setPassword('');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInUser(null);
    setAlerts([]);
    setCurrentOccupancy(0);
    capacityAlertFiredRef.current = false;
  };

  // ── Forgot password — properly checks the `sent` field in the response ──
  const handleForgotPassword = async (e) => {
    e.preventDefault(); setForgotMsg(''); setForgotError('');
    if (!validEmail(forgotEmail)) { setForgotError('Enter a valid email'); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, role: forgotRole, email: forgotEmail })
      });
      if (res.ok) {
        const d = await res.json();
        if (d.sent) {
          // Email was sent — move to token entry; token is NOT returned for security
          setForgotMsg('Reset email sent! Check your inbox and paste the token below.');
          setResetToken('');
          setShowResetPassword(true);
        } else {
          // SMTP not configured (dev mode) — token returned directly
          if (d.token) {
            setResetToken(d.token);
            setForgotMsg(`SMTP not configured. Dev token: ${d.token}`);
          } else {
            setForgotMsg('Reset token generated. Enter it below.');
          }
          setShowResetPassword(true);
        }
      } else {
        const err = await res.json();
        setForgotError(err.detail || 'No account found.');
      }
    } catch (_) {
      setForgotError('Cannot connect to server.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault(); setResetMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword })
      });
      if (res.ok) {
        setResetMsg('Password reset successfully!');
        setTimeout(() => {
          setShowForgotPassword(false); setShowResetPassword(false);
          setResetMsg(''); setForgotMsg('');
        }, 2000);
      } else {
        setResetMsg('Invalid or expired token.');
      }
    } catch (_) {
      setResetMsg('Cannot connect to server.');
    }
  };

  const handleRequestActivation = async (e) => {
    e.preventDefault(); setActivationMsg('');
    const res = await fetch(`${API_BASE_URL}/users/request-activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: inactiveInfo.username, email: activationEmail })
    });
    const data = await res.json();
    setActivationMsg(
      data.sent
        ? `Request sent to admin (${data.admin_email})`
        : 'Could not send — contact admin directly.'
    );
  };

  const statusColor = currentOccupancy >= maxCapacity
    ? 'full'
    : currentOccupancy >= maxCapacity * (alertThreshold / 100)
      ? 'warning'
      : 'normal';
  const statusText = currentOccupancy >= maxCapacity
    ? 'FULL'
    : currentOccupancy >= maxCapacity * (alertThreshold / 100)
      ? 'NEAR FULL'
      : 'NORMAL';

  // ── Auth screens ─────────────────────────────────────────────────────────
  if (inactiveInfo) return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <div className="login-logo" style={{color:'var(--danger)'}}><MdLock size={28} /></div>
            <h1>Account Inactive</h1>
            <p>Your account has been deactivated. Contact your administrator.</p>
          </div>
          <p style={{fontSize:13,color:'var(--text-secondary)',marginBottom:16}}>
            Admin: <strong>{inactiveInfo.adminEmail}</strong>
          </p>
          <form onSubmit={handleRequestActivation}>
            <div className="form-group" style={{marginBottom:16}}>
              <label className="form-label">Your Email Address</label>
              <input type="email" placeholder="you@example.com" value={activationEmail}
                onChange={e => setActivationEmail(e.target.value)} className="login-input" required />
            </div>
            <button type="submit" className="login-button" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              <MdMail size={16} />Send Activation Request
            </button>
          </form>
          {activationMsg && <p style={{color:'var(--success)',marginTop:10,fontSize:13}}>{activationMsg}</p>}
          <button className="forgot-password" onClick={() => { setInactiveInfo(null); setActivationMsg(''); setActivationEmail(''); }}>
            &larr; Back to Login
          </button>
        </div>
      </div>
    </div>
  );

  if (showForgotPassword) return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <div className="login-logo"><MdLock size={28} /></div>
            <h1>Reset Password</h1>
            <p>Enter your details to receive a reset link.</p>
          </div>
          {!showResetPassword ? (
            <form onSubmit={handleForgotPassword}>
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">Role</label>
                <select value={forgotRole} onChange={e => setForgotRole(e.target.value)} className="login-input role-select">
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="operator">Operator</option>
                  <option value="security">Security</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">Username</label>
                <input type="text" placeholder="Username" value={forgotUsername}
                  onChange={e => setForgotUsername(e.target.value)} className="login-input" required />
              </div>
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">Registered Email</label>
                <input type="email" placeholder="you@example.com" value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)} className="login-input" required />
              </div>
              {forgotError && <p style={{color:'var(--danger)',fontSize:13,marginBottom:8}}>{forgotError}</p>}
              <button type="submit" className="login-button" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <MdMail size={16} />Send Reset Link
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              {forgotMsg && (
                <p style={{color: forgotMsg.startsWith('SMTP') ? 'var(--warning)' : 'var(--success)', fontSize:13, marginBottom:12}}>
                  {forgotMsg}
                </p>
              )}
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">Reset Token</label>
                <input type="text" placeholder="Paste token from email" value={resetToken}
                  onChange={e => setResetToken(e.target.value)} className="login-input" required />
              </div>
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">New Password</label>
                <input type="password" placeholder="New password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} className="login-input" required />
              </div>
              <button type="submit" className="login-button" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <MdLock size={16} />Set New Password
              </button>
            </form>
          )}
          {resetMsg && (
            <p style={{color: resetMsg.includes('success') ? 'var(--success)' : 'var(--danger)', marginTop:10, fontSize:13}}>
              {resetMsg}
            </p>
          )}
          <button className="forgot-password" onClick={() => {
            setShowForgotPassword(false); setShowResetPassword(false);
            setForgotMsg(''); setForgotError(''); setResetMsg('');
          }}>
            &larr; Back to Login
          </button>
        </div>
      </div>
    </div>
  );

  if (!isLoggedIn) return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <div className="login-logo"><MdDashboard size={28} /></div>
            <h1>Crowd Control System</h1>
            <p>Sign in to your account</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{marginBottom:14}}>
              <label className="form-label">Role</label>
              <select value={userRole} onChange={e => setUserRole(e.target.value)} className="login-input role-select">
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="security">Security Staff</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="form-group" style={{marginBottom:14}}>
              <label className="form-label">Username</label>
              <input type="text" placeholder="Username" value={username}
                onChange={e => setUsername(e.target.value)} className="login-input" />
            </div>
            <div className="form-group" style={{marginBottom:14}}>
              <label className="form-label">Password</label>
              <div className="password-input-container">
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                  onChange={e => setPassword(e.target.value)} className="login-input" />
                <button type="button" className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                </button>
              </div>
            </div>
            <button type="submit" className="login-button" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              <MdLogin size={16} />Sign In
            </button>
          </form>
          {loginError && <p style={{color:'var(--danger)',marginTop:8,fontSize:13}}>{loginError}</p>}
          <button className="forgot-password" onClick={() => setShowForgotPassword(true)}>Forgot password?</button>
          <div className="login-footer">&copy; 2025 Crowd Control System. All rights reserved.</div>
        </div>
      </div>
    </div>
  );

  // ── Main app shell ───────────────────────────────────────────────────────
  const navItems = [
    { to:'/',          icon:<MdDashboard size={24} />, label:'Dashboard' },
    { to:'/camera',    icon:<MdVideocam size={24} />,  label:'Live Camera' },
    { to:'/multiview', icon:<MdGridView size={24} />,  label:'Control Room' },
    { to:'/profile',   icon:<MdPerson size={24} />,    label:'My Profile' },
    ...(userRole === 'admin' || userRole === 'manager'
      ? [
          { to:'/settings', icon:<MdSettings size={24} />, label:'System Settings' },
          { to:'/users',    icon:<MdPeople size={24} />,   label:'User Management' }
        ]
      : []),
  ];

  return (
    <BrowserRouter>
      <div className="dashboard-layout">

        {/* ── Sidebar ── */}
        <aside className="dashboard-sidebar">
          <div className="sidebar-content">

            {/* Profile */}
            <div className="sidebar-profile">
              <MdPerson size={32} />
              <div className="profile-info">
                <p className="profile-name">{loggedInUser?.full_name || loggedInUser?.username || 'User'}</p>
                <p className="profile-role">{userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}</p>
              </div>
            </div>

            {/* Nav links */}
            <nav className="sidebar-nav">
              <p className="sidebar-section-label">Navigation</p>
              {navItems.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to==='/'} className={({isActive}) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
                  <span className="nav-icon-wrap">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Alerts */}
            <div className="sidebar-alerts">
              <h4><MdWarning size={16} style={{marginRight:5}} />Alerts</h4>
              {alerts.length > 0 ? (
                <div className="alert-list">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className="alert-item">
                      <div className="alert-content">
                        <MdWarning size={14} style={{marginRight:6, flexShrink:0}} />
                        <div>
                          <p className="alert-title">{alert.title}</p>
                          <p className="alert-message">{alert.message}</p>
                          <p className="alert-time">{alert.time}</p>
                        </div>
                      </div>
                      <button className="acknowledge-btn" onClick={() => setAlerts(a => a.filter((_,i) => i !== idx))}>
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-alerts">No active alerts</p>
              )}
            </div>

            {/* Footer with logout */}
            <div className="sidebar-footer">
              <button className="sidebar-logout-btn" onClick={handleLogout} title="Sign out">
                <MdLogout size={20} /><span> Sign out</span>
              </button>
            </div>

          </div>
        </aside>

        {/* ── Main ── */}
        <div className="dashboard-main">

          {/* Top header */}
          <header className="dashboard-header">
            <div className="header-left">
              <h1>Crowd Control System</h1>
              <span className="header-date">
                {new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} &nbsp;|&nbsp;
                {new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
              </span>
            </div>
            <div className="header-right">
              <button className="theme-toggle" onClick={toggleTheme} title={isDarkMode ? 'Light mode' : 'Dark mode'}>
                {isDarkMode ? <MdLightMode size={17} /> : <MdDarkMode size={17} />}
              </button>
              <button className="notification-btn" title="Alerts">
                <MdNotifications size={17} />
                {alerts.length > 0 && <span className="notif-badge">{alerts.length}</span>}
              </button>
            </div>
          </header>

          {/* Pages */}
          <Routes>
            <Route path="/" element={
              <HomePage
                currentOccupancy={currentOccupancy}
                maxCapacity={maxCapacity}
                entries={entries}
                exits={exits}
                chartData={chartData}
                statusColor={statusColor}
                statusText={statusText}
                loggedInUser={loggedInUser}
                userRole={userRole}
              />
            } />
            <Route path="/camera" element={
              <CameraPage
                currentOccupancy={currentOccupancy}
                setCrowd={setCurrentOccupancy}
                maxCapacity={maxCapacity}
                setEntries={setEntries}
                setExits={setExits}
              />
            } />
            <Route path="/multiview" element={
              <MultiViewPage currentOccupancy={currentOccupancy} maxCapacity={maxCapacity} />
            } />
            <Route path="/profile" element={
              <ProfilePage loggedInUser={loggedInUser} userRole={userRole} setLoggedInUser={setLoggedInUser} />
            } />
            {(userRole === 'admin' || userRole === 'manager') && (
              <>
                <Route path="/settings" element={
                  <SettingsPage
                    maxCapacity={maxCapacity}
                    setMaxCapacity={setMaxCapacity}
                    alertThreshold={alertThreshold}
                    setAlertThreshold={setAlertThreshold}
                  />
                } />
                <Route path="/users" element={<UsersPage />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

        </div>
      </div>
    </BrowserRouter>
  );
}
