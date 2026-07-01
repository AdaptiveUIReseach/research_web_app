import React, { useCallback, useEffect, useRef, useState } from 'react';
import { bufferEvent, flushEvents } from '../services/eventBuffer';
import { clientTimestamp, performanceNow } from '../utils/time';
import { saveMetrics } from '../utils/metrics';
import { motion, AnimatePresence } from 'framer-motion';

interface Target {
  id: string;
  x: number;
  y: number;
  radius: number;
  spawnTs: number;
}

import { useUI } from '../context/UIContext';

export default function TapAccuracyGame({ sessionId, stage, onComplete }: { sessionId: string, stage: 'easy' | 'hard', onComplete: () => void }) {
  const { uiState } = useUI();
  const [targets, setTargets] = useState<Target[]>([]);
  const [feedbacks, setFeedbacks] = useState<{ id: string, x: number, y: number, type: 'hit' | 'miss' }[]>([]);
  const [hudStats, setHudStats] = useState({ totalTaps: 0, hits: 0, misses: 0 });
  
  // Metrics state
  const metricsRef = useRef({
      totalTaps: 0,
      hits: 0,
      misses: 0,
      reactionTimes: [] as number[],
      lastTapTs: 0,
      doubleTaps: 0,
      screenInfo: {
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
        pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1
      }
  });

  const finishStage = useCallback(async () => {
      const m = metricsRef.current;
      const derived = {
          total_taps: m.totalTaps,
          successful_taps: m.hits,
          miss_taps: m.misses,
          tap_accuracy: m.totalTaps > 0 ? m.hits / m.totalTaps : 0,
          avg_reaction_time_ms: m.reactionTimes.length > 0 ? m.reactionTimes.reduce((a,b)=>a+b, 0) / m.reactionTimes.length : 0,
          double_tap_count: m.doubleTaps,
          screen_width: m.screenInfo.width,
          screen_height: m.screenInfo.height
      };
      
      await saveMetrics(sessionId, `precision_target_matrix_${stage}`, derived);
      await flushEvents(sessionId);
      onComplete();
  }, [onComplete, sessionId, stage]);

  const addFeedback = (x: number, y: number, type: 'hit' | 'miss') => {
    const id = Math.random().toString(36).substring(7);
    setFeedbacks(prev => [...prev, { id, x, y, type }]);
    // Auto-cleanup handled by Framer Motion onExit or manual timeout
    setTimeout(() => {
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    }, 800);
  };

  useEffect(() => {
    // spawn loop based on stage params
    const spawnInterval = stage === 'easy' ? 900 : 650;
    const baseRadius = stage === 'easy' ? 36 : 24;
    const radius = baseRadius * uiState.scale;
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    const marginX = w * 0.08;
    const marginY = h * 0.12; // More top margin for HUD

    const randomTarget = (r: number): Target => {
        let spawnWidth = w - 2 * marginX - 2 * r;
        let startX = marginX + r;
        
        if (uiState.handMode === 'left') {
          spawnWidth = spawnWidth * 0.70;
        } else if (uiState.handMode === 'right') {
          spawnWidth = spawnWidth * 0.70;
          startX = startX + (w - 2 * marginX - 2 * r) * 0.30;
        }

        return {
            id: Math.random().toString(36).substring(7),
            x: startX + Math.random() * spawnWidth,
            y: marginY + r + Math.random() * (h - 2 * marginY - 2 * r),
            radius: r,
            spawnTs: performanceNow()
        };
    };

    const spawn = () => {
      const target = randomTarget(radius);
      setTargets([target]);
      
      bufferEvent(sessionId, {
        game_id: 'precision_target_matrix',
        event_type: 'spawn',
        payload: { 
          target_id: target.id,
          target_x: target.x, 
          target_y: target.y, 
          target_radius: target.radius, 
          spawn_client_ts: target.spawnTs,
          screen_width: w,
          screen_height: h,
          stage 
        },
        client_ts: clientTimestamp()
      });
    };
    
    spawn();
    const id = setInterval(spawn, spawnInterval);
    
    const completeTimeout = setTimeout(() => {
        clearInterval(id);
        finishStage();
    }, 10000);

    return () => {
        clearInterval(id);
        clearTimeout(completeTimeout);
    };
  }, [finishStage, sessionId, stage, uiState.scale, uiState.handMode]);

  const distance = (x1: number, y1: number, x2: number, y2: number) => {
      return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const tapX = e.clientX;
    const tapY = e.clientY;
    const now = performanceNow();
    
    const m = metricsRef.current;
    m.totalTaps++;

    const isDoubleTap = now - m.lastTapTs < 300;
    if (isDoubleTap) {
        m.doubleTaps++;
    }
    m.lastTapTs = now;

    const target = targets[0];
    let hit = false;
    let reactionTime = 0;
    let offsetX = 0;
    let offsetY = 0;

    if (target) {
        const dist = distance(tapX, tapY, target.x, target.y);
        hit = dist <= target.radius;
        reactionTime = now - target.spawnTs;
        offsetX = tapX - target.x;
        offsetY = tapY - target.y;
        
        if (hit) {
            m.hits++;
            addFeedback(tapX, tapY, 'hit');
            setTargets([]); 
        } else {
            m.misses++;
            addFeedback(tapX, tapY, 'miss');
        }
        
        m.reactionTimes.push(reactionTime);

        bufferEvent(sessionId, {
          game_id: 'precision_target_matrix',
          event_type: 'tap',
          payload: { 
            target_id: target.id,
            tap_x: tapX, 
            tap_y: tapY, 
            target_x: target.x, 
            target_y: target.y, 
            target_radius: target.radius, 
            offset_x: offsetX,
            offset_y: offsetY,
            distance_from_center: dist,
            hit_bool: hit, 
            reaction_time_ms: reactionTime, 
            double_tap: isDoubleTap,
            pointer_type: e.pointerType,
            pressure: e.pressure,
            stage 
          },
          client_ts: clientTimestamp()
        });
    } else {
        // Tap on empty space
        m.misses++;
        addFeedback(tapX, tapY, 'miss');
        bufferEvent(sessionId, {
          game_id: 'precision_target_matrix',
          event_type: 'tap_empty',
          payload: { 
            tap_x: tapX, 
            tap_y: tapY, 
            double_tap: isDoubleTap,
            pointer_type: e.pointerType,
            stage 
          },
          client_ts: clientTimestamp()
        });
    }

    setHudStats({ totalTaps: m.totalTaps, hits: m.hits, misses: m.misses });
  };

  return (
    <div onPointerDown={handlePointerDown} className="game-canvas absolute inset-0 bg-slate-950 overflow-hidden touch-none select-none">
        {/* Background Grid for better depth */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'radial-gradient(#0ea5e9 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} />
        
        <AnimatePresence>
          {targets.map((t) => (
            <motion.div 
              key={t.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute flex items-center justify-center pointer-events-none"
              style={{
                left: t.x - t.radius,
                top: t.y - t.radius,
                width: t.radius * 2,
                height: t.radius * 2,
              }}
            >
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-sky-400/50 shadow-[0_0_15px_rgba(56,189,248,0.3)] animate-pulse" />
              {/* Target core */}
              <div className="w-full h-full rounded-full bg-sky-400 shadow-lg shadow-sky-500/40 relative z-10 flex items-center justify-center">
                <div className="w-1/3 h-1/3 bg-white/60 rounded-full blur-[1px]" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Feedback for hit/miss */}
        <AnimatePresence>
          {feedbacks.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.4 }}
              className="absolute pointer-events-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
              style={{ left: f.x, top: f.y }}
            >
              {f.type === 'hit' ? (
                <div className="relative flex items-center justify-center">
                  <motion.div 
                    animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                    className="absolute w-12 h-12 bg-sky-400/40 rounded-full blur-xl"
                  />
                  <motion.div 
                    animate={{ rotate: 180, scale: [0, 1.2, 1] }}
                    className="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_white]"
                  />
                </div>
              ) : (
                <motion.div 
                  initial={{ scale: 0.2, opacity: 1 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  className="w-8 h-8 border border-white/40 rounded-full"
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* HUD - Compact */}
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 text-[9px] sm:text-[10px] font-mono text-slate-500 flex gap-2 sm:gap-3 bg-slate-900/40 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/5">
          <span>HITS <span className="text-sky-400 font-bold">{hudStats.hits}</span></span>
          <span className="hidden sm:inline">MISS <span className="text-slate-400 font-bold">{hudStats.misses}</span></span>
          <span>ACC <span className="text-white font-bold">{(hudStats.totalTaps > 0 ? (hudStats.hits / hudStats.totalTaps * 100) : 0).toFixed(0)}%</span></span>
        </div>
    </div>
  );
}
