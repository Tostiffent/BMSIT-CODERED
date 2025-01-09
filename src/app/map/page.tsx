"use client";
import { useRef } from "react";
import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

// Custom tile layer that handles local tiles with proper scaling
class LocalTileLayer extends L.TileLayer {
  getTileUrl(coords: any) {
    const maxNativeZoom = 19;
    if (coords.z <= maxNativeZoom) {
      return `/bangalore_tiles/${coords.z}/${coords.x}/${coords.y}.png`;
    }

    const zoomDiff = coords.z - maxNativeZoom;
    const scale = Math.pow(2, zoomDiff);
    const x = Math.floor(coords.x / scale);
    const y = Math.floor(coords.y / scale);

    return `/bangalore_tiles/${maxNativeZoom}/${x}/${y}.png`;
  }

  createTile(coords: any, done: any) {
    const tile = document.createElement("img");
    const maxNativeZoom = 19;

    tile.onload = () => {
      if (coords.z > maxNativeZoom) {
        const zoomDiff = coords.z - maxNativeZoom;
        const scale = Math.pow(2, zoomDiff);
        tile.style.transformOrigin = "top left";
        tile.style.transform = `scale(${scale})`;
        tile.style.imageRendering = "pixelated";
      }
      done(null, tile);
    };

    tile.onerror = () => {
      done("error loading tile");
    };

    tile.src = this.getTileUrl(coords);
    tile.style.width = "256px";
    tile.style.height = "256px";

    return tile;
  }
}

// Helper component to update map view
function ChangeView({ center }: any) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

// Custom TileLayer component
function CustomTileLayer() {
  const map = useMap();

  useEffect(() => {
    const localTileLayer = new LocalTileLayer("", {
      minZoom: 19,
      maxZoom: 22,
      maxNativeZoom: 19,
      tileSize: 256,
      errorTileUrl: "/path/to/error-tile.png",
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2,
    });

    localTileLayer.addTo(map);

    const style = document.createElement("style");
    style.textContent = `
      .leaflet-tile {
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      map.removeLayer(localTileLayer);
      document.head.removeChild(style);
    };
  }, [map]);

  return null;
}

const MapComponent = () => {
  const [position, setPosition] = useState([13.132742830091999, 77.56889104945668]);
  const [vehicles, setVehicles] = useState(new Map());

  const customCircleIcon = new L.DivIcon({
    className: "custom-icon",
    html: '<div class="w-5 h-5 bg-blue-500 rounded-full border border-white shadow-lg"></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  // WebSocket connection setup
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8765");

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
      ws.send(JSON.stringify({ type: "request_positions" }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(message);
        switch (message.type) {
          case "initial_state":
          case "position_update":
            handlePositionUpdates(message.data);
            break;
          default:
            console.warn("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const handlePositionUpdates = useCallback((data: any) => {
    if (Array.isArray(data)) {
      const newVehicles = new Map();
      data.forEach((vehicle) => {
        newVehicles.set(vehicle.id, vehicle);
      });
      setVehicles(newVehicles);
    } else {
      setVehicles((prev) => new Map(prev).set(data.id, data));
    }
  }, []);

  const handleMove = (direction: string) => {
    // Implement the logic to move the map based on the direction
    console.log(`Moving ${direction}`);
  };

  return (
    <div className="w-full h-screen -z-[1]">
      <MapContainer center={position} zoom={19} maxZoom={22} zoomSnap={0.17} zoomDelta={0.17} className="w-full h-full z-50">
        <ChangeView center={position} />
        <CustomTileLayer />

        {/* Main marker */}
        <Marker position={position} icon={customCircleIcon} />

        {/* Vehicle markers */}
        {Array.from(vehicles.values()).map((vehicle) => (
          <Marker key={vehicle.id} position={vehicle.position} icon={customCircleIcon} />
        ))}
      </MapContainer>

      {/* Control Box */}
      <Card
  className="absolute bottom-4 right-4 p-2 z-50 bg-white/80 backdrop-blur-sm pointer-events-none"
>
  <div className="grid grid-cols-3 gap-2 pointer-events-auto">
    <div></div>
    <Button variant="outline" size="icon" onClick={() => handleMove("up")}>
      <ArrowUp className="h-4 w-4" />
    </Button>
    <div></div>
    <Button variant="outline" size="icon" onClick={() => handleMove("left")}>
      <ArrowLeft className="h-4 w-4" />
    </Button>
    <div></div>
    <Button variant="outline" size="icon" onClick={() => handleMove("right")}>
      <ArrowRight className="h-4 w-4" />
    </Button>
    <div></div>
    <Button variant="outline" size="icon" onClick={() => handleMove("down")}>
      <ArrowDown className="h-4 w-4" />
    </Button>
    <div></div>
  </div>
</Card>

    </div>
  );
};

export default MapComponent;

