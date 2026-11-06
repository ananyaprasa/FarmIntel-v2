"""Google OIDC sign-in and FarmIntel's signed browser session."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import math
import os
import secrets
import time
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit
from urllib.request import Request as UrlRequest, urlopen

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response
from jose import JWTError, jwt
from pydantic import BaseModel
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

try:
    from database import MongoDBError, get_database
except ImportError:
    from backend.database import MongoDBError, get_database


_GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
_APP_TOKEN_ISSUER = "farmintel-api"
_APP_TOKEN_AUDIENCE = "farmintel-web"
_APP_TOKEN_ALGORITHM = "HS256"
_APP_SESSION_COOKIE = "farmintel_session"
_OAUTH_COOKIE_PATH = "/api/v1/auth/google"
_OAUTH_COOKIE_MAX_AGE = 300
_SESSION_MAX_AGE = 60 * 60
_MAX_TOKEN_RESPONSE_BYTES = 65_536
_MAX_CALLBACK_BODY_BYTES = 16_384


class AuthConfigurationError(ValueError):
    """Authentication settings are missing or invalid."""


class GoogleSignInError(RuntimeError):
    """A sanitized Google authorization or identity verification failure."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class AuthStorageError(RuntimeError):
    """The user identity could not be read from or written to MongoDB."""


@dataclass(frozen=True)
class AuthSettings:
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str
    frontend_origin: str
    signing_secret: str
    session_minutes: int

    @classmethod
    def from_env(
        cls, environ: Mapping[str, str] | None = None
    ) -> AuthSettings:
        settings = os.environ if environ is None else environ

        def required(name: str) -> str:
            value = (settings.get(name) or "").strip()
            if not value:
                raise AuthConfigurationError(f"{name} is required.")
            return value

        client_id = required("GOOGLE_CLIENT_ID")
        client_secret = required("GOOGLE_CLIENT_SECRET")
        redirect_uri = _validate_redirect_uri(required("GOOGLE_REDIRECT_URI"))
        frontend_origin = _validate_frontend_origin(
            required("FRONTEND_ORIGIN")
        )
        signing_secret = required("JWT_SECRET_KEY")
        if len(signing_secret.encode("utf-8")) < 32:
            raise AuthConfigurationError(
                "JWT_SECRET_KEY must contain at least 32 bytes."
            )

        algorithm = (settings.get("JWT_ALGORITHM") or _APP_TOKEN_ALGORITHM).strip()
        if algorithm != _APP_TOKEN_ALGORITHM:
            raise AuthConfigurationError(
                f"JWT_ALGORITHM must be {_APP_TOKEN_ALGORITHM}."
            )

        try:
            session_minutes = int(settings.get("JWT_EXPIRE_MINUTES", "30"))
        except ValueError:
            raise AuthConfigurationError(
                "JWT_EXPIRE_MINUTES must be an integer from 5 to 60."
            ) from None
        if not 5 <= session_minutes <= 60:
            raise AuthConfigurationError(
                "JWT_EXPIRE_MINUTES must be an integer from 5 to 60."
            )

        allowed_origins = {
            item.strip().rstrip("/")
            for item in (settings.get("CORS_ORIGINS") or "").split(",")
            if item.strip()
        }
        if "*" in allowed_origins or frontend_origin not in allowed_origins:
            raise AuthConfigurationError(
                "CORS_ORIGINS must include FRONTEND_ORIGIN and cannot use '*'."
            )

        return cls(
            google_client_id=client_id,
            google_client_secret=client_secret,
            google_redirect_uri=redirect_uri,
            frontend_origin=frontend_origin,
            signing_secret=signing_secret,
            session_minutes=session_minutes,
        )


class AuthenticatedUser(BaseModel):
    id: str
    email: str | None = None
    display_name: str | None = None


def _validate_origin(value: str, setting_name: str) -> str:
    try:
        parsed = urlsplit(value)
        parsed.port
    except ValueError:
        raise AuthConfigurationError(f"{setting_name} is invalid.") from None
    is_local_http = parsed.scheme == "http" and parsed.hostname in {
        "localhost",
        "127.0.0.1",
        "::1",
    }
    if (
        parsed.scheme != "https"
        and not is_local_http
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
    ):
        raise AuthConfigurationError(
            f"{setting_name} must be an HTTPS origin (HTTP is allowed only for localhost)."
        )
    return urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))


def _validate_frontend_origin(value: str) -> str:
    return _validate_origin(value, "FRONTEND_ORIGIN")


def _validate_redirect_uri(value: str) -> str:
    try:
        parsed = urlsplit(value)
        parsed.port
    except ValueError:
        raise AuthConfigurationError("GOOGLE_REDIRECT_URI is invalid.") from None
    is_local_http = parsed.scheme == "http" and parsed.hostname in {
        "localhost",
        "127.0.0.1",
        "::1",
    }
    if (
        parsed.scheme != "https"
        and not is_local_http
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path != "/api/v1/auth/google/callback"
        or parsed.query
        or parsed.fragment
    ):
        raise AuthConfigurationError(
            "GOOGLE_REDIRECT_URI must be an HTTPS Google callback URL "
            "(HTTP is allowed only for localhost)."
        )
    return value


def _oauth_cookie_options() -> dict[str, Any]:
    return {
        "httponly": True,
        "secure": True,
        "samesite": "none",
        "path": _OAUTH_COOKIE_PATH,
        "max_age": _OAUTH_COOKIE_MAX_AGE,
    }


def _set_oauth_cookie(response: RedirectResponse, name: str, value: str) -> None:
    response.set_cookie(name, value, **_oauth_cookie_options())


def _clear_oauth_cookies(response: RedirectResponse) -> None:
    for name in (
        "farmintel_oauth_state",
        "farmintel_oauth_nonce",
        "farmintel_oauth_verifier",
    ):
        response.delete_cookie(
            name,
            path=_OAUTH_COOKIE_PATH,
            secure=True,
            httponly=True,
            samesite="none",
        )


def start_google_sign_in() -> RedirectResponse:
    settings = AuthSettings.from_env()
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "response_mode": "form_post",
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    response = RedirectResponse(
        f"{_GOOGLE_AUTHORIZE_URL}?{query}", status_code=status.HTTP_302_FOUND
    )
    _set_oauth_cookie(response, "farmintel_oauth_state", state)
    _set_oauth_cookie(response, "farmintel_oauth_nonce", nonce)
    _set_oauth_cookie(response, "farmintel_oauth_verifier", verifier)
    return response


def _validate_oauth_state(request_state: str, cookie_state: str) -> None:
    if not request_state or not cookie_state or not secrets.compare_digest(
        request_state, cookie_state
    ):
        raise GoogleSignInError("Google sign-in state validation failed.")


def _exchange_google_code_sync(
    code: str, verifier: str, settings: AuthSettings
) -> str:
    body = urlencode(
        {
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        }
    ).encode("ascii")
    request = UrlRequest(
        _GOOGLE_TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=5) as response:
            if response.status != 200:
                raise GoogleSignInError(
                    "Google sign-in could not be completed.", 502
                )
            response_body = response.read(_MAX_TOKEN_RESPONSE_BYTES + 1)
        if len(response_body) > _MAX_TOKEN_RESPONSE_BYTES:
            raise GoogleSignInError(
                "Google sign-in could not be completed.", 502
            )
        token_response = json.loads(response_body)
    except GoogleSignInError:
        raise
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        raise GoogleSignInError(
            "Google sign-in could not be completed.", 502
        ) from None

    if not isinstance(token_response, dict):
        raise GoogleSignInError("Google sign-in could not be completed.", 502)
    identity_token = token_response.get("id_token")
    if not isinstance(identity_token, str) or not identity_token:
        raise GoogleSignInError("Google sign-in could not be completed.", 502)
    return identity_token


async def _read_callback_body(request: Request) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > _MAX_CALLBACK_BODY_BYTES:
                raise GoogleSignInError(
                    "Google sign-in callback was invalid.", 413
                )
        except ValueError:
            raise GoogleSignInError(
                "Google sign-in callback was invalid."
            ) from None

    chunks = []
    total_bytes = 0
    async for chunk in request.stream():
        total_bytes += len(chunk)
        if total_bytes > _MAX_CALLBACK_BODY_BYTES:
            raise GoogleSignInError(
                "Google sign-in callback was invalid.", 413
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def _exchange_google_code(
    code: str, verifier: str, settings: AuthSettings
) -> str:
    return await asyncio.to_thread(
        _exchange_google_code_sync, code, verifier, settings
    )


def _verify_google_token_sync(
    identity_token: str, audience: str
) -> Mapping[str, Any]:
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import id_token

    class BoundedGoogleRequest:
        def __init__(self) -> None:
            self._request = GoogleRequest()

        def __call__(self, url: str, **kwargs: Any) -> Any:
            kwargs.setdefault("timeout", 5)
            return self._request(url, **kwargs)

    return id_token.verify_oauth2_token(
        identity_token, BoundedGoogleRequest(), audience=audience
    )


async def verify_google_identity_token(
    identity_token: str, settings: AuthSettings, expected_nonce: str
) -> Mapping[str, Any]:
    try:
        from google.auth.exceptions import GoogleAuthError

        claims = await asyncio.to_thread(
            _verify_google_token_sync, identity_token, settings.google_client_id
        )
    except ImportError:
        raise AuthConfigurationError(
            "The google-auth dependency is required for Google sign-in."
        ) from None
    except (GoogleAuthError, ValueError, TypeError, KeyError, OSError):
        raise GoogleSignInError(
            "Google identity token verification failed."
        ) from None

    issuer = claims.get("iss")
    audience = claims.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    expires_at = claims.get("exp")
    subject = claims.get("sub")
    nonce = claims.get("nonce")
    if (
        issuer not in _GOOGLE_ISSUERS
        or settings.google_client_id not in audiences
        or not isinstance(expires_at, (int, float))
        or isinstance(expires_at, bool)
        or not math.isfinite(expires_at)
        or expires_at <= time.time()
        or not isinstance(subject, str)
        or not subject
        or not isinstance(nonce, str)
        or not secrets.compare_digest(nonce, expected_nonce)
    ):
        raise GoogleSignInError(
            "Google identity token verification failed."
        )
    return claims


def _user_from_document(document: Mapping[str, Any]) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=str(document["_id"]),
        email=document.get("email")
        if isinstance(document.get("email"), str)
        else None,
        display_name=document.get("display_name")
        if isinstance(document.get("display_name"), str)
        else None,
    )


async def provision_google_user(
    database: Any, claims: Mapping[str, Any]
) -> AuthenticatedUser:
    subject = claims["sub"]
    identity = {"provider": "google", "subject": subject}
    identity_filter = {
        "identity.provider": "google",
        "identity.subject": subject,
    }
    users = database["users"]
    now = datetime.now(timezone.utc)

    profile: dict[str, str] = {}
    if claims.get("email_verified") is True and isinstance(claims.get("email"), str):
        profile["email"] = claims["email"]
    if isinstance(claims.get("name"), str) and claims["name"].strip():
        profile["display_name"] = claims["name"].strip()

    try:
        await users.create_index(
            [
                ("identity.provider", ASCENDING),
                ("identity.subject", ASCENDING),
            ],
            unique=True,
            name="unique_provider_subject",
        )
        document = await users.find_one_and_update(
            identity_filter,
            {
                "$set": {**profile, "updated_at": now},
                "$setOnInsert": {
                    "identity": identity,
                    "created_at": now,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        try:
            document = await users.find_one(identity_filter)
        except PyMongoError:
            raise AuthStorageError(
                "User identity storage is unavailable."
            ) from None
        if document is None:
            raise AuthStorageError(
                "User identity storage is unavailable."
            ) from None
    except PyMongoError:
        raise AuthStorageError("User identity storage is unavailable.") from None

    if document is None:
        raise AuthStorageError("User identity storage is unavailable.")
    return _user_from_document(document)


def create_application_token(
    user_id: str, settings: AuthSettings, now: datetime | None = None
) -> str:
    issued_at = now or datetime.now(timezone.utc)
    if issued_at.tzinfo is None:
        issued_at = issued_at.replace(tzinfo=timezone.utc)
    issued_timestamp = int(issued_at.timestamp())
    payload = {
        "sub": user_id,
        "iss": _APP_TOKEN_ISSUER,
        "aud": _APP_TOKEN_AUDIENCE,
        "iat": issued_timestamp,
        "nbf": issued_timestamp,
        "exp": issued_timestamp + settings.session_minutes * 60,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(
        payload, settings.signing_secret, algorithm=_APP_TOKEN_ALGORITHM
    )


def _decode_application_token(token: str, settings: AuthSettings) -> Mapping[str, Any]:
    return jwt.decode(
        token,
        settings.signing_secret,
        algorithms=[_APP_TOKEN_ALGORITHM],
        issuer=_APP_TOKEN_ISSUER,
        audience=_APP_TOKEN_AUDIENCE,
        options={
            "require_exp": True,
            "require_iat": True,
            "require_nbf": True,
            "require_iss": True,
            "require_aud": True,
            "require_sub": True,
            "require_jti": True,
        },
    )


async def complete_google_sign_in(request: Request) -> RedirectResponse:
    settings = AuthSettings.from_env()
    content_type = request.headers.get("content-type", "").split(";", 1)[0]
    if content_type.lower() != "application/x-www-form-urlencoded":
        raise GoogleSignInError("Google sign-in callback was invalid.")
    body = await _read_callback_body(request)
    try:
        form = parse_qs(
            body.decode("ascii"),
            keep_blank_values=True,
            strict_parsing=True,
            max_num_fields=8,
        )
    except (UnicodeDecodeError, ValueError):
        raise GoogleSignInError("Google sign-in callback was invalid.") from None

    def one_value(name: str) -> str:
        values = form.get(name, [])
        return values[0] if len(values) == 1 else ""

    code = one_value("code")
    request_state = one_value("state")
    response_issuer = one_value("iss")
    cookie_state = request.cookies.get("farmintel_oauth_state", "")
    nonce = request.cookies.get("farmintel_oauth_nonce", "")
    verifier = request.cookies.get("farmintel_oauth_verifier", "")
    _validate_oauth_state(request_state, cookie_state)
    if response_issuer and response_issuer not in _GOOGLE_ISSUERS:
        raise GoogleSignInError("Google sign-in response issuer was invalid.")
    if not code or not nonce or not verifier:
        raise GoogleSignInError("Google sign-in callback was invalid.")

    identity_token = await _exchange_google_code(code, verifier, settings)
    claims = await verify_google_identity_token(identity_token, settings, nonce)
    try:
        database = get_database(request)
        user = await provision_google_user(database, claims)
    except (MongoDBError, AuthStorageError):
        raise AuthStorageError("User identity storage is unavailable.") from None

    response = RedirectResponse(settings.frontend_origin, status_code=303)
    _clear_oauth_cookies(response)
    session_token = create_application_token(user.id, settings)
    response.set_cookie(
        _APP_SESSION_COOKIE,
        session_token,
        max_age=min(settings.session_minutes * 60, _SESSION_MAX_AGE),
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return response


async def get_current_user(request: Request) -> AuthenticatedUser:
    try:
        settings = AuthSettings.from_env()
    except AuthConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        ) from exc

    token = request.cookies.get(_APP_SESSION_COOKIE)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    try:
        claims = _decode_application_token(token, settings)
        subject = claims.get("sub")
        if not isinstance(subject, str):
            raise JWTError("invalid subject")
        user_id = ObjectId(subject)
    except (JWTError, InvalidId, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    try:
        database = get_database(request)
        document = await database["users"].find_one({"_id": user_id})
    except (MongoDBError, PyMongoError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        ) from None

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _user_from_document(document)


def logout_google_user(request: Request) -> Response:
    try:
        settings = AuthSettings.from_env()
    except AuthConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        ) from exc
    origin = request.headers.get("origin", "").rstrip("/")
    if not origin or not secrets.compare_digest(origin, settings.frontend_origin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid request origin.",
        )

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        _APP_SESSION_COOKIE,
        path="/",
        secure=True,
        httponly=True,
        samesite="none",
    )
    _clear_oauth_cookies(response)
    return response
