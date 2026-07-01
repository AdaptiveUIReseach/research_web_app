import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

declare global {
  interface Window {
    __FIREBASE_AUTH__?: Auth;
    __FIREBASE_DB__?: Firestore;
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

console.log("Firebase Config Check:", {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey
    ? "PRESENT (Starts with " + firebaseConfig.apiKey.slice(0, 5) + ")"
    : "MISSING",
});

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (typeof window !== "undefined") {
  window.__FIREBASE_AUTH__ = auth;
  window.__FIREBASE_DB__ = db;

  onAuthStateChanged(auth, (user) => {
    console.log("Firebase auth state changed:", user ? {
      uid: user.uid,
      isAnonymous: user.isAnonymous,
      email: user.email,
      providerData: user.providerData,
    } : null);
  });
}

// In a real app, persistence should be enabled to support offline batching
/*
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn("Multiple tabs open, persistence disabled");
    } else if (err.code == "unimplemented") {
      // The current browser does not support all of the features required to enable persistence
      console.warn("Persistence not supported");
    }
  });
}
*/

export const signIn = async () => {
  console.log("Firebase signIn called");
  try {
    const cred = await signInAnonymously(auth);
    console.log("Anonymous auth success", { uid: cred.user.uid, isAnonymous: cred.user.isAnonymous });
    return cred.user;
  } catch (e) {
    console.error("Anonymous auth failed", e);
    throw e;
  }
};
