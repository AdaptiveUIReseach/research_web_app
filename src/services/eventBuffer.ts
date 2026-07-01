import { collection, writeBatch, serverTimestamp, doc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { EVENT_BATCH_FLUSH_INTERVAL_MS } from '../utils/config';

export interface BaseEvent {
    game_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    client_ts: number;
}

let eventBuffer: BaseEvent[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export const bufferEvent = (sessionId: string, event: BaseEvent) => {
    eventBuffer.push(event);

    if (!flushTimeout) {
        flushTimeout = setTimeout(() => {
            flushEvents(sessionId);
        }, EVENT_BATCH_FLUSH_INTERVAL_MS);
    }
};

export const flushEvents = async (sessionId: string) => {
    if (eventBuffer.length === 0) return;

    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }

    const eventsToFlush = [...eventBuffer];
    eventBuffer = []; // Clear buffer

    try {
        console.log(`flushEvents: currentUser=`, auth.currentUser ? {
            uid: auth.currentUser.uid,
            isAnonymous: auth.currentUser.isAnonymous,
            email: auth.currentUser.email,
        } : null);

        const batch = writeBatch(db);

        eventsToFlush.forEach(event => {
            const eventsRef = collection(db, `sessions/${sessionId}/games/${event.game_id}/raw_events`);
            const newEventRef = doc(eventsRef);
            console.log(`flushEvents: write event path=`, newEventRef.path, `game_id=`, event.game_id);
            batch.set(newEventRef, {
                ...event,
                session_id: sessionId,
                server_ts: serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`Flushed ${eventsToFlush.length} events to Firestore`);
    } catch (error) {
        console.error("Failed to flush events, requeueing...", error);
        // Put them back at the beginning of the buffer
        eventBuffer = [...eventsToFlush, ...eventBuffer];
        
        // Retry with exponential backoff logic would go here
        if (!flushTimeout) {
            flushTimeout = setTimeout(() => {
                flushEvents(sessionId);
            }, EVENT_BATCH_FLUSH_INTERVAL_MS * 2); // Simple backoff
        }
    }
};
