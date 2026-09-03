from gamingclock.services.hltb_cache import UpstashHLTBCache


def test_cache_key_uses_the_current_hltb_result_format_version():
    cache = UpstashHLTBCache(url="https://example.com", token="token")

    assert cache._key("kingdom hearts") == "gamingclock:hltb:v2:kingdom hearts"


def test_cache_key_uses_a_configured_hltb_cache_version():
    cache = UpstashHLTBCache(
        url="https://example.com",
        token="token",
        cache_version="hltb-2026-09-03",
    )

    assert cache._key("kingdom hearts") == "gamingclock:hltb:hltb-2026-09-03:kingdom hearts"


def test_cache_uses_version_configured_in_the_environment(monkeypatch):
    monkeypatch.setenv("KV_REST_API_URL", "https://example.com")
    monkeypatch.setenv("KV_REST_API_TOKEN", "token")
    monkeypatch.setenv("HLTB_CACHE_VERSION", "hltb-2026-09-03")

    cache = UpstashHLTBCache.from_environment()

    assert cache is not None
    assert cache._key("kingdom hearts") == "gamingclock:hltb:hltb-2026-09-03:kingdom hearts"
