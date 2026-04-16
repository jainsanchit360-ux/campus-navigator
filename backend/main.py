from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import networkx as nx
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

# Create expanded Graph
G = nx.Graph()
for loc in locations:
    G.add_node(loc["id"], pos=(loc["latitude"], loc["longitude"]), name=loc["name"])

# Expanded connections representing campus pathways
connections = [
    ("main_gate", "admin_block"),
    ("admin_block", "auditorium"),
    ("admin_block", "library"),
    ("admin_block", "management"),
    ("library", "it_dept"),
    ("it_dept", "pharmacy"),
    ("it_dept", "boys_hostel"),
    ("pharmacy", "girls_hostel"),
    ("management", "it_dept"),
    ("auditorium", "library"),
    ("girls_hostel", "boys_hostel"), 
    ("library", "management")
]

G.add_edges_from(connections)

class RouteRequest(BaseModel):
    start_id: str
    end_id: str

@app.get("/locations")
async def get_locations():
    return locations

@app.post("/route")
async def get_route(request: RouteRequest):
    if request.start_id not in G or request.end_id not in G:
        raise HTTPException(status_code=404, detail="Location not found")
    
    try:
        path = nx.shortest_path(G, source=request.start_id, target=request.end_id)
        path_coords = []
        for node_id in path:
            node = next(l for l in locations if l["id"] == node_id)
            path_coords.append({
                "latitude": node["latitude"],
                "longitude": node["longitude"],
                "name": node["name"]
            })
        return {"path": path_coords}
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=404, detail="No path found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
