import logging

from gamingclock.main import app


def test_http_client_request_urls_are_not_logged_at_info_level():
    assert app is not None
    assert logging.getLogger("httpx").getEffectiveLevel() >= logging.WARNING
    assert logging.getLogger("httpcore").getEffectiveLevel() >= logging.WARNING
