ESTATEFLOW CRM - ATTENDANCE CAMERA FIX

यह अपडेट Employee Reminder Alerts वाले मौजूदा प्रोजेक्ट पर आधारित है। Reminder/Notifications के कोड और Firestore Rules को नहीं बदला गया है।

Attendance में बदलाव:
1. Camera stream अब React video element mount होने के बाद attach होता है।
2. Camera preview तैयार होने तक Capture बटन disabled रहता है।
3. Capture दबाने पर selfie capture, GPS और Firebase save के चरण स्क्रीन पर दिखते हैं।
4. Camera/GPS/Storage/Firestore error साफ संदेश में दिखेगा।
5. Attendance page के CSS selector की typo भी ठीक की गई है।

इंस्टॉल:
1. ZIP को नए अलग folder में extract करें।
2. उस folder में package.json होना चाहिए।
3. CMD में npm install चलाएँ।
4. फिर npm start चलाएँ।
5. Chrome में localhost पर Camera और Location permission Allow करें।

नोट: इस build को यहाँ पूर्ण browser + Firebase live test नहीं किया गया है। अगर Capture के बाद कोई error दिखे तो वही error text भेजें। Firebase Storage Rules पहले से configured और published होने चाहिए।
