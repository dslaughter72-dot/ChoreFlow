import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC2BJ-WgJDxrZVnPWRpAbVzZoGdG5YwIuU",
  authDomain: "choreflow-c0e58.firebaseapp.com",
  projectId: "choreflow-c0e58",
  storageBucket: "choreflow-c0e58.firebasestorage.app",
  messagingSenderId: "727777503894",
  appId: "1:727777503894:web:6ad3968b648a030d6770b7",
  measurementId: "G-7S9RHD20E8"
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ── AUTH ─────────────────────────────────────────────────────
export const registerFamily = async (email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
};

export const loginFamily = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
};

export const logoutFamily = () => signOut(auth);

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

// ── FIRESTORE SYNC ───────────────────────────────────────────
export const syncToCloud = async (uid, data) => {
  if (!uid) return;
  try {
    await setDoc(doc(db, "families", uid), {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.error("Sync failed:", e);
  }
};

export const loadFromCloud = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "families", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("Load failed:", e);
    return null;
  }
};

export const listenToCloud = (uid, onUpdate) => {
  if (!uid) return () => {};
  return onSnapshot(doc(db, "families", uid), (snap) => {
    if (snap.exists()) onUpdate(snap.data());
  });
};
