import React, { useState, useEffect } from 'react';
import { MdPeople, MdPersonAdd, MdEdit, MdDelete, MdToggleOn, MdToggleOff, MdSearch } from 'react-icons/md';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/v1';

export default function UsersPage() {
  const [users, setUsers]           = useState([]);
  const [search, setSearch]         = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser]       = useState({ username:'', password:'', role:'viewer', email:'', full_name:'', department:'', is_active:true });
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsers = () =>
    fetch(`${API_BASE_URL}/users`).then(r => r.json()).then(setUsers).catch(() => {});

  useEffect(() => { fetchUsers(); }, []);

  const validEmail = e => /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(e);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.full_name) { alert('Fill required fields'); return; }
    if (newUser.email && !validEmail(newUser.email)) { alert('Invalid email'); return; }
    const res = await fetch(`${API_BASE_URL}/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newUser) });
    if (res.ok) {
      setNewUser({ username:'', password:'', role:'viewer', email:'', full_name:'', department:'', is_active:true });
      setShowCreate(false);
      fetchUsers();
    } else { const e = await res.json(); alert(e.detail || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await fetch(`${API_BASE_URL}/users/${id}`, { method:'DELETE' });
    fetchUsers();
  };

  const toggleStatus = async (id) => {
    await fetch(`${API_BASE_URL}/users/${id}/toggle-status`, { method:'PUT' });
    fetchUsers();
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (editingUser.email && !validEmail(editingUser.email)) { alert('Invalid email'); return; }
    // Build payload — only include password if the user typed a new one.
    // The backend skips password update when the field is an empty string.
    const payload = {
      username:   editingUser.username,
      role:       editingUser.role,
      email:      editingUser.email      || '',
      full_name:  editingUser.full_name  || '',
      department: editingUser.department || '',
      is_active:  editingUser.is_active,
      password:   editingUser.password || '', // empty string = keep existing (backend guards this)
    };
    const res = await fetch(`${API_BASE_URL}/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { const err = await res.json(); alert(err.detail || 'Failed to update user'); return; }
    setEditingUser(null);
    fetchUsers();
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = { admin:'var(--danger)', manager:'var(--warning)', operator:'var(--info)', security:'var(--success)', viewer:'var(--text-muted)' };

  return (
    <div className="page-content">

      <div className="page-header-row">
        <div>
          <h2 className="page-title"><MdPeople size={20} style={{marginRight:8}} />User Management</h2>
          <p className="page-subtitle">{users.length} registered users</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <MdPersonAdd size={16} style={{marginRight:6}} />
          {showCreate ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="profile-card" style={{marginBottom:0}}>
          <h3 className="card-section-title"><MdPersonAdd size={14} style={{marginRight:6}} />New User</h3>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group"><label>Username *</label><input className="form-input" value={newUser.username} onChange={e => setNewUser({...newUser, username:e.target.value})} required /></div>
              <div className="form-group"><label>Password *</label><input className="form-input" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password:e.target.value})} required /></div>
              <div className="form-group"><label>Full Name *</label><input className="form-input" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name:e.target.value})} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Email</label><input className="form-input" type="email" placeholder="user@example.com" value={newUser.email} onChange={e => setNewUser({...newUser, email:e.target.value})} /></div>
              <div className="form-group"><label>Department</label><input className="form-input" value={newUser.department} onChange={e => setNewUser({...newUser, department:e.target.value})} /></div>
              <div className="form-group"><label>Role</label>
                <select className="form-input" value={newUser.role} onChange={e => setNewUser({...newUser, role:e.target.value})}>
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="security">Security</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary"><MdPersonAdd size={14} style={{marginRight:6}} />Create User</button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <MdSearch size={16} style={{color:'var(--text-muted)', flexShrink:0}} />
        <input placeholder="Search by name, username or department…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="users-table-wrap">
        <div className="users-table">
          <div className="table-header">
            <div>Username</div>
            <div>Full Name</div>
            <div>Role</div>
            <div>Department</div>
            <div>Status</div>
            <div>Created</div>
            <div>Actions</div>
          </div>
          {filtered.length === 0 && (
            <div style={{padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>No users found.</div>
          )}
          {filtered.map(user => (
            <div key={user.id} className="table-row">
              <div className="col-username">{user.username}</div>
              <div>{user.full_name}</div>
              <div>
                <span className="role-badge" style={{background: roleColor[user.role]+'22', color: roleColor[user.role], border:`1px solid ${roleColor[user.role]}44`}}>
                  {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                </span>
              </div>
              <div style={{color:'var(--text-secondary)',fontSize:12}}>{user.department || '—'}</div>
              <div>
                <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{color:'var(--text-muted)',fontSize:12}}>{new Date(user.created_at).toLocaleDateString()}</div>
              <div className="col-actions">
                <button className="action-btn" onClick={() => toggleStatus(user.id)} title={user.is_active ? 'Deactivate' : 'Activate'}>
                  {user.is_active ? <MdToggleOn size={16} style={{color:'var(--success)'}} /> : <MdToggleOff size={16} style={{color:'var(--text-muted)'}} />}
                </button>
                <button className="action-btn edit-user" onClick={() => setEditingUser({...user, password:''})} title="Edit">
                  <MdEdit size={14} style={{marginRight:3}} />Edit
                </button>
                {user.username !== 'admin' && (
                  <button className="action-btn delete-user" onClick={() => handleDelete(user.id)} title="Delete">
                    <MdDelete size={14} style={{marginRight:3}} />Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3><MdEdit size={16} style={{marginRight:8}} />Edit — {editingUser.username}</h3>
              <button className="btn-ghost icon-only" onClick={() => setEditingUser(null)}>&times;</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="form-row">
                <div className="form-group"><label>Full Name</label><input className="form-input" value={editingUser.full_name||''} onChange={e => setEditingUser({...editingUser, full_name:e.target.value})} /></div>
                <div className="form-group"><label>Email</label><input className="form-input" type="email" value={editingUser.email||''} onChange={e => setEditingUser({...editingUser, email:e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Department</label><input className="form-input" value={editingUser.department||''} onChange={e => setEditingUser({...editingUser, department:e.target.value})} /></div>
                <div className="form-group"><label>Role</label>
                  <select className="form-input" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role:e.target.value})}>
                    <option value="viewer">Viewer</option><option value="operator">Operator</option>
                    <option value="security">Security</option><option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>New Password <span style={{fontWeight:400,color:'var(--text-muted)'}}>(leave blank to keep current)</span></label>
                <input className="form-input" type="password" placeholder="New password" value={editingUser.password} onChange={e => setEditingUser({...editingUser, password:e.target.value})} />
              </div>
              <div style={{display:'flex',gap:8,marginTop:16}}>
                <button type="submit" className="btn-primary" style={{flex:1}}>Save Changes</button>
                <button type="button" className="btn-ghost" style={{flex:1}} onClick={() => setEditingUser(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
