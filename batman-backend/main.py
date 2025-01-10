import asyncio
import json
import websockets
import logging
import ssl
import threading
from broadcast import Broadcast
from datetime import datetime
from typing import Set, Dict

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

vehicle_positions = {}

async def recv_broadcasts_bg():
    bdct = Broadcast()

    while True:
        data, addr = bdct.rxBroadcast(); 
        if data != -1:
            parsed_data = json.loads(data)
            v_id = parsed_data.get("id")
            if v_id or addr:
                lat = parsed_data.get("lat")
                long = parsed_data.get("long")
                vehicle_positions[v_id or addr] = (lat, long) 

class MapWebSocketServer:
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.connected_clients: Set[websockets.WebSocketServerProtocol] = set()
        
    async def register(self, websocket: websockets.WebSocketServerProtocol):
        """Register a new client connection"""
        self.connected_clients.add(websocket)
        logger.info(f"New client connected. Total clients: {len(self.connected_clients)}")
        
        # Send current vehicle positions to new client
        await websocket.send(json.dumps({
                "type": "initial_state",
                "data": [
                    {"id": 1, "position": [13.134104638498696, 77.56917072648946], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 2, "position": [13.131337084484583, 77.56861137245265], "timestamp": "2021-09-01T12:00:00"}
                ]
            }))
    
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
                    {"id": 1, "position": [13.134104638498696, 77.56917072648946], "timestamp": "2021-09-01T12:00:00"},
                    {"id": 2, "position": [13.131337084484583, 77.56861137245265], "timestamp": "2021-09-01T12:00:00"}
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
        """Periodically fetch and update vehicle positions."""
        while True:
            try:
                # Fetch new vehicle positions
                for vehicle_id, (latitude, longitude) in vehicle_positions.items():
                    # Update vehicle positions
                    await self.update_vehicle_position(vehicle_id, latitude, longitude)
            except Exception as e:
                logger.error(f"Error during periodic update: {str(e)}")
            # Wait for 1 second before the next update
            await asyncio.sleep(1)
    
    async def start_server(self):
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain('server.crt', 'server.key')

        """Start the WebSocket server with periodic updates."""
        asyncio.create_task(self.periodic_update())  # Schedule the periodic update

        async with websockets.serve(self.handler, self.host, self.port, ssl=ssl_context):
            logger.info(f"WebSocket server started on wss://{self.host}:{self.port}")
            await asyncio.Future()

# Example usage
if __name__ == "__main__":
    # Create and start the server
    server = MapWebSocketServer()

    # Start the broadcast receiver in a separate thread
    broadcast_thread = threading.Thread(target=recv_broadcasts_bg)
    broadcast_thread.start()

    # Run the server
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
