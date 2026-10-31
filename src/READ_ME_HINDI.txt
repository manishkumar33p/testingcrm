ESTATEFLOW CRM — HINDI NOTES

- Super Admin ही Companies पेज से company और Owner login बनाता है। Public company registration बंद है।
- Super Admin Firebase Console में एक बार अपना Auth user बनाकर Firestore users/{UID} document में role=superadmin सेट करे। Details SETUP_HINDI.txt में हैं।
- Super Admin company name, Owner name, Owner email और initial password भरता है। Company ID Firebase Function बनाती है। Owner को पहली login पर password बदलना होगा।
- Company Owner Employees पेज से employee login बनाता है। Owner initial password दे सकता है; खाली छोड़ने पर generated temporary password मिलेगा।
- Employee list में Edit से नाम, email, phone, job title, salary और Active/Inactive status बदले जा सकते हैं। Reset password नया temporary password बनाता है।
- Firebase backend deploy करने के लिए project root से `firebase deploy --only functions,firestore:rules,storage` चलाएँ। पहले `firebase use elevate-fdcd0` और `firebase login` करें।
- App चलाने के लिए project root में `npm install` और `npm start` चलाएँ।
- यह source तब तक production-ready नहीं माना जाएगा जब तक दो अलग कंपनियों से login करके company data isolation, employee login, password change, edit/reset और selfie/GPS attendance test न हो जाए।
