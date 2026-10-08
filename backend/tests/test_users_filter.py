import pytest
from fastapi.testclient import TestClient


def test_get_users_default(client: TestClient, auth_headers: dict, seed_users: dict):
    response = client.get("/api/v1/users", headers=auth_headers["admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "items" in data["data"]
    assert "pagination" in data["data"]
    assert len(data["data"]["items"]) >= 3


def test_get_users_search_by_name(client: TestClient, auth_headers: dict, seed_users: dict):
    search_name = seed_users["user"].name
    response = client.get(f"/api/v1/users?search={search_name}", headers=auth_headers["admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    items = data["data"]["items"]
    assert len(items) >= 1
    assert any(u["name"] == search_name for u in items)


def test_get_users_search_by_nik(client: TestClient, auth_headers: dict, seed_users: dict):
    search_nik = seed_users["admin"].nik
    response = client.get(f"/api/v1/users?search={search_nik}", headers=auth_headers["super_admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    items = data["data"]["items"]
    assert len(items) == 1
    assert items[0]["nik"] == search_nik


def test_get_users_filter_status(client: TestClient, auth_headers: dict, seed_users: dict):
    # Filter ACTIVE
    res_active = client.get("/api/v1/users?status=ACTIVE", headers=auth_headers["admin"])
    assert res_active.status_code == 200
    for u in res_active.json()["data"]["items"]:
        assert u["status"] == "ACTIVE"

    # Filter INACTIVE
    res_inactive = client.get("/api/v1/users?status=INACTIVE", headers=auth_headers["admin"])
    assert res_inactive.status_code == 200
    items = res_inactive.json()["data"]["items"]
    assert len(items) >= 1
    for u in items:
        assert u["status"] == "INACTIVE"


def test_get_users_filter_role(client: TestClient, auth_headers: dict, seed_users: dict):
    response = client.get("/api/v1/users?role=ADMIN", headers=auth_headers["super_admin"])
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) >= 1
    for u in items:
        assert u["role"] == "ADMIN"


def test_get_users_filter_certificate_status(client: TestClient, auth_headers: dict, seed_users: dict):
    response = client.get("/api/v1/users?certificate_status=ACTIVE", headers=auth_headers["admin"])
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) >= 2
    # Verify active certificate attached
    for u in items:
        if u["id"] in [str(seed_users["user"].id), str(seed_users["admin"].id)]:
            assert u["active_certificate"] is not None
            assert u["active_certificate"]["status"] == "ACTIVE"


def test_get_users_sort_name_asc_desc(client: TestClient, auth_headers: dict, seed_users: dict):
    res_asc = client.get("/api/v1/users?sort=name&order=asc", headers=auth_headers["admin"])
    assert res_asc.status_code == 200
    names_asc = [u["name"] for u in res_asc.json()["data"]["items"]]
    assert names_asc == sorted(names_asc)

    res_desc = client.get("/api/v1/users?sort=name&order=desc", headers=auth_headers["admin"])
    assert res_desc.status_code == 200
    names_desc = [u["name"] for u in res_desc.json()["data"]["items"]]
    assert names_desc == sorted(names_desc, reverse=True)


def test_get_users_sort_nearest_expiry(client: TestClient, auth_headers: dict, seed_users: dict):
    response = client.get("/api/v1/users?sort=nearest_expiry&order=asc", headers=auth_headers["admin"])
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    # User with nearest expiring cert should be earlier than the one with longer expiry
    user_idx = None
    admin_idx = None
    for idx, u in enumerate(items):
        if u["id"] == str(seed_users["user"].id):
            user_idx = idx
        elif u["id"] == str(seed_users["admin"].id):
            admin_idx = idx

    assert user_idx is not None
    assert admin_idx is not None
    assert user_idx < admin_idx  # regular user expires in 30d, admin in 630d


def test_get_users_pagination(client: TestClient, auth_headers: dict, seed_users: dict):
    res_page_1 = client.get("/api/v1/users?page=1&limit=2", headers=auth_headers["admin"])
    assert res_page_1.status_code == 200
    data_1 = res_page_1.json()["data"]
    assert len(data_1["items"]) == 2
    assert data_1["pagination"]["page"] == 1
    assert data_1["pagination"]["limit"] == 2
    assert data_1["pagination"]["total"] >= 4

    res_page_2 = client.get("/api/v1/users?page=2&limit=2", headers=auth_headers["admin"])
    assert res_page_2.status_code == 200
    data_2 = res_page_2.json()["data"]
    assert len(data_2["items"]) >= 1
    assert data_2["pagination"]["page"] == 2

    # Verify no item duplication across pages
    ids_page_1 = {u["id"] for u in data_1["items"]}
    ids_page_2 = {u["id"] for u in data_2["items"]}
    assert ids_page_1.isdisjoint(ids_page_2)


def test_get_users_forbidden_for_user(client: TestClient, auth_headers: dict):
    response = client.get("/api/v1/users", headers=auth_headers["user"])
    assert response.status_code == 403
