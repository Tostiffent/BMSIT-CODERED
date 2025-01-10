import os
import requests
import time
from datetime import datetime
import logging

class OSMTileDownloader:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TileDownloader/1.0 (rayyaanf235@gmail.com)',  # Replace with your email
            'Accept': 'image/png',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        })
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            filename='tile_download.log'
        )
        self.logger = logging.getLogger('OSMTileDownloader')
        
        # Rate limiting parameters
        self.min_delay = 0.5  # Minimum delay between requests
        self.last_request_time = 0
        
    def _wait_for_rate_limit(self):
        """Ensure we don't exceed rate limits"""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time
        if time_since_last_request < self.min_delay:
            time.sleep(self.min_delay - time_since_last_request)
        self.last_request_time = time.time()

    def download_tile(self, z, x, y, save_path):
        """Download a single tile with proper rate limiting"""
        self._wait_for_rate_limit()
        
        url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        try:
            response = self.session.get(url, timeout=30)
            if response.status_code == 200:
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, 'wb') as file:
                    file.write(response.content)
                self.logger.info(f"Successfully downloaded tile: z={z}, x={x}, y={y}")
                return True
            else:
                self.logger.warning(f"Failed to download tile (status {response.status_code}): z={z}, x={x}, y={y}")
                if response.status_code in [429, 418]:
                    self.logger.info("Rate limit hit, increasing delay...")
                    time.sleep(5)  # Additional delay when rate limited
                return False
        except Exception as e:
            self.logger.error(f"Error downloading tile z={z}, x={x}, y={y}: {str(e)}")
            return False

    def lat_lon_to_tile(self, lat, lon, zoom):
        """Convert latitude/longitude to tile coordinates"""
        lat_rad = math.radians(lat)
        n = 2.0 ** zoom
        x = int((lon + 180.0) / 360.0 * n)
        y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
        return x, y

    def download_area(self, min_zoom, max_zoom, min_lat, max_lat, min_lon, max_lon, output_dir="tiles"):
        """Download all tiles for a given area"""
        total_tiles = 0
        downloaded_tiles = 0
        
        for z in range(min_zoom, max_zoom + 1):
            # Calculate tile coordinates for the bounding box
            x_min, y_max = self.lat_lon_to_tile(min_lat, min_lon, z)
            x_max, y_min = self.lat_lon_to_tile(max_lat, max_lon, z)
            
            # Ensure correct order
            x_min, x_max = min(x_min, x_max), max(x_min, x_max)
            y_min, y_max = min(y_min, y_max), max(y_min, y_max)
            
            level_tiles = (x_max - x_min + 1) * (y_max - y_min + 1)
            total_tiles += level_tiles
            
            self.logger.info(f"Starting zoom level {z} - {level_tiles} tiles to download")
            
            for x in range(x_min, x_max + 1):
                for y in range(y_min, y_max + 1):
                    save_path = os.path.join(output_dir, str(z), str(x), f"{y}.png")
                    
                    # Skip if tile already exists
                    if os.path.exists(save_path):
                        downloaded_tiles += 1
                        continue
                        
                    if self.download_tile(z, x, y, save_path):
                        downloaded_tiles += 1
                    
                    # Progress update
                    progress = (downloaded_tiles / total_tiles) * 100
                    self.logger.info(f"Progress: {progress:.1f}% ({downloaded_tiles}/{total_tiles} tiles)")

# Example usage
if __name__ == "__main__":
    import math  # Required for lat/lon conversion
    
    # Bangalore coordinates (approximately)
    min_lat, max_lat = 13.120240973282115, 13.147281011514035
    min_lon, max_lon = 77.5729400408967, 77.56802403246218
    
    downloader = OSMTileDownloader()
    downloader.download_area(
        min_zoom=0,
        max_zoom=19,  # Reduced max zoom to be more reasonable
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        output_dir="bangalore_tiles"
    )