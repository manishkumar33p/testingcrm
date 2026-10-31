import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

export const firebaseConfig = {
  apiKey: 'AIzaSyCO5bGMwkhY1kU2yq9r8Yc0w4hy7ya7uh0',
  authDomain: 'elevate-fdcd0.firebaseapp.com',
  projectId: 'elevate-fdcd0',
  storageBucket: 'elevate-fdcd0.firebasestorage.app',
  messagingSenderId: '811207940981',
  appId: '1:811207940981:web:e745536ea3042cf8e5d13c',
  measurementId: 'G-FZ70DMLY2G'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Keep the callable functions region aligned with functions/index.js (default: us-central1).
export const functions = getFunctions(app, 'us-central1');
