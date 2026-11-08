import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import bcrypt

_temp_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{(Path(_temp_dir.name) / 'auth-test.db').as_posix()}"
os.environ["APP_ACCESS_PIN_HASH"] = bcrypt.hashpw(b"test-preview-pin", bcrypt.gensalt()).decode("ascii")
os.environ["SESSION_SECRET"] = "test-session-secret-that-is-long-enough"
os.environ["COOKIE_SECURE"] = "false"
os.environ["GOOGLE_CLIENT_ID"] = "test-google-client.apps.googleusercontent.com"

from fastapi.testclient import TestClient
from app.database import engine
from app.main import app


class AuthFlowTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        engine.dispose()

    def test_pin_registration_login_and_profile_privacy(self):
        protected = self.client.get("/api/users/me")
        self.assertEqual(protected.status_code, 401)
        blocked_registration = self.client.post(
            "/api/auth/register",
            json={"email": "blocked@example.com", "username": "blocked-member", "password": "correct horse battery"},
        )
        self.assertEqual(blocked_registration.status_code, 401)

        rejected = self.client.post("/api/access/unlock", json={"pin": "wrong-pin"})
        self.assertEqual(rejected.status_code, 401)

        unlocked = self.client.post("/api/access/unlock", json={"pin": "test-preview-pin"})
        self.assertEqual(unlocked.status_code, 200)

        registered = self.client.post(
            "/api/auth/register",
            json={"email": "member@gmail.com", "username": "member-one", "password": "correct horse battery"},
        )
        self.assertEqual(registered.status_code, 200)
        user_id = registered.json()["id"]

        google_claims = {
            "sub": "google-account-subject-1",
            "email": "member@gmail.com",
            "email_verified": True,
            "name": "Member One",
            "picture": "https://example.com/member-photo.jpg",
        }
        with patch("app.main.id_token.verify_oauth2_token", return_value=google_claims):
            google_login = self.client.post("/api/auth/google", json={"credential": "signed-google-test-token"})
        self.assertEqual(google_login.status_code, 200)
        self.assertEqual(google_login.json()["id"], user_id)

        created_job = self.client.post(
            "/api/jobs",
            json={
                "title": "Create a new customer dashboard",
                "category": "Development",
                "description": "Build an accessible dashboard for our customers with responsive charts and a clear deployment handoff.",
                "budget": 1250,
            },
        )
        self.assertEqual(created_job.status_code, 201)
        self.assertEqual(created_job.json()["client_id"], user_id)
        self.assertEqual(created_job.json()["client"], "Member One")

        current_user = self.client.get("/api/users/me")
        self.assertEqual(current_user.status_code, 200)
        self.assertEqual(current_user.json()["email"], "member@gmail.com")

        updated = self.client.put(
            "/api/users/me",
            json={"full_name": "Member One", "location": "Toronto, Canada", "country": "Canada"},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["location"], "Toronto, Canada")
        self.assertEqual(updated.json()["full_name"], "Member One")
        self.assertTrue(updated.json()["google_linked"])

        public_profile = self.client.get(f"/api/users/{user_id}")
        self.assertEqual(public_profile.status_code, 200)
        self.assertEqual(public_profile.json()["location"], "Toronto, Canada")
        self.assertEqual(public_profile.json()["full_name"], "Member One")
        self.assertEqual(public_profile.json()["avatar_url"], "https://example.com/member-photo.jpg")
        self.assertNotIn("email", public_profile.json())
        self.assertNotIn("password_hash", public_profile.json())

        signed_out = self.client.post("/api/auth/logout")
        self.assertEqual(signed_out.status_code, 200)
        self.assertEqual(self.client.get("/api/users/me").status_code, 401)
        self.assertEqual(self.client.post("/api/access/unlock", json={"pin": "test-preview-pin"}).status_code, 200)
        saved_jobs = self.client.get("/api/jobs")
        self.assertEqual(saved_jobs.status_code, 200)
        self.assertEqual(len(saved_jobs.json()), 1)
        self.assertEqual(saved_jobs.json()[0]["id"], created_job.json()["id"])
        self.assertEqual(saved_jobs.json()[0]["client_id"], user_id)

        unlocked_again = self.client.post("/api/access/unlock", json={"pin": "test-preview-pin"})
        self.assertEqual(unlocked_again.status_code, 200)
        authenticated_again = self.client.post(
            "/api/auth/login",
            json={"identity": "member-one", "password": "correct horse battery"},
        )
        self.assertEqual(authenticated_again.status_code, 200)
        password_saved = self.client.put(
            "/api/users/me/password",
            json={"current_password": "correct horse battery", "new_password": "new secure password"},
        )
        self.assertEqual(password_saved.status_code, 200)
        self.client.post("/api/auth/logout")
        self.client.post("/api/access/unlock", json={"pin": "test-preview-pin"})
        login = self.client.post(
            "/api/auth/login",
            json={"identity": "member-one", "password": "new secure password"},
        )
        self.assertEqual(login.status_code, 200)
        bad_password = self.client.post(
            "/api/auth/login",
            json={"identity": "member-one", "password": "not-the-password"},
        )
        self.assertEqual(bad_password.status_code, 401)


if __name__ == "__main__":
    unittest.main()
