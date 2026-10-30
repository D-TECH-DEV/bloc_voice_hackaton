"use client";

import { useEffect, useRef } from "react";
import type { OrbMode } from "@/lib/esther-machine";

/** Palette BLOK par état : bleu commercial, vert validation, ambre traitement. */
const MODE_COLORS: Record<OrbMode, [string, string, string]> = {
  accueil: ["#0b5cad", "#39c2d7", "#0a2f4f"],
  connexion: ["#0b5cad", "#7fb3e8", "#0a2f4f"],
  ecoute: ["#1e7e34", "#7fe0a8", "#0b2e1a"],
  reflexion: ["#b7791f", "#f2c14e", "#3a2a08"],
  parole: ["#0b5cad", "#9be8ff", "#0a2f4f"],
  recherche: ["#6a4fb3", "#b9a7f2", "#241a4d"],
  devis: ["#1e7e34", "#a9e8c3", "#0b2e1a"],
  veille: ["#3d5a73", "#8fb8d8", "#101c26"],
  termine: ["#5b6470", "#b9c2cc", "#22282e"],
  erreur: ["#b3261e", "#f2a19b", "#3d0f0c"],
};

/**
 * Orb ESTHER : sphère lumineuse dessinée sur canvas (aucune image, aucun
 * avatar). L'amplitude respire avec `energy` (niveau audio réel du flux
 * actif) ; la teinte suit le mode. Mouvement réduit si
 * `prefers-reduced-motion` (halo statique).
 */
export function EstherOrb({ mode, energy }: { mode: OrbMode; energy: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ mode, energy });
  stateRef.current = { mode, energy };

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
      const { mode: m, energy: e } = stateRef.current;
      const [core, glow, deep] = MODE_COLORS[m];
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) * 0.26;
      const breathe = reduced ? 0 : Math.sin(t * 0.0016) * base * 0.05 + e * base * 0.35;
      const r = base + breathe;
      ctx.clearRect(0, 0, w, h);

      const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4);
      halo.addColorStop(0, glow + "55");
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      const sphere = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      sphere.addColorStop(0, "#ffffff");
      sphere.addColorStop(0.35, core);
      sphere.addColorStop(1, deep);
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Anneaux d'onde : écartement piloté par l'énergie réelle.
      ctx.strokeStyle = glow + "aa";
      for (let k = 1; k <= 3; k++) {
        const wobble = reduced ? 0 : Math.sin(t * 0.0022 + k * 1.7) * 3;
        ctx.lineWidth = 2.5 - k * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r + k * (10 + e * 26) + wobble, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Arc orbital (connexion / traitement).
      if (!reduced && (m === "connexion" || m === "reflexion" || m === "recherche" || m === "devis")) {
        const a0 = t * 0.002;
        ctx.strokeStyle = "#ffffffcc";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 8, a0, a0 + Math.PI * 0.7);
        ctx.stroke();
      }
      if (!reduced) {
        t += 16;
        raf = requestAnimationFrame(() => draw(canvas, ctx));
      }
    }

    function resize() {
      const c = canvasRef.current;
      const g = c?.getContext("2d");
      if (!c || !g) return;
      const rect = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(rect.width * dpr));
      c.height = Math.max(1, Math.round(rect.height * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) draw(c, g);
    }
    resize();
    window.addEventListener("resize", resize);
    if (!reduced && canvasEl && ctx2d) raf = requestAnimationFrame(() => draw(canvasEl, ctx2d));
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="esther-orb"
      role="img"
      aria-label={`ESTHER — état ${mode}`}
    />
  );
}
