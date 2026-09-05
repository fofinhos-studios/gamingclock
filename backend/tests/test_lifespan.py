from unittest.mock import AsyncMock, patch

import pytest

from gamingclock.main import app, lifespan


@pytest.mark.asyncio
async def test_lifespan_closes_every_router_service():
    with (
        patch("gamingclock.main.close_services", new_callable=AsyncMock) as close_services,
        patch("gamingclock.main.close_group_services", new_callable=AsyncMock) as close_group_services,
    ):
        async with lifespan(app):
            pass

    close_services.assert_awaited_once()
    close_group_services.assert_awaited_once()
