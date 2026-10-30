"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type EnginePhase = "idle" | "connecting" | "live" | "ended" | "error";

export interface VoiceEngine {
  phase: EnginePhase;
  error: string | null;
  micOpen: boolean;
  micMuted: boolean;
  micLevel: number;
  remoteLevel: number;
  lastMicActiveAt: number;
  audioConnected: boolean;
  start: () => Promise<void>;
  toggleMute: () => void;
  end: () => void;
  attachAudio: (el: HTMLAudioElement | null) => void;
}

const MIC_THRESHOLD = 0.08;

function levelOf(analyser: AnalyserNode | null): number {
  if (!analyser) return 0;
  const buf = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  return Math.min(1, (sum / buf.length / 255) * 2);
}

async function waitForIceComplete(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      pc.onicegatheringstatechange = null;
      reject(new Error("La collecte ICE a pris trop de temps (réseau ?). Réessayez."));
    }, timeoutMs);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.onicegatheringstatechange = null;
        resolve();
      }
    };
  });
}

/**
 * Moteur vocal WebRTC : même protocole que le client historique
 * (`POST /session` puis `POST /session/{sid}/offer` vers le proxy Flask),
 * avec en plus : coupure micro, analyse du flux micro (écoute réelle) et
 * analyse du flux distant (parole réelle d'ESTHER), nettoyage complet.
 */
export function useVoiceEngine(voiceBaseUrl: string): VoiceEngine {
  const [phase, setPhase] = useState<EnginePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOpen, setMicOpen] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [remoteLevel, setRemoteLevel] = useState(0);
  const [lastMicActiveAt, setLastMicActiveAt] = useState(0);
  const [audioConnected, setAudioConnected] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const startingRef = useRef(false);
  const lastActiveRef = useRef(0);

  const cleanup = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    micTrackRef.current = null;
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* fermeture idempotente */
      }
      pcRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    micAnalyserRef.current = null;
    remoteAnalyserRef.current = null;
    if (audioElRef.current) audioElRef.current.srcObject = null;
    setMicOpen(false);
    setMicMuted(false);
    setMicLevel(0);
    setRemoteLevel(0);
    setAudioConnected(false);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (phase !== "live") return;
    const timer = setInterval(() => {
      const mic = levelOf(micAnalyserRef.current);
      const remote = levelOf(remoteAnalyserRef.current);
      setMicLevel(mic);
      setRemoteLevel(remote);
      if (mic > MIC_THRESHOLD) {
        lastActiveRef.current = Date.now();
        setLastMicActiveAt(lastActiveRef.current);
      }
    }, 125);
    return () => clearInterval(timer);
  }, [phase]);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setError(null);
    setPhase("connecting");
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          throw new Error("Accès au microphone refusé. Autorisez le micro dans le navigateur puis réessayez.");
        }
        if (name === "NotFoundError") throw new Error("Aucun microphone détecté sur cet appareil.");
        throw new Error("Microphone indisponible.");
      }
      micStreamRef.current = stream;
      micTrackRef.current = stream.getAudioTracks()[0] ?? null;
      setMicOpen(true);
      setMicMuted(false);

      let res: Response;
      try {
        res = await fetch(`${voiceBaseUrl}/session`, { method: "POST" });
      } catch {
        throw new Error("Serveur vocal injoignable. Vérifiez qu'il tourne sur " + voiceBaseUrl + ".");
      }
      const data = (await res.json().catch(() => null)) as {
        session_id?: string;
        ice_config?: RTCConfiguration | null;
      } | null;
      if (!res.ok) {
        throw new Error(
          (data as { error?: string } | null)?.error ?? `Échec de session (HTTP ${res.status}).`,
        );
      }
      const sessionId = data?.session_id;
      if (!sessionId) throw new Error("Session invalide reçue du serveur. Réessayez.");

      const pc = new RTCPeerConnection(data?.ice_config || undefined);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        try {
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          const micSrc = ctx.createMediaStreamSource(stream);
          const micAnalyser = ctx.createAnalyser();
          micAnalyser.fftSize = 512;
          micSrc.connect(micAnalyser);
          micAnalyserRef.current = micAnalyser;
        } catch {
          micAnalyserRef.current = null;
        }
      }

      pc.ontrack = (ev) => {
        const remote = ev.streams[0];
        if (audioElRef.current) audioElRef.current.srcObject = remote;
        if (audioCtxRef.current) {
          try {
            const src = audioCtxRef.current.createMediaStreamSource(remote);
            const analyser = audioCtxRef.current.createAnalyser();
            analyser.fftSize = 512;
            src.connect(analyser);
            remoteAnalyserRef.current = analyser;
          } catch {
            remoteAnalyserRef.current = null;
          }
        }
      };
      pc.onconnectionstatechange = () => {
        if (!pcRef.current) return;
        if (pc.connectionState === "connected") {
          setPhase("live");
          setAudioConnected(true);
        } else if (pc.connectionState === "failed") {
          setError("Connexion WebRTC interrompue (réseau ?). La session est fermée.");
          setPhase("error");
          cleanup();
        } else if (pc.connectionState === "closed" || pc.connectionState === "disconnected") {
          setPhase((p) => (p === "live" ? "ended" : p));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc, 10000);
      const desc = pc.localDescription;
      if (!desc) throw new Error("Négociation audio impossible. Réessayez.");
      let answerRes: Response;
      try {
        answerRes = await fetch(`${voiceBaseUrl}/session/${encodeURIComponent(sessionId)}/offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdp: desc.sdp, type: desc.type }),
        });
      } catch {
        throw new Error("Serveur injoignable pendant la négociation. Réessayez.");
      }
      const answer = (await answerRes.json().catch(() => null)) as {
        sdp?: string;
        type?: string;
        error?: string;
      } | null;
      if (!answerRes.ok) throw new Error(answer?.error ?? `Échec de négociation (HTTP ${answerRes.status}).`);
      if (!answer?.sdp) throw new Error("Réponse audio incomplète. Réessayez.");
      await pc.setRemoteDescription({ sdp: answer.sdp, type: (answer.type ?? "answer") as RTCSdpType });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
      cleanup();
    } finally {
      startingRef.current = false;
    }
  }, [cleanup, voiceBaseUrl]);

  const toggleMute = useCallback(() => {
    const track = micTrackRef.current;
    if (!track) return;
    track.enabled = !track.enabled;
    setMicMuted(!track.enabled);
    if (track.enabled) setMicOpen(true);
  }, []);

  const end = useCallback(() => {
    cleanup();
    setPhase("ended");
  }, [cleanup]);

  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    audioElRef.current = el;
  }, []);

  return {
    phase,
    error,
    micOpen,
    micMuted,
    micLevel,
    remoteLevel,
    lastMicActiveAt,
    audioConnected,
    start,
    toggleMute,
    end,
    attachAudio,
  };
}
