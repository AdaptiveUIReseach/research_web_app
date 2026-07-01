type MetricRecord = Record<string, unknown>;

export type ButtonUiLabel =
  | 'small_button_ui'
  | 'default_button_ui'
  | 'large_button_ui'
  | 'extra_large_button_ui';

export type KeyboardUiLabel =
  | 'compact_keyboard_ui'
  | 'default_keyboard_ui'
  | 'large_keyboard_ui';

export type NavigationUiLabel =
  | 'top_navigation_ui'
  | 'default_navigation_ui'
  | 'bottom_navigation_ui'
  | 'simplified_navigation_ui';

export type LayoutUiLabel =
  | 'compact_layout_ui'
  | 'default_layout_ui'
  | 'spaced_layout_ui';

export type HandUiLabel =
  | 'left_hand_ui'
  | 'right_hand_ui'
  | 'two_hand_ui'
  | 'ambiguous_hand_ui';

export interface OutputLabels {
  button_ui_label?: ButtonUiLabel;
  keyboard_ui_label?: KeyboardUiLabel;
  navigation_ui_label?: NavigationUiLabel;
  layout_ui_label?: LayoutUiLabel;
  hand_ui_label?: HandUiLabel;
}

export interface RecommendedUiProfile {
  button_ui?: ButtonUiLabel;
  keyboard_ui?: KeyboardUiLabel;
  navigation_ui?: NavigationUiLabel;
  layout_ui?: LayoutUiLabel;
  hand_ui?: HandUiLabel;
}

interface MetricContainer extends MetricRecord {
  derived_metrics?: MetricRecord;
}

export interface FrictionScores {
  tap_friction_score: number;
  thumb_reach_friction_score: number;
  typing_friction_score: number;
  navigation_friction_score: number;
  layout_friction_score: number;
  combined_research_score: number;
}

export interface MetricDetail {
  label: string;
  value: string | number;
}

export interface FrictionExplanation {
  title: string;
  score: number;
  reason: string;
  metrics: MetricDetail[];
  recommendation: string;
  confidence: number;
  confidenceReason: string;
}

export interface HandInferenceDetails {
  hand_label: HandUiLabel;
  hand_confidence: number;
  declared_hand: string;
  evidence: string[];
  reach_preference: 'left' | 'right' | 'neutral';
  one_hand_pattern: 'left_hand' | 'right_hand' | 'mixed_use' | 'uncertain';
  agreement: 'agree' | 'disagree' | 'ambiguous';
}

export interface CompleteFrictionProfile {
  scores: FrictionScores;
  recommended_profile: RecommendedUiProfile;
  explanations: Record<string, FrictionExplanation>;
  hand_inference?: HandInferenceDetails;
}

const getRecord = (value: unknown): MetricRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as MetricRecord
    : {};

const getOptionalNumber = (record: MetricRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
};

const getNumber = (record: MetricRecord, keys: string[]) =>
  getOptionalNumber(record, keys) ?? 0;

const getMetricNumber = (metric: MetricContainer, keys: string[]) => {
  const topLevelValue = getOptionalNumber(metric, keys);
  if (topLevelValue !== null) return topLevelValue;
  return getOptionalNumber(getRecord(metric.derived_metrics), keys);
};

const sumMetric = (metrics: MetricContainer[], keys: string[]) =>
  metrics.reduce((sum, metric) => sum + (getMetricNumber(metric, keys) ?? 0), 0);

const averageMetric = (metrics: MetricContainer[], keys: string[], transform?: (value: number) => number) => {
  const values = metrics
    .map((metric) => getMetricNumber(metric, keys))
    .filter((value): value is number => value !== null)
    .map((value) => transform ? transform(value) : value);

  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
};

export const calculateButtonUiLabel = (metrics: MetricRecord): ButtonUiLabel => {
  const missTaps = getNumber(metrics, ['miss_taps']);

  if (missTaps <= 2) return 'small_button_ui';
  if (missTaps <= 5) return 'default_button_ui';
  if (missTaps <= 10) return 'large_button_ui';
  return 'extra_large_button_ui';
};

export const calculateKeyboardUiLabel = (metrics: MetricRecord): KeyboardUiLabel => {
  const typingErrorCount = getNumber(metrics, ['typing_error_count']);
  const backspaceCount = getNumber(metrics, ['backspace_count']);

  if (typingErrorCount <= 2 && backspaceCount <= 3) return 'compact_keyboard_ui';
  if (typingErrorCount <= 7) return 'default_keyboard_ui';
  return 'large_keyboard_ui';
};

export const calculateNavigationUiLabel = (metrics: MetricRecord): NavigationUiLabel => {
  const wrongNavigationCount = getNumber(metrics, ['wrong_navigation_count']);

  if (wrongNavigationCount <= 1) return 'top_navigation_ui';
  if (wrongNavigationCount <= 4) return 'default_navigation_ui';
  if (wrongNavigationCount <= 8) return 'bottom_navigation_ui';
  return 'simplified_navigation_ui';
};

export const calculateLayoutUiLabel = (metrics: MetricRecord): LayoutUiLabel => {
  const explicitSpeed = getOptionalNumber(metrics, ['avg_scroll_speed']);
  const speedPxPerSecond = explicitSpeed ?? getNumber(metrics, ['avg_scroll_speed_px_per_ms']) * 1000;

  if (speedPxPerSecond > 500) return 'compact_layout_ui';
  if (speedPxPerSecond > 250) return 'default_layout_ui';
  return 'spaced_layout_ui';
};

export const calculateHandUiLabel = (metrics: MetricRecord): HandUiLabel => {
  const leftTouches = getNumber(metrics, ['left_zone_touch_count', 'left_zone_count']);
  const rightTouches = getNumber(metrics, ['right_zone_touch_count', 'right_zone_count']);
  const horizontalTouches = leftTouches + rightTouches;

  if (horizontalTouches > 0 && rightTouches / horizontalTouches > 0.7) return 'right_hand_ui';
  if (horizontalTouches > 0 && leftTouches / horizontalTouches > 0.7) return 'left_hand_ui';
  return 'two_hand_ui';
};

export const getOutputLabelsForGame = (gameId: string, derivedMetrics: MetricRecord): OutputLabels => {
  if (gameId.startsWith('precision_target_matrix')) {
    return { button_ui_label: calculateButtonUiLabel(derivedMetrics) };
  }

  if (gameId.startsWith('input_rhythm_racer')) {
    return { keyboard_ui_label: calculateKeyboardUiLabel(derivedMetrics) };
  }

  if (gameId.startsWith('hierarchical_system_navigator')) {
    return { navigation_ui_label: calculateNavigationUiLabel(derivedMetrics) };
  }

  if (gameId.startsWith('density_scan_optimizer')) {
    return { layout_ui_label: calculateLayoutUiLabel(derivedMetrics) };
  }

  if (gameId.startsWith('reachability_zone_mapper')) {
    return { hand_ui_label: calculateHandUiLabel(derivedMetrics) };
  }

  return {};
};

export const calculateSessionOutputLabels = (metrics: MetricContainer[]): OutputLabels => {
  const tapMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('precision_target_matrix'));
  const typingMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('input_rhythm_racer'));
  const navigationMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('hierarchical_system_navigator'));
  const scrollMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('density_scan_optimizer'));
  const thumbMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('reachability_zone_mapper'));

  const labels: OutputLabels = {};

  if (tapMetrics.length > 0) {
    labels.button_ui_label = calculateButtonUiLabel({
      miss_taps: sumMetric(tapMetrics, ['miss_taps']),
    });
  }

  if (typingMetrics.length > 0) {
    labels.keyboard_ui_label = calculateKeyboardUiLabel({
      typing_error_count: sumMetric(typingMetrics, ['typing_error_count']),
      backspace_count: sumMetric(typingMetrics, ['backspace_count']),
    });
  }

  if (navigationMetrics.length > 0) {
    labels.navigation_ui_label = calculateNavigationUiLabel({
      wrong_navigation_count: sumMetric(navigationMetrics, ['wrong_navigation_count']),
    });
  }

  if (scrollMetrics.length > 0) {
    labels.layout_ui_label = calculateLayoutUiLabel({
      avg_scroll_speed: averageMetric(
        scrollMetrics,
        ['avg_scroll_speed', 'avg_scroll_speed_px_per_ms'],
        (value) => value <= 10 ? value * 1000 : value
      ),
    });
  }

  if (thumbMetrics.length > 0) {
    labels.hand_ui_label = calculateHandUiLabel({
      left_zone_count: sumMetric(thumbMetrics, ['left_zone_count', 'left_zone_touch_count']),
      right_zone_count: sumMetric(thumbMetrics, ['right_zone_count', 'right_zone_touch_count']),
    });
  }

  return labels;
};

export const createRecommendedUiProfile = (labels: OutputLabels): RecommendedUiProfile => ({
  ...(labels.button_ui_label ? { button_ui: labels.button_ui_label } : {}),
  ...(labels.keyboard_ui_label ? { keyboard_ui: labels.keyboard_ui_label } : {}),
  ...(labels.navigation_ui_label ? { navigation_ui: labels.navigation_ui_label } : {}),
  ...(labels.layout_ui_label ? { layout_ui: labels.layout_ui_label } : {}),
  ...(labels.hand_ui_label ? { hand_ui: labels.hand_ui_label } : {}),
});

export const calculateFrictionProfile = (
  metrics: MetricContainer[],
  declaredHand = 'unknown',
  screenWidth = 0
): CompleteFrictionProfile => {
  const tapMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('precision_target_matrix'));
  const typingMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('input_rhythm_racer'));
  const navigationMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('hierarchical_system_navigator'));
  const scrollMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('density_scan_optimizer'));
  const thumbMetrics = metrics.filter((metric) => metric.id?.toString().startsWith('reachability_zone_mapper'));

  // -------------------------------------------------------------
  // 1. Touch Precision Target Matrix
  // -------------------------------------------------------------
  const missTaps = sumMetric(tapMetrics, ['miss_taps']);
  const totalTaps = sumMetric(tapMetrics, ['total_taps']);
  const avgReactTime = averageMetric(tapMetrics, ['avg_reaction_time_ms']);
  
  const tapErrorRate = totalTaps > 0 ? (missTaps / totalTaps) : 0;
  const reactionDelay = avgReactTime > 0 ? Math.max(0, Math.min(1, (avgReactTime - 200) / 1000)) : 0;
  const tapFriction = Math.max(0, Math.min(1, (0.7 * tapErrorRate) + (0.3 * reactionDelay)));

  // Confidence Calculation
  const tapSampleFactor = Math.max(0, Math.min(1, totalTaps / 20));
  const tapStageFactor = tapMetrics.length === 2 ? 1.0 : 0.5;
  const easyTap = tapMetrics.find(m => typeof m.id === 'string' && m.id.includes('easy'));
  const hardTap = tapMetrics.find(m => typeof m.id === 'string' && m.id.includes('hard'));
  const easyRate = easyTap ? (getMetricNumber(easyTap, ['miss_taps']) ?? 0) / Math.max(1, getMetricNumber(easyTap, ['total_taps']) ?? 1) : 0;
  const hardRate = hardTap ? (getMetricNumber(hardTap, ['miss_taps']) ?? 0) / Math.max(1, getMetricNumber(hardTap, ['total_taps']) ?? 1) : 0;
  const tapConsistencyFactor = (tapMetrics.length === 2 && easyRate > hardRate + 0.15) ? 0.7 : 1.0;
  const tapConfidence = Math.max(0, Math.min(1, tapSampleFactor * tapStageFactor * tapConsistencyFactor));

  let tapConfidenceReason = '';
  if (tapConfidence === 0) {
    tapConfidenceReason = "No precision matrix telemetry logged.";
  } else if (tapConfidence < 0.4) {
    tapConfidenceReason = `Low confidence: small sample size (${totalTaps}/20 taps) and only one stage run.`;
  } else if (tapConsistencyFactor < 1.0) {
    tapConfidenceReason = `Moderate confidence: easy stage error rate (${(easyRate*100).toFixed(0)}%) was anomalously higher than hard stage (${(hardRate*100).toFixed(0)}%).`;
  } else if (tapConfidence < 0.8) {
    tapConfidenceReason = `Moderate confidence: precision checks incomplete (only ${tapMetrics.length} of 2 stages logged).`;
  } else {
    tapConfidenceReason = `High confidence: robust sample size (${totalTaps} taps) with consistent touch targets across stages.`;
  }

  // -------------------------------------------------------------
  // 2. Thumb Zone Comfort Reach Mapper (Confidence-Based Model)
  // -------------------------------------------------------------
  const avgFirstTouchTime = averageMetric(thumbMetrics, ['avg_time_to_first_touch_ms']);
  const leftZoneCount = sumMetric(thumbMetrics, ['left_zone_count', 'left_zone_touch_count']);
  const rightZoneCount = sumMetric(thumbMetrics, ['right_zone_count', 'right_zone_touch_count']);
  const topZoneCount = sumMetric(thumbMetrics, ['top_zone_count']);
  const bottomZoneCount = sumMetric(thumbMetrics, ['bottom_zone_count']);
  
  const thumbFriction = avgFirstTouchTime > 0 ? Math.max(0, Math.min(1, (avgFirstTouchTime - 350) / 1250)) : 0;

  // Inference Model Math
  const totalTouches = leftZoneCount + rightZoneCount + topZoneCount + bottomZoneCount;
  const rightRatio = (leftZoneCount + rightZoneCount) > 0 ? rightZoneCount / (leftZoneCount + rightZoneCount) : 0.5;
  const touchBias = rightRatio - 0.5; // -0.5 to +0.5
  
  const thumbVolumeWeight = Math.max(0, Math.min(1, totalTouches / 12));
  
  // Easy vs Hard stage ratios
  const easyThumb = thumbMetrics.find(m => typeof m.id === 'string' && m.id.includes('easy'));
  const hardThumb = thumbMetrics.find(m => typeof m.id === 'string' && m.id.includes('hard'));
  const easyL = easyThumb ? sumMetric([easyThumb], ['left_zone_count', 'left_zone_touch_count']) : 0;
  const easyR = easyThumb ? sumMetric([easyThumb], ['right_zone_count', 'right_zone_touch_count']) : 0;
  const hardL = hardThumb ? sumMetric([hardThumb], ['left_zone_count', 'left_zone_touch_count']) : 0;
  const hardR = hardThumb ? sumMetric([hardThumb], ['right_zone_count', 'right_zone_touch_count']) : 0;
  const easyRightRatio = (easyL + easyR) > 0 ? easyR / (easyL + easyR) : 0.5;
  const hardRightRatio = (hardL + hardR) > 0 ? hardR / (hardL + hardR) : 0.5;

  let consistencyWeight = 0.6;
  let consistencyAgreed = false;
  if (thumbMetrics.length === 2) {
    consistencyAgreed = (easyRightRatio > 0.5 && hardRightRatio > 0.5) || (easyRightRatio < 0.5 && hardRightRatio < 0.5) || (easyRightRatio === 0.5 && hardRightRatio === 0.5);
    consistencyWeight = consistencyAgreed ? 1.0 : 0.3;
  }

  // Reach Bias Score (incorporates volume weight and consistency weight)
  const finalBias = touchBias * thumbVolumeWeight * consistencyWeight;

  // Hand Confidence Model
  const thumbVolumeFactor = Math.max(0, Math.min(1, totalTouches / 12));
  const thumbStageFactor = thumbMetrics.length === 2 ? 1.0 : 0.6;
  const thumbConsistencyFactor = thumbMetrics.length === 2 ? (consistencyAgreed ? 1.0 : 0.4) : 0.7;
  
  let screenWidthFactor = 1.0;
  if (screenWidth > 600) {
    // Tablet width degrades hand shift confidence (prefers standard centered layout)
    screenWidthFactor = 0.75;
  }

  const handConfidence = Math.max(0, Math.min(1, thumbVolumeFactor * thumbStageFactor * thumbConsistencyFactor * screenWidthFactor));

  // Determine Reach Preference label
  let reachPreference: 'left' | 'right' | 'neutral' = 'neutral';
  if (finalBias > 0.15) reachPreference = 'right';
  else if (finalBias < -0.15) reachPreference = 'left';

  // Determine Usage Pattern
  let usagePattern: 'left_hand' | 'right_hand' | 'mixed_use' | 'uncertain' = 'uncertain';
  if (totalTouches >= 6) {
    if (rightRatio > 0.75) usagePattern = 'right_hand';
    else if (rightRatio < 0.25) usagePattern = 'left_hand';
    else if (rightRatio >= 0.4 && rightRatio <= 0.6) usagePattern = 'mixed_use';
  }

  // Map to Label
  let handUiLabel: HandUiLabel = 'two_hand_ui';
  if (handConfidence >= 0.48) {
    if (finalBias > 0.15) handUiLabel = 'right_hand_ui';
    else if (finalBias < -0.15) handUiLabel = 'left_hand_ui';
  } else {
    handUiLabel = 'ambiguous_hand_ui';
  }

  // Conflict / Agreement matching
  let agreement: 'agree' | 'disagree' | 'ambiguous' = 'ambiguous';
  if (declaredHand === 'right') {
    if (finalBias > 0.12) agreement = 'agree';
    else if (finalBias < -0.12) agreement = 'disagree';
  } else if (declaredHand === 'left') {
    if (finalBias < -0.12) agreement = 'agree';
    else if (finalBias > 0.12) agreement = 'disagree';
  }

  // Build reach preference evidence logs
  const evidence: string[] = [];
  evidence.push(`User declared dominant hand as '${declaredHand}' on onboarding.`);
  evidence.push(`Logged ${totalTouches} target touches in comfort reach mapping stages.`);
  evidence.push(`Touch distribution leans ${(rightRatio * 100).toFixed(0)}% to the right and ${((1 - rightRatio) * 100).toFixed(0)}% to the left.`);
  if (thumbMetrics.length === 2) {
    evidence.push(consistencyAgreed 
      ? "Reach preferences are consistent across Easy and Hard testing runs."
      : "Bias shifted between easy and hard trials, suggesting mixed or adaptive gripping."
    );
  }
  if (screenWidth > 600) {
    evidence.push(`Large screen width (${screenWidth}px) suggests two-handed or desktop/tablet usage.`);
  }

  let thumbConfidenceReason = '';
  if (handConfidence === 0) {
    thumbConfidenceReason = "No reach comfort telemetry logged.";
  } else if (handConfidence < 0.4) {
    thumbConfidenceReason = `Low confidence: minimal reach targets matched (${totalTouches}/10 matches).`;
  } else if (handConfidence < 0.7) {
    thumbConfidenceReason = `Moderate confidence: reach trials incomplete or had high bias inconsistency.`;
  } else {
    thumbConfidenceReason = `High confidence: consistent bias patterns verified across both stages (${totalTouches} touch events).`;
  }

  const handInference: HandInferenceDetails = {
    hand_label: handUiLabel,
    hand_confidence: handConfidence,
    declared_hand: declaredHand,
    evidence,
    reach_preference: reachPreference,
    one_hand_pattern: usagePattern,
    agreement
  };

  // -------------------------------------------------------------
  // 3. Typing Rhythm Racer
  // -------------------------------------------------------------
  const typingErrors = sumMetric(typingMetrics, ['typing_error_count']);
  const backspaces = sumMetric(typingMetrics, ['backspace_count']);
  const wpm = averageMetric(typingMetrics, ['wpm']);
  const typedLength = sumMetric(typingMetrics, ['typed_length']);
  
  const typingErrorRatio = typedLength > 0 ? Math.min(1, typingErrors / typedLength) : 0;
  const backspaceRatio = typedLength > 0 ? Math.min(1, backspaces / typedLength) : 0;
  const wpmPenalty = wpm > 0 ? Math.max(0, Math.min(1, (60 - wpm) / 50)) : 0.5;
  const typingFriction = Math.max(0, Math.min(1, (0.4 * typingErrorRatio) + (0.4 * backspaceRatio) + (0.2 * wpmPenalty)));

  // Confidence Calculation
  const typingSampleFactor = Math.max(0, Math.min(1, typedLength / 50));
  const typingStageFactor = typingMetrics.length === 2 ? 1.0 : 0.5;
  const typingConfidence = Math.max(0, Math.min(1, typingSampleFactor * typingStageFactor));

  let typingConfidenceReason = '';
  if (typingConfidence === 0) {
    typingConfidenceReason = "No typing racer telemetry logged.";
  } else if (typingConfidence < 0.4) {
    typingConfidenceReason = `Low confidence: typed text was too short (${typedLength}/50 characters).`;
  } else if (typingConfidence < 0.8) {
    typingConfidenceReason = `Moderate confidence: typing race incomplete (only one stage logged).`;
  } else {
    typingConfidenceReason = `High confidence: typing cadence verified over ${typedLength} characters across stages.`;
  }

  // -------------------------------------------------------------
  // 4. Hierarchical System Navigator
  // -------------------------------------------------------------
  const wrongNavs = sumMetric(navigationMetrics, ['wrong_navigation_count']);
  const backPresses = sumMetric(navigationMetrics, ['back_button_count']);
  const avgMenuSelection = averageMetric(navigationMetrics, ['avg_menu_selection_time_ms']);
  
  const confusionRatio = Math.min(1, (wrongNavs + backPresses) / 5);
  const selectionDelay = avgMenuSelection > 0 ? Math.max(0, Math.min(1, (avgMenuSelection - 500) / 2500)) : 0;
  const navFriction = Math.max(0, Math.min(1, (0.7 * confusionRatio) + (0.3 * selectionDelay)));

  // Confidence Calculation
  const foundTargetCount = navigationMetrics.reduce((sum, m) => sum + (getMetricNumber(m, ['found_target']) ? 1 : 0), 0);
  const selectionCount = wrongNavs + backPresses + foundTargetCount;
  const navSampleFactor = Math.max(0, Math.min(1, selectionCount / 6));
  const navStageFactor = navigationMetrics.length === 2 ? 1.0 : 0.5;
  const navConfidence = Math.max(0, Math.min(1, navSampleFactor * navStageFactor));

  let navConfidenceReason = '';
  if (navConfidence === 0) {
    navConfidenceReason = "No hierarchy navigator telemetry logged.";
  } else if (navConfidence < 0.4) {
    navConfidenceReason = `Low confidence: minimal navigation decision nodes completed (${selectionCount}/6 actions).`;
  } else if (navConfidence < 0.8) {
    navConfidenceReason = `Moderate confidence: directory navigation completed for only one stage.`;
  } else {
    navConfidenceReason = `High confidence: navigation accuracy verified over ${selectionCount} decision steps across stages.`;
  }

  // -------------------------------------------------------------
  // 5. Density Scan Optimizer
  // -------------------------------------------------------------
  const avgScrollSpeed = averageMetric(scrollMetrics, ['avg_scroll_speed', 'avg_scroll_speed_px_per_ms'], (v) => v <= 10 ? v * 1000 : v);
  const foundTargets = sumMetric(scrollMetrics, ['found_targets']);
  const totalTargets = scrollMetrics.reduce((sum, m) => sum + (getMetricNumber(m, ['total_targets']) ?? (typeof m.id === 'string' && m.id.includes('hard') ? 5 : 3)), 0);
  
  const scrollFrictionPenalty = Math.max(0, Math.min(1, (500 - avgScrollSpeed) / 500));
  const missingTargetsRatio = totalTargets > 0 ? (totalTargets - foundTargets) / totalTargets : 0;
  const layoutFriction = Math.max(0, Math.min(1, (0.6 * scrollFrictionPenalty) + (0.4 * missingTargetsRatio)));

  // Confidence Calculation
  const totalScrollDistance = sumMetric(scrollMetrics, ['total_scroll_distance_px']);
  const scrollSampleFactor = Math.max(0, Math.min(1, totalScrollDistance / 1200));
  const scrollCompletionFactor = totalTargets > 0 ? foundTargets / totalTargets : 0.0;
  const layoutConfidence = Math.max(0, Math.min(1, scrollSampleFactor * (0.5 + 0.5 * scrollCompletionFactor)));

  let layoutConfidenceReason = '';
  if (layoutConfidence === 0) {
    layoutConfidenceReason = "No scrolling scan telemetry logged.";
  } else if (layoutConfidence < 0.4) {
    layoutConfidenceReason = `Low confidence: minimal scroll actions detected (${totalScrollDistance.toFixed(0)}px scrolled).`;
  } else if (layoutConfidence < 0.8) {
    layoutConfidenceReason = `Moderate confidence: list scan completed but only ${foundTargets}/${totalTargets} targets located.`;
  } else {
    layoutConfidenceReason = `High confidence: scroll scanner verified over ${totalScrollDistance.toFixed(0)}px with 100% target detection.`;
  }

  // Combined Research Score
  const combinedResearchScore = 0.2 * (tapFriction + thumbFriction + typingFriction + navFriction + layoutFriction);

  // Confidence-Modulated Soft UI Adaptation
  const adjustedTapFriction = tapFriction * tapConfidence + 0.5 * (1 - tapConfidence);
  const adjustedTypingFriction = typingFriction * typingConfidence + 0.5 * (1 - typingConfidence);
  const adjustedNavFriction = navFriction * navConfidence + 0.5 * (1 - navConfidence);
  const adjustedLayoutFriction = layoutFriction * layoutConfidence + 0.5 * (1 - layoutConfidence);

  // Map to UI adjustments
  const buttonUi: ButtonUiLabel = adjustedTapFriction < 0.20 ? 'small_button_ui'
    : adjustedTapFriction < 0.50 ? 'default_button_ui'
    : adjustedTapFriction < 0.75 ? 'large_button_ui'
    : 'extra_large_button_ui';

  const keyboardUi: KeyboardUiLabel = adjustedTypingFriction < 0.20 ? 'compact_keyboard_ui'
    : adjustedTypingFriction < 0.60 ? 'default_keyboard_ui'
    : 'large_keyboard_ui';

  const navigationUi: NavigationUiLabel = adjustedNavFriction < 0.20 ? 'top_navigation_ui'
    : adjustedNavFriction < 0.50 ? 'default_navigation_ui'
    : adjustedNavFriction < 0.80 ? 'bottom_navigation_ui'
    : 'simplified_navigation_ui';

  const layoutUi: LayoutUiLabel = adjustedLayoutFriction < 0.20 ? 'compact_layout_ui'
    : adjustedLayoutFriction < 0.60 ? 'default_layout_ui'
    : 'spaced_layout_ui';

  const recommendedProfile: RecommendedUiProfile = {
    button_ui: buttonUi,
    hand_ui: handUiLabel,
    keyboard_ui: keyboardUi,
    navigation_ui: navigationUi,
    layout_ui: layoutUi,
  };

  const explanations: Record<string, FrictionExplanation> = {
    button: {
      title: "Precision Target Matrix",
      score: tapFriction,
      reason: tapFriction >= 0.5 
        ? `High tap friction detected due to ${missTaps} miss-taps and ${avgReactTime.toFixed(0)}ms target reaction time.`
        : `Excellent touch accuracy with only ${missTaps} miss-taps and standard response times.`,
      metrics: [
        { label: "Total Taps", value: totalTaps },
        { label: "Miss-Taps", value: missTaps },
        { label: "Avg Reaction Delay", value: `${avgReactTime.toFixed(0)} ms` },
      ],
      recommendation: buttonUi.replace(/_/g, ' '),
      confidence: tapConfidence,
      confidenceReason: tapConfidenceReason,
    },
    hand: {
      title: "Reachability Zone Mapper",
      score: thumbFriction,
      reason: handUiLabel === 'ambiguous_hand_ui'
        ? `Ambiguous reach signals. Leaning preference cannot be determined with certainty.`
        : handUiLabel === 'two_hand_ui'
        ? `Symmetric reach comfort mapped. Mixed usage or two-handed reach pattern observed.`
        : `Clear one-handed reach preference detected (${reachPreference === 'left' ? 'left-side' : 'right-side'} biased).`,
      metrics: [
        { label: "Left Zone Touches", value: leftZoneCount },
        { label: "Right Zone Touches", value: rightZoneCount },
        { label: "Reach Bias", value: finalBias > 0.05 ? "Right" : (finalBias < -0.05 ? "Left" : "Balanced") },
      ],
      recommendation: handUiLabel.replace(/_/g, ' '),
      confidence: handConfidence,
      confidenceReason: thumbConfidenceReason,
    },
    keyboard: {
      title: "Input Rhythm Racer",
      score: typingFriction,
      reason: typingFriction >= 0.5 
        ? `Low typing cadence detected (${wpm.toFixed(0)} WPM) with ${typingErrors} errors and ${backspaces} corrections.`
        : `Consistent typing rhythm (${wpm.toFixed(0)} WPM) with minimal keystroke corrections.`,
      metrics: [
        { label: "Speed (WPM)", value: `${wpm.toFixed(1)}` },
        { label: "Character Errors", value: typingErrors },
        { label: "Backspace Count", value: backspaces },
      ],
      recommendation: keyboardUi.replace(/_/g, ' '),
      confidence: typingConfidence,
      confidenceReason: typingConfidenceReason,
    },
    navigation: {
      title: "Hierarchical System Navigator",
      score: navFriction,
      reason: navFriction >= 0.5 
        ? `Significant navigation maze friction with ${wrongNavs} wrong turns and ${backPresses} backtrack steps.`
        : `Flawless directory system navigation. Standard hierarchical path matching.`,
      metrics: [
        { label: "Wrong Folders Visited", value: wrongNavs },
        { label: "Back Button Presses", value: backPresses },
        { label: "Menu Selection Time", value: `${avgMenuSelection.toFixed(0)} ms` },
      ],
      recommendation: navigationUi.replace(/_/g, ' '),
      confidence: navConfidence,
      confidenceReason: navConfidenceReason,
    },
    layout: {
      title: "Density Scan Optimizer",
      score: layoutFriction,
      reason: layoutFriction >= 0.5 
        ? `Degraded scroll velocity (${avgScrollSpeed.toFixed(0)} px/s) while searching lists. Found ${foundTargets}/${totalTargets} targets.`
        : `Optimal scroll control and visual scanning rhythm. Successfully identified all target fragments.`,
      metrics: [
        { label: "Avg Scroll Speed", value: `${avgScrollSpeed.toFixed(0)} px/s` },
        { label: "Fragments Found", value: `${foundTargets} / ${totalTargets}` },
      ],
      recommendation: layoutUi.replace(/_/g, ' '),
      confidence: layoutConfidence,
      confidenceReason: layoutConfidenceReason,
    },
  };

  return {
    scores: {
      tap_friction_score: tapFriction,
      thumb_reach_friction_score: thumbFriction,
      typing_friction_score: typingFriction,
      navigation_friction_score: navFriction,
      layout_friction_score: layoutFriction,
      combined_research_score: combinedResearchScore,
    },
    recommended_profile: recommendedProfile,
    explanations,
    hand_inference: handInference,
  };
};

export const hasAllSessionOutputLabels = (sessionData: MetricRecord) =>
  typeof sessionData.button_ui_label === 'string' &&
  typeof sessionData.keyboard_ui_label === 'string' &&
  typeof sessionData.navigation_ui_label === 'string' &&
  typeof sessionData.layout_ui_label === 'string' &&
  typeof sessionData.hand_ui_label === 'string' &&
  getRecord(sessionData.recommended_ui_profile).button_ui !== undefined;
