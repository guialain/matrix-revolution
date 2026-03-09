
// chart (remonter à src/components)
import VerticalTube from "../charts/VerticalTube";

// styles (remonter à src/, puis stylespages)
import "../../styles/stylesterminalMT5/capitalallocation.css";

// ============================================================================
// Helpers couleurs (alignées Account Health)
// ============================================================================
function getAllocationColor(ratio, empty) {
  if (empty)        return "#555";       // classe inactive
  if (ratio >= 1)   return "#ff4d4d";    // FULL
  if (ratio >= 0.85) return "#f5c26b";   // NEAR
  return "#4cff9a";                      // OK
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function CapitalAllocationPanel({ allocation = [] }) {

  if (!Array.isArray(allocation)) {
    return (
      <div className="dashboard-card dashboard-allocation">
        <div className="card-title">Capital Allocation</div>
        <div className="allocation-empty">
          No allocation data
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card dashboard-allocation">
      <div className="card-title">Capital Allocation</div>

      <div className="allocation-tubes">
        {allocation.map(row => {
          const used = Math.min(Math.max(row.usedRatio ?? 0, 0), 1);
          const pct  = Math.round(used * 100);

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
  label={row.assetClass}
  value={used}
  displayValue={`${pct}%`}
  color={getAllocationColor(used, row.empty)}
  maxHeightRatio={row.heightRatio}   // 👈 ICI
/>

            </div>
          );
        })}
      </div>
    </div>
  );
}
