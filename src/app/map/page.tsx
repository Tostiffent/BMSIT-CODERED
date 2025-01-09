"use client";
import { useRef } from "react";
import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Plus, Trash, Navigation } from "lucide-react";

// Custom tile layer for scaling local tiles
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

interface Circle {
  id: number;
  position: [number, number];
  name: string;
}

const MapComponent = () => {
  const [position, setPosition] = useState<[number, number]>([13.132742830091999, 77.56889104945668]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<string | null>(null);
  const circleIdCounter = useRef(1);

  const customCircleIcon = new L.DivIcon({
    className: "custom-icon",
    html: '<div class="w-5 h-5 bg-blue-500 rounded-full border border-white shadow-lg"></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const generateRandomPosition = () => {
    const radius = 0.001;
    const randomLat = position[0] + (Math.random() - 0.5) * radius * 2;
    const randomLng = position[1] + (Math.random() - 0.5) * radius * 2;
    return [randomLat, randomLng] as [number, number];
  };

  const spawnNewCircle = () => {
    const newCircle: Circle = {
      id: circleIdCounter.current,
      position: generateRandomPosition(),
      name: `Circle ${circleIdCounter.current}`
    };
    setCircles(prevCircles => [...prevCircles, newCircle]);
    circleIdCounter.current += 1;
  };

  const deleteSelectedCircle = () => {
    if (selectedCircle) {
      setCircles(prevCircles => prevCircles.filter(circle => circle.id.toString() !== selectedCircle));
      setSelectedCircle(null);
    }
  };

  const teleportToSelectedCircle = () => {
    if (selectedCircle) {
      const circle = circles.find(c => c.id.toString() === selectedCircle);
      if (circle) {
        setPosition(circle.position);
      }
    }
  };

  // Handle position updates with smooth animation
  const handleMove = (direction: string) => {
    const step = 0.0001; // Adjust step size for movement
    const duration = 200; // Animation duration in milliseconds
  
    setPosition(([currentLat, currentLng]) => {
      let targetLat = currentLat;
      let targetLng = currentLng;
  
      switch (direction) {
        case "up":
          targetLat += step;
          break;
        case "down":
          targetLat -= step;
          break;
        case "left":
          targetLng -= step;
          break;
        case "right":
          targetLng += step;
          break;
        default:
          break;
      }
  
      const startTime = performance.now();
  
      const animateMovement = (timestamp: number) => {
        const elapsedTime = timestamp - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
  
        const interpolatedLat = currentLat + progress * (targetLat - currentLat);
        const interpolatedLng = currentLng + progress * (targetLng - currentLng);
  
        setPosition([interpolatedLat, interpolatedLng]);
  
        if (progress < 1) {
          requestAnimationFrame(animateMovement);
        }
      };
  
      requestAnimationFrame(animateMovement);
  
      return [currentLat, currentLng];
    });
  };

  // Continuous movement for holding down W, A, S, D
  useEffect(() => {
    let movementInterval: NodeJS.Timeout | null = null;

    const startMoving = (direction: string) => {
      if (movementInterval) return;
      movementInterval = setInterval(() => handleMove(direction), 50);
    };

    const stopMoving = () => {
      if (movementInterval) {
        clearInterval(movementInterval);
        movementInterval = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case "w":
          startMoving("up");
          break;
        case "a":
          startMoving("left");
          break;
        case "s":
          startMoving("down");
          break;
        case "d":
          startMoving("right");
          break;
      }
    };

    const handleKeyUp = () => {
      stopMoving();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      stopMoving();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div className="w-full h-screen -z-[1]">
      <MapContainer center={position} zoom={19} maxZoom={22} zoomSnap={0.17} zoomDelta={0.17} className="w-full h-full z-50">
        <ChangeView center={position} />
        <CustomTileLayer />

        {/* Main marker */}
        <Marker position={position} icon={customCircleIcon} />

        {/* Spawned circles */}
        {circles.map((circle) => (
          <Marker 
            key={circle.id} 
            position={circle.position} 
            icon={customCircleIcon}
          />
        ))}
      </MapContainer>

      {/* Control Box */}
      <Card className="absolute bottom-4 right-4 p-2 z-50 bg-white/80 backdrop-blur-sm">
        <div className="space-y-4">
          {/* Movement controls */}
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
              <ArrowDown className="h-4 w-4"/>
            </Button>
            <div></div>
          </div>

          {/* Spawn button and circle controls */}
          <div className="space-y-2">
            <Button 
              variant="outline" 
              onClick={spawnNewCircle}
              className="w-full flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Spawn Circle
            </Button>

            <Select
              value={selectedCircle}
              onValueChange={setSelectedCircle}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a circle" />
              </SelectTrigger>
              <SelectContent>
                {circles.map((circle) => (
                  <SelectItem key={circle.id} value={circle.id.toString()}>
                    {circle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Circle action buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={deleteSelectedCircle}
                className="flex-1 flex items-center gap-2"
                disabled={!selectedCircle}
              >
                <Trash className="h-4 w-4" />
                Delete
              </Button>
              <Button 
                variant="outline" 
                onClick={teleportToSelectedCircle}
                className="flex-1 flex items-center gap-2"
                disabled={!selectedCircle}
              >
                <Navigation className="h-4 w-4" />
                Teleport
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MapComponent;