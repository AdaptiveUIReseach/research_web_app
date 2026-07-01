import React, { useState, useEffect } from "react";
import TapAccuracyGame from "./TapAccuracyGame";
import ThumbZoneGame from "./ThumbZoneGame";
import TypingGame from "./TypingGame";
import NavigationMazeGame from "./NavigationMazeGame";
import ScrollSearchGame from "./ScrollSearchGame";
import { db } from "../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Beaker, CheckCircle2 } from "lucide-react";

type StageType = "easy" | "hard";
interface GameComponentProps {
  sessionId: string;
  stage: StageType;
  onComplete: () => void;
}

interface GameSequence {
  id: string;
  Component: React.ComponentType<GameComponentProps>;
  stage: StageType;
  title: string;
}

const SEQUENCE: GameSequence[] = [
  { id: "precision_target_matrix", Component: TapAccuracyGame, stage: "easy", title: "Touch Target Precision" },
  { id: "precision_target_matrix", Component: TapAccuracyGame, stage: "hard", title: "High-Precision Target Grid" },
  { id: "reachability_zone_mapper", Component: ThumbZoneGame, stage: "easy", title: "Comfort Reach Mapping" },
  { id: "reachability_zone_mapper", Component: ThumbZoneGame, stage: "hard", title: "Extreme Reach Diagnostics" },
  { id: "input_rhythm_racer", Component: TypingGame, stage: "easy", title: "Typing Cadence Racer" },
  { id: "input_rhythm_racer", Component: TypingGame, stage: "hard", title: "Complex Input Rhythm" },
  { id: "hierarchical_system_navigator", Component: NavigationMazeGame, stage: "easy", title: "Directory System Navigation" },
  { id: "hierarchical_system_navigator", Component: NavigationMazeGame, stage: "hard", title: "Deep Hierarchy Navigator" },
  { id: "density_scan_optimizer", Component: ScrollSearchGame, stage: "easy", title: "Layout Density Scanner" },
  { id: "density_scan_optimizer", Component: ScrollSearchGame, stage: "hard", title: "Rapid Density Search" },
];

export default function GameLauncher({
  sessionId,
  onComplete,
}: {
  sessionId: string;
  onComplete: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inTransition, setInTransition] = useState(false);
  const [appliedUi, setAppliedUi] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(true);

  useEffect(() => {
    const sessionRef = doc(db, `sessions/${sessionId}`);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const nextAppliedUi = typeof data.applied_ui === "string" ? data.applied_ui : null;
        if (nextAppliedUi !== appliedUi) {
          setAppliedUi(nextAppliedUi);
        }
      }
    });
    return () => unsubscribe();
  }, [sessionId, appliedUi]);

  const handleStartStage = () => {
    setShowBriefing(false);
  };

  const handleStageComplete = () => {
    if (currentIndex < SEQUENCE.length - 1) {
      setInTransition(true);
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setInTransition(false);
        setShowBriefing(true); // Show briefing for the next stage
      }, 400); // Snappier transition
    } else {
      onComplete();
    }
  };

  const getBriefing = (id: string, stage: StageType) => {
    const isHard = stage === 'hard';
    switch (id) {
      case 'precision_target_matrix': return {
        icon: <Zap size={24} />,
        goal: "Tap targets as fast & accurately as you can.",
        steps: isHard
          ? ["Watch for small blue circles appearing anywhere on screen", "Tap the center of each circle as quickly as possible", "Avoid tapping empty areas — misses are tracked"]
          : ["Blue circles will pop up on screen one at a time", "Tap each circle before the next one appears", "Aim for the center to maximize your accuracy score"],
        metric: "Accuracy & Reaction Time"
      };
      case 'reachability_zone_mapper': return {
        icon: <Zap size={24} />,
        goal: "Tap the highlighted screen zone using one hand.",
        steps: isHard
          ? ["The screen is divided into 6 zones", "A small blue dot will appear in one of them", "Reach and tap that zone using only your thumb — do not reposition your grip"]
          : ["The screen is divided into 6 zones", "One zone will light up with a large TAP indicator", "Using just your thumb, tap anywhere inside that zone"],
        metric: "Reachability & Zone Mapping"
      };
      case 'input_rhythm_racer': return {
        icon: <Zap size={24} />,
        goal: "Type the phrase shown exactly as written.",
        steps: isHard
          ? ["Read the phrase displayed — it includes punctuation and numbers", "Tap the text field and type it out as accurately as you can", "The stage ends when you finish or time runs out"]
          : ["A short phrase will appear on screen", "Tap the input box below and type it exactly", "Green letters mean correct, red means a mistake"],
        metric: "WPM & Error Rate"
      };
      case 'hierarchical_system_navigator': return {
        icon: <Zap size={24} />,
        goal: isHard ? "Find 'Target Authorization' deep in the menu tree." : "Find 'Audio Frequency' inside the directory.",
        steps: isHard
          ? ["You start at the Mainframe root menu", "Tap folders to drill into submenus — look for 'Secure Subsystem'", "Use the back arrow if you go the wrong way"]
          : ["You start at the Systems root menu", "Tap 'Configuration' then look for 'Audio Frequency'", "Tap it to complete the stage"],
        metric: "Pathing & Confusion Index"
      };
      case 'density_scan_optimizer': return {
        icon: <Zap size={24} />,
        goal: isHard ? "Find and tap all 5 red targets in the long list." : "Find and tap all 3 red targets in the list.",
        steps: isHard
          ? ["Scroll through a list of 200 entries", "Items labeled 'CRITICAL_TARGET_DETECTION_FOUND' are your targets", "Tap each red target — find all 5 to finish early"]
          : ["Scroll down through the list of entries", "Spotted a red glowing item? That's a target — tap it!", "Find all 3 targets to complete the stage"],
        metric: "Velocity & Search Stability"
      };
      default: return { icon: <Zap size={24} />, goal: "Begin Protocol", steps: ["Interact with the targets provided."], metric: "General Interaction" };
    }
  };

  const currentGame = SEQUENCE[currentIndex];
  const briefing = getBriefing(currentGame.id, currentGame.stage);

  const uiClassNames =
    appliedUi === "Large_Button_UI"
      ? "scale-110 origin-center"
      : appliedUi === "Accessibility_UI"
        ? "contrast-150 saturate-150"
        : appliedUi === "Large_Font_UI"
        ? "text-lg"
        : "";

  const GameComponent = currentGame.Component;

  return (
    <div className={`relative w-full h-full bg-slate-950 overflow-hidden transition-all duration-300 ${uiClassNames}`}>
      {/* Global Top HUD - Compact */}
      <div className="absolute top-0 left-0 w-full p-3 sm:p-4 flex justify-between items-center z-50 pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 glass px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border-white/5 backdrop-blur-md">
          <Beaker size={12} className="text-sky-400 sm:w-3.5 sm:h-3.5" />
          <h1 className="text-white/80 font-semibold text-[10px] sm:text-xs tracking-tight truncate max-w-[100px] sm:max-w-none">{currentGame.title}</h1>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 glass px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border-white/5 backdrop-blur-md">
          <div className="w-10 sm:w-16 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / SEQUENCE.length) * 100}%` }}
              className="h-full bg-sky-400"
            />
          </div>
          <span className="text-white/60 font-mono text-[9px] sm:text-[10px]">
            {currentIndex + 1}/{SEQUENCE.length}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showBriefing ? (
          <motion.div 
            key="briefing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm glass p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 opacity-[0.03] text-sky-400">
                {briefing.icon}
              </div>
              <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-400/10 rounded-xl mx-auto mb-3 sm:mb-4 flex items-center justify-center text-sky-400">
                   {briefing.icon}
                </div>
                
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 sm:mb-3">
                  {currentGame.stage} Mode
                </div>
                
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{briefing.goal}</h3>
              </div>

              {/* How to Play Steps */}
              <div className="mb-4 sm:mb-5 bg-slate-900/50 rounded-xl border border-white/5 p-3 sm:p-4">
                <span className="text-[7px] sm:text-[8px] font-black text-sky-500 uppercase tracking-[0.2em] block mb-2.5">How to Play</span>
                <ol className="space-y-2">
                  {briefing.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-left">
                      <span className="shrink-0 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-sky-400/15 border border-sky-400/30 text-sky-400 text-[9px] sm:text-[10px] font-bold flex items-center justify-center mt-px">{i + 1}</span>
                      <span className="text-slate-300 text-[11px] sm:text-xs leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              
              <div className="mb-4 sm:mb-5 p-2 sm:p-2.5 bg-slate-900/50 rounded-xl border border-white/5 flex flex-col items-center">
                <span className="text-[7px] sm:text-[8px] font-black text-sky-500 uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Key Metric</span>
                <span className="text-[11px] sm:text-xs text-slate-300 font-medium">{briefing.metric}</span>
              </div>

              <button 
                onClick={handleStartStage}
                className="w-full py-3 sm:py-3.5 bg-sky-400 text-slate-950 rounded-xl font-bold tracking-tight text-sm shadow-lg shadow-sky-400/20 active:scale-95 transition-all cursor-pointer"
              >
                Begin Stage
              </button>
            </div>
          </motion.div>
        ) : inTransition ? (
          <motion.div 
            key="transition"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-40"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Stage Clear</h2>
              <p className="text-emerald-400/60 font-medium text-sm">Data synchronized successfully</p>
              
              <div className="mt-8 flex gap-1 justify-center">
                {[0, 1, 2].map(i => (
                  <motion.div 
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-1.5 h-1.5 bg-sky-400 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            <GameComponent
              sessionId={sessionId}
              stage={currentGame.stage}
              onComplete={handleStageComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

