
import ExposureDonut from "../charts/ExposureDonut";
import "../../styles/stylesterminalMT5/exposuredistribution.css";


export default function ExposureDistribution({ exposureData = [] }) {
  return (
    <div className="dashboard-card dashboard-exposure">
      <div className="card-title">Exposure Distribution</div>

      <div className="donut-layout">
        {exposureData.length > 0 && (
          <ExposureDonut data={exposureData} />
        )}
      </div>
    </div>
  );
}
