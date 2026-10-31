// Local-only demo mode. No Firebase billing, network writes, or real authentication.
export const DEMO_MODE = false;
const STORE_KEY = 'estateflow_crm_demo_v1';
const EVENT_NAME = 'estateflow-demo-update';

const today = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
const seed = () => ({
  users: [
    { uid:'demo-superadmin', name:'Demo Super Admin', email:'admin@estateflow.demo', password:'Demo@123', role:'superadmin' },
    { uid:'demo-owner-rihaos', name:'Rahul Sharma', email:'owner@rihaos.demo', password:'Owner@123', role:'owner', companyId:'DEMO-RIHAOS' },
    { uid:'demo-employee-rihaos', name:'Amit Verma', email:'employee@rihaos.demo', password:'Staff@123', role:'employee', companyId:'DEMO-RIHAOS' }
  ],
  companies: [{ id:'DEMO-RIHAOS', name:'Rihaos Realtor (Demo)', ownerName:'Rahul Sharma', ownerEmail:'owner@rihaos.demo', ownerUid:'demo-owner-rihaos', plan:'Growth', seatLimit:15, status:'Active', color:'#55b9ee', short:'RR', createdAt:new Date().toISOString() }],
  data: {
    'DEMO-RIHAOS': {
      leads: [
        { id:'LD-1001', name:'Rohit Gupta', phone:'9876543210', email:'rohit@example.com', source:'99acres', budget:8500000, location:'Noida Sector 150', type:'3 BHK', status:'Qualified', assigned:'Amit Verma', next:'Today', notes:'Family looking for ready-to-move property' },
        { id:'LD-1002', name:'Neha Singh', phone:'9876501234', email:'neha@example.com', source:'Website', budget:6200000, location:'Greater Noida West', type:'2 BHK', status:'New', assigned:'Amit Verma', next:'Tomorrow', notes:'Needs weekend site visit' },
        { id:'LD-1003', name:'Karan Mehta', phone:'9811102233', email:'karan@example.com', source:'Referral', budget:12500000, location:'Noida Expressway', type:'Villa', status:'Site Visit', assigned:'Amit Verma', next:'Oct 30', notes:'Interested in premium inventory' }
      ],
      employees: [{ id:'demo-employee-rihaos', uid:'demo-employee-rihaos', name:'Amit Verma', email:'employee@rihaos.demo', role:'Sales Executive', phone:'9876543210', salary:28000, status:'Active' }],
      attendance: [{ id:'ATT-DEMO-1', employeeId:'demo-employee-rihaos', name:'Amit Verma', date:today, checkIn:'09:35 am', checkInAt:new Date().toISOString(), checkInLocation:{ latitude:28.6139, longitude:77.2090 }, checkOut:'', status:'Present', demo:true }],
      payroll: [{ id:'PAY-DEMO-1', employeeId:'demo-employee-rihaos', employee:'Amit Verma', month:new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'}), base:28000, incentive:2500, deductions:500, status:'Draft' }],
      properties: [
        { id:'PR-1001', name:'Skyline Residency', location:'Noida Sector 150', type:'Apartment', price:8500000, status:'Available' },
        { id:'PR-1002', name:'Green Avenue Villas', location:'Greater Noida West', type:'Villa', price:14500000, status:'Available' },
        { id:'PR-1003', name:'Business Square', location:'Noida Sector 62', type:'Commercial', price:22000000, status:'On Hold' }
      ],
      settings: { companyName:'Rihaos Realtor (Demo)', brandColor:'#55b9ee', currency:'INR', timezone:'Asia/Kolkata' }
    }
  }
});

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
    const initial = seed(); localStorage.setItem(STORE_KEY, JSON.stringify(initial)); return initial;
  } catch { return seed(); }
}
function writeStore(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); window.dispatchEvent(new CustomEvent(EVENT_NAME)); } catch (e) { console.error('Demo data could not be saved', e); }
}
export function getDemoStore() { return readStore(); }
export function updateDemoStore(updater) { const store = readStore(); const next = typeof updater === 'function' ? updater(store) : updater; writeStore(next); return next; }
export function subscribeDemo(callback) { window.addEventListener(EVENT_NAME, callback); window.addEventListener('storage', callback); return () => { window.removeEventListener(EVENT_NAME, callback); window.removeEventListener('storage', callback); }; }
export function demoLogin(email, password, role) {
  const user = readStore().users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase() && u.password === password && u.role === role && u.status !== 'Inactive');
  if (!user) throw new Error('Demo login details galat hain. Neeche diye gaye demo credentials use karein.');
  const { password: _password, ...safeUser } = user; return safeUser;
}
export function createDemoCompany(form) {
  const store = readStore();
  if (store.users.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) throw new Error('Is email ka demo login pehle se hai.');
  const companyId = `DEMO-${String(form.companyName || 'COMPANY').replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,8)}-${Date.now().toString().slice(-5)}`;
  const ownerUid = `owner-${Date.now()}`;
  const company = { id:companyId, name:form.companyName, ownerName:form.ownerName, ownerEmail:form.email.trim(), ownerUid, plan:form.plan || 'Growth', seatLimit:Number(form.seatLimit || 15), status:'Active', color:'#55b9ee', short:form.companyName.slice(0,2).toUpperCase(), createdAt:new Date().toISOString(), demo:true };
  store.companies.unshift(company);
  store.users.push({ uid:ownerUid, name:form.ownerName, email:form.email.trim(), password:form.password, role:'owner', companyId, phone:form.phone || '', mustChangePassword:false, demo:true });
  store.data[companyId] = { leads:[], employees:[], attendance:[], payroll:[], properties:[], settings:{ companyName:form.companyName, brandColor:'#55b9ee', currency:'INR', timezone:'Asia/Kolkata' } };
  writeStore(store);
  return { companyId, companyName:company.name, ownerName:company.ownerName, email:company.ownerEmail, password:form.password, ownerUid };
}
export function updateDemoUser(uid, changes) { return updateDemoStore(store => { store.users = store.users.map(u => u.uid === uid ? { ...u, ...changes } : u); store.companies = store.companies.map(c => c.ownerUid === uid ? { ...c, ownerName:changes.name || c.ownerName, ownerEmail:changes.email || c.ownerEmail } : c); return store; }); }
export function addDemoEmployee(companyId, form) {
  const store = readStore();
  if (store.users.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) throw new Error('Is email ka demo login pehle se hai.');
  const uid = `employee-${Date.now()}`; const password = form.initialPassword || `Demo${Math.random().toString(36).slice(2,7)}!`;
  const user = { uid, name:form.name, email:form.email.trim(), password, role:'employee', companyId, phone:form.phone || '', status:form.status || 'Active', demo:true };
  store.users.push(user);
  const row = { id:uid, uid, name:form.name, email:user.email, role:form.role || 'Sales Executive', phone:form.phone || '', salary:Number(form.salary || 0), status:form.status || 'Active' };
  store.data[companyId] ||= { leads:[], employees:[], attendance:[], payroll:[], properties:[], settings:{} };
  store.data[companyId].employees.unshift(row); writeStore(store);
  return { ...row, companyId, password, email:user.email, name:user.name, uid };
}
export function resetDemoPassword(uid) {
  const password = `Demo${Math.random().toString(36).slice(2,7)}!`;
  updateDemoUser(uid, { password, mustChangePassword:false });
  return { password };
}
export function editDemoEmployee(companyId, uid, changes) {
  const store = readStore();
  store.users = store.users.map(u => u.uid === uid ? { ...u, name:changes.name, email:changes.email, phone:changes.phone, status:changes.status } : u);
  if (store.data[companyId]) store.data[companyId].employees = store.data[companyId].employees.map(e => e.id === uid || e.uid === uid ? { ...e, ...changes, id:e.id, uid } : e);
  writeStore(store);
}
