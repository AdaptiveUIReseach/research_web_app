import React from 'react';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useUI } from '../context/UIContext';
import { motion } from 'framer-motion';
import { X, Check, Laptop, Smartphone, Type, MousePointer2 } from 'lucide-react';

const UIOptions = [
  { id: 'Default_UI', label: 'Default Experience', icon: Laptop, desc: 'Standard layout and scaling' },
  { id: 'Large_Button_UI', label: 'Enhanced Targets', icon: MousePointer2, desc: 'Increased clickable area' },
  { id: 'Large_Font_UI', label: 'High Legibility', icon: Type, desc: 'Bold typography and larger text' },
  { id: 'Simplified_UI', label: 'Minimalist Mode', icon: Check, desc: 'Reduced cognitive complexity' },
  { id: 'One_Hand_Right_UI', label: 'Right-Hand Mode', icon: Smartphone, desc: 'Optimized for right-thumb reach' },
  { id: 'One_Hand_Left_UI', label: 'Left-Hand Mode', icon: Smartphone, desc: 'Optimized for left-thumb reach' },
  { id: 'Accessibility_UI', label: 'High Contrast', icon: Check, desc: 'Visual clarity boost' },
];

export default function Settings({ sessionId, currentAppliedUi, onClose }: { sessionId: string, currentAppliedUi: string | null, onClose: () => void }) {
  const { applyUIAdjustment, resetUI } = useUI();
  
  const handleApplyUi = async (uiId: string) => {
    const appliedValue = uiId === 'Default_UI' ? null : uiId;
    
    // Update Cloud
    await updateDoc(doc(db, `sessions/${sessionId}`), {
      applied_ui: appliedValue
    });

    // Apply Locally immediately
    if (appliedValue) applyUIAdjustment(uiId);
    else resetUI();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass p-6 sm:p-8 rounded-[2rem] shadow-2xl w-full max-w-lg relative overflow-hidden bg-slate-900 border-white/10"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Preferences</h2>
            <p className="text-slate-400 text-xs">Research environment tuning</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 rounded-xl text-slate-300 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {UIOptions.map(ui => {
            const isSelected = (currentAppliedUi === ui.id) || (ui.id === 'Default_UI' && !currentAppliedUi);
            const Icon = ui.icon;

            return (
              <button
                key={ui.id}
                onClick={() => handleApplyUi(ui.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all group ${
                  isSelected 
                    ? 'bg-sky-600 border-sky-400 text-white shadow-lg shadow-sky-500/20' 
                    : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:border-white/10'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-sky-500 text-white' : 'bg-slate-900 text-slate-500 group-hover:text-sky-400'}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs uppercase tracking-wide truncate">{ui.label}</div>
                  <div className={`text-xs mt-0.5 truncate ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>{ui.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        <button 
          onClick={onClose}
          className="mt-6 w-full py-3 bg-white text-slate-950 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-sky-50 transition-all shadow-lg"
        >
          Finalize Changes
        </button>
      </motion.div>
    </motion.div>
  );
}
