"""Pushover notifications, for a scheduler nobody is watching (Milestone 27).

A weekly refresh runs unattended. Its own report is only useful to someone reading a
log, so the two things worth knowing — it failed, or it is waiting on a "regenerate
readings" decision — are also pushed to the owner's phone.

`PUSHOVER_USER_KEY` and `PUSHOVER_API_TOKEN` are read directly from the environment,
the same way `FRED_API_KEY` and `BLS_API_KEY` are (ARCHITECTURE #80: an absent key is
unavailability, not a configuration error) — not through `Settings`, because a Pushover
account is the owner's, not the platform's, and every other vendor credential in this
codebase is read the same way.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

PUSHOVER_URL = "https://api.pushover.net/1/messages.json"
_TIMEOUT = 10.0


def send(title: str, message: str, *, priority: int = 0) -> bool:
    """Send one Pushover notification. Returns whether it was actually sent.

    Never raises: the one thing worse than a scheduler that cannot notify the owner is
    a scheduler that crashes on the notification itself, hiding whatever it was trying
    to report. Missing keys, a network failure and a Pushover-side error are all logged
    and treated the same way — the caller decides whether a silent notification failure
    should also change its own exit code.
    """
    user = os.environ.get("PUSHOVER_USER_KEY")
    token = os.environ.get("PUSHOVER_API_TOKEN")
    if not user or not token:
        logger.warning(
            "Pushover not configured (PUSHOVER_USER_KEY/PUSHOVER_API_TOKEN absent); "
            "not sent: %s",
            title,
        )
        return False
    try:
        response = httpx.post(
            PUSHOVER_URL,
            data={
                "token": token,
                "user": user,
                "title": title,
                "message": message,
                "priority": priority,
            },
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
    except (httpx.HTTPError, OSError) as exc:
        logger.warning("Pushover notification failed: %s", exc)
        return False
    return True
