import { auth, db } from '../services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getOutputLabelsForGame } from './uiLabels';

export type DerivedMetrics = Record<string, unknown>;

export const saveMetrics = async (sessionId: string, gameId: string, derivedMetrics: DerivedMetrics) => {
    const gameRef = doc(db, `sessions/${sessionId}/games/${gameId}`);
    const outputLabels = getOutputLabelsForGame(gameId, derivedMetrics);
    const metricsWithLabels = {
        ...derivedMetrics,
        ...outputLabels,
    };

    console.log(`saveMetrics: currentUser=`, auth.currentUser ? {
        uid: auth.currentUser.uid,
        isAnonymous: auth.currentUser.isAnonymous,
        email: auth.currentUser.email,
    } : null);
    console.log(`saveMetrics: path=`, gameRef.path, `sessionId=`, sessionId, `gameId=`, gameId);

    try {
        await setDoc(
            gameRef,
            {
                session_id: sessionId,
                game_id: gameId,
                derived_metrics: metricsWithLabels,
                ...outputLabels,
                computed_at: serverTimestamp()
            },
            { merge: true }
        );
        console.log(`✓ Metrics saved for game ${gameId}`);
    } catch (error) {
        console.error(`✗ Failed to save metrics for ${gameId}:`, error);
        throw error;
    }
};
