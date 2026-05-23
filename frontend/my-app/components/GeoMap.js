"use client";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { useState } from "react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function GeoMap({ points = [] }) {
  const [tooltip, setTooltip] = useState(null);

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-950 border border-gray-800" style={{ height: 420 }}>
      <ComposableMap projection="geoMercator" style={{ width: "100%", height: "100%" }}>
        <ZoomableGroup center={[20, 20]} zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography key={geo.rsmKey} geography={geo}
                  fill="#1f2937" stroke="#374151" strokeWidth={0.5}
                  style={{ default: { outline: "none" }, hover: { fill: "#374151", outline: "none" }, pressed: { outline: "none" } }}
                />
              ))
            }
          </Geographies>
          {points.map((p, i) => (
            <Marker key={i} coordinates={[p.lng, p.lat]}
              onMouseEnter={() => setTooltip(p)}
              onMouseLeave={() => setTooltip(null)}>
              <circle
                r={5}
                fill={p.status === "success" ? "#22c55e" : "#ef4444"}
                fillOpacity={0.8}
                stroke={p.status === "success" ? "#16a34a" : "#dc2626"}
                strokeWidth={1}
                style={{ cursor: "pointer" }}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div className="absolute top-4 left-4 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs pointer-events-none">
          <p className="text-white font-medium">{tooltip.user}</p>
          <p className="text-gray-400">{tooltip.location}</p>
          <p className={tooltip.status === "success" ? "text-green-400" : "text-red-400"}>{tooltip.status}</p>
          <p className="text-gray-500">{new Date(tooltip.timestamp).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
