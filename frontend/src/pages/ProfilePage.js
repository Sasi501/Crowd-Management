import React, { useState } from 'react';
import { MdPerson, MdEmail, MdBusiness, MdShield, MdEdit, MdSave, MdClose, MdLock } from 'react-icons/md';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/v1';

export default function ProfilePage({ loggedInUser, userRole, setLoggedInUser }) {
  const [editing, setEditing]     = useState(false);
  const [form, setForm]           = useState({ full_name: loggedInUser?.full_name || '', email: loggedInUser?.email || '', department: loggedInUser?.department || '' });
  const [pwForm, setPwForm]       = useState({ current: '', newPw: '', confirm: '' });
  const [pwMsg, setPwMsg]         = useState('');
  const [saveMsg, setSaveMsg]     = useState('');

  const handleSave = async () => {
    const updatedUser = { ...loggedInUser, ...form };
    const res = await fetch(`${API_BASE_URL}/users/${loggedInUser?.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser)
    }).catch(() => null);
    
    if (res?.ok) {
      setLoggedInUser(updatedUser);
      setSaveMsg('Profile updated successfully!');
    } else {
      setSaveMsg('Failed to update profile.');
    }
    
    setEditing(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg('Passwords do not match.'); return; }
    const res = await fetch(`${API_BASE_URL}/users/${loggedInUser?.id}/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw })
    }).catch(() => null);
    setPwMsg(res?.ok ? 'Password changed successfully.' : 'Failed — check your current password.');
    setPwForm({ current: '', newPw: '', confirm: '' });
    setTimeout(() => setPwMsg(''), 4000);
  };

  const roleColors = { admin:'var(--danger)', manager:'var(--warning)', operator:'var(--info)', security:'var(--success)', viewer:'var(--text-muted)' };

  return (
    <div className="page-content">

      <div className="page-header-row">
        <div>
          <h2 className="page-title"><MdPerson size={20} style={{marginRight:8}} />My Profile</h2>
          <p className="page-subtitle">View and manage your account details</p>
        </div>
        {!editing
          ? <button className="btn-secondary" onClick={() => setEditing(true)}><MdEdit size={15} style={{marginRight:6}} />Edit Profile</button>
          : <div style={{display:'flex',gap:8}}>
              <button className="btn-primary" onClick={handleSave}><MdSave size={15} style={{marginRight:6}} />Save</button>
              <button className="btn-ghost" onClick={() => setEditing(false)}><MdClose size={15} style={{marginRight:6}} />Cancel</button>
            </div>
        }
      </div>

      {saveMsg && <div className="info-banner success">{saveMsg}</div>}

      <div className="profile-grid">

        {/* Avatar + role card */}
        <div className="profile-card profile-avatar-card">
          <div className="avatar-circle">
            {(loggedInUser?.full_name || loggedInUser?.username || 'U')[0].toUpperCase()}
          </div>
          <p className="avatar-name">{loggedInUser?.full_name || loggedInUser?.username}</p>
          <p className="avatar-username">@{loggedInUser?.username}</p>
          <span className="role-pill" style={{background: roleColors[userRole] + '22', color: roleColors[userRole], border:`1px solid ${roleColors[userRole]}44`}}>
            <MdShield size={12} style={{marginRight:4}} />
            {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
          </span>
          <div className="avatar-meta">
            <span>Member since</span>
            <strong>{loggedInUser?.created_at ? new Date(loggedInUser.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'}) : '—'}</strong>
          </div>
          <div className="avatar-meta">
            <span>Account status</span>
            <strong style={{color:'var(--success)'}}>Active</strong>
          </div>
        </div>

        {/* Details card */}
        <div className="profile-card profile-details-card">
          <h3 className="card-section-title">Personal Information</h3>

          <div className="profile-field">
            <label><MdPerson size={13} style={{marginRight:5}} />Full Name</label>
            {editing
              ? <input className="form-input" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
              : <span>{loggedInUser?.full_name || '—'}</span>
            }
          </div>

          <div className="profile-field">
            <label><MdEmail size={13} style={{marginRight:5}} />Email Address</label>
            {editing
              ? <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              : <span>{loggedInUser?.email || '—'}</span>
            }
          </div>

          <div className="profile-field">
            <label><MdBusiness size={13} style={{marginRight:5}} />Department</label>
            {editing
              ? <input className="form-input" value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
              : <span>{loggedInUser?.department || '—'}</span>
            }
          </div>

          <div className="profile-field">
            <label><MdShield size={13} style={{marginRight:5}} />Role</label>
            <span>{userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}</span>
          </div>
        </div>

        {/* Change password card */}
        <div className="profile-card profile-pw-card">
          <h3 className="card-section-title"><MdLock size={14} style={{marginRight:6}} />Change Password</h3>
          <form onSubmit={handlePwChange} style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="profile-field">
              <label>Current Password</label>
              <input className="form-input" type="password" placeholder="Current password" value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})} required />
            </div>
            <div className="profile-field">
              <label>New Password</label>
              <input className="form-input" type="password" placeholder="New password" value={pwForm.newPw} onChange={e => setPwForm({...pwForm, newPw: e.target.value})} required />
            </div>
            <div className="profile-field">
              <label>Confirm New Password</label>
              <input className="form-input" type="password" placeholder="Confirm password" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} required />
            </div>
            {pwMsg && <p style={{fontSize:12, color: pwMsg.includes('success') ? 'var(--success)' : 'var(--danger)', margin:0}}>{pwMsg}</p>}
            <button type="submit" className="btn-primary" style={{alignSelf:'flex-start'}}>
              <MdLock size={14} style={{marginRight:6}} />Update Password
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
