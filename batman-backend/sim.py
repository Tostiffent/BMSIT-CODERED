import asyncio
import json
import websockets
import logging
from broadcast import Broadcast
from datetime import datetime
from typing import Set, Dict
import random
import ssl

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# In the MapWebSocketSim class, modify the periodic_update method:

bdct_client = Broadcast()

# Update the WaypointManager class:
class WaypointManager:
    def __init__(self):
        # Define paths for each vehicle
        self.vehicle_paths = {
            1: [
                [13.135379905537818, 77.56909605703297]
            ],
            2: [
                [13.135225253691889, 77.56916901851365],
                [13.130204, 77.571351],
                [13.130326, 77.571583],
                [13.130471, 77.571223],
                [13.135225253691889, 77.56916901851365]
            ],
            3: [
                [13.135387669683919, 77.56871515177139],
                [13.135252, 77.569146],
                [13.135252, 77.569255],
                [13.134599, 77.569498],
                [13.134114, 77.572075],
                [13.131497, 77.571457],
                [13.131563, 77.571021],
                [13.131164, 77.570862],
                [13.130209, 77.571360],
                [13.130153, 77.571248],
                [13.135252, 77.569107]
            ],
            4: [
                [13.134432963671776, 77.56952104490269],
                [13.135415, 77.569070],
                [13.134432, 77.569130],
                [13.133922, 77.569039],
                [13.134077, 77.569501]
            ],
            5: [
                [13.134557599098008, 77.56946376046962]
            ]
        }
        
        # Keep track of current position index for each vehicle
        self.current_indices = {vehicle_id: 0 for vehicle_id in self.vehicle_paths.keys()}
        self.current_positions = {}

    def get_next_position(self, vehicle_id: int) -> list[float]:
        """Get the next position for a vehicle and update its index"""
        path = self.vehicle_paths[vehicle_id]
        if not path:
            return None

        current_index = self.current_indices[vehicle_id]
        position = path[current_index]
        
        # Update index for next time, wrapping around to 0 if we reach the end
        self.current_indices[vehicle_id] = (current_index + 1) % len(path)
        
        return position
    
async def fetch_vehicle_positions() -> Dict[int, list[float]]:
    """
    Fetches the next set of vehicle positions, cycling through waypoints for each vehicle
    Returns: Dictionary mapping vehicle IDs to their new positions
    """
    # Initialize WaypointManager if it doesn't exist
    if not hasattr(fetch_vehicle_positions, 'waypoint_manager'):
        fetch_vehicle_positions.waypoint_manager = WaypointManager()
    
    manager = fetch_vehicle_positions.waypoint_manager
    
    # Randomly select a vehicle to update
    available_vehicles = list(manager.vehicle_paths.keys())
    vehicle_id = random.choice(available_vehicles)
    
    # Get next position for selected vehicle
    position = manager.get_next_position(vehicle_id)
    if position:
        manager.current_positions[vehicle_id] = position
    
    return manager.current_positions

class MapWebSocketSim:
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.connected_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.update_task = None
        
    async def register(self, websocket: websockets.WebSocketServerProtocol):
        """Register a new client connection and start periodic updates if first client"""
        is_first_client = len(self.connected_clients) == 0
        self.connected_clients.add(websocket)
        logger.info(f"New client connected. Total clients: {len(self.connected_clients)}")
        
        # Send current vehicle positions to new client
        await websocket.send(json.dumps({
                "type": "initial_state",
                "data": [
                    {"id": 1, "position": [13.134407425677608, 77.56936729614509], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 2, "position": [13.135633790624643, 77.56791730038407], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 3, "position": [13.134933169146414, 77.56856909994178], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 4, "position": [13.135669510376736, 77.56915069919188], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 5, "position": [13.134405252127834, 77.5703374633789], "timestamp": "2021-09-01T12:00:00"},
                ]
            }))
            
        # Start periodic updates only for the first client
        if is_first_client:
            logger.info("First client connected. Starting periodic updates...")
            self.update_task = asyncio.create_task(self.periodic_update())
    
    async def unregister(self, websocket: websockets.WebSocketServerProtocol):
        """Unregister a client connection"""
        self.connected_clients.remove(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.connected_clients)}")
    
    async def broadcast_message(self, message: dict):
        """Broadcast a message to all connected clients"""
        print("sending loop", message)
        if self.connected_clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.connected_clients]
            )
        
        # Broadcasting to mesh network
        id = message["id"]
        lat = message["position"][0]
        long = message["position"][1]

        bdct_client.txBroadcast(json.dumps({"id": id, "lat": lat, "long": long}))
    
    async def update_vehicle_position(self, vehicle_id: str, latitude: float, longitude: float):
        """Update vehicle position and broadcast to clients"""
        await self.broadcast_message({
            "id": vehicle_id,
            "position": [latitude, longitude],
            "timestamp": datetime.now().isoformat()
        })
    
    async def handle_client_message(self, websocket: websockets.WebSocketServerProtocol, message: str):
        """Handle incoming messages from clients"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            print("Message type: ", message_type)
            if message_type == "request_positions":
                await websocket.send(json.dumps({
                    "type": "position_update",
                    "data": [
                    {"id": 1, "position": [13.134407425677608, 77.56936729614509], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 2, "position": [13.135633790624643, 77.56791730038407], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 3, "position": [13.134933169146414, 77.56856909994178], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 4, "position": [13.135669510376736, 77.56915069919188], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 5, "position": [13.134405252127834, 77.5703374633789], "timestamp": "2021-09-01T12:00:00"},
                ]
                }))
            
            elif message_type == "update_position":
                vehicle_data = data.get("data", {})
                await self.update_vehicle_position(
                    vehicle_data.get("id"),
                    vehicle_data.get("latitude"),
                    vehicle_data.get("longitude")
                )
            
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {message}")
        except Exception as e:
            logger.error(f"Error handling message: {str(e)}")
    
    async def handler(self, websocket: websockets.WebSocketServerProtocol):
        """Handle websocket connections"""
        await self.register(websocket)
        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed unexpectedly")
        finally:
            await self.unregister(websocket)
            
    async def periodic_update(self):
        """Continuously update vehicle positions in a random order"""
        while True:
            try:
                # Fetch new vehicle positions
                positions = await fetch_vehicle_positions()
                for vehicle_id, position in positions.items():
                    # Update vehicle positions
                    await self.update_vehicle_position(vehicle_id, position[0], position[1])
                    logger.info(f"Updated vehicle {vehicle_id} to position {position}")
                
                # Wait before next update
                await asyncio.sleep(3)
                    
            except Exception as e:
                logger.error(f"Error during periodic update: {str(e)}")
                await asyncio.sleep(1)
    
    
    async def start_server(self):
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain('server.crt', 'server.key')

        """Start the WebSocket server and wait for clients."""
        async with websockets.serve(self.handler, self.host, self.port, ssl=ssl_context):
            logger.info(f"WebSocket server started on wss://{self.host}:{self.port}")
            await asyncio.Future()  # Keep the server running

# Example usage
if __name__ == "__main__":
    # Create and start the server
    server = MapWebSocketSim(port=8766)
    
    # Run the server
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    
