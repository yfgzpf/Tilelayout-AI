"""API 集成测试"""
import pytest
import httpx

BASE = "http://127.0.0.1:8000"

@pytest.fixture
def client():
    return httpx.Client(base_url=BASE, timeout=10)

class TestHealthAPI:
    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert "version" in r.json()

    def test_openapi(self, client):
        r = client.get("/api/openapi.json")
        assert r.status_code == 200
        assert "paths" in r.json()

class TestProjectsAPI:
    def test_list_projects(self, client):
        r = client.get("/api/v1/projects/")
        assert r.status_code == 200

    def test_create_project(self, client):
        r = client.post("/api/v1/projects/", json={
            "name": "测试项目",
            "room_polygon": [[0,0],[3000,0],[3000,4000],[0,4000]]
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_create_project_validation(self, client):
        r = client.post("/api/v1/projects/", json={
            "name": "X",
            "room_polygon": [[0,0],[3000,0],[3000,4000],[0,4000]]
        })
        assert r.status_code == 400

    def test_calculate_layout(self, client):
        r = client.post("/api/v1/projects/test123/calculate", json={
            "config": {
                "tile_width": 800, "tile_height": 800,
                "gap_width": 3, "direction": "horizontal",
                "start_point": [0, 0]
            }
        })
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["data"]["statistics"]["total_tiles"] > 0

    def test_calculate_layout_invalid(self, client):
        r = client.post("/api/v1/projects/test123/calculate", json={
            "config": {
                "tile_width": -100, "tile_height": 800,
                "gap_width": 3, "direction": "horizontal",
                "start_point": [0, 0]
            }
        })
        assert r.status_code in (400, 500)

    def test_get_export_pdf(self, client):
        r = client.get("/api/v1/projects/test123/export/pdf")
        assert r.status_code == 200

    def test_get_export_ppt(self, client):
        r = client.get("/api/v1/projects/test123/export/ppt")
        assert r.status_code == 200

class TestAuthAPI:
    def test_register_short_phone(self, client):
        r = client.post("/api/v1/auth/register", json={
            "phone": "123", "password": "123456"
        })
        assert r.status_code in (400, 422)

    def test_login_invalid(self, client):
        r = client.post("/api/v1/auth/login", json={
            "phone": "99900000000", "password": "wrong"
        })
        assert r.status_code in (401, 422, 500)
