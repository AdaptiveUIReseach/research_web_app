"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SessionSummary from "../../../../components/SessionSummary";
import { signIn } from "../../../../services/firebase";

const getSessionId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

export default function SummaryPage() {
  const { id } = useParams();
  const [isAuth, setIsAuth] = useState(false);
  const sessionId = getSessionId(id);

  useEffect(() => {
    let isMounted = true;

    signIn()
      .then(() => {
        if (isMounted) setIsAuth(true);
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, []);

  if (!sessionId || !isAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#020617] relative">
      <SessionSummary sessionId={sessionId} />
    </div>
  );
}
