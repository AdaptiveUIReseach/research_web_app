import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  collectionGroup,
  query,
  limit,
  getDocs,
  orderBy,
  where,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import Settings from "./Settings";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  Settings as SettingsIcon,
  CheckCircle2,
  Database,
  Info,
  Smartphone,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { useUI } from "../context/UIContext";
import {
  calculateFrictionProfile,
  type OutputLabels,
  type RecommendedUiProfile,
  type FrictionExplanation,
} from "../utils/uiLabels";

type FirestoreRecord = Record<string, unknown>;

interface SessionData extends FirestoreRecord, OutputLabels {
  recommended_ui?: string;
  applied_ui?: string | null;
  applied_ui_profile?: RecommendedUiProfile;
  combined_research_score?: number;
  tap_friction_score?: number;
  thumb_reach_friction_score?: number;
  typing_friction_score?: number;
  navigation_friction_score?: number;
  layout_friction_score?: number;
  tap_precision_confidence?: number;
  thumb_reach_confidence?: number;
  typing_friction_confidence?: number;
  navigation_friction_confidence?: number;
  layout_friction_confidence?: number;
  recommended_ui_profile?: RecommendedUiProfile;
  hand_inference?: unknown;
}

interface MetricData extends FirestoreRecord {
  id: string;
  game_id?: string;
  derived_metrics?: FirestoreRecord;
}

interface RawEvent extends FirestoreRecord {
  id: string;
  game_id: string;
  event_type: string;
  payload: unknown;
}

export default function SessionSummary({ sessionId }: { sessionId: string }) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showIfiInfo, setShowIfiInfo] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    dominantHand: string;
    screenWidth: number;
  } | null>(null);
  const { uiState, applyUIProfile, resetUI } = useUI();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `sessions/${sessionId}`), (docSnap) => {
      if (docSnap.exists()) {
        setSessionData(docSnap.data() as SessionData);
      }
    });

    // Fetch user data for declared hand
    const fetchUser = async () => {
      try {
        const userSnap = await getDoc(doc(db, `users/${sessionId}`));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserProfile({
            dominantHand:
              typeof userData.dominant_hand === "string"
                ? userData.dominant_hand
                : "unknown",
            screenWidth:
              typeof userData.screen_width === "number"
                ? userData.screen_width
                : 0,
          });
        }
      } catch (e) {
        console.error("Failed to fetch onboarding profile:", e);
      }
    };

    // Fetch game summaries
    const fetchMetrics = async () => {
      try {
        const q = collection(db, `sessions/${sessionId}/games`);
        const snap = await getDocs(q);
        setMetrics(
          snap.docs.map(
            (d): MetricData => ({ id: d.id, ...(d.data() as FirestoreRecord) }),
          ),
        );
      } catch (e) {
        console.error("Game metrics query failed.", e);
      }
    };

    // Fetch raw data sample for transparency
    const fetchRaw = async () => {
      const q = query(
        collectionGroup(db, "raw_events"),
        where("session_id", "==", sessionId),
        orderBy("server_ts", "desc"),
        limit(15),
      );
      try {
        const snap = await getDocs(q);
        setRawEvents(
          snap.docs.map((d): RawEvent => {
            const data = d.data() as FirestoreRecord;
            return {
              ...data,
              id: d.id,
              game_id:
                typeof data.game_id === "string" ? data.game_id : "unknown",
              event_type:
                typeof data.event_type === "string"
                  ? data.event_type
                  : "unknown",
              payload: data.payload,
            };
          }),
        );
      } catch (e) {
        console.error(
          "Raw logs query failed. This usually requires a manual index link from the browser console.",
          e,
        );
      }
    };

    fetchUser();
    fetchMetrics();
    fetchRaw();

    return () => unsub();
  }, [sessionId]);

  // Rule-based Recommendation Engine Logic
  useEffect(() => {
    if (
      metrics.length > 0 &&
      sessionData &&
      userProfile &&
      (sessionData.combined_research_score === undefined ||
        !sessionData.recommended_ui_profile ||
        sessionData.hand_inference === undefined)
    ) {
      const runAnalysis = async () => {
        const profile = calculateFrictionProfile(
          metrics,
          userProfile.dominantHand,
          userProfile.screenWidth,
        );

        const updatePayload: FirestoreRecord = {
          tap_friction_score: profile.scores.tap_friction_score,
          thumb_reach_friction_score: profile.scores.thumb_reach_friction_score,
          typing_friction_score: profile.scores.typing_friction_score,
          navigation_friction_score: profile.scores.navigation_friction_score,
          layout_friction_score: profile.scores.layout_friction_score,
          combined_research_score: profile.scores.combined_research_score,
          ifi: profile.scores.combined_research_score, // backward compatibility

          // Confidence metrics
          tap_precision_confidence: profile.explanations.button.confidence,
          thumb_reach_confidence: profile.explanations.hand.confidence,
          typing_friction_confidence: profile.explanations.keyboard.confidence,
          navigation_friction_confidence:
            profile.explanations.navigation.confidence,
          layout_friction_confidence: profile.explanations.layout.confidence,

          // Hand preference model output
          hand_inference: profile.hand_inference,

          recommended_ui_profile: profile.recommended_profile,
          button_ui_label: profile.recommended_profile.button_ui,
          keyboard_ui_label: profile.recommended_profile.keyboard_ui,
          navigation_ui_label: profile.recommended_profile.navigation_ui,
          layout_ui_label: profile.recommended_profile.layout_ui,
          hand_ui_label: profile.recommended_profile.hand_ui,
          recommended_ui: "Multi-Profile Adaptive UI",
          output_labels_completed_at: serverTimestamp(),
          analysis_completed_at: serverTimestamp(),
        };

        try {
          await updateDoc(doc(db, `sessions/${sessionId}`), updatePayload);
          console.log(
            `[SessionSummary] Friction scores, hand preference model, and recommended UI saved for session ${sessionId}`,
          );
        } catch (err) {
          console.error("Failed to save recommendation profile", err);
        }
      };

      const analysisTimeout = setTimeout(runAnalysis, 1000);
      return () => clearTimeout(analysisTimeout);
    }
  }, [metrics, sessionData, userProfile, sessionId]);

  const handleApply = async () => {
    const declared = userProfile?.dominantHand ?? "unknown";
    const width = userProfile?.screenWidth ?? 0;
    const profile =
      metrics.length > 0
        ? calculateFrictionProfile(metrics, declared, width)
        : null;
    const recommended =
      sessionData?.recommended_ui_profile ?? profile?.recommended_profile;
    if (!recommended) return;

    setIsApplying(true);
    await updateDoc(doc(db, `sessions/${sessionId}`), {
      applied_ui: "Multi-Profile Adaptive UI",
      applied_ui_profile: recommended,
    });
    applyUIProfile(recommended);
    setTimeout(() => setIsApplying(false), 500);
  };

  const handleUndo = async () => {
    await updateDoc(doc(db, `sessions/${sessionId}`), {
      applied_ui: null,
      applied_ui_profile: null,
    });
    resetUI();
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  // Compute profile calculations locally if firebase sync is not yet finished
  const declaredHand = userProfile?.dominantHand ?? "unknown";
  const devWidth = userProfile?.screenWidth ?? 0;
  const calculatedProfile =
    metrics.length > 0
      ? calculateFrictionProfile(metrics, declaredHand, devWidth)
      : null;
  const combinedScore =
    sessionData.combined_research_score ??
    calculatedProfile?.scores.combined_research_score ??
    null;
  const recommendedProfile =
    sessionData.recommended_ui_profile ??
    calculatedProfile?.recommended_profile ??
    null;
  const explanations = calculatedProfile?.explanations ?? null;

  const appliedUi = sessionData.applied_ui;
  const isApplied = appliedUi === "Multi-Profile Adaptive UI";

  const getScoreColorClass = (score: number) => {
    if (score < 0.25)
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (score < 0.5) return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    if (score < 0.75)
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  const getConfidenceColorClass = (conf: number) => {
    if (conf >= 0.8)
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (conf >= 0.4) return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  };

  const getFrictionTextLabel = (score: number) => {
    if (score < 0.25) return "Low Friction";
    if (score < 0.5) return "Nominal Friction";
    if (score < 0.75) return "Moderate Friction";
    return "High Friction";
  };

  const getConfidenceRating = (conf: number) => {
    if (conf >= 0.8) return "High Confidence";
    if (conf >= 0.4) return "Moderate Confidence";
    return "Low Confidence";
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 sm:p-6 overflow-y-auto flex flex-col items-stretch custom-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-4xl space-y-6 pb-12 transition-all duration-300 ${
          uiState.handMode === "left"
            ? "w-[88%] mr-auto ml-0"
            : uiState.handMode === "right"
              ? "w-[88%] ml-auto mr-0"
              : "mx-auto"
        }`}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-1.5 text-sky-400 mb-1.5">
              <Activity size={14} className="animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Diagnostic Complete
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
              Interaction Profile Analysis
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-xs font-medium"
            >
              <SettingsIcon size={14} />
              <span>Manual Overrides</span>
            </button>
          </div>
        </div>

        {/* Top Section: Combined Score & Adaptive UI controls */}
        <div
          className={
            uiState.simplified
              ? "flex justify-center w-full"
              : "grid grid-cols-1 md:grid-cols-3 gap-5"
          }
        >
          {/* Combined Research Score Card */}
          {!uiState.simplified && (
            <div className="md:col-span-2 glass p-6 rounded-[2rem] relative overflow-hidden bg-slate-900/40 border-white/5 backdrop-blur-md flex flex-col justify-between">
              <div className="absolute -top-10 -right-10 opacity-[0.01] pointer-events-none text-sky-400">
                <Activity size={200} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="space-y-1">
                    <h2 className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                      Combined Research Score
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">
                      Aggregate Cross-Session Comparison Index
                    </p>
                  </div>
                  <button
                    onClick={() => setShowIfiInfo(!showIfiInfo)}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-sky-400"
                  >
                    <Info size={14} />
                  </button>
                </div>

                <AnimatePresence>
                  {showIfiInfo && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mb-4 p-3 bg-sky-500/5 border border-sky-500/10 rounded-xl overflow-hidden"
                    >
                      <p className="text-xs text-slate-300 leading-relaxed">
                        This score represents the weighted average of all
                        per-game friction dimensions. It is reserved exclusively
                        for research comparison and analytical evaluation. UI
                        layout modifications are determined independently by
                        dimension-specific scores.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {combinedScore === null ? (
                  <div className="flex items-center gap-3 py-4">
                    <div className="animate-spin h-4 w-4 border-2 border-sky-500 border-t-transparent rounded-full" />
                    <p className="text-xs italic text-slate-400 font-mono tracking-widest uppercase animate-pulse">
                      Aggregating Dimension Metrics...
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-6 my-2">
                    <span className="text-5xl md:text-6xl font-black text-white tracking-tighter tabular-nums">
                      {combinedScore.toFixed(3)}
                    </span>
                    <div className="space-y-1.5">
                      <div
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest ${getScoreColorClass(combinedScore)}`}
                      >
                        {getFrictionTextLabel(combinedScore)}
                      </div>
                      <p className="text-xs text-slate-300 max-w-[240px] leading-snug font-medium">
                        Overall performance score computed deterministically
                        from all five diagnostic dimensions.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-3 mt-4 text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <AlertCircle size={12} className="text-amber-500 shrink-0" />
                <span>
                  This composite index does NOT drive the individual dimension
                  recommendations.
                </span>
              </div>
            </div>
          )}

          {/* Adaptive UI Profile Action Card */}
          <div
            className={`glass p-6 rounded-[2rem] border-white/5 bg-slate-900/40 flex flex-col justify-between relative overflow-hidden ${
              uiState.simplified ? "w-full max-w-md min-h-[160px]" : ""
            }`}
          >
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Adaptation Status
              </h2>
              <div className="py-2">
                {isApplied ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={20} className="shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-sm block">
                        Active Profile
                      </span>
                      <span className="text-xs text-slate-400 block truncate">
                        Applied multi-dimension settings
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Smartphone size={20} className="shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <span className="font-bold text-sm block">
                        Pending Application
                      </span>
                      <span className="text-xs text-slate-400 block truncate">
                        Adjustments calculated and ready
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-4">
              {isApplied ? (
                <button
                  onClick={handleUndo}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase tracking-wider text-xs transition-all border border-white/5 active:scale-95 cursor-pointer"
                >
                  Reset Interface
                </button>
              ) : (
                <button
                  onClick={handleApply}
                  disabled={isApplying || !recommendedProfile}
                  className="w-full py-3 bg-sky-400 hover:bg-sky-300 text-slate-950 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-lg shadow-sky-400/10 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isApplying ? "Syncing..." : "Apply Adaptive Profile"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section Title */}
        <div className="pt-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">
            Friction Metrics & UI Recommendations
          </h3>
          {!uiState.simplified && (
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="flex items-center gap-1.5 text-xs text-sky-400 font-mono bg-slate-900/30 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-slate-800/40 transition-all cursor-pointer"
            >
              <BarChart3 size={14} />
              <span>{showRawData ? "Hide Telemetry" : "Inspect Raw"}</span>
            </button>
          )}
        </div>

        {/* Dimension Card Deck */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {explanations &&
            Object.entries(explanations).map(
              ([key, exp]: [string, FrictionExplanation]) => {
                const recLabel = recommendedProfile
                  ? recommendedProfile[
                      `${key}_ui` as keyof RecommendedUiProfile
                    ]
                  : null;

                return (
                  <motion.div
                    key={key}
                    whileHover={{ y: -2 }}
                    className="glass p-5 rounded-2xl bg-slate-900/20 border-white/5 backdrop-blur-md flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Card Title & Friction Score */}
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest block mb-1">
                            {key === "button"
                              ? "Touch Precision"
                              : key === "hand"
                                ? "Reach & Position"
                                : key === "keyboard"
                                  ? "Typing & Layout"
                                  : key === "navigation"
                                    ? "Hierarchy Depth"
                                    : "Scanning Density"}
                          </span>
                          <h4 className="text-base font-bold text-white tracking-tight leading-snug">
                            {exp.title}
                          </h4>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {/* Friction Score Badge */}
                          <div
                            className={`px-2.5 py-1 rounded-xl border font-mono font-bold text-sm flex flex-col items-center min-w-[56px] ${getScoreColorClass(exp.score)}`}
                          >
                            <span className="leading-tight">
                              {exp.score.toFixed(2)}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans mt-0.5 leading-none">
                              FRICTION
                            </span>
                          </div>
                          {/* Confidence Badge */}
                          {!uiState.simplified && (
                            <div
                              className={`px-2.5 py-1 rounded-xl border font-mono font-bold text-sm flex flex-col items-center min-w-[56px] ${getConfidenceColorClass(exp.confidence)}`}
                            >
                              <span className="leading-tight">
                                {(exp.confidence * 100).toFixed(0)}%
                              </span>
                              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans mt-0.5 leading-none">
                                CONFIDENCE
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Friction Reason */}
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {exp.reason}
                      </p>

                      {/* Confidence Explanation Alert */}
                      {!uiState.simplified && (
                        <div className="flex gap-2 items-start mt-3 p-3 bg-slate-950/40 rounded-xl text-xs text-slate-300 border border-white/5">
                          <Info
                            size={14}
                            className="shrink-0 text-slate-400 mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-200 block mb-0.5">
                              {getConfidenceRating(exp.confidence)}
                            </span>
                            <span className="leading-normal block text-slate-400">
                              {exp.confidenceReason}
                            </span>
                          </div>
                        </div>
                      )}

                      {key === "hand" &&
                        calculatedProfile?.hand_inference &&
                        !uiState.simplified && (
                          <div className="mt-3 space-y-2">
                            {/* Agreement badge */}
                            {calculatedProfile.hand_inference.agreement ===
                              "agree" && (
                              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                <CheckCircle2 size={12} />
                                <span>
                                  Matches declared hand (
                                  {
                                    calculatedProfile.hand_inference
                                      .declared_hand
                                  }
                                  )
                                </span>
                              </div>
                            )}
                            {calculatedProfile.hand_inference.agreement ===
                              "disagree" && (
                              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                <AlertCircle size={12} />
                                <span>
                                  Reach shift conflicts with dominant hand (
                                  {
                                    calculatedProfile.hand_inference
                                      .declared_hand
                                  }
                                  )
                                </span>
                              </div>
                            )}

                            {/* Supporting evidence */}
                            <div className="bg-slate-950/30 p-3 rounded-xl border border-white/5 space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                Reach Model Evidence
                              </span>
                              <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                                {calculatedProfile.hand_inference.evidence.map(
                                  (ev, idx) => (
                                    <li key={idx} className="leading-normal">
                                      {ev}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          </div>
                        )}

                      {/* Contributing Metrics Grid */}
                      {!uiState.simplified && (
                        <div className="grid grid-cols-3 gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-white/5 mt-3">
                          {exp.metrics.map((metric, i) => (
                            <div key={i} className="text-center min-w-0">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block truncate">
                                {metric.label}
                              </span>
                              <span className="text-xs text-slate-200 font-mono font-semibold block truncate mt-0.5">
                                {metric.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recommendation Output */}
                    <div className="border-t border-white/5 pt-3 mt-4 flex items-center justify-between gap-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Recommendation
                      </span>
                      {recLabel ? (
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-sky-400 font-mono">
                          <span>{recLabel.replace(/_/g, " ")}</span>
                          <ArrowUpRight size={12} className="stroke-[2.5px]" />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono italic animate-pulse">
                          Calculating...
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              },
            )}
        </div>

        {/* Raw Telemetry Log Overlay */}
        <AnimatePresence>
          {showRawData && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-2"
            >
              <div className="glass p-5 rounded-[2rem] bg-black/40 border-white/5">
                <div className="flex items-center gap-2 text-slate-400 mb-4">
                  <Database size={14} />
                  <h3 className="text-xs font-bold uppercase tracking-widest">
                    Low-Level Telemetry Logs
                  </h3>
                </div>
                {rawEvents.length === 0 ? (
                  <p className="text-xs italic text-slate-400 font-mono py-4 text-center">
                    No raw logs logged. Complete a test run to generate events.
                  </p>
                ) : (
                  <div className="space-y-1.5 font-mono text-xs max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {rawEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sky-400 font-bold">
                            [{ev.game_id.toUpperCase()}]
                          </span>
                          <span className="text-slate-400 italic">
                            #{ev.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-slate-300 font-bold uppercase">
                            {ev.event_type}:
                          </span>
                          <span className="text-slate-400 truncate flex-1">
                            {JSON.stringify(ev.payload)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
      </motion.div>

      {showSettings && (
        <Settings
          sessionId={sessionId}
          currentAppliedUi={sessionData.applied_ui || null}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
