# EstateFlow CRM — Spark Free Company Creation Update

This update keeps the existing CRM project and enables a Spark-compatible Company + Owner creation flow.

## Company creation flow
- Super Admin fills Company name, Owner name, Owner email, temporary password (8+ chars), phone, plan and seat limit.
- The app creates the Owner Firebase Authentication account through a secondary Firebase app, so the Super Admin's current auth session is not replaced.
- It then writes `companies/{companyId}`, `users/{ownerUid}`, and `companySettings/{companyId}` in one Firestore batch.
- The Owner password is not stored in Firestore.

## Requirements and limitations
- Firebase Authentication Email/Password provider must be enabled.
- Firestore rules must allow a signed-in Super Admin to create documents in `companies`, `users`, and `companySettings`.
- This is a client-side Spark-compatible workflow, not a privileged server-side provisioning service. Protect the Super Admin account, restrict your Firebase API key by authorized domains where appropriate, and obtain a security review before commercial/high-scale use.
- Existing manually created Marv company/user records are not migrated or duplicated by this update.
- Cloud Functions-based employee creation/edit/password-reset features remain unavailable on Spark until replaced or a paid plan is enabled.
