import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Use current hostname as authDomain when deployed to custom domains
// This ensures Firebase Auth popup/redirect works on Vercel, Cloud Run, etc.
const config = {
  ...firebaseConfig,
  authDomain: window.location.hostname === 'localhost' 
    ? firebaseConfig.authDomain 
    : window.location.host,
};

const app = initializeApp(config);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
