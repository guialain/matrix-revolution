import { useEffect, useRef, useState } from "react";

export default function useTrinityVoice({ valid = 0, wait = 0, topValid, muted = false }) {

  const prev = useRef({ valid: 0, wait: 0 });
  const lastSpoken = useRef(0);

  const [state, setState] = useState("idle");
  // idle | scan | alert

  useEffect(() => {

    if (typeof window === "undefined") return;

    const hasSpeech = "speechSynthesis" in window;
    if (!hasSpeech) return;

    const now = Date.now();

    const speak = (text) => {
      if (muted) return;
      if (now - lastSpoken.current < 8000) return;
      // Priorité LiveAIAnalysis : ne pas couper Claude en cours de parole
      if (window.__aiVoiceSpeaking) return;

      lastSpoken.current = now;
      window.speechSynthesis.cancel();

      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = "fr-FR";
      msg.rate = 1.0;
      msg.pitch = 0.78;
      msg.volume = 1.0;

      window.speechSynthesis.speak(msg);
    };

    const validIncreased = valid > prev.current.valid;
    const waitIncreased  = wait  > prev.current.wait;

    // ================= VISUAL STATE =================

    if (validIncreased && topValid) {
      setState("alert");
    }
    else if (waitIncreased) {
      setState("scan");
    }
    else if (valid === 0 && wait === 0) {
      setState("idle");
    }

    // ================= VOICE =================

    if (validIncreased && topValid) {

      const diff   = valid - prev.current.valid;
      const symbol = topValid?.symbol ?? "";
      const side   = topValid?.side ?? "";
      const score  = Number.isFinite(topValid?.score)
        ? Math.round(topValid.score)
        : "";

      speak(
        diff === 1
          ? `Opportunité validée prête pour dealing room. ${symbol}. ` +
            `${side}. Score ${score}.`
          : `${diff} nouvelles opportunités validées. ${symbol}.`
      );
    }
    // All cleared
    if (
      prev.current.valid > 0 &&
      valid === 0 &&
      wait === 0
    ) {
      speak("Aucune opportunité active. Marchés sous contrôle.");
    }

    prev.current = { valid, wait };

  }, [valid, wait, topValid]);

  return state;
}
