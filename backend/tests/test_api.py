import json
from uuid import uuid4
import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from app.main import create_app, Settings
BASE = 'https://example.supabase.co'
USER, MED = str(uuid4()), str(uuid4())
HEADERS = {'Authorization': 'Bearer valid-test-token'}
ROW = {'id': MED, 'name': 'Example', 'dosage': 'Label dosage', 'schedule': 'Label schedule', 'pinned': False, 'created_at': '2026-01-01T00:00:00Z'}
@pytest.fixture
def client():
    with TestClient(create_app(Settings(supabase_url=BASE, supabase_publishable_key='public-test-key'))) as c:
        yield c
@pytest.fixture
def upstream():
    with respx.mock(assert_all_called=False) as router:
        router.get(BASE + '/auth/v1/user').mock(return_value=httpx.Response(200, json={'id': USER}))
        yield router

def test_requires_authentication(client):
    assert client.get('/medications').status_code == 401

def test_rejects_invalid_token(client, upstream):
    upstream.get(BASE + '/auth/v1/user').mock(return_value=httpx.Response(401, json={}))
    assert client.get('/medications', headers=HEADERS).status_code == 401

def test_list_scoped_with_user_token(client, upstream):
    route = upstream.get(BASE + '/rest/v1/aloe_medications').mock(return_value=httpx.Response(200, json=[ROW]))
    result = client.get('/medications', headers=HEADERS)
    assert result.status_code == 200
    req = route.calls.last.request
    assert req.url.params['user_id'] == f'eq.{USER}'
    assert req.headers['Authorization'] == HEADERS['Authorization']
    assert req.headers['apikey'] == 'public-test-key'
    assert len(result.json()) == 1

def test_create_authenticated_owner_and_trim(client, upstream):
    route = upstream.post(BASE + '/rest/v1/aloe_medications').mock(return_value=httpx.Response(201, json=[ROW]))
    result = client.post('/medications', headers=HEADERS, json={'name': ' Example ', 'dosage': ' Label dosage ', 'schedule': ' Label schedule '})
    assert result.status_code == 201
    assert json.loads(route.calls.last.request.content) == {'name': 'Example', 'dosage': 'Label dosage', 'schedule': 'Label schedule', 'user_id': USER}
    assert 'user_id' not in result.json()

@pytest.mark.parametrize('payload', [
    {'name': ' ', 'dosage': 'x', 'schedule': 'x'},
    {'name': 'x' * 101, 'dosage': 'x', 'schedule': 'x'},
    {'name': 'x', 'dosage': 'x', 'schedule': 'x', 'user_id': str(uuid4())},
])
def test_invalid_input_or_owner_injection(client, upstream, payload):
    assert client.post('/medications', headers=HEADERS, json=payload).status_code == 422

def test_pin_cannot_modify_owner(client, upstream):
    assert client.patch(f'/medications/{MED}', headers=HEADERS, json={'pinned': True, 'user_id': str(uuid4())}).status_code == 422

def test_pin_scoped(client, upstream):
    route = upstream.patch(BASE + '/rest/v1/aloe_medications').mock(return_value=httpx.Response(200, json=[{**ROW, 'pinned': True}]))
    result = client.patch(f'/medications/{MED}', headers=HEADERS, json={'pinned': True})
    assert result.status_code == 200 and result.json()['pinned'] is True
    assert route.calls.last.request.url.params['user_id'] == f'eq.{USER}'
    assert route.calls.last.request.url.params['id'] == f'eq.{MED}'

def test_foreign_or_missing_record(client, upstream):
    upstream.patch(BASE + '/rest/v1/aloe_medications').mock(return_value=httpx.Response(200, json=[]))
    assert client.patch(f'/medications/{MED}', headers=HEADERS, json={'pinned': True}).status_code == 404

def test_delete_scoped(client, upstream):
    route = upstream.delete(BASE + '/rest/v1/aloe_medications').mock(return_value=httpx.Response(200, json=[{'id': MED}]))
    result = client.delete(f'/medications/{MED}', headers=HEADERS)
    assert result.status_code == 204 and not result.content
    assert route.calls.last.request.url.params['user_id'] == f'eq.{USER}'

def test_network_failure(client, upstream):
    upstream.get(BASE + '/rest/v1/aloe_medications').mock(side_effect=httpx.ConnectError('network'))
    assert client.get('/medications', headers=HEADERS).status_code == 503

def test_internal_errors_hidden(client, upstream):
    upstream.get(BASE + '/rest/v1/aloe_medications').mock(return_value=httpx.Response(500, json={'secret': 'private database detail'}))
    result = client.get('/medications', headers=HEADERS)
    assert result.status_code == 503 and 'private database detail' not in result.text
