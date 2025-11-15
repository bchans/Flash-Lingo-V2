import React from "react";

interface LoadingScreenProps {
  isLoading: boolean;
  assetsLoaded: number;
  totalAssets: number;
}

export function LoadingScreen({
  isLoading,
  assetsLoaded,
  totalAssets,
}: LoadingScreenProps) {
  if (!isLoading) return null;
  
  const loadingPercentage = Math.round((assetsLoaded / totalAssets) * 100);
  
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundImage: "url('/flashhour_loadingscreen.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end", // Move elements to bottom
        alignItems: "center",
        zIndex: 10,
        padding: "0 0 5vh 0", // Add padding at the bottom
      }}
    >
      {/* Semi-transparent overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          zIndex: -1,
        }}
      />
      
      <div
        style={{
          color: "white",
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: "16px",
          textShadow: "0 2px 4px rgba(0,0,0,0.8)",
          zIndex: 2,
        }}
      >
        Loading 3D Driving Game...
      </div>
      <div
        style={{
          width: "80%",
          maxWidth: "300px",
          height: "20px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: `${loadingPercentage}%`,
            height: "100%",
            backgroundColor: "#4CAF50",
            borderRadius: "10px",
            transition: "width 0.3s ease-out",
          }}
        />
      </div>
      <div
        style={{
          color: "white",
          fontSize: "14px",
          marginTop: "8px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textShadow: "0 2px 4px rgba(0,0,0,0.8)",
          zIndex: 2,
        }}
      >
        <div>{loadingPercentage}%</div>
        <div style={{ marginTop: "4px", fontSize: "12px" }}>
          {assetsLoaded} of {totalAssets} assets loaded
        </div>
      </div>
    </div>
  );
}