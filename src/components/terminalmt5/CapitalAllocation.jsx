import { useState, useEffect } from "react";
import VerticalTube from "../charts/VerticalTube";
import { CLASS_WEIGHTS, applyWeights } from "../robot/engines/trading/CapitalAllocation";
import "../../styles/stylesterminalMT5/capitalallocation.css";

// ============================================================================
// Helpers
// ============================================================================
function getAllocationColor(ratio, empty) {
  if (empty)        return "#555";
  if (ratio >= 1)   return "#ff4d4d";
  if (ratio >= 0.85) return "#f5c26b";
  return "#4cff9a";
}

const STORAGE_KEY = "neo_class_weights";

function loadSavedWeights() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch { /* ignore */ }
  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function CapitalAllocationPanel({ allocation = [] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  // Init draft from current CLASS_WEIGHTS
  useEffect(() => {
    const saved = loadSavedWeights();
    if (saved) {
      applyWeights(saved);
    }
    setDraft({ ...CLASS_WEIGHTS });
  }, []);

  const handleChange = (cls, val) => {
    const n = parseFloat(val);
    setDraft(d => ({ ...d, [cls]: isNaN(n) ? 0 : n }));
  };

  const totalPct = Object.values(draft).reduce((s, v) => s + (v || 0), 0);
  const totalValid = Math.abs(totalPct - 1) < 0.001;

  const handleValidate = () => {
    if (!totalValid) return;
    applyWeights(draft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({ ...CLASS_WEIGHTS });
    setEditing(false);
  };

  if (!Array.isArray(allocation)) {
    return (
      <div className="dashboard-card dashboard-allocation">
        <div className="card-title">Capital Allocation</div>
        <div className="allocation-empty">No allocation data</div>
      </div>
    );
  }

  return (
    <div className="dashboard-card dashboard-allocation">
      <div className="alloc-header">
        <span className="card-title">Capital Allocation</span>
        {!editing && (
          <button className="alloc-edit-btn" onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>

      {editing && (
        <div className="alloc-editor">
          <div className="alloc-inputs">
            {Object.keys(CLASS_WEIGHTS).map(cls => (
              <div key={cls} className="alloc-input-row">
                <span className="alloc-input-label">{cls}</span>
                <input
                  type="number"
                  className="alloc-input"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round((draft[cls] ?? 0) * 100)}
                  onChange={e => handleChange(cls, e.target.value / 100)}
                />
                <span className="alloc-input-pct">%</span>
              </div>
            ))}
          </div>
          <div className="alloc-editor-footer">
            <span className={`alloc-total ${totalValid ? "valid" : "invalid"}`}>
              Total: {Math.round(totalPct * 100)}%
            </span>
            <button className="alloc-cancel-btn" onClick={handleCancel}>Annuler</button>
            <button
              className="alloc-validate-btn"
              disabled={!totalValid}
              onClick={handleValidate}
            >Valider</button>
          </div>
        </div>
      )}

      <div className="allocation-tubes">
        {allocation.map(row => {
          const used = Math.min(Math.max(row.usedRatio ?? 0, 0), 1);
          const pct  = Math.round(used * 100);
          const weightPct = Math.round((row.weight ?? 0) * 100);

          return (
            <div
              key={row.assetClass}
              data-class={row.assetClass}
              className={`tube-wrapper ${row.empty ? "tube-empty" : ""}`}
              title={
                row.capacity
                  ? `${row.usedNotional.toFixed(0)} / ${row.capacity.toFixed(0)}`
                  : "No capacity"
              }
            >
              <VerticalTube
                label={`${row.assetClass} ${weightPct}%`}
                value={used}
                displayValue={`${pct}%`}
                color={getAllocationColor(used, row.empty)}
                maxHeightRatio={row.heightRatio}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
