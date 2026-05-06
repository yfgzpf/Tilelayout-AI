import httpx
import sys

BASE = "http://127.0.0.1:8000"
passed = 0
failed = 0

def check(name, resp, key=None):
    global passed, failed
    if resp.status_code < 400:
        print(f"  PASS {name} -> {resp.status_code}")
        passed += 1
    else:
        print(f"  FAIL {name} -> {resp.status_code}: {resp.text[:100]}")
        failed += 1

# Health check
r = httpx.get(f"{BASE}/health")
check("GET /health", r)
assert r.json()['status'] == 'healthy'

# Root
r = httpx.get(f"{BASE}/")
check("GET /", r)

# Calculate layout
payload = {
    "config": {
        "tile_width": 800, "tile_height": 800,
        "gap_width": 3, "direction": "horizontal",
        "start_point": [0, 0]
    }
}
r = httpx.post(f"{BASE}/api/v1/projects/test123/calculate", json=payload)
check("POST /projects/{id}/calculate", r)
data = r.json()
assert data['success'] == True
assert data['data']['statistics']['total_tiles'] > 0
print(f"    tiles={data['data']['statistics']['total_tiles']} whole={data['data']['statistics']['whole_tiles']}")

# List projects
r = httpx.get(f"{BASE}/api/v1/projects/")
check("GET /projects", r)

# Create project
r = httpx.post(f"{BASE}/api/v1/projects/", json={
    "name": "测试客厅",
    "room_polygon": [[0,0],[3000,0],[3000,4000],[0,4000]]
})
check("POST /projects", r)
print(f"    created: {r.json()['data']['name']}")

# OpenAPI docs
r = httpx.get(f"{BASE}/api/openapi.json")
check("GET /api/openapi.json", r)
assert 'paths' in r.json()

print(f"\n=== RESULTS: {passed} passed, {failed} failed ===")
sys.exit(0 if failed == 0 else 1)
