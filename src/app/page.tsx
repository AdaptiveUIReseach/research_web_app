"use client";

import React, { useState, useEffect } from "react";
import OnboardingForm from "../components/OnboardingForm";
import type { OnboardingData } from "../components/OnboardingForm";
import { signIn } from "../services/firebase";
import { createSession } from "../services/sessionStore";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const authenticateAndSetId = async () => {
      try {
        const user = await signIn();
        if (user) {
          setAuthUserId(user.uid);
          setAuthError(null); // Clear any previous auth errors on success
        } else {
          console.error("Auth init failed: User object is null/undefined.");
          setAuthError("Authentication failed: User object is null/undefined.");
        }
      } catch (err) {
        console.error("Auth init failed", err);
        setAuthError("Failed to initialize authentication. Please check your Firebase configuration and network connection.");
      }
    };
    authenticateAndSetId();
  }, []);

  const handleOnboardingComplete = async (formData: OnboardingData) => {
    if (!authUserId) return;
    try {
      const newSessionId = await createSession(authUserId, formData);
      router.push(`/session/${newSessionId}`);
    } catch (error: unknown) {
      console.error("Session creation failed", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to create session. Error: ${message}`);
    }
  };

  if (authError || !authUserId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          {authError ? (
            <span className="text-red-400 font-mono text-xs uppercase tracking-widest text-center">{authError}<br/>Check your connection or Firebase config.</span>
          ) : (
            <>
              <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-500 text-center">Initializing Secure<br/>Handshake...</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#020617] relative">
      <OnboardingForm onComplete={handleOnboardingComplete} />
    </div>
  );
}
