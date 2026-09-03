from gamingclock.services.hltb_cache import UpstashHLTBCache


def test_cache_key_uses_the_current_hltb_result_format_version():
    cache = UpstashHLTBCache(url="https://example.com", token="token")

    assert cache._key("kingdom hearts") == "gamingclock:hltb:v2:kingdom hearts"
