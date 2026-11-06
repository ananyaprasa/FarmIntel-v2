import asyncio
import base64
import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlencode, urlsplit
from unittest.mock import AsyncMock, MagicMock, patch

from bson import ObjectId
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID
from fastapi import HTTPException, Request
from google.auth.transport import requests as google_auth_requests
from jose import jwt
from jose.exceptions import JWTError
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from backend import main
from backend.database import MongoDBError
from backend.middleware import auth


AUTH_ENV = {
    "GOOGLE_CLIENT_ID": "test-client-id.apps.googleusercontent.com",
    "GOOGLE_CLIENT_SECRET": "test-google-client-secret",
    "GOOGLE_REDIRECT_URI": (
        "https://api.example.test/api/v1/auth/google/callback"
    ),
    "FRONTEND_ORIGIN": "https://app.example.test",
    "CORS_ORIGINS": "https://app.example.test",
    "JWT_SECRET_KEY": "a" * 64,
    "JWT_ALGORITHM": "HS256",
    "JWT_EXPIRE_MINUTES": "30",
}
GOOGLE_CLAIMS = {
    "iss": "https://accounts.google.com",
    "aud": AUTH_ENV["GOOGLE_CLIENT_ID"],
    "sub": "google-subject-123",
    "exp": 4_000_000_000,
    "iat": 1_900_000_000,
    "nonce": "expected-nonce",
    "email": "farmer@example.test",
    "email_verified": True,
    "name": "Demo Farmer",
}


def make_request(
    *,
    path="/api/v1/auth/google/callback",
    headers=(),
    body=b"",
    app=None,
):
    scope = {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": list(headers),
            "query_string": b"",
            "app": app or main.app,
            "server": ("test", 443),
            "client": ("127.0.0.1", 1234),
            "scheme": "https",
            "http_version": "1.1",
            "asgi": {"version": "3.0"},
            "router": None,
            "state": {},
            "extensions": {},
        }
    return Request(scope, _body_receiver(body))


def _body_receiver(body):
    sent = False

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    return receive


def auth_request_app(database=None, error=None):
    return SimpleNamespace(
        state=SimpleNamespace(mongo_database=database, mongo_error=error)
    )


class AuthConfigurationTests(unittest.TestCase):
    def test_missing_and_invalid_auth_configuration_fails_closed(self):
        required = (
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
            "GOOGLE_REDIRECT_URI",
            "FRONTEND_ORIGIN",
            "JWT_SECRET_KEY",
            "CORS_ORIGINS",
        )
        for name in required:
            with self.subTest(missing=name):
                values = dict(AUTH_ENV)
                values.pop(name)
                with self.assertRaises(auth.AuthConfigurationError):
                    auth.AuthSettings.from_env(values)

        invalid_values = (
            {"JWT_SECRET_KEY": "short"},
            {"JWT_ALGORITHM": "none"},
            {"JWT_EXPIRE_MINUTES": "1440"},
            {"CORS_ORIGINS": "*"},
            {"CORS_ORIGINS": "https://other.example.test"},
            {"GOOGLE_REDIRECT_URI": "https://attacker.example/callback"},
            {"FRONTEND_ORIGIN": "https://app.example.test/path"},
        )
        for invalid in invalid_values:
            with self.subTest(invalid=invalid):
                values = {**AUTH_ENV, **invalid}
                with self.assertRaises(auth.AuthConfigurationError):
                    auth.AuthSettings.from_env(values)


class GoogleIdentityVerificationTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048
        )
        name = x509.Name(
            [x509.NameAttribute(NameOID.COMMON_NAME, "Google test key")]
        )
        now = datetime.now(timezone.utc)
        certificate = (
            x509.CertificateBuilder()
            .subject_name(name)
            .issuer_name(name)
            .public_key(cls.private_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(days=1))
            .not_valid_after(now + timedelta(days=1))
            .sign(cls.private_key, hashes.SHA256())
        )
        cls.certificate_pem = certificate.public_bytes(
            serialization.Encoding.PEM
        ).decode("ascii")

    def signed_token(self, overrides=None, signer=None):
        claims = {
            **GOOGLE_CLAIMS,
            "exp": int(datetime.now(timezone.utc).timestamp()) + 300,
            "iat": int(datetime.now(timezone.utc).timestamp()),
            **(overrides or {}),
        }
        header = {"alg": "RS256", "kid": "test-key", "typ": "JWT"}
        pieces = [
            base64.urlsafe_b64encode(json.dumps(part).encode()).rstrip(b"=")
            for part in (header, claims)
        ]
        signing_input = b".".join(pieces)
        signature = (signer or self.private_key).sign(
            signing_input, padding.PKCS1v15(), hashes.SHA256()
        )
        return b".".join(
            (*pieces, base64.urlsafe_b64encode(signature).rstrip(b"="))
        ).decode("ascii")

    async def verify(self, token, nonce="expected-nonce"):
        cert_response = SimpleNamespace(
            status=200,
            data=json.dumps({"test-key": self.certificate_pem}).encode("ascii"),
        )

        class FakeGoogleRequest:
            def __call__(self, *args, **kwargs):
                return cert_response

        with (
            patch.object(
                google_auth_requests,
                "Request",
                return_value=FakeGoogleRequest(),
            ),
            patch.dict(os.environ, AUTH_ENV, clear=True),
        ):
            return await auth.verify_google_identity_token(
                token, auth.AuthSettings.from_env(), nonce
            )

    async def test_google_token_verifies_signature_issuer_audience_expiry_and_nonce(self):
        claims = await self.verify(self.signed_token())
        self.assertEqual(claims["sub"], GOOGLE_CLAIMS["sub"])

        wrong_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048
        )
        invalid_tokens = (
            (self.signed_token(signer=wrong_key), "signature"),
            (self.signed_token({"iss": "https://attacker.example"}), "issuer"),
            (self.signed_token({"aud": "another-client"}), "audience"),
            (
                self.signed_token(
                    {"exp": int(datetime.now(timezone.utc).timestamp()) - 60}
                ),
                "expiration",
            ),
        )
        for token, failure in invalid_tokens:
            with self.subTest(failure=failure):
                with self.assertRaises(auth.GoogleSignInError):
                    await self.verify(token)

        with self.assertRaises(auth.GoogleSignInError):
            await self.verify(self.signed_token(), nonce="different-nonce")

    async def test_oauth_state_mismatch_is_rejected(self):
        with self.assertRaises(auth.GoogleSignInError):
            auth._validate_oauth_state("attacker-state", "browser-state")

        auth._validate_oauth_state("same-state", "same-state")


class UserProvisioningTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.user_id = ObjectId()
        self.document = {
            "_id": self.user_id,
            "identity": {
                "provider": "google",
                "subject": GOOGLE_CLAIMS["sub"],
            },
            "email": GOOGLE_CLAIMS["email"],
            "display_name": GOOGLE_CLAIMS["name"],
        }
        self.users = MagicMock()
        self.users.create_index = AsyncMock(return_value="unique_provider_subject")
        self.users.find_one_and_update = AsyncMock(return_value=self.document)
        self.users.find_one = AsyncMock(return_value=self.document)
        self.database = MagicMock()
        self.database.__getitem__.return_value = self.users

    async def test_user_provisioning_is_idempotent_and_indexes_provider_subject(self):
        first = await auth.provision_google_user(self.database, GOOGLE_CLAIMS)
        second = await auth.provision_google_user(self.database, GOOGLE_CLAIMS)

        self.assertEqual(first.id, str(self.user_id))
        self.assertEqual(second.id, first.id)
        self.users.create_index.assert_awaited_with(
            [
                ("identity.provider", 1),
                ("identity.subject", 1),
            ],
            unique=True,
            name="unique_provider_subject",
        )
        update = self.users.find_one_and_update.call_args.args[1]
        self.assertEqual(
            update["$setOnInsert"]["identity"],
            {"provider": "google", "subject": GOOGLE_CLAIMS["sub"]},
        )
        self.assertNotIn("access_token", update["$set"])
        self.assertNotIn("refresh_token", update["$set"])

    async def test_concurrent_provisioning_resolves_to_same_identity(self):
        first, second = await asyncio.gather(
            auth.provision_google_user(self.database, GOOGLE_CLAIMS),
            auth.provision_google_user(self.database, GOOGLE_CLAIMS),
        )

        self.assertEqual(first.id, second.id)
        self.assertEqual(self.users.find_one_and_update.await_count, 2)

    async def test_duplicate_key_race_resolves_existing_user(self):
        self.users.find_one_and_update.side_effect = DuplicateKeyError(
            "duplicate identity"
        )

        result = await auth.provision_google_user(self.database, GOOGLE_CLAIMS)

        self.assertEqual(result.id, str(self.user_id))
        self.users.find_one.assert_awaited_once_with(
            {
                "identity.provider": "google",
                "identity.subject": GOOGLE_CLAIMS["sub"],
            }
        )

    async def test_unverified_email_is_not_persisted(self):
        claims = {**GOOGLE_CLAIMS, "email_verified": False}

        await auth.provision_google_user(self.database, claims)

        update = self.users.find_one_and_update.call_args.args[1]
        self.assertNotIn("email", update["$set"])

    async def test_mongodb_failure_is_sanitized(self):
        self.users.create_index.side_effect = ServerSelectionTimeoutError(
            "sensitive connection detail"
        )

        with self.assertRaises(auth.AuthStorageError) as raised:
            await auth.provision_google_user(self.database, GOOGLE_CLAIMS)

        self.assertNotIn("sensitive connection detail", str(raised.exception))


class ApplicationSessionTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_expired_malformed_and_invalid_signature_tokens_reject(self):
        user_doc = {"_id": ObjectId(), "display_name": "Demo"}
        users = MagicMock()
        users.find_one = AsyncMock(return_value=user_doc)
        database = {"users": users}
        app = auth_request_app(database)
        settings = auth.AuthSettings.from_env(AUTH_ENV)
        expired = auth.create_application_token(
            str(user_doc["_id"]),
            settings,
            datetime.now(timezone.utc) - timedelta(hours=2),
        )
        valid = auth.create_application_token(str(user_doc["_id"]), settings)
        parts = valid.split(".")
        invalid_signature = ".".join(
            (parts[0], parts[1], base64.urlsafe_b64encode(b"bad").decode().rstrip("="))
        )

        for token in ("", "malformed", expired, invalid_signature):
            with self.subTest(token=token[:12]):
                with (
                    patch.dict(os.environ, AUTH_ENV, clear=True),
                    self.assertRaises(HTTPException) as raised,
                ):
                    await auth.get_current_user(
                        make_request(
                            headers=(
                                (b"cookie", f"farmintel_session={token}".encode()),
                            ),
                            app=app,
                        )
                    )
                self.assertEqual(getattr(raised.exception, "status_code", None), 401)

    async def test_application_token_checks_issuer_and_audience(self):
        settings = auth.AuthSettings.from_env(AUTH_ENV)
        for claim, invalid_value in (
            ("iss", "other-issuer"),
            ("aud", "other-audience"),
        ):
            with self.subTest(claim=claim):
                payload = {
                    "sub": str(ObjectId()),
                    "iss": auth._APP_TOKEN_ISSUER,
                    "aud": auth._APP_TOKEN_AUDIENCE,
                    "iat": int(datetime.now(timezone.utc).timestamp()),
                    "nbf": int(datetime.now(timezone.utc).timestamp()),
                    "exp": int(datetime.now(timezone.utc).timestamp()) + 300,
                    "jti": "test-jti",
                }
                payload[claim] = invalid_value
                token = jwt.encode(payload, settings.signing_secret, algorithm="HS256")
                with self.assertRaises(JWTError):
                    auth._decode_application_token(token, settings)

    async def test_current_user_is_resolved_from_signed_session_subject(self):
        user_id = ObjectId()
        document = {
            "_id": user_id,
            "email": "farmer@example.test",
            "display_name": "Demo Farmer",
        }
        users = MagicMock()
        users.find_one = AsyncMock(return_value=document)
        database = {"users": users}
        settings = auth.AuthSettings.from_env(AUTH_ENV)
        token = auth.create_application_token(str(user_id), settings)
        request = make_request(
            headers=((b"cookie", f"farmintel_session={token}".encode()),),
            app=auth_request_app(SimpleNamespace(database=database)),
        )

        with patch.dict(os.environ, AUTH_ENV, clear=True):
            result = await auth.get_current_user(request)

        self.assertEqual(result.id, str(user_id))
        users.find_one.assert_awaited_once_with({"_id": user_id})

    async def test_unavailable_database_fails_closed(self):
        app = auth_request_app(
            error=MongoDBError("not_configured", "MONGODB_URI is required.")
        )
        user_id = ObjectId()
        settings = auth.AuthSettings.from_env(AUTH_ENV)
        token = auth.create_application_token(str(user_id), settings)
        request = make_request(
            headers=((b"cookie", f"farmintel_session={token}".encode()),),
            app=app,
        )

        with (
            patch.dict(os.environ, AUTH_ENV, clear=True),
            self.assertRaises(HTTPException) as raised,
        ):
            await auth.get_current_user(request)

        self.assertEqual(getattr(raised.exception, "status_code", None), 503)

    async def test_logout_requires_configured_frontend_origin(self):
        request = make_request(
            headers=((b"origin", b"https://attacker.example"),)
        )
        with patch.dict(os.environ, AUTH_ENV, clear=True):
            with self.assertRaises(HTTPException) as raised:
                auth.logout_google_user(request)
        self.assertEqual(raised.exception.status_code, 403)

        request = make_request(
            headers=((b"origin", AUTH_ENV["FRONTEND_ORIGIN"].encode()),)
        )
        with patch.dict(os.environ, AUTH_ENV, clear=True):
            response = auth.logout_google_user(request)
        self.assertEqual(response.status_code, 204)


class OAuthFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_start_uses_state_nonce_pkce_and_secure_temporary_cookies(self):
        with patch.dict(os.environ, AUTH_ENV, clear=True):
            response = auth.start_google_sign_in()

        query = parse_qs(urlsplit(response.headers["location"]).query)
        self.assertEqual(query["response_type"], ["code"])
        self.assertEqual(query["response_mode"], ["form_post"])
        self.assertEqual(query["code_challenge_method"], ["S256"])
        self.assertTrue(query["state"][0])
        self.assertTrue(query["nonce"][0])
        cookie_headers = [
            value.decode()
            for key, value in response.raw_headers
            if key.lower() == b"set-cookie"
        ]
        self.assertEqual(len(cookie_headers), 3)
        for cookie in cookie_headers:
            self.assertIn("HttpOnly", cookie)
            self.assertIn("Secure", cookie)
            self.assertIn("SameSite=none", cookie)

    async def test_callback_verifies_identity_provisions_user_and_sets_session_cookie(self):
        user_id = ObjectId()
        users = MagicMock()
        users.create_index = AsyncMock(return_value="unique_provider_subject")
        users.find_one_and_update = AsyncMock(
            return_value={
                "_id": user_id,
                "email": GOOGLE_CLAIMS["email"],
                "display_name": GOOGLE_CLAIMS["name"],
            }
        )
        database = {"users": users}
        app = auth_request_app(SimpleNamespace(database=database))
        body = urlencode(
            {"code": "one-time-google-code", "state": "browser-state"}
        ).encode("ascii")
        request = make_request(
            headers=(
                (b"content-type", b"application/x-www-form-urlencoded"),
                (
                    b"cookie",
                    b"farmintel_oauth_state=browser-state; "
                    b"farmintel_oauth_nonce=expected-nonce; "
                    b"farmintel_oauth_verifier=pkce-verifier",
                ),
            ),
            body=body,
            app=app,
        )

        with (
            patch.dict(os.environ, AUTH_ENV, clear=True),
            patch(
                "backend.middleware.auth._exchange_google_code",
                new=AsyncMock(return_value="verified-id-token"),
            ) as exchange,
            patch(
                "backend.middleware.auth.verify_google_identity_token",
                new=AsyncMock(return_value=GOOGLE_CLAIMS),
            ) as verify,
        ):
            response = await auth.complete_google_sign_in(request)

        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], AUTH_ENV["FRONTEND_ORIGIN"])
        self.assertNotIn("one-time-google-code", response.headers["location"])
        exchange.assert_awaited_once_with(
            "one-time-google-code", "pkce-verifier", auth.AuthSettings.from_env(AUTH_ENV)
        )
        verify.assert_awaited_once_with(
            "verified-id-token", auth.AuthSettings.from_env(AUTH_ENV), "expected-nonce"
        )
        session_cookie = next(
            value.decode()
            for key, value in response.raw_headers
            if key.lower() == b"set-cookie"
            and value.startswith(b"farmintel_session=")
        )
        self.assertIn("HttpOnly", session_cookie)
        self.assertIn("Secure", session_cookie)
        self.assertIn("SameSite=none", session_cookie)
        self.assertNotIn("google", session_cookie.lower())

    async def test_callback_state_mismatch_and_missing_database_fail_closed(self):
        body = urlencode({"code": "one-time-code", "state": "wrong"}).encode()
        request = make_request(
            headers=(
                (b"content-type", b"application/x-www-form-urlencoded"),
                (b"cookie", b"farmintel_oauth_state=expected"),
            ),
            body=body,
            app=auth_request_app(),
        )
        with patch.dict(os.environ, AUTH_ENV, clear=True):
            with self.assertRaises(auth.GoogleSignInError):
                await auth.complete_google_sign_in(request)

        body = urlencode({"code": "one-time-code", "state": "same"}).encode()
        request = make_request(
            headers=(
                (b"content-type", b"application/x-www-form-urlencoded"),
                (
                    b"cookie",
                    b"farmintel_oauth_state=same; "
                    b"farmintel_oauth_nonce=expected-nonce; "
                    b"farmintel_oauth_verifier=pkce-verifier",
                ),
            ),
            body=body,
            app=auth_request_app(
                error=MongoDBError("not_configured", "MONGODB_URI is required.")
            ),
        )
        with (
            patch.dict(os.environ, AUTH_ENV, clear=True),
            patch(
                "backend.middleware.auth._exchange_google_code",
                new=AsyncMock(return_value="verified-id-token"),
            ),
            patch(
                "backend.middleware.auth.verify_google_identity_token",
                new=AsyncMock(return_value=GOOGLE_CLAIMS),
            ),
            self.assertRaises(auth.AuthStorageError),
        ):
            await auth.complete_google_sign_in(request)


class AuthRouteRegressionTests(unittest.TestCase):
    def test_auth_routes_are_added_without_protecting_existing_public_features(self):
        routes = {
            route.path: route
            for route in main.app.routes
            if hasattr(route, "path")
        }
        self.assertIn("/api/v1/auth/google/start", routes)
        self.assertIn("/api/v1/auth/google/callback", routes)
        self.assertIn("/api/v1/auth/me", routes)
        self.assertIn("/api/v1/auth/logout", routes)
        current_user_dependencies = routes[
            "/api/v1/auth/me"
        ].dependant.dependencies
        self.assertTrue(
            any(
                dependency.call is auth.get_current_user
                for dependency in current_user_dependencies
            )
        )
        self.assertFalse(
            any(
                "allow_origin_regex" in middleware.kwargs
                for middleware in main.app.user_middleware
            )
        )
        for path in (
            "/api/v1/analyze/disease",
            "/api/v1/analyze/soil",
            "/api/v1/recommend/crop",
            "/api/v1/weather",
            "/api/v1/advice",
        ):
            with self.subTest(path=path):
                route = routes[path]
                self.assertFalse(
                    any(
                        dependency.call is auth.get_current_user
                        for dependency in route.dependant.dependencies
                    )
                )


if __name__ == "__main__":
    unittest.main()
