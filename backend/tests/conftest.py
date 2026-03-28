import pytest
from fastapi.testclient import TestClient

from gamingclock.main import app


@pytest.fixture
def client():
    return TestClient(app)
