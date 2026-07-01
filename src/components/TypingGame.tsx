import React, { useCallback, useEffect, useRef, useState } from 'react';
import { bufferEvent, flushEvents } from '../services/eventBuffer';
import { clientTimestamp, performanceNow } from '../utils/time';
import { saveMetrics } from '../utils/metrics';
import { motion } from 'framer-motion';
import { useUI } from '../context/UIContext';

const EASY_PHRASES = ["hello world", "quick brown fox", "jump over lazy dog"];
const HARD_PHRASES = ["The quick, brown fox jumps over 13 lazy dogs!", "Hello World; It's 2026. #AdaptiveUI"];

interface KeyLogEntry {
    key: string;
    ts: number;
    time_since_start: number;
    text_length: number;
}

const getEditDistance = (a: string, b: string) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            if (b.charAt(j - 1) === a.charAt(i - 1)) {
                matrix[j][i] = matrix[j - 1][i - 1];
            } else {
                matrix[j][i] = Math.min(
                    matrix[j - 1][i - 1] + 1,
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

export default function TypingGame({ sessionId, stage, onComplete }: { sessionId: string, stage: 'easy' | 'hard', onComplete: () => void }) {
    const { uiState } = useUI();
    const [targetPhrase, setTargetPhrase] = useState('');
    const [typedText, setTypedText] = useState('');
    const startRef = useRef(performanceNow());
    const targetPhraseRef = useRef(targetPhrase);
    const typedTextRef = useRef(typedText);
    const metricsRef = useRef({ 
      backspaceCount: 0,
      keyLog: [] as KeyLogEntry[]
    });

    useEffect(() => { targetPhraseRef.current = targetPhrase; }, [targetPhrase]);
    useEffect(() => { typedTextRef.current = typedText; }, [typedText]);

    const finishStage = useCallback(async (finalText?: string) => {
        const now = performanceNow();
        const completionTimeMs = now - startRef.current;
        const phrase = targetPhraseRef.current;
        const textToUse = finalText !== undefined ? finalText : typedTextRef.current;
        
        const errorCount = getEditDistance(phrase, textToUse);
        const wpm = (textToUse.length / 5) / (completionTimeMs / 60000);

        const derived = {
            wpm: wpm,
            typing_error_count: errorCount,
            backspace_count: metricsRef.current.backspaceCount,
            typing_completion_time_ms: completionTimeMs,
            phrase_length: phrase.length,
            typed_length: textToUse.length
        };

        bufferEvent(sessionId, {
            game_id: 'input_rhythm_racer',
            event_type: 'completion',
            payload: { 
              typed_text: textToUse, 
              target_phrase: phrase,
              completion_time_ms: completionTimeMs, 
              error_count: errorCount,
              wpm: wpm,
              key_log_summary: metricsRef.current.keyLog.length,
              stage 
            },
            client_ts: clientTimestamp()
        });

        await saveMetrics(sessionId, `input_rhythm_racer_${stage}`, derived);
        await flushEvents(sessionId);
        onComplete();
    }, [onComplete, sessionId, stage]);

    useEffect(() => {
        const phrases = stage === 'easy' ? EASY_PHRASES : HARD_PHRASES;
        const selectedPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        targetPhraseRef.current = selectedPhrase;
        startRef.current = performanceNow();
        metricsRef.current = {
            backspaceCount: 0,
            keyLog: []
        };

        const phraseTimeout = setTimeout(() => {
            setTargetPhrase(selectedPhrase);
            setTypedText('');
        }, 0);

        const completeTimeout = setTimeout(() => {
            finishStage();
        }, 15000); // 15s for typing

        return () => {
            clearTimeout(phraseTimeout);
            clearTimeout(completeTimeout);
        };
    }, [finishStage, stage]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const now = performanceNow();
        const keyData = { 
          key: e.key, 
          ts: now, 
          time_since_start: now - startRef.current,
          text_length: typedText.length
        };
        metricsRef.current.keyLog.push(keyData);

        bufferEvent(sessionId, {
            game_id: 'input_rhythm_racer',
            event_type: 'key_event',
            payload: { ...keyData, event_type: 'down', stage },
            client_ts: clientTimestamp()
        });

        if (e.key === 'Backspace') {
            metricsRef.current.backspaceCount++;
            bufferEvent(sessionId, {
                game_id: 'input_rhythm_racer',
                event_type: 'backspace_event',
                payload: { ts: now, stage },
                client_ts: clientTimestamp()
            });
        }
    };

    const renderChar = (char: string, index: number) => {
      const typed = typedText[index];
      let color = 'text-slate-500';
      if (typed !== undefined) {
        color = typed === char ? 'text-emerald-400' : 'text-red-400 underline';
      }
      return <span key={index} className={`${color} transition-colors duration-200`}>{char}</span>;
    };

    return (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`w-full max-w-lg glass p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl relative overflow-hidden transition-all duration-300 ${
                uiState.handMode === 'left' ? 'w-[88%] mr-auto ml-0' :
                uiState.handMode === 'right' ? 'w-[88%] ml-auto mr-0' : 'w-full'
              }`}
            >
                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500/50" />
                
                <h2 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-sky-400 mb-3 sm:mb-4">Input Rhythm</h2>
                
                <div className="text-base sm:text-lg font-mono leading-relaxed sm:leading-tight mb-5 sm:mb-6 p-3 sm:p-4 bg-slate-900/40 rounded-xl border border-white/5 shadow-inner break-words">
                    {targetPhrase.split('').map(renderChar)}
                    {typedText.length < targetPhrase.length && (
                      <span className="inline-block w-1.5 sm:w-2 h-4 sm:h-5 bg-sky-500 ml-0.5 animate-pulse align-middle" />
                    )}
                </div>

                <input 
                    type="text" 
                    value={typedText}
                    onChange={(e) => {
                        setTypedText(e.target.value);
                        if (e.target.value === targetPhrase) {
                            finishStage(e.target.value);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-full p-3 text-sm sm:text-base rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 outline-none transition-all placeholder:text-slate-700"
                    placeholder="Type to begin..."
                />

                <div className="mt-5 sm:mt-6 flex justify-between text-[8px] sm:text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                    <span>Errors: <span className={getEditDistance(targetPhrase, typedText.substring(0, targetPhrase.length)) > 0 ? 'text-red-400' : 'text-slate-500'}>{getEditDistance(targetPhrase, typedText.substring(0, targetPhrase.length))}</span></span>
                    <span>Progress: {targetPhrase.length > 0 ? Math.round((typedText.length / targetPhrase.length) * 100) : 0}%</span>
                </div>
            </motion.div>
        </div>
    );
}
