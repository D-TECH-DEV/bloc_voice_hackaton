"use client";

import { useEffect, useRef, useState } from "react";

export interface Utterance {
  id: number;
  text: string;
  at: string;
}

/**
 * Transcription côté visiteur via la reconnaissance vocale du navigateur
 * (Web Speech API, Chrome/Edge). AUCUNE transcription des réponses d'ESTHER :
 * le moteur vocal ne fournit aucun flux de transcription — l'inventer serait
 * mensonger, la zone l'indique explicitement.
 */
export function useTranscript(active: boolean): {
  supported: boolean;
  utterances: Utterance[];
  listening: boolean;
} {
  const [supported] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return typeof w.SpeechRecognition === "function" || typeof w.webkitSpeechRecognition === "function";
  });
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (!active || !supported || typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => WebSpeechRecognizer;
      webkitSpeechRecognition?: new () => WebSpeechRecognizer;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    interface WebSpeechRecognizer {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start: () => void;
      stop: () => void;
    }
    const rec: WebSpeechRecognizer = new Ctor();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const finals: string[] = [];
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finals.push(r[0].transcript.trim());
      }
      if (finals.length > 0) {
        idRef.current += 1;
        const at = new Date().toLocaleTimeString("fr-FR");
        setUtterances((prev) => [...prev.slice(-9), { id: idRef.current, text: finals.join(" "), at }]);
      }
    };
    rec.onend = () => {
      // Reconnaissance navigateur : redémarrage si la conversation continue.
      try {
        if (recRef.current) rec.start();
      } catch {
        setListening(false);
      }
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
    return () => {
      recRef.current = null;
      try {
        rec.stop();
      } catch {
        /* arrêt idempotent */
      }
      setListening(false);
    };
  }, [active, supported]);

  return { supported, utterances, listening };
}
