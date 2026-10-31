import React, { useEffect, useMemo, useState } from 'react';
import Login from './components/Login';
import ForcePasswordChange from './components/ForcePasswordChange';
import Dashboard from './modules/Dashboard/Dashboard';
import SuperAdminPage from './modules/SuperAdmin/SuperAdminPage';
import LeadsPage from './modules/Leads/LeadsPage';
import FollowUpsPage from './modules/FollowUps/FollowUpsPage';
import CustomersPage from './modules/Customers/CustomersPage';
import PropertiesPage from './modules/Properties/PropertiesPage';
import ProjectsPage from './modules/Projects/ProjectsPage';
import SiteVisitsPage from './modules/SiteVisits/SiteVisitsPage';
import BookingsPage from './modules/Bookings/BookingsPage';
import PaymentsPage from './modules/Payments/PaymentsPage';
import EmployeesPage from './modules/Employees/EmployeesPage';
import AttendancePage from './modules/Attendance/AttendancePage';
import PayrollPage from './modules/Payroll/PayrollPage';
import ReportsPage from './modules/Reports/ReportsPage';
import SettingsPage from './modules/Settings/SettingsPage';
import { PageTitle, Field, Modal, Status, Empty } from './components/common';
import { auth, db, storage, firebaseConfig } from './firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, getDoc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { useFirestoreCollection, useCompanies, useCompanyDocument, useFirestoreSettings } from './firebaseData';
import { DEMO_MODE, demoLogin, getDemoStore, createDemoCompany, addDemoEmployee, resetDemoPassword, editDemoEmployee } from './demoMode';

const NAV = [
  { group: 'WORKSPACE', items: [['Dashboard','▦'],['Leads','♧'],['Follow-ups','◷'],['Customers','♙'],['Properties','⌂'],['Projects','▤'],['Site Visits','⌖'],['Bookings','✓'],['Payments','₹']] },
  { group: 'PEOPLE', items: [['Employees','♧'],['Attendance','◷'],['Payroll','₹']] },
  { group: 'INSIGHTS', items: [['Reports','▥'],['Settings','⚙']] },
];
const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));

function uid(prefix='ID') { return `${prefix}-${Math.random().toString(36).slice(2,6).toUpperCase()}${Date.now().toString().slice(-4)}`; }

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const companies = useCompanies(session?.role === 'superadmin');
  const tenantId = activeCompanyId || session?.companyId || null;
  const ownerDataTenantId = (session?.role === 'owner' || Boolean(activeCompanyId)) ? tenantId : null;
  const companyDoc = useCompanyDocument(tenantId);
  const [page, setPage] = useState('Dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const employeeContext = session?.role === 'employee' ? { uid:session.uid, name:session.name } : null;
  const [alerts, setAlerts] = useFirestoreCollection(tenantId, 'notifications', employeeContext);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [leads, setLeads] = useFirestoreCollection(tenantId, 'leads', employeeContext);
  const [employees, setEmployees] = useFirestoreCollection(ownerDataTenantId, 'employees');
  const [attendance, setAttendance] = useFirestoreCollection(tenantId, 'attendance', employeeContext);
  const [payroll, setPayroll] = useFirestoreCollection(ownerDataTenantId, 'payroll');
  const [properties, setProperties] = useFirestoreCollection(tenantId, 'properties');
  const [ownerCredentials, setOwnerCredentials] = useState(null);
  const [employeeEditOpen, setEmployeeEditOpen] = useState(false);
  const [employeeEditForm, setEmployeeEditForm] = useState(null);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({ name:'', phone:'', email:'', source:'Website', budget:'', location:'', type:'2 BHK', status:'New', assigned:'', next:'Today', notes:'' });
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ name:'', email:'', role:'Sales Executive', phone:'', salary:'', status:'Active', password:'' });
  const [employeeCredentials, setEmployeeCredentials] = useState(null);
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [propertyForm, setPropertyForm] = useState({ name:'', location:'', type:'Apartment', price:'', status:'Available' });
  const [settings, setSettings] = useFirestoreSettings(tenantId, { companyName:'Rihaos Realtor', brandColor:'#55b9ee', currency:'INR', timezone:'Asia/Kolkata' });

  useEffect(() => {
    if (DEMO_MODE) {
      try { const saved = localStorage.getItem('estateflow_demo_session'); if (saved) { const restored = JSON.parse(saved); setSession(restored); setPage(restored.role === 'superadmin' ? 'Companies' : 'Dashboard'); } }
      catch (error) { console.warn('Demo session could not be restored', error); }
      setAuthLoading(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) { setSession(null); setAuthLoading(false); return; }
      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid));
        if (!profileSnap.exists()) {
          setAuthMessage('Login ho gaya, lekin Firestore users/' + user.uid + ' profile nahi mili. Setup guide ke mutabik role profile banayein.');
          await signOut(auth); setSession(null);
        } else {
          const profile = profileSnap.data();
          if (!['superadmin','owner','employee'].includes(profile.role)) throw new Error('User profile role must be superadmin, owner, or employee.');
          if (profile.active === false) throw new Error('This account is inactive. Please contact your company administrator.');
          if (profile.role !== 'superadmin' && !profile.companyId) throw new Error('Owner/Employee profile mein exact companyId missing hai.');
          setSession({ uid:user.uid, email:user.email || profile.email || '', name:profile.name || user.displayName || user.email || 'User', role:profile.role, companyId:profile.companyId || null, companyName:profile.companyName || '', mustChangePassword:Boolean(profile.mustChangePassword) });
          setAuthMessage(''); setPage(profile.role === 'superadmin' ? 'Companies' : 'Dashboard');
        }
      } catch (error) { setAuthMessage(error.message || 'Login profile load nahi hua.'); await signOut(auth).catch(()=>{}); }
      finally { setAuthLoading(false); }
    });
    return unsubscribe;
  }, []);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t); } }, [toast]);

  // Live Firebase reminders: create one persistent notification for the assigned employee when a reminder becomes due.
  useEffect(() => {
    if (DEMO_MODE || !tenantId || !session || !['owner', 'employee'].includes(session.role)) return undefined;
    let stopped = false;
    const checkDue = async () => {
      const now = Date.now();
      for (const lead of leads) {
        if (!lead.dueAt || !lead.assigned || ['Won', 'Lost'].includes(lead.status) || new Date(lead.dueAt).getTime() > now) continue;
        const dueMillis = new Date(lead.dueAt).getTime();
        const safeLead = String(lead.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 70);
        const notificationId = `rem_${safeLead}_${dueMillis}`;
        const notificationRef = doc(db, 'companyData', tenantId, 'notifications', notificationId);
        try {
          const existing = await getDoc(notificationRef);
          if (stopped || existing.exists()) continue;
          const notification = {
            id: notificationId, companyId: tenantId, leadId: lead.id, leadName: lead.name || 'Lead',
            dueAt: new Date(dueMillis).toISOString(), createdAt: new Date().toISOString(), read: false,
            recipientRole: 'employee', recipientName: lead.assigned,
            message: `Follow-up reminder due: ${lead.name || 'Lead'}`
          };
          await setDoc(notificationRef, notification);
          if (!stopped && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && session.role === 'employee' && (lead.assigned || '').toLowerCase() === (session.name || '').toLowerCase()) {
            try { new Notification('EstateFlow CRM — Follow-up reminder', { body: `${lead.name || 'Lead'} · ${new Date(dueMillis).toLocaleString()}` }); } catch {}
          }
        } catch (error) { console.error('Reminder notification could not be saved:', error); }
      }
    };
    checkDue();
    const timer = setInterval(checkDue, 30000);
    return () => { stopped = true; clearInterval(timer); };
  }, [tenantId, session?.uid, session?.role, session?.name, leads]);

  // Local-demo reminders: persisted in this browser, with in-app and optional browser alerts.
  useEffect(() => {
    if (!DEMO_MODE || !tenantId || !session) { if (DEMO_MODE) setAlerts([]); return undefined; }
    const key = `estateflow_demo_alerts_${tenantId}`;
    const load = () => { try { setAlerts(JSON.parse(localStorage.getItem(key) || '[]')); } catch { setAlerts([]); } };
    load();
    const checkDue = () => {
      const now = Date.now();
      let current = [];
      try { current = JSON.parse(localStorage.getItem(key) || '[]'); } catch { current = []; }
      let changed = false;
      leads.forEach(lead => {
        if (!lead.dueAt || ['Won', 'Lost'].includes(lead.status) || new Date(lead.dueAt).getTime() > now) return;
        const dueKey = new Date(lead.dueAt).toISOString();
        if (current.some(a => a.leadId === lead.id && a.dueAt === dueKey)) return;
        const base = { id: uid('AL'), companyId: tenantId, leadId: lead.id, leadName: lead.name, dueAt: dueKey, createdAt: new Date().toISOString(), read: false, message: `Follow-up due: ${lead.name}` };
        current.unshift({ ...base, id: uid('AL'), recipientRole: 'employee', recipientName: lead.assigned || 'Unassigned' });
        current.unshift({ ...base, id: uid('AL'), recipientRole: 'owner', recipientName: '' });
        changed = true;
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const belongsToCurrentUser = session.role === 'owner' || (session.role === 'employee' && (lead.assigned || '').toLowerCase() === (session.name || '').toLowerCase());
          if (belongsToCurrentUser) { try { new Notification('EstateFlow CRM — Follow-up due', { body: `${lead.name} · ${lead.assigned || 'Unassigned'}` }); } catch {} }
        }
      });
      if (changed) { localStorage.setItem(key, JSON.stringify(current)); setAlerts(current); }
    };
    checkDue();
    const timer = setInterval(checkDue, 30000);
    return () => clearInterval(timer);
  }, [tenantId, session?.uid, session?.role, session?.name, leads]);

  function scheduleFollowUp(leadId, value) {
    const dueAt = new Date(value);
    if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now()) { setToast('Please choose a future date and time'); return; }
    updateLead(leadId, { dueAt: dueAt.toISOString(), next: dueAt.toDateString() === new Date().toDateString() ? 'Today' : 'Tomorrow', reminderUpdatedBy: session.uid, reminderUpdatedAt: new Date().toISOString() });
    setToast(DEMO_MODE ? 'Follow-up reminder saved in this browser' : 'Follow-up reminder saved to Firebase');
  }

  async function enableBrowserAlerts() {
    if (!('Notification' in window)) { setToast('This browser does not support notifications'); return; }
    try { const permission = await Notification.requestPermission(); setToast(permission === 'granted' ? 'Browser alerts enabled while CRM is open' : 'Browser notification permission was not granted'); } catch { setToast('Could not enable browser alerts'); }
  }

  async function markAlertRead(alertId) {
    if (!tenantId) return;
    if (DEMO_MODE) {
      const key = `estateflow_demo_alerts_${tenantId}`;
      const next = alerts.map(a => a.id === alertId ? { ...a, read: true } : a);
      localStorage.setItem(key, JSON.stringify(next)); setAlerts(next); return;
    }
    try { await updateDoc(doc(db, 'companyData', tenantId, 'notifications', alertId), { read: true }); }
    catch (error) { console.error('Notification read status update failed:', error); setToast('Notification update nahi hua. Firestore Rules check karein.'); }
  }

  async function login(role, email, password) {
    setActiveCompanyId(null); setAuthMessage('');
    if (!email || !password) { setAuthMessage('Email aur password dono bharein.'); return; }
    if (DEMO_MODE) {
      try {
        const user = demoLogin(email, password, role);
        const next = { uid:user.uid, email:user.email, name:user.name, role:user.role, companyId:user.companyId || null, companyName:(getDemoStore().companies.find(c=>c.id===user.companyId)?.name) || '', mustChangePassword:Boolean(user.mustChangePassword), demo:true };
        setSession(next); localStorage.setItem('estateflow_demo_session', JSON.stringify(next));
        setPage(role === 'superadmin' ? 'Companies' : 'Dashboard');
      } catch (error) { setAuthMessage(error.message || 'Demo login nahi ho paya.'); }
      return;
    }
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profileSnap = await getDoc(doc(db, 'users', credential.user.uid));
      if (!profileSnap.exists()) { await signOut(auth); throw new Error('Firebase account ka users/{UID} profile nahi mila. Setup guide mein diye gaye profile fields add karein.'); }
      const profile = profileSnap.data();
      if (profile.role !== role) { await signOut(auth); throw new Error('Is email ka role ' + (profile.role || 'set nahi') + ' hai. Login par wahi tab select karein.'); }
      if (profile.active === false) { await signOut(auth); throw new Error('This account is inactive. Please contact your company administrator.'); }
      if (role !== 'superadmin' && !profile.companyId) { await signOut(auth); throw new Error('Owner/Employee ke users profile mein companyId missing hai.'); }
    } catch (error) { setAuthMessage(error.code === 'auth/invalid-credential' ? 'Email ya password galat hai.' : error.code === 'auth/operation-not-allowed' ? 'Firebase Console > Authentication > Sign-in method mein Email/Password enable karein.' : error.message || 'Login nahi ho paya.'); }
  }
  async function logout() {
    setActiveCompanyId(null);
    if (!DEMO_MODE) await signOut(auth); else localStorage.removeItem('estateflow_demo_session');
    setSession(null);
    setPage('Dashboard');
  }
  const company = activeCompanyId ? companyDoc : session?.role === 'superadmin' ? (companies[0] || null) : companyDoc;
  const visibleEmployees = session?.role === 'employee' ? [{ id:session.uid, name:session.name, role:'Employee', status:'Active' }] : employees;
  const isSuper = session?.role === 'superadmin' && !activeCompanyId;
  const todayKey = new Date().toLocaleDateString('en-CA');
  const todayAttendance = attendance.filter(a => a.date === todayKey);
  const openLeads = leads.filter(l => !['Won','Lost'].includes(l.status));
  const overdue = leads.filter(l => ['Today','Overdue'].includes(l.next) && !['Won','Lost'].includes(l.status));
  const filteredLeads = useMemo(() => leads.filter(l => `${l.name} ${l.phone} ${l.location} ${l.id} ${l.assigned}`.toLowerCase().includes(search.toLowerCase())), [leads, search]);

  function addLead(e) { e.preventDefault(); const lead = { ...leadForm, id:uid('LD'), budget:Number(leadForm.budget || 0), assigned:leadForm.assigned || (session.role === 'employee' ? session.name : employees[0]?.name) || 'Unassigned', createdBy:session.uid }; setLeads(prev => [lead, ...prev]); setLeadForm({ name:'', phone:'', email:'', source:'Website', budget:'', location:'', type:'2 BHK', status:'New', assigned:'', next:'Today', notes:'' }); setLeadFormOpen(false); setToast('Lead created successfully'); }
  function updateLead(id, changes) { setLeads(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l)); setToast('Lead updated'); }
  async function addEmployee(e) {
    e.preventDefault();
    if (session.role !== 'owner') { setToast('Employee login sirf Company Owner bana sakta hai.'); return; }
    try {
      if (DEMO_MODE) {
        const result = addDemoEmployee(session.companyId, { ...employeeForm, initialPassword:employeeForm.password, salary:Number(employeeForm.salary || 0) });
        setEmployeeCredentials(result);
      } else {
        const email = String(employeeForm.email || '').trim().toLowerCase();
        const password = String(employeeForm.password || '');
        if (!email) throw new Error('Employee email required hai.');
        if (password.length < 8) throw new Error('Employee password kam se kam 8 characters ka hona chahiye.');
        const secondaryApp = initializeApp(firebaseConfig, `employee-create-${Date.now()}`);
        const { getAuth } = await import('firebase/auth');
        const secondaryAuth = getAuth(secondaryApp);
        let createdUser = null;
        try {
          const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          createdUser = credential.user;
          const employeeUid = createdUser.uid;
          const companyId = session.companyId;
          const employeeRow = { id:employeeUid, uid:employeeUid, name:employeeForm.name.trim(), email, role:employeeForm.role || 'Sales Executive', phone:employeeForm.phone || '', salary:Number(employeeForm.salary || 0), status:employeeForm.status || 'Active', companyId, createdAt:new Date().toISOString() };
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', employeeUid), { uid:employeeUid, name:employeeRow.name, email, role:'employee', companyId, companyName:session.companyName || '', active:true, mustChangePassword:true, phone:employeeRow.phone, createdAt:employeeRow.createdAt });
          batch.set(doc(db, 'companyData', companyId, 'employees', employeeUid), employeeRow);
          await batch.commit();
          setEmployeeCredentials({ ...employeeRow, password, companyId });
        } catch (error) {
          if (createdUser) await deleteUser(createdUser).catch(() => {});
          throw error;
        } finally {
          await signOut(secondaryAuth).catch(() => {});
          await deleteApp(secondaryApp).catch(() => {});
        }
      }
      setEmployeeForm({ name:'', email:'', role:'Sales Executive', phone:'', salary:'', status:'Active', password:'' });
      setEmployeeFormOpen(false); setToast('Employee login successfully created');
    } catch (error) { setToast(error.message || 'Employee account create nahi hua.'); }
  }
  async function createCompanyWithOwner(e, form) {
    e.preventDefault();
    try {
      if (DEMO_MODE) {
        const result = createDemoCompany(form); setOwnerCredentials(result); setToast('Demo company aur Owner login create ho gaye'); return true;
      }
      // Spark-compatible client flow: create the Owner in a secondary Firebase Auth app.
      // This keeps the currently signed-in Super Admin session intact and requires no Cloud Function.
      const companyName = String(form.companyName || '').trim();
      const ownerName = String(form.ownerName || '').trim();
      const ownerEmail = String(form.email || '').trim().toLowerCase();
      const ownerPassword = String(form.password || '');
      if (!companyName || !ownerName || !ownerEmail) throw new Error('Company aur Owner ki required details bharein.');
      if (ownerPassword.length < 8) throw new Error('Temporary password kam se kam 8 characters ka hona chahiye.');
      const companyId = uid('CO').toLowerCase();
      const secondaryApp = initializeApp(firebaseConfig, `owner-create-${Date.now()}`);
      const secondaryAuth = (await import('firebase/auth')).getAuth(secondaryApp);
      let createdUser = null;
      try {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, ownerEmail, ownerPassword);
        createdUser = credential.user;
        const ownerUid = createdUser.uid;
        const batch = writeBatch(db);
        batch.set(doc(db, 'companies', companyId), {
          name: companyName, ownerName, ownerEmail, ownerUid,
          phone: String(form.phone || '').trim(), plan: form.plan || 'Growth',
          seatLimit: Number(form.seatLimit || 15), status: 'Active',
          color: '#55b9ee', short: companyName.slice(0, 2).toUpperCase(),
          createdAt: new Date().toISOString()
        });
        batch.set(doc(db, 'users', ownerUid), {
          uid: ownerUid, name: ownerName, email: ownerEmail,
          role: 'owner', companyId, companyName, active: true, mustChangePassword: true,
          phone: String(form.phone || '').trim(), createdAt: new Date().toISOString()
        });
        batch.set(doc(db, 'companySettings', companyId), {
          companyName, brandColor: '#55b9ee', currency: 'INR', timezone: 'Asia/Kolkata'
        });
        await batch.commit();
        setOwnerCredentials({ companyName, ownerName, email: ownerEmail, companyId, ownerUid, password: ownerPassword });
        setToast('Company, Owner Login aur Profile create ho gaye'); return true;
      } catch (error) {
        if (createdUser) await deleteUser(createdUser).catch(() => {});
        throw error;
      } finally {
        await signOut(secondaryAuth).catch(() => {});
        await deleteApp(secondaryApp).catch(() => {});
      }
    } catch (error) { setToast(error.message || 'Company/Owner create nahi hua.'); return false; }
  }
  async function resetOwnerPassword(company) {
    const ok = window.confirm(`${company.ownerName || 'Company Owner'} ka temporary password reset karna hai? Purana password kaam nahi karega.`);
    if (!ok) return;
    try {
      if (DEMO_MODE) { const result = resetDemoPassword(company.ownerUid); const owner = getDemoStore().users.find(u=>u.uid===company.ownerUid); setOwnerCredentials({ ...result, companyName:company.name, ownerName:company.ownerName, email:owner?.email, companyId:company.id }); setToast('Demo temporary password reset ho gaya'); }
      else { await sendPasswordResetEmail(auth, company.ownerEmail); setToast(`Password reset email ${company.ownerEmail} par bhej diya gaya.`); }
    } catch (error) { setToast(error.message || 'Owner password reset nahi hua.'); }
  }
  function openEmployeeEdit(employee) {
    setEmployeeEditForm({ uid:employee.uid || employee.id, name:employee.name || '', email:employee.email || '', phone:employee.phone || '', jobTitle:employee.role || employee.jobTitle || 'Sales Executive', salary:String(employee.salary || ''), status:employee.status || 'Active' });
    setEmployeeEditOpen(true);
  }
  async function saveEmployeeEdit(e) {
    e.preventDefault();
    try {
      if (DEMO_MODE) editDemoEmployee(session.companyId, employeeEditForm.uid, { ...employeeEditForm, salary:Number(employeeEditForm.salary || 0), role:employeeEditForm.jobTitle });
      else {
        const employeeUid = employeeEditForm.uid;
        const existingEmployee = employees.find(item => (item.uid || item.id) === employeeUid);
        if (employeeEditForm.email.trim().toLowerCase() !== String(existingEmployee?.email || '').trim().toLowerCase()) throw new Error('Employee login email cannot be changed here. Use Firebase Authentication email update flow.');
        const changes = { name:employeeEditForm.name.trim(), email:employeeEditForm.email.trim().toLowerCase(), phone:employeeEditForm.phone || '', role:employeeEditForm.jobTitle, salary:Number(employeeEditForm.salary || 0), status:employeeEditForm.status };
        await updateDoc(doc(db, 'companyData', session.companyId, 'employees', employeeUid), changes);
        await updateDoc(doc(db, 'users', employeeUid), { name:changes.name, phone:changes.phone, active:changes.status === 'Active' });
      }
      setEmployeeEditOpen(false); setEmployeeEditForm(null); setToast('Employee details updated');
    } catch (error) { setToast(error.message || 'Employee details update nahi hue.'); }
  }
  async function resetEmployeePassword(employee) {
    const ok = window.confirm(`${employee.name} ka temporary password reset karna hai? Purana password kaam nahi karega.`);
    if (!ok) return;
    try {
      if (DEMO_MODE) { const result = resetDemoPassword(employee.uid || employee.id); setEmployeeCredentials({ ...result, name:employee.name, email:employee.email }); setToast('Demo temporary password reset ho gaya'); }
      else {
        await sendPasswordResetEmail(auth, employee.email);
        setToast(`Password reset email ${employee.email} par bhej diya gaya.`);
      }
    } catch (error) { setToast(error.message || 'Password reset nahi hua.'); }
  }
  function addProperty(e) { e.preventDefault(); setProperties(prev => [...prev, { ...propertyForm, id:uid('PR'), price:Number(propertyForm.price || 0) }]); setPropertyForm({ name:'', location:'', type:'Apartment', price:'', status:'Available' }); setPropertyFormOpen(false); setToast('Property added'); }
  async function saveAttendancePhoto(payload, action) {
    if (!payload?.photoBlob || !payload?.location) throw new Error('Selfie aur GPS location dono required hain.');
    if (DEMO_MODE) return 'demo-selfie-captured-locally-not-uploaded';
    const dateKey = todayKey;
    const filename = `${dateKey}-${action}-${Date.now()}.jpg`;
    const imageRef = storageRef(storage, `attendance/${session.companyId}/${session.uid}/${filename}`);
    const uploaded = await uploadBytes(imageRef, payload.photoBlob, { contentType:'image/jpeg', customMetadata:{ employeeId:session.uid, companyId:session.companyId, action } });
    return getDownloadURL(uploaded.ref);
  }
  async function checkIn(payload) {
    if (session.role === 'superadmin') throw new Error('Super Admin preview में attendance submit नहीं की जा सकती।');
    if (attendance.some(a => a.date === todayKey && a.employeeId === session.uid)) throw new Error('Aaj ka check-in already recorded hai.');
    const photoUrl = await saveAttendancePhoto(payload, 'checkin');
    const time = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    const record = { id:uid('ATT'), employeeId:session.uid, name:session.name, date:todayKey, checkIn:time, checkInAt:new Date().toISOString(), checkInPhotoUrl:photoUrl, checkInLocation:payload.location, checkOut:'', status:'Present' };
    if (DEMO_MODE) setAttendance(prev => [record, ...prev]);
    else await setDoc(doc(db, 'companyData', session.companyId, 'attendance', record.id), record);
    setToast(DEMO_MODE ? 'Demo check-in recorded (photo not uploaded)' : 'Check-in selfie + GPS recorded');
  }
  async function checkOut(payload) {
    if (session.role === 'superadmin') throw new Error('Super Admin preview में attendance submit नहीं की जा सकती।');
    const record = attendance.find(a => a.date === todayKey && a.employeeId === session.uid && !a.checkOut);
    if (!record) throw new Error('Pehle check-in karein.');
    const photoUrl = await saveAttendancePhoto(payload, 'checkout');
    const time = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    const updated = { ...record, checkOut:time, checkOutAt:new Date().toISOString(), checkOutPhotoUrl:photoUrl, checkOutLocation:payload.location };
    if (DEMO_MODE) setAttendance(prev => prev.map(a => a.id === record.id ? updated : a));
    else await setDoc(doc(db, 'companyData', session.companyId, 'attendance', record.id), updated, { merge:true });
    setToast(DEMO_MODE ? 'Demo check-out recorded (photo not uploaded)' : 'Check-out selfie + GPS recorded');
  }
  function createPayroll() { const month = new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'}); const next = employees.map(e => ({ id:uid('PAY'), employeeId:e.id, employee:e.name, month, base:Number(e.salary||0), incentive:0, deductions:0, status:'Draft' })); setPayroll(prev => [...next, ...prev]); setToast('Payroll drafts created for active employees'); }
  if (!session) return <Login onLogin={login} authMessage={authMessage} authLoading={authLoading} />;
  if (session.mustChangePassword) return <ForcePasswordChange session={session} onComplete={() => setSession(current => ({ ...current, mustChangePassword:false }))} />;

  return <div className={`shell ${collapsed?'collapsed':''} ${mobileNav?'nav-open':''}`} style={{'--brand':company?.color || '#55b9ee'}}>
    {mobileNav && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className="sidebar">
      <div className="brand"><div className="brand-logo">N<span>+</span></div><div className="brand-text"><strong>NISS TECHNOLOGY<span>.</span></strong><small>RIHAOS REALTOR CRM</small></div><button className="collapse-btn" onClick={() => setCollapsed(v=>!v)} title="Collapse sidebar">‹</button></div>
      {isSuper ? <><div className="side-caption">PLATFORM</div><button className={`nav-item ${page==='Companies'?'active':''}`} onClick={()=>{setPage('Companies');setMobileNav(false)}}><span className="nav-icon">▦</span><span>Companies</span></button><button className={`nav-item ${page==='Platform Overview'?'active':''}`} onClick={()=>{setPage('Platform Overview');setMobileNav(false)}}><span className="nav-icon">◈</span><span>Platform overview</span></button><button className={`nav-item ${page==='Subscriptions'?'active':''}`} onClick={()=>{setPage('Subscriptions');setMobileNav(false)}}><span className="nav-icon">₹</span><span>Subscriptions</span></button></> : <>
        <div className="company-switch"><div className="company-avatar">{company?.short || 'RR'}</div><div className="company-meta"><b>{settings.companyName || company?.name}</b><small>ID: {company?.id || session.companyId || '—'} · {company?.plan || 'Growth'} plan</small></div><span>⌄</span></div>
        {NAV.map(group => <div key={group.group}><div className="side-caption">{group.group}</div>{group.items.filter(([label]) => activeCompanyId || session.role === 'owner' || session.role === 'superadmin' || !['Payments','Employees','Payroll','Reports','Settings'].includes(label)).map(([label, icon]) => <button key={label} className={`nav-item ${page===label?'active':''}`} onClick={() => {setPage(label);setMobileNav(false)}}><span className="nav-icon">{icon}</span><span>{label}</span>{label==='Leads' && <em>{openLeads.length}</em>}</button>)}</div>)}
      </>}
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon">✦</div><b>{isSuper?'Platform controls':'Make work flow.'}</b><p>{isSuper?'Manage client workspaces in one place.':'Your team workspace is ready to grow.'}</p><button onClick={()=>{setPage(isSuper?'Subscriptions':'Settings');setMobileNav(false)}}>{isSuper?'View plans':'Workspace settings'} <span>↗</span></button></div><div className="sidebar-user"><div className="avatar">{session.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="user-meta"><b>{session.name}</b><small>{session.role==='superadmin'?'Super Admin':session.role==='owner'?'Workspace Owner':'Sales Employee'}</small></div><button className="more-btn" onClick={logout} title="Sign out">↗</button></div></div>
    </aside>
    <main className="main">
      {DEMO_MODE && <div className="demo-mode-banner">DEMO MODE · Data is saved only in this browser · No cloud sync / real authentication</div>}
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMobileNav(v=>!v)}>☰</button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{page}</strong></div>{activeCompanyId && <button className="btn secondary" onClick={()=>{setActiveCompanyId(null);setPage("Companies")}}>← Back to Platform</button>}<div className="top-actions"><label className="search-box"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search anything..."/><kbd>⌘ K</kbd></label><div className="notification-wrap"><button className="icon-button" title="Notifications" onClick={()=>setNotificationsOpen(v=>!v)}>♧{alerts.filter(a=>!a.read && (session.role==='employee' ? a.recipientRole==='employee' && (a.recipientName||'').toLowerCase()===(session.name||'').toLowerCase() : a.recipientRole==='owner')).length>0 && <i/>}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-popover-head"><b>Notifications</b><button onClick={()=>setNotificationsOpen(false)}>×</button></div>{alerts.filter(a=>session.role==='employee' ? a.recipientRole==='employee' && (a.recipientName||'').toLowerCase()===(session.name||'').toLowerCase() : a.recipientRole==='owner').slice(0,8).map(a=><div className={`notification-item ${a.read?'read':''}`} key={a.id}><b>{a.message}</b><small>{a.leadName} · {new Date(a.dueAt).toLocaleString()}</small>{!a.read && <button onClick={()=>markAlertRead(a.id)}>Mark read</button>}</div>)}{!alerts.some(a=>session.role==='employee' ? a.recipientRole==='employee' && (a.recipientName||'').toLowerCase()===(session.name||'').toLowerCase() : a.recipientRole==='owner') && <div className="notification-empty">No reminders yet. Schedule a follow-up to test alerts.</div>}</div>}</div><div className="top-avatar">{session.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div></div></header>
      <div className="content">
        {isSuper ? <SuperAdminPage page={page} companies={companies} setPage={setPage} onCreateCompanyOwner={createCompanyWithOwner} onResetOwnerPassword={resetOwnerPassword} onOpenCompany={(c)=>{setActiveCompanyId(c.id);setPage('Dashboard');setToast(`Workspace preview: ${c.name}`)}}/> : <>
          {page==='Dashboard' && <Dashboard company={company} leads={leads} employees={visibleEmployees} attendance={todayAttendance} overdue={overdue} properties={properties} setPage={setPage} money={money} />}
          {page==='Leads' && <LeadsPage leads={filteredLeads} allLeads={leads} employees={employees} onAdd={()=>setLeadFormOpen(true)} onUpdate={updateLead} search={search} money={money} />}
          {page==='Follow-ups' && <FollowUpsPage leads={leads} updateLead={updateLead} onSchedule={scheduleFollowUp} onEnableBrowserAlerts={enableBrowserAlerts} />}
          {page==='Customers' && <CustomersPage leads={leads} />}
          {page==='Properties' && <PropertiesPage properties={properties} onAdd={session.role==='owner' || activeCompanyId ? ()=>setPropertyFormOpen(true) : null} money={money} />}
          {page==='Projects' && <ProjectsPage properties={properties} money={money} />}
          {page==='Site Visits' && <SiteVisitsPage leads={leads} />}
          {page==='Bookings' && <BookingsPage leads={leads} money={money} />}
          {page==='Payments' && <PaymentsPage payroll={payroll} money={money} />}
          {page==='Employees' && <EmployeesPage employees={employees} onAdd={session.role==='owner' ? ()=>setEmployeeFormOpen(true) : null} onEdit={session.role==='owner' ? openEmployeeEdit : null} onResetPassword={session.role==='owner' ? resetEmployeePassword : null} money={money} />}
          {page==='Attendance' && <AttendancePage attendance={attendance} employees={visibleEmployees} checkIn={checkIn} checkOut={checkOut} todayKey={todayKey} role={session.role} userId={session.uid} />}
          {page==='Payroll' && <PayrollPage payroll={payroll} employees={employees} createPayroll={createPayroll} setPayroll={setPayroll} money={money} />}
          {page==='Reports' && <ReportsPage leads={leads} employees={employees} properties={properties} money={money} />}
          {page==='Settings' && <SettingsPage settings={settings} setSettings={setSettings} company={company} setToast={setToast} />}
        </>}
      </div>
      <footer className="footer"><span>NISS TECHNOLOGY <b>•</b> Rihaos Realtor CRM</span><span>Built by NISS Technology · <button onClick={()=>setToast(DEMO_MODE ? 'Demo mode: browser-local data only' : 'Firebase connected workspace')}>System status: {DEMO_MODE ? 'Demo' : 'Firebase'}</button></span></footer>
    </main>
    {leadFormOpen && <Modal title="Create new lead" onClose={()=>setLeadFormOpen(false)}><form className="form-grid" onSubmit={addLead}><Field label="Customer name" required><input required value={leadForm.name} onChange={e=>setLeadForm({...leadForm,name:e.target.value})} placeholder="e.g. Rahul Sharma"/></Field><Field label="Phone number" required><input required value={leadForm.phone} onChange={e=>setLeadForm({...leadForm,phone:e.target.value})} placeholder="Mobile number"/></Field><Field label="Email"><input type="email" value={leadForm.email} onChange={e=>setLeadForm({...leadForm,email:e.target.value})} placeholder="name@email.com"/></Field><Field label="Lead source"><select value={leadForm.source} onChange={e=>setLeadForm({...leadForm,source:e.target.value})}>{['Website','99acres','MagicBricks','Referral','Facebook','Instagram','Walk-in','WhatsApp','Other'].map(x=><option>{x}</option>)}</select></Field><Field label="Budget (₹)"><input type="number" value={leadForm.budget} onChange={e=>setLeadForm({...leadForm,budget:e.target.value})} placeholder="10000000"/></Field><Field label="Preferred location"><input value={leadForm.location} onChange={e=>setLeadForm({...leadForm,location:e.target.value})} placeholder="Sector / city"/></Field><Field label="Property preference"><select value={leadForm.type} onChange={e=>setLeadForm({...leadForm,type:e.target.value})}>{['1 BHK','2 BHK','3 BHK','4 BHK','Villa','Plot','Commercial','Office'].map(x=><option>{x}</option>)}</select></Field><Field label="Lead status"><select value={leadForm.status} onChange={e=>setLeadForm({...leadForm,status:e.target.value})}>{['New','Qualified','Hot','Site Visit','Negotiation','Won','Lost'].map(x=><option>{x}</option>)}</select></Field><Field label="Assign to"><select value={leadForm.assigned} onChange={e=>setLeadForm({...leadForm,assigned:e.target.value})}><option value="">Auto / Unassigned</option>{employees.map(x=><option>{x.name}</option>)}</select></Field><Field label="Next follow-up"><select value={leadForm.next} onChange={e=>setLeadForm({...leadForm,next:e.target.value})}>{['Today','Tomorrow','Oct 27','Oct 28','Next week','Not scheduled'].map(x=><option>{x}</option>)}</select></Field><Field label="Notes" wide><textarea value={leadForm.notes} onChange={e=>setLeadForm({...leadForm,notes:e.target.value})} placeholder="Customer requirements..."/></Field><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setLeadFormOpen(false)}>Cancel</button><button className="btn primary">Create lead</button></div></form></Modal>}
    {employeeFormOpen && <Modal title="Add team member" onClose={()=>setEmployeeFormOpen(false)}><form className="form-grid" onSubmit={addEmployee}><Field label="Full name" required><input required value={employeeForm.name} onChange={e=>setEmployeeForm({...employeeForm,name:e.target.value})}/></Field><Field label="Work email" required><input required type="email" value={employeeForm.email} onChange={e=>setEmployeeForm({...employeeForm,email:e.target.value})}/></Field><Field label="Initial password (optional)"><input type="password" minLength="8" autoComplete="new-password" value={employeeForm.password} onChange={e=>setEmployeeForm({...employeeForm,password:e.target.value})} placeholder="Blank = auto-generate"/></Field><Field label="Role"><select value={employeeForm.role} onChange={e=>setEmployeeForm({...employeeForm,role:e.target.value})}>{['Sales Executive','Sales Manager','Property Consultant','HR','Accountant','Operations'].map(x=><option>{x}</option>)}</select></Field><Field label="Phone"><input value={employeeForm.phone} onChange={e=>setEmployeeForm({...employeeForm,phone:e.target.value})}/></Field><Field label="Monthly base salary (₹)"><input type="number" value={employeeForm.salary} onChange={e=>setEmployeeForm({...employeeForm,salary:e.target.value})}/></Field><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setEmployeeFormOpen(false)}>Cancel</button><button className="btn primary">Add employee</button></div></form></Modal>}
    {employeeEditOpen && employeeEditForm && <Modal title="Edit employee account" onClose={()=>{setEmployeeEditOpen(false);setEmployeeEditForm(null)}}><form className="form-grid" onSubmit={saveEmployeeEdit}><Field label="Full name" required><input required value={employeeEditForm.name} onChange={e=>setEmployeeEditForm({...employeeEditForm,name:e.target.value})}/></Field><Field label="Login email" required><input required type="email" value={employeeEditForm.email} onChange={e=>setEmployeeEditForm({...employeeEditForm,email:e.target.value})}/></Field><Field label="Job title"><select value={employeeEditForm.jobTitle} onChange={e=>setEmployeeEditForm({...employeeEditForm,jobTitle:e.target.value})}>{['Sales Executive','Sales Manager','Property Consultant','HR','Accountant','Operations'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Phone"><input value={employeeEditForm.phone} onChange={e=>setEmployeeEditForm({...employeeEditForm,phone:e.target.value})}/></Field><Field label="Monthly base salary (₹)"><input type="number" min="0" value={employeeEditForm.salary} onChange={e=>setEmployeeEditForm({...employeeEditForm,salary:e.target.value})}/></Field><Field label="Account status"><select value={employeeEditForm.status} onChange={e=>setEmployeeEditForm({...employeeEditForm,status:e.target.value})}><option>Active</option><option>Inactive</option></select></Field><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>{setEmployeeEditOpen(false);setEmployeeEditForm(null)}}>Cancel</button><button className="btn primary">Save changes</button></div></form></Modal>}
    {ownerCredentials && <Modal title="Company and Owner login created" onClose={()=>setOwnerCredentials(null)}><div className="credential-panel"><p>ये details संबंधित Owner को सुरक्षित तरीके से दें। Temporary password पहली login पर बदलना होगा। यह password दोबारा नहीं दिखेगा।</p><div><small>Company name</small><b>{ownerCredentials.companyName}</b></div><div><small>Company ID</small><b>{ownerCredentials.companyId}</b></div><div><small>Owner name</small><b>{ownerCredentials.ownerName}</b></div><div><small>Owner Login ID / Email</small><b>{ownerCredentials.email}</b></div><div><small>Temporary password</small><b className="temporary-password">{ownerCredentials.password}</b></div><div className="modal-actions"><button className="btn secondary" type="button" onClick={()=>{navigator.clipboard?.writeText(`Company: ${ownerCredentials.companyName}\nCompany ID: ${ownerCredentials.companyId}\nOwner: ${ownerCredentials.ownerName}\nLogin ID: ${ownerCredentials.email}\nTemporary password: ${ownerCredentials.password}`).then(()=>setToast('Owner credentials copied')).catch(()=>setToast('Copy failed; details are visible here'));}}>Copy details</button><button className="btn primary" type="button" onClick={()=>setOwnerCredentials(null)}>Done</button></div></div></Modal>}
    {propertyFormOpen && <Modal title="Add property inventory" onClose={()=>setPropertyFormOpen(false)}><form className="form-grid" onSubmit={addProperty}><Field label="Property / project name" required><input required value={propertyForm.name} onChange={e=>setPropertyForm({...propertyForm,name:e.target.value})}/></Field><Field label="Location" required><input required value={propertyForm.location} onChange={e=>setPropertyForm({...propertyForm,location:e.target.value})}/></Field><Field label="Type"><select value={propertyForm.type} onChange={e=>setPropertyForm({...propertyForm,type:e.target.value})}>{['Apartment','Villa','Plot','Commercial','Office','Retail'].map(x=><option>{x}</option>)}</select></Field><Field label="Price (₹)"><input type="number" value={propertyForm.price} onChange={e=>setPropertyForm({...propertyForm,price:e.target.value})}/></Field><Field label="Availability"><select value={propertyForm.status} onChange={e=>setPropertyForm({...propertyForm,status:e.target.value})}>{['Available','On Hold','Sold','Unavailable'].map(x=><option>{x}</option>)}</select></Field><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setPropertyFormOpen(false)}>Cancel</button><button className="btn primary">Add property</button></div></form></Modal>}
    {employeeCredentials && <Modal title="Employee login created" onClose={() => setEmployeeCredentials(null)}><div className="credential-panel"><p>यह temporary password employee को सुरक्षित तरीके से दें। पहली login पर employee को password बदलना होगा।</p><div><small>Company ID</small><b>{employeeCredentials.companyId}</b></div><div><small>Employee name</small><b>{employeeCredentials.name}</b></div><div><small>Login email / ID</small><b>{employeeCredentials.email}</b></div><div><small>Temporary password</small><b className="temporary-password">{employeeCredentials.password}</b></div><div className="modal-actions"><button className="btn secondary" type="button" onClick={() => { navigator.clipboard?.writeText(`Company ID: ${employeeCredentials.companyId}\nName: ${employeeCredentials.name}\nLogin ID: ${employeeCredentials.email}\nTemporary password: ${employeeCredentials.password}`).then(() => setToast('Credentials copied')).catch(() => setToast('Copy failed; credentials are visible here'));  }}>Copy credentials</button><button className="btn primary" type="button" onClick={() => setEmployeeCredentials(null)}>Done</button></div></div></Modal>}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}

