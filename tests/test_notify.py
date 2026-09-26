"""Pushover notifications never take down the run that needed them.

Milestone 27's scheduled refresh notifies the owner on failure or on a pending
regeneration decision. If Pushover itself is unreachable, or the keys were never set,
the refresh's own report is what must survive — not another traceback about the
notification that was trying to report the first one.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from hip import notify


class _Response:
    def __init__(self, status_code: int = 200) -> None:
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "bad request",
                request=httpx.Request("POST", notify.PUSHOVER_URL),
                response=self,  # type: ignore[arg-type]
            )


def test_missing_keys_do_not_raise(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PUSHOVER_USER_KEY", raising=False)
    monkeypatch.delenv("PUSHOVER_API_TOKEN", raising=False)

    def forbidden(*_args: Any, **_kwargs: Any) -> Any:
        raise AssertionError("sent a request with no keys configured")

    monkeypatch.setattr(notify.httpx, "post", forbidden)

    assert notify.send("Refresh failed", "BLS unreachable") is False


@pytest.mark.parametrize("missing", ["PUSHOVER_USER_KEY", "PUSHOVER_API_TOKEN"])
def test_one_missing_key_is_still_unconfigured(
    missing: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Half a configuration is not a configuration — either key alone must refuse."""
    monkeypatch.setenv("PUSHOVER_USER_KEY", "u123")
    monkeypatch.setenv("PUSHOVER_API_TOKEN", "t456")
    monkeypatch.setenv(missing, "")  # present but empty, not merely unset

    def forbidden(*_args: Any, **_kwargs: Any) -> Any:
        raise AssertionError(f"sent a request with {missing} empty")

    monkeypatch.setattr(notify.httpx, "post", forbidden)

    assert notify.send("Refresh failed", "BLS unreachable") is False


def test_a_successful_send_posts_the_title_and_message_with_both_keys(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PUSHOVER_USER_KEY", "u123")
    monkeypatch.setenv("PUSHOVER_API_TOKEN", "t456")
    sent: dict[str, Any] = {}

    def fake_post(url: str, *, data: dict[str, Any], timeout: float) -> _Response:
        sent["url"] = url
        sent["data"] = data
        return _Response(200)

    monkeypatch.setattr(notify.httpx, "post", fake_post)

    assert notify.send("Refresh failed", "BLS unreachable", priority=1) is True
    assert sent["url"] == notify.PUSHOVER_URL
    assert sent["data"] == {
        "token": "t456",
        "user": "u123",
        "title": "Refresh failed",
        "message": "BLS unreachable",
        "priority": 1,
    }


def test_a_pushover_side_error_is_reported_as_not_sent_not_raised(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PUSHOVER_USER_KEY", "u123")
    monkeypatch.setenv("PUSHOVER_API_TOKEN", "t456")
    monkeypatch.setattr(notify.httpx, "post", lambda *a, **k: _Response(400))

    assert notify.send("Refresh failed", "bad token") is False


def test_a_network_failure_is_reported_as_not_sent_not_raised(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PUSHOVER_USER_KEY", "u123")
    monkeypatch.setenv("PUSHOVER_API_TOKEN", "t456")

    def offline(*_args: Any, **_kwargs: Any) -> Any:
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(notify.httpx, "post", offline)

    assert notify.send("Refresh failed", "the Mac is offline") is False
