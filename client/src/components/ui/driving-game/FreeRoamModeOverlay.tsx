import React from "react";

interface FreeRoamModeOverlayProps {
  isEnabled: boolean;
}

export function FreeRoamModeOverlay({ isEnabled }: FreeRoamModeOverlayProps) {
  if (!isEnabled) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "60px",
        left: "10px",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: 100,
        userSelect: "none",
        pointerEvents: "none", // Make sure overlay doesn't interfere with user interactions
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
        🎮 FREE ROAM MODE
      </div>
      <div style={{ marginBottom: "5px" }}>
        <span style={{ color: "#4CAF50" }}>W/A/S/D</span> - Move Camera
      </div>
      <div style={{ marginBottom: "5px" }}>
        <span style={{ color: "#4CAF50" }}>Q/E</span> - Rotate Camera
      </div>
      <div>
        <span style={{ color: "#4CAF50" }}>F</span> - Exit Free Roam
      </div>
    </div>
  );
}