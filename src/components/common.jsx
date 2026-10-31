import React from 'react';

function Stat({label,value,change,icon,tone,foot}) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-change"><span className="change-chip">↗</span>{change}</div><div className="stat-foot">{foot}</div></div>; }

function PageTitle({eyebrow,title,subtitle,actions}) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{actions&&<div className="heading-actions">{actions}</div>}</div>; }

function Field({label,required,wide,children}) { return <label className={`field ${wide?'wide':''}`}><span>{label}{required&&' *'}</span>{children}</label>; }

function Modal({title,onClose,children}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>; }

function Status({value}) { const v=String(value||'Unknown'); const key=v.toLowerCase().replace(/[^a-z]+/g,'-'); return <span className={`status-pill status-${key}`}>{v}</span>; }

function Empty({title,desc}) { return <div className="empty-state"><div>✦</div><h3>{title}</h3><p>{desc}</p></div>; }

export { Stat, PageTitle, Field, Modal, Status, Empty };
