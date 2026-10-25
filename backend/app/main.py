from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    supabase_url: str = ''
    supabase_publishable_key: str = ''
    cors_origins: str = 'http://localhost:8081,http://127.0.0.1:8081'


class MedicationInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    name: str = Field(min_length=1, max_length=100)
    dosage: str = Field(min_length=1, max_length=80)
    schedule: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=500)


class MedicationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid', strict=True)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    dosage: str | None = Field(default=None, min_length=1, max_length=80)
    schedule: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    pinned: bool | None = None

    @model_validator(mode='after')
    def require_nonempty_fields(self):
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError('Provide at least one non-null medication field to update.')
        return self


class Medication(MedicationInput):
    # The REST response contains user_id; never return that internal field.
    model_config = ConfigDict(extra='ignore')
    id: UUID
    pinned: bool
    created_at: datetime


class Identity(BaseModel):
    user_id: UUID
    token: str


bearer = HTTPBearer(auto_error=False)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with httpx.AsyncClient(timeout=10) as client:
            app.state.http = client
            yield

    app = FastAPI(title='Aloe API', version='0.1.0', lifespan=lifespan)
    app.add_middleware(CORSMiddleware,
                       allow_origins=[s.strip() for s in settings.cors_origins.split(',') if s.strip()],
                       allow_methods=['GET', 'POST', 'PATCH', 'DELETE'],
                       allow_headers=['Authorization', 'Content-Type'])

    async def supabase_request(request: Request, method: str, path: str, token: str, **kwargs) -> httpx.Response:
        if not settings.supabase_url or not settings.supabase_publishable_key:
            raise HTTPException(503, 'The backend Supabase connection is not configured.')
        try:
            response = await request.app.state.http.request(
                method, settings.supabase_url.rstrip('/') + path,
                headers={'apikey': settings.supabase_publishable_key,
                         'Authorization': f'Bearer {token}',
                         'Prefer': 'return=representation'}, **kwargs)
        except httpx.RequestError:
            raise HTTPException(503, 'Could not reach the database. Please try again.') from None
        if response.status_code in (401, 403):
            raise HTTPException(401 if path.startswith('/auth/') else 403,
                                'Your session is invalid. Reopen the app.' if path.startswith('/auth/') else 'You do not have access to this medication.')
        if response.status_code >= 400:
            # Do not expose upstream SQL, tokens, or private server diagnostics.
            raise HTTPException(503, 'The database is unavailable or needs the Aloe setup SQL.')
        return response

    async def identity(request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> Identity:
        if not credentials:
            raise HTTPException(401, 'Sign in to access your medications.', headers={'WWW-Authenticate': 'Bearer'})
        # Validate with Supabase Auth; never trust a decoded JWT or a client user_id.
        response = await supabase_request(request, 'GET', '/auth/v1/user', credentials.credentials)
        try:
            return Identity(user_id=response.json()['id'], token=credentials.credentials)
        except (ValueError, KeyError):
            raise HTTPException(401, 'Your session is invalid.') from None

    User = Annotated[Identity, Depends(identity)]
    table = '/rest/v1/aloe_medications'
    columns = 'id,name,dosage,schedule,description,pinned,created_at'

    @app.get('/health')
    async def health():
        return {'status': 'ok', 'database_configured': bool(settings.supabase_url and settings.supabase_publishable_key)}

    @app.get('/medications', response_model=list[Medication])
    async def list_medications(request: Request, user: User):
        response = await supabase_request(request, 'GET', table, user.token, params={
            'user_id': f'eq.{user.user_id}', 'select': columns, 'order': 'pinned.desc,created_at.asc,id.asc'})
        return response.json()

    @app.post('/medications', response_model=Medication, status_code=201)
    async def add_medication(body: MedicationInput, request: Request, user: User):
        response = await supabase_request(request, 'POST', table, user.token,
            json={**body.model_dump(exclude_unset=True), 'user_id': str(user.user_id)}, params={'select': columns})
        rows = response.json()
        if not rows:
            raise HTTPException(503, 'The medication was not saved. Please try again.')
        return rows[0]

    @app.patch('/medications/{medication_id}', response_model=Medication)
    async def update_medication(medication_id: UUID, body: MedicationUpdate, request: Request, user: User):
        response = await supabase_request(request, 'PATCH', table, user.token,
            params={'id': f'eq.{medication_id}', 'user_id': f'eq.{user.user_id}', 'select': columns},
            json=body.model_dump(exclude_unset=True))
        rows = response.json()
        if not rows:
            raise HTTPException(404, 'Medication not found.')
        return rows[0]

    @app.delete('/medications/{medication_id}', status_code=204)
    async def delete_medication(medication_id: UUID, request: Request, user: User):
        response = await supabase_request(request, 'DELETE', table, user.token,
            params={'id': f'eq.{medication_id}', 'user_id': f'eq.{user.user_id}', 'select': 'id'})
        if not response.json():
            raise HTTPException(404, 'Medication not found.')
        return Response(status_code=204)

    return app


app = create_app()
