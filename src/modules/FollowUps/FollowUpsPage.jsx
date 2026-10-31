import React, { useState } from 'react';
import { PageTitle, Status, Empty } from '../../components/common';
import './FollowUpsPage.css';
import { DEMO_MODE } from '../../demoMode';

function localDateTimeValue(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function FollowUpsPage({ leads, updateLead, onSchedule, onEnableBrowserAlerts }) {
  const [filter, setFilter] = useState('All');
  const [dueInputs, setDueInputs] = useState({});
  const items = leads
    .filter(l => !['Won', 'Lost'].includes(l.status))
    .filter(l => filter === 'All' || (filter === 'Not scheduled' ? !l.dueAt : filter === 'Overdue' ? (l.dueAt && new Date(l.dueAt) < new Date()) || l.next === 'Overdue' : l.next === filter || (filter === 'Today' && l.dueAt && new Date(l.dueAt).toDateString() === new Date().toDateString())));

  return <div className="module-page module-page--follow-ups">
    <PageTitle eyebrow="STAY AHEAD" title="Follow-up manager" subtitle="Schedule reminders and keep every lead moving." />
    <div className="notice wide"><b>Reminder alerts:</b> Due reminders are sent to the assigned employee's CRM notification bell. Keep the CRM open around the reminder time; background alerts while the browser is closed require a server-side scheduler. {DEMO_MODE ? 'Demo reminders are stored in this browser.' : 'Live reminders are saved in Firebase.'}</div>
    <div className="filter-row">{['All', 'Today', 'Tomorrow', 'Overdue', 'Not scheduled'].map(x => <button className={`filter-chip ${filter === x ? 'selected' : ''}`} onClick={() => setFilter(x)} key={x}>{x}</button>)}<button className="btn secondary" onClick={onEnableBrowserAlerts}>Enable browser alerts</button></div>
    <div className="followup-grid">{items.map((l, i) => <div className="panel follow-card" key={l.id}>
      <div className="follow-card-top"><div className={`tiny-avatar av-${i % 4}`}>{(l.name || 'Lead').split(' ').map(n => n[0]).join('').slice(0, 2)}</div><Status value={l.status} /></div>
      <h3>{l.name}</h3><p>{l.location || 'Location not added'} · {l.type}</p>
      <div className="follow-meta"><span>◷ {l.dueAt ? new Date(l.dueAt).toLocaleString() : (l.next || 'Not scheduled')}</span><span>♙ {l.assigned || 'Unassigned'}</span></div>
      <label className="field reminder-field">Reminder date & time<input type="datetime-local" min={localDateTimeValue(new Date())} value={dueInputs[l.id] ?? (l.dueAt ? localDateTimeValue(new Date(l.dueAt)) : '')} onChange={e => setDueInputs(prev => ({ ...prev, [l.id]: e.target.value }))} /></label>
      <div className="follow-actions"><a href={`tel:${String(l.phone || '').replace(/\D/g, '')}`} className="btn secondary">☎ Call</a><button className="btn primary" onClick={() => { const value = dueInputs[l.id] ?? (l.dueAt ? localDateTimeValue(new Date(l.dueAt)) : ''); if (!value) { window.alert('Please select follow-up date and time first.'); return; } onSchedule(l.id, value); }}>Set reminder</button><button className="btn secondary" onClick={() => updateLead(l.id, { next: 'Tomorrow', dueAt: null })}>Done · reschedule</button></div>
    </div>)}{!items.length && <Empty title="No follow-ups in this view" desc="Try another filter or schedule a reminder for a lead." />}</div>
  </div>;
}
