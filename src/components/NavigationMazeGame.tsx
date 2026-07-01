import React, { useCallback, useEffect, useRef, useState } from "react";
import { bufferEvent, flushEvents } from "../services/eventBuffer";
import { clientTimestamp, performanceNow } from "../utils/time";
import { saveMetrics } from "../utils/metrics";
import {
  ChevronRight,
  ArrowLeft,
  Folder,
  FileText,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUI } from "../context/UIContext";

interface MenuNode {
  id: string;
  label: string;
  isTarget?: boolean;
  children?: MenuNode[];
}

const EASY_MAZE: MenuNode = {
  id: "root",
  label: "Systems",
  children: [
    {
      id: "settings",
      label: "Configuration",
      children: [
        { id: "display", label: "Visual Interface" },
        { id: "audio", label: "Audio Frequency", isTarget: true },
      ],
    },
    { id: "profile", label: "User Protocol" },
  ],
};

const HARD_MAZE: MenuNode = {
  id: "root",
  label: "Mainframe",
  children: [
    {
      id: "settings",
      label: "System Access",
      children: [
        {
          id: "display",
          label: "Display Buffer",
          children: [{ id: "brightness", label: "Luminance" }],
        },
        { id: "audio", label: "Audio Out" },
        {
          id: "advanced",
          label: "Secure Subsystem",
          children: [
            { id: "dev", label: "Developer Logs" },
            { id: "target", label: "Target Authorization", isTarget: true },
          ],
        },
      ],
    },
    {
      id: "profile",
      label: "Security Crypt",
      children: [{ id: "security", label: "Encryption Key" }],
    },
    { id: "help", label: "Internal Documentation" },
  ],
};

export default function NavigationMazeGame({
  sessionId,
  stage,
  onComplete,
}: {
  sessionId: string;
  stage: "easy" | "hard";
  onComplete: () => void;
}) {
  const { uiState } = useUI();
  const maze = stage === "easy" ? EASY_MAZE : HARD_MAZE;

  const [path, setPath] = useState<MenuNode[]>([maze]);
  const startRef = useRef(performanceNow());
  const lastNavTsRef = useRef(performanceNow());
  const completedRef = useRef(false);

  const metricsRef = useRef({
    wrongNavigationCount: 0,
    backButtonCount: 0,
    selectionTimes: [] as number[],
    routeSequence: ["root"],
  });

  const finishStage = useCallback(
    async (foundTarget = false) => {
      if (completedRef.current) return;
      completedRef.current = true;

      const now = performanceNow();
      const completionTimeMs = now - startRef.current;
      const m = metricsRef.current;

      const confusion = Math.min(
        1,
        (m.wrongNavigationCount + m.backButtonCount) / 5,
      );

      const derived = {
        wrong_navigation_count: m.wrongNavigationCount,
        back_button_count: m.backButtonCount,
        task_completion_time_ms: completionTimeMs,
        avg_menu_selection_time_ms:
          m.selectionTimes.length > 0
            ? m.selectionTimes.reduce((a, b) => a + b, 0) /
              m.selectionTimes.length
            : 0,
        navigation_confusion: confusion,
        route_sequence: m.routeSequence,
        found_target: foundTarget,
        ui_scale: uiState.scale,
      };

      await saveMetrics(
        sessionId,
        `hierarchical_system_navigator_${stage}`,
        derived,
      );
      await flushEvents(sessionId);
      onComplete();
    },
    [onComplete, sessionId, stage, uiState.scale],
  );

  useEffect(() => {
    completedRef.current = false;
    const completeTimeout = setTimeout(() => {
      finishStage();
    }, 15000);

    return () => clearTimeout(completeTimeout);
  }, [finishStage]);

  const currentNode = path[path.length - 1];

  const handleSelect = (node: MenuNode) => {
    const now = performanceNow();
    const selectionTime = now - lastNavTsRef.current;

    const m = metricsRef.current;
    m.selectionTimes.push(selectionTime);
    m.routeSequence.push(node.id);

    if (!node.children && !node.isTarget) {
      m.wrongNavigationCount++;
      bufferEvent(sessionId, {
        game_id: "hierarchical_system_navigator",
        event_type: "wrong_nav",
        payload: {
          screen_id: node.id,
          parent_id: currentNode.id,
          selection_time_ms: selectionTime,
          ui_scale: uiState.scale,
          stage,
        },
        client_ts: clientTimestamp(),
      });
    }

    bufferEvent(sessionId, {
      game_id: "hierarchical_system_navigator",
      event_type: "nav_select",
      payload: {
        from_screen: currentNode.id,
        to_screen: node.id,
        selection_ts: now,
        selection_time_ms: selectionTime,
        is_folder: !!node.children,
        is_target: !!node.isTarget,
        ui_scale: uiState.scale,
        stage,
      },
      client_ts: clientTimestamp(),
    });

    lastNavTsRef.current = now;

    if (node.isTarget) {
      finishStage(true);
    } else if (node.children) {
      setPath([...path, node]);
    }
  };

  const handleBack = () => {
    if (path.length <= 1) return;

    const now = performanceNow();
    const m = metricsRef.current;
    m.backButtonCount++;
    m.routeSequence.push("back");

    bufferEvent(sessionId, {
      game_id: "hierarchical_system_navigator",
      event_type: "back_press",
      payload: {
        screen_id: currentNode.id,
        ts: now,
        path_depth: path.length,
        ui_scale: uiState.scale,
        stage,
      },
      client_ts: clientTimestamp(),
    });

    lastNavTsRef.current = now;
    setPath(path.slice(0, -1));
  };

  const targetLabel =
    stage === "easy" ? "Audio Frequency" : "Target Authorization";

  return (
    <div className="absolute inset-0 bg-slate-950 text-white flex flex-col pt-12 sm:pt-16 select-none overflow-hidden">
      <div className="p-3 sm:p-4 glass flex flex-col sm:flex-row sm:items-center justify-between z-10 border-white/10 gap-3">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {path.length > 1 && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handleBack}
              className="p-1.5 sm:p-2 bg-sky-600/20 border border-sky-500/30 rounded-lg text-sky-400 active:scale-90 transition-all shrink-0"
            >
              <ArrowLeft size={16} />
            </motion.button>
          )}
          <div className="min-w-0">
            <div className="text-[8px] sm:text-[9px] text-sky-500 font-black uppercase tracking-[0.1em]">
              Current Directory
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
              {currentNode.label}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-900/50 rounded-lg border border-white/5 w-full sm:w-auto justify-center sm:justify-start">
          <Search size={12} className="text-slate-500 shrink-0" />
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono italic truncate">
            Goal: {targetLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentNode.id}
            initial={{ x: 10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -10, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-2"
          >
            {currentNode.children?.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSelect(child)}
                style={{
                  padding: `${0.75 * uiState.scale}rem ${1 * uiState.scale}rem`,
                }}
                className={`flex items-center justify-between bg-slate-900/40 border border-white/5 rounded-xl hover:bg-slate-800/60 active:scale-[0.98] transition-all group ${
                  uiState.handMode === "left"
                    ? "w-[88%] mr-auto ml-0"
                    : uiState.handMode === "right"
                      ? "w-[88%] ml-auto mr-0"
                      : "w-full"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 sm:p-2 bg-slate-800 rounded-lg text-slate-400 group-hover:text-sky-400 transition-colors">
                    {child.children ? (
                      <Folder size={14} className="sm:w-4 sm:h-4" />
                    ) : (
                      <FileText size={14} className="sm:w-4 sm:h-4" />
                    )}
                  </div>
                  <span className="text-sm sm:text-base font-medium text-slate-200 text-left">
                    {child.label}
                  </span>
                </div>
                <ChevronRight
                  size={16}
                  className="text-slate-600 group-hover:text-sky-500 group-hover:translate-x-1 transition-all shrink-0 ml-2"
                />
              </button>
            ))}
            {!currentNode.children && !currentNode.isTarget && (
              <div className="py-12 flex flex-col items-center justify-center text-slate-600 opacity-50 grayscale">
                <Folder size={32} className="mb-2 stroke-[1px]" />
                <div className="text-[10px] font-mono tracking-widest uppercase">
                  Directory Empty
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-2 sm:p-3 bg-slate-900/30 border-t border-white/5 text-center">
        <p className="text-[8px] sm:text-[9px] text-slate-600 uppercase tracking-widest">
          Navigation Trace Enabled
        </p>
      </div>
    </div>
  );
}
