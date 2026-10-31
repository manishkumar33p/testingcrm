const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

initializeApp();
const auth = getAuth();
const db = getFirestore();
const clean = (value, max = 120) => String(value || '').trim().slice(0, max);
const slug = value => clean(value, 70).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
const tempPassword = () => crypto.randomBytes(9).toString('base64url') + 'A7!';



async function requireSuperAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in as Super Admin.');
  const snap = await db.doc(`users/${request.auth.uid}`).get();
  if (!snap.exists || snap.data().role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only Super Admin can create company workspaces and owner accounts.');
  }
  return snap.data();
}

exports.createCompanyWithOwner = onCall({ maxInstances: 5 }, async request => {
  await requireSuperAdmin(request);
  const { ownerName: rawOwnerName, companyName: rawCompanyName, email: rawEmail, password: rawPassword, phone, plan, seatLimit } = request.data || {};
  const ownerName = clean(rawOwnerName);
  const companyName = clean(rawCompanyName);
  const email = clean(rawEmail, 254).toLowerCase();
  const seats = Math.max(1, Math.min(500, Number(seatLimit || 15)));
  const selectedPlan = ['Starter', 'Growth', 'Business', 'Enterprise'].includes(clean(plan, 30)) ? clean(plan, 30) : 'Growth';
  const password = String(rawPassword || '');
  if (!ownerName || !companyName || !email || !email.includes('@') || password.length < 8) {
    throw new HttpsError('invalid-argument', 'Company name, owner name, valid owner email and an initial password of at least 8 characters are required.');
  }
  let owner;
  try {
    owner = await auth.createUser({ email, password, displayName: ownerName, disabled: false });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'This email already has a Firebase login. Use a different Owner email.');
    throw new HttpsError('invalid-argument', error.message || 'Could not create Owner login.');
  }
  const companyId = `${slug(companyName)}-${crypto.randomBytes(3).toString('hex')}`;
  const company = {
    name: companyName, id: companyId, companyId,
    short: companyName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
    plan: selectedPlan, users: seats, seatLimit: seats, color: '#55b9ee', status: 'Active',
    phone: clean(phone, 30), ownerUid: owner.uid, ownerName, ownerEmail: email,
    createdAt: new Date().toISOString(), createdBy: request.auth.uid
  };
  const batch = db.batch();
  batch.set(db.doc(`companies/${companyId}`), company);
  batch.set(db.doc(`users/${owner.uid}`), {
    uid: owner.uid, name: ownerName, email, phone: clean(phone, 30), role: 'owner',
    companyId, companyName, createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp(),
    active: true, mustChangePassword: true
  });
  batch.set(db.doc(`companySettings/${companyId}`), { companyName, brandColor: '#55b9ee', currency: 'INR', timezone: 'Asia/Kolkata' });
  try {
    await batch.commit();
  } catch (error) {
    await auth.deleteUser(owner.uid).catch(() => {});
    throw new HttpsError('internal', 'Company and Owner profile could not be saved. Please retry.');
  }
  return { companyId, companyName, ownerName, email, password, uid: owner.uid };
});

exports.resetOwnerPassword = onCall({ maxInstances: 5 }, async request => {
  await requireSuperAdmin(request);
  const ownerUid = clean(request.data && request.data.ownerUid, 128);
  const ownerSnap = await db.doc(`users/${ownerUid}`).get();
  if (!ownerUid || !ownerSnap.exists || ownerSnap.data().role !== 'owner') {
    throw new HttpsError('not-found', 'Company Owner account was not found.');
  }
  const password = tempPassword();
  await auth.updateUser(ownerUid, { password, disabled: false });
  await db.doc(`users/${ownerUid}`).set({ mustChangePassword: true, active: true, passwordResetAt: FieldValue.serverTimestamp() }, { merge: true });
  return { uid: ownerUid, name: ownerSnap.data().name, email: ownerSnap.data().email, companyId: ownerSnap.data().companyId, companyName: ownerSnap.data().companyName, password };
});

exports.updateEmployeeAccount = onCall({ maxInstances: 10 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in as the Company Owner.');
  const ownerSnap = await db.doc(`users/${request.auth.uid}`).get();
  const owner = ownerSnap.data();
  if (!ownerSnap.exists || owner.role !== 'owner' || !owner.companyId) throw new HttpsError('permission-denied', 'Only a Company Owner can edit employees.');
  const { employeeUid, name: rawName, email: rawEmail, phone, jobTitle, salary, status } = request.data || {};
  const uid = clean(employeeUid, 128);
  if (!uid) throw new HttpsError('invalid-argument', 'Employee ID is missing.');
  const userRef = db.doc(`users/${uid}`);
  const employeeRef = db.doc(`companyData/${owner.companyId}/employees/${uid}`);
  const [profileSnap, employeeSnap] = await Promise.all([userRef.get(), employeeRef.get()]);
  if (!profileSnap.exists || !employeeSnap.exists || profileSnap.data().role !== 'employee' || profileSnap.data().companyId !== owner.companyId) {
    throw new HttpsError('permission-denied', 'This employee does not belong to your company.');
  }
  const name = clean(rawName);
  const email = clean(rawEmail, 254).toLowerCase();
  if (!name || !email || !email.includes('@')) throw new HttpsError('invalid-argument', 'Employee name and valid email are required.');
  const current = profileSnap.data();
  try {
    await auth.updateUser(uid, { displayName: name, email });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'This email is already used by another login.');
    throw new HttpsError('invalid-argument', error.message || 'Could not update employee login.');
  }
  const active = clean(status, 20) !== 'Inactive';
  const safeJobTitle = clean(jobTitle, 60) || 'Sales Executive';
  const updates = { name, email, phone: clean(phone, 30), jobTitle: safeJobTitle, active, updatedAt: FieldValue.serverTimestamp() };
  const employeeUpdates = { name, email, phone: clean(phone, 30), role: safeJobTitle, salary: Math.max(0, Number(salary || 0)), status: active ? 'Active' : 'Inactive', updatedAt: new Date().toISOString() };
  const batch = db.batch();
  batch.set(userRef, updates, { merge: true });
  batch.set(employeeRef, employeeUpdates, { merge: true });
  await batch.commit();
  if (!active) await auth.updateUser(uid, { disabled: true });
  else await auth.updateUser(uid, { disabled: false });
  return { success: true, employeeUid: uid, name, email };
});

exports.resetEmployeePassword = onCall({ maxInstances: 10 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in as the Company Owner.');
  const ownerSnap = await db.doc(`users/${request.auth.uid}`).get();
  const owner = ownerSnap.data();
  if (!ownerSnap.exists || owner.role !== 'owner' || !owner.companyId) throw new HttpsError('permission-denied', 'Only a Company Owner can reset employee passwords.');
  const uid = clean(request.data && request.data.employeeUid, 128);
  const employeeSnap = await db.doc(`users/${uid}`).get();
  if (!uid || !employeeSnap.exists || employeeSnap.data().role !== 'employee' || employeeSnap.data().companyId !== owner.companyId) {
    throw new HttpsError('permission-denied', 'This employee does not belong to your company.');
  }
  const password = tempPassword();
  await auth.updateUser(uid, { password, disabled: false });
  await db.doc(`users/${uid}`).set({ mustChangePassword: true, active: true, passwordResetAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc(`companyData/${owner.companyId}/employees/${uid}`).set({ status: 'Active' }, { merge: true });
  return { uid, name: employeeSnap.data().name, email: employeeSnap.data().email, companyId: owner.companyId, password };
});

exports.createEmployeeAccount = onCall({ maxInstances: 10 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in as the company owner.');
  const ownerSnap = await db.doc(`users/${request.auth.uid}`).get();
  const owner = ownerSnap.data();
  if (!ownerSnap.exists || owner.role !== 'owner' || !owner.companyId) {
    throw new HttpsError('permission-denied', 'Only the company owner can create employee accounts.');
  }
  const { name: rawName, email: rawEmail, phone, role, salary, initialPassword } = request.data || {};
  const name = clean(rawName);
  const email = clean(rawEmail, 254).toLowerCase();
  if (!name || !email || !email.includes('@')) throw new HttpsError('invalid-argument', 'Employee name and valid email are required.');
  const companyRef = db.doc(`companies/${owner.companyId}`);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) throw new HttpsError('failed-precondition', 'Company profile not found. Contact support.');
  const company = companySnap.data();
  const employeesSnap = await db.collection(`companyData/${owner.companyId}/employees`).get();
  const seatLimit = Number(company.seatLimit || company.users || 15);
  if (employeesSnap.size >= seatLimit) throw new HttpsError('resource-exhausted', `Company seat limit (${seatLimit}) reached. Increase the plan seat limit first.`);
  const password = String(initialPassword || '');
  if (password && password.length < 8) throw new HttpsError('invalid-argument', 'Employee password must be at least 8 characters, or leave it blank for an auto-generated temporary password.');
  const finalPassword = password || tempPassword();
  let employee;
  try {
    employee = await auth.createUser({ email, password: finalPassword, displayName: name });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'This email already has a Firebase login. Use a different email.');
    throw new HttpsError('invalid-argument', error.message || 'Could not create employee account.');
  }
  const employeeRole = clean(role, 60) || 'Sales Executive';
  const employeeProfile = {
    uid: employee.uid, name, email, phone: clean(phone, 30), role: 'employee', jobTitle: employeeRole,
    companyId: owner.companyId, companyName: owner.companyName || company.name,
    createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp(), active: true,
    mustChangePassword: true
  };
  const employeeRecord = {
    id: employee.uid, uid: employee.uid, name, email, phone: clean(phone, 30), role: employeeRole,
    salary: Number(salary || 0), status: 'Active', companyId: owner.companyId,
    createdBy: request.auth.uid, createdAt: new Date().toISOString(), mustChangePassword: true
  };
  const batch = db.batch();
  batch.set(db.doc(`users/${employee.uid}`), employeeProfile);
  batch.set(db.doc(`companyData/${owner.companyId}/employees/${employee.uid}`), employeeRecord);
  try {
    await batch.commit();
  } catch (error) {
    await auth.deleteUser(employee.uid).catch(() => {});
    throw new HttpsError('internal', 'Employee login was created but profile setup failed. Please contact support.');
  }
  return { uid: employee.uid, email, password: finalPassword, companyId: owner.companyId, name };
});

// WhatsApp reminder scaffold for EstateFlow CRM.
// This is intentionally opt-in: it sends nothing until Meta credentials,
// an approved WhatsApp template, and whatsappOutbox documents are configured.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret, defineString } = require('firebase-functions/params');
const WHATSAPP_ACCESS_TOKEN = defineSecret('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = defineString('WHATSAPP_PHONE_NUMBER_ID', { default: '' });
const WHATSAPP_API_VERSION = defineString('WHATSAPP_API_VERSION', { default: 'v23.0' });
const WHATSAPP_TEMPLATE_NAME = defineString('WHATSAPP_TEMPLATE_NAME', { default: 'estateflow_followup_reminder' });

exports.processWhatsAppReminderOutbox = onSchedule({
  schedule: 'every 5 minutes',
  timeZone: 'Asia/Kolkata',
  region: 'asia-south1',
  timeoutSeconds: 60,
  memory: '256MiB',
  maxInstances: 1,
  secrets: [WHATSAPP_ACCESS_TOKEN]
}, async () => {
  const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value();
  const apiVersion = WHATSAPP_API_VERSION.value();
  const templateName = WHATSAPP_TEMPLATE_NAME.value();
  if (!phoneNumberId) {
    console.warn('WhatsApp is not configured: WHATSAPP_PHONE_NUMBER_ID is empty.');
    return;
  }
  const now = new Date();
  const due = await db.collection('whatsappOutbox')
    .where('status', '==', 'pending')
    .limit(100)
    .get();

  for (const snap of due.docs) {
    const item = snap.data();
    const dueAt = item.dueAt && typeof item.dueAt.toDate === 'function'
      ? item.dueAt.toDate()
      : new Date(item.dueAt);
    if (!item.dueAt || Number.isNaN(dueAt.getTime()) || dueAt > now) continue;
    const phone = clean(item.phone, 30).replace(/[^+\d]/g, '');
    if (!phone || !item.companyId || !item.leadName) {
      await snap.ref.set({ status: 'failed', lastError: 'Missing phone, companyId, or leadName', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }

    // Claim each outbox item transactionally to reduce duplicate sends.
    const claimed = await db.runTransaction(async tx => {
      const fresh = await tx.get(snap.ref);
      if (!fresh.exists || fresh.data().status !== 'pending') return false;
      tx.set(snap.ref, { status: 'sending', attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });
    if (!claimed) continue;

    try {
      const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en_US' },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: clean(item.recipientName || 'there', 80) },
                { type: 'text', text: clean(item.leadName, 120) },
                { type: 'text', text: clean(item.followUpLabel || dueAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 120) },
                { type: 'text', text: clean(item.task || 'Please follow up with this lead.', 200) }
              ]
            }]
          }
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(clean(result.error && result.error.message, 500) || `WhatsApp API HTTP ${response.status}`);
      await snap.ref.set({ status: 'sent', providerMessageId: result.messages && result.messages[0] && result.messages[0].id || null, sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastError: FieldValue.delete() }, { merge: true });
    } catch (error) {
      console.error('WhatsApp reminder failed', snap.id, error);
      await snap.ref.set({ status: 'failed', lastError: clean(error.message, 500), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
});
