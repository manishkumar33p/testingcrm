import { useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, writeBatch, query, where, or } from 'firebase/firestore';
import { db } from './firebase';
import { DEMO_MODE, getDemoStore, updateDemoStore, subscribeDemo } from './demoMode';

export function useFirestoreCollection(companyId, collectionName, employeeContext = null) {
  const [items, setItems] = useState([]);
  const currentRef = useRef([]);
  const [loading, setLoading] = useState(Boolean(companyId));
  useEffect(() => {
    currentRef.current = [];
    if (!companyId) { setItems([]); setLoading(false); return undefined; }
    if (DEMO_MODE) {
      const load = () => {
        const store = getDemoStore();
        let next = (store.data?.[companyId]?.[collectionName] || []).slice();
        if (employeeContext && collectionName === 'attendance') next = next.filter(a => a.employeeId === employeeContext.uid);
        if (employeeContext && collectionName === 'leads') next = next.filter(l => l.assigned === employeeContext.name || l.createdBy === employeeContext.uid);
        currentRef.current = next; setItems(next); setLoading(false);
      };
      load(); return subscribeDemo(load);
    }
    setItems([]); setLoading(true);
    const ref = collection(db, 'companyData', companyId, collectionName);
    let source = ref;
    if (employeeContext && collectionName === 'attendance') source = query(ref, where('employeeId', '==', employeeContext.uid));
    else if (employeeContext && collectionName === 'leads') source = query(ref, or(where('assigned', '==', employeeContext.name), where('createdBy', '==', employeeContext.uid)));
    else if (employeeContext && collectionName === 'notifications') source = query(ref, where('recipientName', '==', employeeContext.name));
    const unsubscribe = onSnapshot(source, snapshot => { const next = snapshot.docs.map(d => ({ ...d.data(), id: d.id })); currentRef.current = next; setItems(next); setLoading(false); }, error => { console.error(`Firestore ${collectionName} listener:`, error); setLoading(false); });
    return unsubscribe;
  }, [companyId, collectionName, employeeContext?.uid, employeeContext?.name]);
  const setAndSync = (updater) => {
    const previous = currentRef.current;
    const next = typeof updater === 'function' ? updater(previous) : updater;
    currentRef.current = next; setItems(next);
    if (!companyId) return;
    if (DEMO_MODE) {
      updateDemoStore(store => { store.data[companyId] ||= {}; store.data[companyId][collectionName] = next; return store; });
      return;
    }
    (async () => { try {
      const previousById = new Map(previous.map(item => [String(item.id), item])); const nextById = new Map(next.map(item => [String(item.id), item])); const batch = writeBatch(db); let writes = 0;
      nextById.forEach((item, id) => { const old = previousById.get(id); if (!old || JSON.stringify(old) !== JSON.stringify(item)) { batch.set(doc(db, 'companyData', companyId, collectionName, id), { ...item, id }, { merge: true }); writes += 1; } });
      previousById.forEach((_item, id) => { if (!nextById.has(id)) { batch.delete(doc(db, 'companyData', companyId, collectionName, id)); writes += 1; } }); if (writes) await batch.commit();
    } catch (error) { console.error(`Firestore save failed for ${collectionName}:`, error); alert(`Firebase में ${collectionName} सेव नहीं हुआ: ${error.message}`); } })();
  };
  return [items, setAndSync, loading];
}
export function useCompanies(enabled) {
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    if (!enabled) { setCompanies([]); return undefined; }
    if (DEMO_MODE) { const load = () => setCompanies(getDemoStore().companies || []); load(); return subscribeDemo(load); }
    return onSnapshot(collection(db, 'companies'), snap => setCompanies(snap.docs.map(d => ({ ...d.data(), id: d.id }))), error => console.error('Companies listener:', error));
  }, [enabled]); return companies;
}
export function useCompanyDocument(companyId) {
  const [company, setCompany] = useState(null);
  useEffect(() => {
    setCompany(null); if (!companyId) return undefined;
    if (DEMO_MODE) { const load = () => setCompany((getDemoStore().companies || []).find(c => c.id === companyId) || null); load(); return subscribeDemo(load); }
    return onSnapshot(doc(db, 'companies', companyId), snap => setCompany(snap.exists() ? { ...snap.data(), id: snap.id } : null), error => console.error('Company profile listener:', error));
  }, [companyId]); return company;
}
export function useFirestoreSettings(companyId, defaults) {
  const [settings, setSettings] = useState(defaults); const currentRef = useRef(defaults);
  useEffect(() => {
    currentRef.current = defaults; setSettings(defaults); if (!companyId) return undefined;
    if (DEMO_MODE) { const load = () => { const next = { ...defaults, ...(getDemoStore().data?.[companyId]?.settings || {}) }; currentRef.current = next; setSettings(next); }; load(); return subscribeDemo(load); }
    return onSnapshot(doc(db, 'companySettings', companyId), snap => { const next = snap.exists() ? { ...defaults, ...snap.data() } : defaults; currentRef.current = next; setSettings(next); }, error => console.error('Settings listener:', error));
  }, [companyId]);
  const setAndSync = (updater) => {
    const next = typeof updater === 'function' ? updater(currentRef.current) : updater; currentRef.current = next; setSettings(next);
    if (!companyId) return;
    if (DEMO_MODE) { updateDemoStore(store => { store.data[companyId] ||= {}; store.data[companyId].settings = next; return store; }); return; }
    setDoc(doc(db, 'companySettings', companyId), next, { merge: true }).catch(error => { console.error(error); alert(`Firebase settings save failed: ${error.message}`); });
  }; return [settings, setAndSync];
}
