"""
Unit tests for role-based authentication (Patient, Doctor, Clinician).

Tests:
1. Demo accounts endpoint returns all 3 primary roles.
2. Registration with patient, doctor, clinician roles.
3. Login success with matched role.
4. Role alignment enforcement (portal mismatch returns HTTP 403).
5. Invalid password rejection (HTTP 401).
6. Protected route access with JWT bearer token (/api/auth/me).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
import mongomock
import pytest

from auth import router, get_db, ensure_demo_users_in_db


@pytest.fixture
def mock_db():
    client = mongomock.MongoClient()
    db = client["cardioxai_test"]
    ensure_demo_users_in_db(db)
    return db


@pytest.fixture
def client(mock_db):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(app)


class TestDemoAccounts:
    def test_get_demo_accounts_returns_all_three_roles(self, client):
        response = client.get("/api/auth/demo-accounts")
        assert response.status_code == 200
        accounts = response.json()
        assert isinstance(accounts, list)
        roles = {acc["role"] for acc in accounts}
        assert "doctor" in roles
        assert "clinician" in roles
        assert "patient" in roles


class TestRoleRegistration:
    def test_register_patient(self, client):
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Alex Patient",
                "email": "alex.patient@example.com",
                "password": "Password123",
                "role": "patient",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "message" in data
        assert "Patient" in data["message"]

    def test_register_doctor(self, client):
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Dr. House",
                "email": "house@hospital.org",
                "password": "Password123",
                "role": "doctor",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "message" in data
        assert "Doctor" in data["message"]

    def test_register_clinician(self, client):
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Lab Specialist Reed",
                "email": "reed@lab.org",
                "password": "Password123",
                "role": "clinician",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "message" in data
        assert "Clinician" in data["message"]

    def test_register_duplicate_email_fails(self, client):
        client.post(
            "/api/auth/register",
            json={
                "name": "Jane User",
                "email": "duplicate@test.org",
                "password": "Password123",
                "role": "patient",
            },
        )
        # Attempt second registration with same email
        response = client.post(
            "/api/auth/register",
            json={
                "name": "Jane Another",
                "email": "duplicate@test.org",
                "password": "Password123",
                "role": "doctor",
            },
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()


class TestRoleLogin:
    def test_doctor_login_success(self, client):
        response = client.post(
            "/api/auth/login",
            json={
                "email": "doctor@cardioxai.org",
                "password": "Doctor@123",
                "role": "doctor",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "doctor"

    def test_clinician_login_success(self, client):
        response = client.post(
            "/api/auth/login",
            json={
                "email": "clinician@cardioxai.org",
                "password": "Clinician@123",
                "role": "clinician",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "clinician"

    def test_patient_login_success(self, client):
        response = client.post(
            "/api/auth/login",
            json={
                "email": "patient@cardioxai.org",
                "password": "Patient@123",
                "role": "patient",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "patient"

    def test_role_mismatch_returns_403(self, client):
        # Patient user trying to log into the Doctor portal
        response = client.post(
            "/api/auth/login",
            json={
                "email": "patient@cardioxai.org",
                "password": "Patient@123",
                "role": "doctor",
            },
        )
        assert response.status_code == 403
        detail = response.json()["detail"]
        assert "patient" in detail.lower()
        assert "doctor" in detail.lower()

    def test_invalid_password_returns_401(self, client):
        response = client.post(
            "/api/auth/login",
            json={
                "email": "doctor@cardioxai.org",
                "password": "WrongPassword999",
                "role": "doctor",
            },
        )
        assert response.status_code == 401

    def test_me_endpoint_with_bearer_token(self, client):
        login_res = client.post(
            "/api/auth/login",
            json={
                "email": "clinician@cardioxai.org",
                "password": "Clinician@123",
                "role": "clinician",
            },
        )
        token = login_res.json()["access_token"]

        me_res = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        user_info = me_res.json()
        assert user_info["role"] == "clinician"
        assert user_info["email"] == "clinician@cardioxai.org"

