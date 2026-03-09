// ============================================================================
//  VOICE BUTTON — Neo Matrix PRO++
//  Bouton unique de contrôle de la voix (Mute / Unmute)
// ============================================================================



export default function VoiceButton({
  muted,
  onToggle,
  onSpeak
}) {
  return (
    <div className="voice-btn-group">
      
      {/* AUTO ON / OFF */}
      <button
        className={`voice-btn ${muted ? "off" : "on"}`}
        title={muted ? "Activer la voix auto" : "Désactiver la voix auto"}
        onClick={onToggle}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* SPEAK NOW */}
      <button
        className="voice-btn speak-now"
        title="Lire maintenant"
        onClick={onSpeak}
      >
        🎙️
      </button>

    </div>
  );
}
