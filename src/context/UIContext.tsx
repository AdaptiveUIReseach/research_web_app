"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RecommendedUiProfile } from '../utils/uiLabels';

interface UIState {
  scale: number;
  fontSize: number;
  highContrast: boolean;
  handMode: 'left' | 'right' | 'none';
  simplified: boolean;
}

interface UIContextType {
  uiState: UIState;
  applyUIAdjustment: (label: string) => void;
  applyUIProfile: (profile: RecommendedUiProfile) => void;
  resetUI: () => void;
}

const defaultState: UIState = {
  scale: 1.0,
  fontSize: 16,
  highContrast: false,
  handMode: 'none',
  simplified: false,
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [uiState, setUiState] = useState<UIState>(defaultState);

  const applyUIAdjustment = (label: string) => {
    switch (label) {
      case 'Large_Button_UI':
        setUiState(prev => ({ ...prev, scale: 1.25 }));
        break;
      case 'Large_Font_UI':
        setUiState(prev => ({ ...prev, fontSize: 20 }));
        break;
      case 'Accessibility_UI':
        setUiState(prev => ({ ...prev, highContrast: true, scale: 1.1 }));
        break;
      case 'Simplified_UI':
        setUiState(prev => ({ ...prev, simplified: true }));
        break;
      case 'One_Hand_Right_UI':
        setUiState(prev => ({ ...prev, handMode: 'right' }));
        break;
      case 'One_Hand_Left_UI':
        setUiState(prev => ({ ...prev, handMode: 'left' }));
        break;
      case 'Adaptive_Navigation_UI':
        setUiState(prev => ({ ...prev, simplified: true }));
        break;
      default:
        setUiState(defaultState);
    }
  };

  const applyUIProfile = (profile: RecommendedUiProfile) => {
    setUiState(() => {
      const next = { ...defaultState };

      // Map button_ui -> scale
      if (profile.button_ui) {
        if (profile.button_ui === 'small_button_ui') next.scale = 0.85;
        else if (profile.button_ui === 'large_button_ui') next.scale = 1.25;
        else if (profile.button_ui === 'extra_large_button_ui') next.scale = 1.5;
      }

      // Map keyboard_ui -> fontSize
      if (profile.keyboard_ui) {
        if (profile.keyboard_ui === 'compact_keyboard_ui') next.fontSize = 14;
        else if (profile.keyboard_ui === 'large_keyboard_ui') next.fontSize = 20;
      }

      // Map navigation_ui -> simplified
      if (profile.navigation_ui) {
        if (profile.navigation_ui === 'simplified_navigation_ui') {
          next.simplified = true;
        }
      }

      // Map hand_ui -> handMode
      if (profile.hand_ui) {
        if (profile.hand_ui === 'left_hand_ui') next.handMode = 'left';
        else if (profile.hand_ui === 'right_hand_ui') next.handMode = 'right';
      }

      return next;
    });
  };

  const resetUI = () => setUiState(defaultState);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = `${uiState.fontSize * uiState.scale}px`;
      
      if (uiState.highContrast) {
        document.documentElement.style.filter = 'contrast(1.5) saturate(1.2)';
      } else {
        document.documentElement.style.filter = 'none';
      }

      if (uiState.simplified) {
        document.documentElement.classList.add('simplified-mode');
      } else {
        document.documentElement.classList.remove('simplified-mode');
      }

      if (uiState.handMode === 'left') {
        document.documentElement.classList.add('hand-mode-left');
        document.documentElement.classList.remove('hand-mode-right');
      } else if (uiState.handMode === 'right') {
        document.documentElement.classList.add('hand-mode-right');
        document.documentElement.classList.remove('hand-mode-left');
      } else {
        document.documentElement.classList.remove('hand-mode-left', 'hand-mode-right');
      }
    }
  }, [uiState]);

  return (
    <UIContext.Provider value={{ uiState, applyUIAdjustment, applyUIProfile, resetUI }}>
      <div className="h-full w-full transition-all duration-300">
        {children}
      </div>
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
