import { db } from './firebase';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';

type SessionUserData = object;

const createNumericId = () => {
    const suffix = Math.floor(100 + Math.random() * 900);
    return `${Date.now()}${suffix}`;
};

export const createSession = async (authUid: string, userData: SessionUserData = {}) => {
    const sessionId = createNumericId();
    const numericId = Number(sessionId);
    const userRef = doc(db, "users", sessionId);
    const sessionRef = doc(db, "sessions", sessionId);
    const batch = writeBatch(db);
    
    batch.set(userRef, {
        ...userData,
        uid: sessionId,
        user_id: sessionId,
        session_id: sessionId,
        numeric_user_id: numericId,
        numeric_session_id: numericId,
        auth_uid: authUid,
        updatedAt: serverTimestamp(),
    }, { merge: true });

    batch.set(sessionRef, {
        session_id: sessionId,
        user_id: sessionId,
        numeric_session_id: numericId,
        numeric_user_id: numericId,
        auth_uid: authUid,
        firebase_uid: authUid,
        started_at: serverTimestamp(),
        created_at: serverTimestamp(),
        ended_at: null,
        status: "active",
        mode: "experiment",
        ifi: null,
        recommended_ui: null,
        applied_ui: null
    }, { merge: true });

    const savePromise = batch.commit();

    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore write timed out after 5 seconds.")), 5000)
    );

    await Promise.race([savePromise, timeoutPromise]);

    return sessionId;
};
