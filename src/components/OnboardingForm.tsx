import React, { useState, useRef, useEffect } from "react";
import { serverTimestamp } from "firebase/firestore";
import { motion, Variants } from "framer-motion";
import {
  ChevronRight,
  Check,
  Activity,
  Heart,
  ChevronDown,
} from "lucide-react";

export interface OnboardingData {
  name: string;
  age: number;
  height_cm: number;
  weight_kg_approx: number;
  dominant_hand: string;
  gender: string;
  department: string;
  device_os: string;
  screen_width: number;
  screen_height: number;
  userAgent: string;
  timezone: string;
  created_at: ReturnType<typeof serverTimestamp>;
}

// Pre-defined departments list
const DEPARTMENTS = [
  "Engineering",
  "Science",
  "Arts & Humanities",
  "Social Sciences",
  "Medicine & Health",
  "Business",
  "Architecture",
  "Agriculture",
  "Fine Arts",
  "Other",
];

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
}

function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select faculty...",
  label,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prevValue, setPrevValue] = useState(value);
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setSearch(value);
  }

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        const exactMatch = options.find(
          (opt) => opt.toLowerCase() === search.trim().toLowerCase(),
        );
        if (exactMatch) {
          onChange(exactMatch);
          setSearch(exactMatch);
        } else {
          onChange(search.trim());
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [search, options, onChange]);

  const filteredOptions =
    search.trim() === ""
      ? options
      : options.filter((opt) =>
          opt.toLowerCase().includes(search.toLowerCase()),
        );

  const handleOptionClick = (option: string) => {
    onChange(option);
    setSearch(option);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {label && (
        <label className="text-[10px] font-medium text-sky-400/80 uppercase tracking-wider ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          required
          type="text"
          className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-900/50 border border-slate-800 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 outline-none transition-all text-sm placeholder:text-slate-600 text-white"
          placeholder={placeholder}
          value={search}
          onChange={handleInputChange}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsOpen(false);
            if (e.key === "Enter" && filteredOptions.length > 0) {
              if (isOpen) {
                handleOptionClick(filteredOptions[0]);
                e.preventDefault();
              }
            }
          }}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/95 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.7)] py-1 custom-scrollbar animate-in fade-in slide-in-from-top-1.5 duration-200">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleOptionClick(opt)}
                  className={`w-full px-4 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between transition-all duration-150 border-l-2 ${
                    isSelected
                      ? "bg-sky-500/10 text-sky-400 border-sky-400 font-semibold"
                      : "text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-white hover:border-slate-700/50"
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && (
                    <Check size={14} className="text-sky-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-xs text-slate-500 italic">
              No matching departments found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Snappy, fast-paced animations
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

export default function OnboardingForm({
  onComplete,
}: {
  onComplete: (data: OnboardingData) => Promise<void> | void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    height: "",
    weight_kg_approx: "",
    dominant_hand: "right",
    gender: "",
    department: "",
    consent: false,
  });

  const isFormValid =
    formData.name.trim() !== "" &&
    formData.age !== "" &&
    formData.weight_kg_approx !== "" &&
    formData.height !== "" &&
    formData.gender !== "" &&
    formData.department.trim() !== "" &&
    formData.consent;

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setLoading(true);

    try {
      let device_os = "Unknown";
      if (typeof window !== "undefined") {
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) device_os = "Android";
        else if (/ipad|iphone|ipod/i.test(ua)) device_os = "iOS";
        else if (/windows/i.test(ua)) device_os = "Windows";
        else if (/mac/i.test(ua)) device_os = "Mac";
      }

      // Parse height
      let height_cm = 0;
      if (formData.height.includes(".")) {
        const parts = formData.height.split(".");
        const ft = parseInt(parts[0], 10) || 0;
        const inch = parseInt(parts[1], 10) || 0;
        height_cm = Math.round((ft * 12 + inch) * 2.54);
      } else {
        const ft = parseInt(formData.height, 10) || 0;
        height_cm = Math.round(ft * 12 * 2.54);
      }

      const userData: OnboardingData = {
        name: formData.name,
        age: parseInt(formData.age, 10),
        height_cm: height_cm,
        weight_kg_approx: parseInt(formData.weight_kg_approx, 10),
        dominant_hand: formData.dominant_hand,
        gender: formData.gender,
        department: formData.department,
        device_os: device_os,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        created_at: serverTimestamp(),
      };
      await onComplete(userData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Something went wrong: ${message}. Please try again`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] flex items-center justify-center p-4 py-12 sm:py-0">
      <div className="w-full max-w-md relative">
        {/* Original aesthetic: translucent, bordered, compactly rounded */}
        <div className="glass p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl relative bg-slate-900/40 border border-white/5 backdrop-blur-md">
          {/* Subtle watermark clipped to the top-right rounded corner */}
          <div className="absolute top-0 right-0 w-48 h-48 overflow-hidden pointer-events-none rounded-tr-[1.5rem] sm:rounded-tr-[2rem]">
            <div className="absolute -top-10 -right-10 opacity-[0.015] text-sky-400">
              <Heart size={200} />
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4 sm:space-y-5 relative z-10"
          >
            {/* Header */}
            <motion.div
              variants={itemVariants}
              className="text-center pb-1 sm:pb-2"
            >
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-2 sm:mb-3">
                <Activity size={12} className="animate-pulse" />
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold">
                  Adaptive UI Research
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                Welcome.
              </h2>
              <p className="text-slate-400 text-[10px] sm:text-xs mt-1">
                Complete your profile to begin.
              </p>
            </motion.div>

            {/* Row 1: Name and Age */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:grid sm:grid-cols-3 gap-3"
            >
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[10px] font-medium text-sky-400/80 uppercase tracking-wider ml-1">
                  Student ID
                </label>
                <input
                  autoFocus
                  required
                  type="text"
                  className="w-full px-4 py-2.5 sm:py-2.5 rounded-xl bg-slate-900/50 border border-slate-800 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 outline-none transition-all text-sm placeholder:text-slate-600"
                  placeholder="2302XXX"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-1 space-y-1.5">
                <label className="text-[10px] font-medium text-sky-400/80 uppercase tracking-wider ml-1">
                  Age
                </label>
                <input
                  required
                  type="number"
                  placeholder="25"
                  className="w-full px-3 py-2.5 sm:py-2.5 rounded-xl bg-slate-900/50 border border-slate-800 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 outline-none transition-all text-sm text-center"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                />
              </div>
            </motion.div>

            {/* Row 2: Weight and Height */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:grid sm:grid-cols-2 gap-3"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-sky-400/80 uppercase tracking-wider ml-1">
                  Weight (kg)
                </label>
                <input
                  required
                  type="number"
                  placeholder="70"
                  className="w-full px-4 py-2.5 sm:py-2.5 rounded-xl bg-slate-900/50 border border-slate-800 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 outline-none transition-all text-sm text-center"
                  value={formData.weight_kg_approx}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weight_kg_approx: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-sky-400/80 uppercase tracking-wider ml-1">
                  Height (ft.in)
                </label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  placeholder="5.10"
                  className="w-full px-4 py-2.5 sm:py-2.5 rounded-xl bg-slate-900/50 border border-slate-800 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 outline-none transition-all text-sm text-center"
                  value={formData.height}
                  onChange={(e) =>
                    setFormData({ ...formData, height: e.target.value })
                  }
                />
              </div>
            </motion.div>

            {/* Row 3: Gender & Dominant Hand */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:grid sm:grid-cols-2 gap-3"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-sky-400/80 uppercase tracking-wider ml-1">
                  Gender
                </label>
                <div className="flex gap-2">
                  {["male", "female"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: g })}
                      className={`flex-1 py-2.5 rounded-xl border font-semibold capitalize transition-all duration-200 text-xs ${
                        formData.gender === g
                          ? "bg-sky-400 border-sky-300 text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                          : "bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-sky-400/80 uppercase tracking-wider ml-1">
                  Dominant Hand
                </label>
                <div className="flex gap-2">
                  {["left", "right"].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, dominant_hand: h })
                      }
                      className={`flex-1 py-2.5 rounded-xl border font-semibold capitalize transition-all duration-200 text-xs ${
                        formData.dominant_hand === h
                          ? "bg-sky-400 border-sky-300 text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                          : "bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Row 4: Department Combobox */}
            <motion.div variants={itemVariants}>
              <Combobox
                label="Faculty"
                options={DEPARTMENTS}
                value={formData.department}
                onChange={(val) =>
                  setFormData({ ...formData, department: val })
                }
              />
            </motion.div>

            {/* Consent */}
            <motion.label
              variants={itemVariants}
              className="flex items-start gap-3 p-3 bg-sky-400/5 border border-sky-400/10 rounded-xl cursor-pointer group transition-all hover:bg-sky-400/10 mt-2"
            >
              <div className="relative flex items-center mt-0.5">
                <input
                  type="checkbox"
                  className="peer appearance-none w-4 h-4 rounded bg-slate-900 border border-slate-700 checked:bg-sky-400 checked:border-sky-300 transition-all cursor-pointer"
                  checked={formData.consent}
                  onChange={(e) =>
                    setFormData({ ...formData, consent: e.target.checked })
                  }
                />
                <Check
                  size={10}
                  strokeWidth={3}
                  className="absolute left-[3px] text-slate-950 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  I agree
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  Data is anonymous. No identifiers are linked to your session.
                </span>
              </div>
            </motion.label>
          </motion.div>

          {/* Submit Button */}
          <div className="mt-6">
            <button
              disabled={loading || !isFormValid}
              onClick={handleSubmit}
              className={`w-full py-3.5 rounded-xl font-bold tracking-wide text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                loading
                  ? "bg-slate-800 text-slate-600"
                  : "bg-sky-400 text-slate-950 hover:bg-sky-300 active:scale-[0.98] shadow-lg shadow-sky-400/20 disabled:opacity-50 disabled:grayscale disabled:active:scale-100"
              }`}
            >
              {loading ? (
                <div className="animate-spin h-4 w-4 border-2 border-slate-600 border-t-slate-950 rounded-full" />
              ) : (
                <>
                  <span>Authorize & Begin</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
