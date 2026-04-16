from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import json
import os

app = FastAPI(title="GGV Campus Navigator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load locations
LOCATIONS_PATH = os.path.join(os.path.dirname(__file__), "..", "locations.json")
with open(LOCATIONS_PATH, "r") as f:
    locations = json.load(f)

class RouteRequest(BaseModel):
    start_id: str
    end_id: str
    # New: Add support for raw coordinates if starting from current_location
    start_coords: list[float] = None # [lat, lng]

@app.get("/locations")
async def get_locations():
    return locations

@app.post("/route")
async def get_route(request: RouteRequest):
    # Determine start coordinates
    if request.start_coords:
        start_lat, start_lng = request.start_coords
    else:
        start_node = next((l for l in locations if l["id"] == request.start_id), None)
        if not start_node:
            raise HTTPException(status_code=404, detail="Start location not found")
        start_lat, start_lng = start_node["latitude"], start_node["longitude"]

    # Determine end coordinates
    end_node = next((l for l in locations if l["id"] == request.end_id), None)
    if not end_node:
        raise HTTPException(status_code=404, detail="End location not found")
    end_lat, end_lng = end_node["latitude"], end_node["longitude"]

    # Call OSRM API for road-based routing
    # OSRM uses {lng},{lat} format
    osrm_url = f"http://router.project-osrm.org/route/v1/foot/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=geojson"
    
    try:
        response = requests.get(osrm_url)
        data = response.json()
        
        if data["code"] != "Ok":
            raise HTTPException(status_code=400, detail="Could not calculate road-based route")
            
        # Extract waypoints from GeoJSON
        route_geojson = data["routes"][0]["geometry"]
        # Convert [lng, lat] to [lat, lng] for Leaflet
        waypoints = [[coord[1], coord[0]] for coord in route_geojson["coordinates"]]
        
        return {
            "path": waypoints,
            "distance": data["routes"][0]["distance"],
            "duration": data["routes"][0]["duration"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
