"use client";
import { useRef } from "react";
import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Plus, Trash, Navigation } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X } from "lucide-react";
// Custom tile layer for scaling local tiles

const doLineSegmentsIntersect = (
  start1: [number, number],
  end1: [number, number],
  start2: [number, number],
  end2: [number, number]
) => {
  const ccw = (A: [number, number], B: [number, number], C: [number, number]) => {
    return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
  };

  return ccw(start1, start2, end2) !== ccw(end1, start2, end2) && ccw(start1, end1, start2) !== ccw(start1, end1, end2);
};

const AnimatedVehicleMarker = ({ vehicle, icon, onIntersection }) => {
  const [currentPosition, setCurrentPosition] = useState(vehicle.position);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const startPositionRef = useRef(vehicle.position);

  useEffect(() => {
    if (startPositionRef.current === vehicle.position) return;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startPosition = currentPosition;
    const targetPosition = vehicle.position;
    startPositionRef.current = startPosition;
    startTimeRef.current = performance.now();

    const animationDuration = 6000; // Match server update interval

    const animate = (currentTime) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / animationDuration, 1);

      const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const newLat = startPosition[0] + (targetPosition[0] - startPosition[0]) * easeProgress;
      const newLng = startPosition[1] + (targetPosition[1] - startPosition[1]) * easeProgress;

      const newPosition = [newLat, newLng];
      setCurrentPosition(newPosition);

      // Check intersections with other vehicles
      onIntersection(vehicle.id, startPosition, newPosition);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [vehicle.position]);

  return <Marker position={currentPosition} icon={icon} zIndexOffset={1000} />;
};

function MapClickHandler() {
  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;

      // Get the zoom level
      const zoom = map.getZoom();

      // Calculate tile coordinates
      const tilePoint = map.project(e.latlng, zoom).divideBy(256).floor();
      const x = tilePoint.x;
      const y = tilePoint.y;

      console.log({
        clickCoordinates: { lat: lat.toFixed(6), lng: lng.toFixed(6) },
        tileCoordinates: { x, y, z: zoom },
        tileUrl: `/bangalore_tiles/${zoom}/${x}/${y}.png`,
      });
    },
  });
  return null;
}
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

interface ProximityAlertProps {
  message: string;
  onDismiss: () => void;
}

const ProximityAlert = ({ message, onDismiss }: ProximityAlertProps) => {
  return (
    <Alert className="mb-2 pr-8 relative">
      <AlertDescription>{message}</AlertDescription>
      <button onClick={onDismiss} className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded">
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
};

// Alerts container
interface AlertProps {
  id: number;
  message: string;
  timestamp: number;
}

interface AlertsContainerProps {
  alerts: AlertProps[];
  onDismiss: (id: number) => void;
}

const AlertsContainer = ({ alerts, onDismiss }: AlertsContainerProps) => {
  return (
    <div className="fixed top-4 right-4 z-50 w-80 space-y-2">
      {alerts.map((alert) => (
        <ProximityAlert key={alert.id} message={alert.message} onDismiss={() => onDismiss(alert.id)} />
      ))}
    </div>
  );
};

interface Circle {
  id: number;
  position: [number, number];
  name: string;
}

interface VehiclePosition {
  id: string | number;
  position: [number, number];
  timestamp: string;
}

const MapComponent = () => {
  const [position, setPosition] = useState<[number, number]>([13.132742830091999, 77.56889104945668]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<string | null>(null);
  const circleIdCounter = useRef(1);
  const websocket = useRef<WebSocket | null>(null);
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([
    { id: "1", position: [17.132742830091999, 77.56889104945668], timestamp: "2021-10-01T12:00:00Z" },
  ]);
  interface ProximityAlert {
    id: number;
    message: string;
    timestamp: number;
  }

  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const alertIdCounter = useRef(1);

  const currentVehiclePositions = useRef<{ [key: string]: [number, number] }>({});

  const checkPathIntersections = (vehicleId: string | number, start1: [number, number], end1: [number, number]) => {
    vehicles.forEach((otherVehicle) => {
      if (vehicleId === otherVehicle.id) return;

      const start2 = otherVehicle.position; // Last known position
      const end2 = currentVehiclePositions.current[otherVehicle.id]; // Current animated position

      if (start2 && end2 && doLineSegmentsIntersect(start1, end1, start2, end2)) {
        const alertId = alertIdCounter.current++;
        setProximityAlerts((prev) => [
          ...prev,
          {
            id: alertId,
            message: `Path of vehicle ${vehicleId} intersects with vehicle ${otherVehicle.id}`,
            timestamp: Date.now(),
          },
        ]);
      }
    });
  };

  const customCircleIcon = new L.DivIcon({
    className: "custom-icon",
    html: '<div class="w-5 h-5 bg-blue-500 rounded-full border border-white shadow-lg"></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const CircleIcon = new L.DivIcon({
    className: "icon",
    html: '<div class="w-5 h-5 bg-green-500 rounded-full border border-white shadow-lg"></div>',
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
      name: `Circle ${circleIdCounter.current}`,
    };
    setCircles((prevCircles) => [...prevCircles, newCircle]);
    circleIdCounter.current += 1;
  };

  const deleteSelectedCircle = () => {
    if (selectedCircle) {
      setCircles((prevCircles) => prevCircles.filter((circle) => circle.id.toString() !== selectedCircle));
      setSelectedCircle(null);
    }
  };

  const teleportToSelectedCircle = () => {
    if (selectedCircle) {
      const circle = circles.find((c) => c.id.toString() === selectedCircle);
      if (circle) {
        setPosition(circle.position);
      }
    }
  };

  const calculateDistance = (pos1: [number, number], pos2: [number, number]) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (pos1[0] * Math.PI) / 180;
    const φ2 = (pos2[0] * Math.PI) / 180;
    const Δφ = ((pos2[0] - pos1[0]) * Math.PI) / 180;
    const Δλ = ((pos2[1] - pos1[1]) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkProximity = useCallback(() => {
    const proximityThreshold = 50; // 50 meters
    const newAlerts = [];

    vehicles.forEach((vehicle1, i) => {
      vehicles.slice(i + 1).forEach((vehicle2) => {
        const distance = calculateDistance(vehicle1.position, vehicle2.position);

        if (distance < proximityThreshold) {
          const alertId = alertIdCounter.current++;
          newAlerts.push({
            id: alertId,
            message: `Vehicles ${vehicle1.id} and ${vehicle2.id} are within ${Math.round(distance)}m of each other`,
            timestamp: Date.now(),
          });
        }
      });
    });

    if (newAlerts.length > 0) {
      setProximityAlerts((prev) => [...prev, ...newAlerts]);
    }
  }, [vehicles]);

  // Dismiss alert
  const dismissAlert = (alertId) => {
    setProximityAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  // Auto-dismiss alerts after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setProximityAlerts((prev) => prev.filter((alert) => Date.now() - alert.timestamp < 5000));
    }, 5000);

    return () => clearTimeout(timeout);
  }, [proximityAlerts]);

  // Check proximity whenever vehicles update
  useEffect(() => {
    checkProximity();
  }, [vehicles, checkProximity]);

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

  useEffect(() => {
    websocket.current = new WebSocket("http://localhost:8765");

    websocket.current.onopen = () => {
      console.log("WebSocket Connected");
      // Request initial positions
      websocket.current?.send(
        JSON.stringify({
          type: "request_positions",
        })
      );
    };

    websocket.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received WebSocket message:", data.id);
      if (data.type === "initial_state" || data.type === "position_update" || data.id) {
        // Update vehicles state with the new positions
        if (Array.isArray(data.data)) {
          setVehicles(
            data.data.map((vehicle: any) => ({
              id: vehicle.id,
              position: vehicle.position,
              timestamp: vehicle.timestamp,
            }))
          );
        } else if (data.id && data.position) {
          console.log("Received WebSocket message:", data);
          // Single vehicle update
          setVehicles((prev) => {
            const newVehicles = prev.filter((v) => v.id !== data.id);
            console.log("new vehicles:", newVehicles);
            return [
              ...newVehicles,
              {
                id: data.id,
                position: data.position,
                timestamp: "2021-10-01T12:00:00Z",
              },
            ];
          });
        }
      }
    };

    websocket.current.onclose = () => {
      console.log("WebSocket Disconnected");
    };

    return () => {
      websocket.current?.close();
    };
  }, []);

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
      <AlertsContainer alerts={proximityAlerts} onDismiss={dismissAlert} />
      <MapContainer
        center={position}
        zoom={19}
        maxZoom={22}
        zoomSnap={0.17}
        zoomDelta={0.17}
        className="w-full h-full z-50"
      >
        <MapClickHandler />
        {/* <ChangeView center={position} /> */}
        <CustomTileLayer />

        {/* Main marker */}
        <Marker position={position} icon={customCircleIcon} />

        {/* Vehicle markers from WebSocket */}
        {vehicles.map((vehicle) => (
          <AnimatedVehicleMarker
            key={vehicle.id}
            vehicle={vehicle}
            icon={customCircleIcon}
            onIntersection={checkPathIntersections}
          />
        ))}

        {/* Spawned circles */}
        {circles.map((circle) => (
          <Marker key={circle.id} position={circle.position} icon={CircleIcon} />
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
              <ArrowDown className="h-4 w-4" />
            </Button>
            <div></div>
          </div>

          {/* Spawn button and circle controls */}
          <div className="space-y-2">
            <Button variant="outline" onClick={spawnNewCircle} className="w-full flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Spawn Circle
            </Button>

            <Select value={selectedCircle ? selectedCircle : ""} onValueChange={setSelectedCircle}>
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
