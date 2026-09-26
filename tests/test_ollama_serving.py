"""Ollama up for a regeneration and as it was afterwards (ARCHITECTURE #230).

The owner keeps Ollama quit between runs, so `serving` starts it for the paid run and
stops it after — but only an Ollama it started: one the owner opened is used and left
running. Nothing here starts a real server; `Popen` and the availability check are
replaced, and the real start and stop were checked once by hand on a spare port.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from hip.eval.runners import ollama
from hip.eval.runners.ollama import OllamaRunner, serving


class _Server:
    """Stands in for the `ollama serve` child."""

    def __init__(self, *, exits: int | None = None) -> None:
        self.returncode = exits
        self.terminated = False

    def poll(self) -> int | None:
        return self.returncode

    def terminate(self) -> None:
        self.terminated = True
        self.returncode = 0

    def wait(self, timeout: float | None = None) -> int:
        return self.returncode or 0

    def kill(self) -> None:
        self.returncode = -9


def _answers(monkeypatch: pytest.MonkeyPatch, *replies: bool) -> None:
    """`OllamaRunner.available` gives these replies in turn, then the last forever."""
    sequence: Iterator[bool] = iter(replies)
    last = {"reply": replies[-1]}

    def available(self: OllamaRunner) -> bool:
        last["reply"] = next(sequence, last["reply"])
        return last["reply"]

    monkeypatch.setattr(OllamaRunner, "available", available)
    monkeypatch.setattr(ollama.time, "sleep", lambda seconds: None)


def _spawn(monkeypatch: pytest.MonkeyPatch, server: _Server) -> list[Any]:
    started: list[Any] = []

    def popen(args: list[str], **kwargs: Any) -> _Server:
        started.append((args, kwargs["env"]["OLLAMA_HOST"]))
        return server

    monkeypatch.setattr(ollama.shutil, "which", lambda name: "/usr/local/bin/ollama")
    monkeypatch.setattr(ollama.subprocess, "Popen", popen)
    return started


def test_an_ollama_already_running_is_used_and_left_running(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _answers(monkeypatch, True)
    started = _spawn(monkeypatch, _Server())

    with serving() as note:
        assert "already running" in note
    assert started == []


def test_a_quit_ollama_is_started_for_the_block_and_stopped_after(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server = _Server()
    _answers(monkeypatch, False, False, True)
    started = _spawn(monkeypatch, server)

    with serving("http://localhost:11434") as note:
        assert note.startswith("started Ollama")
        assert not server.terminated
    assert server.terminated
    # Bound to the endpoint's host alone, not every interface.
    assert started == [(["/usr/local/bin/ollama", "serve"], "localhost:11434")]


def test_it_is_stopped_even_when_the_block_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    server = _Server()
    _answers(monkeypatch, False, True)
    _spawn(monkeypatch, server)

    with pytest.raises(RuntimeError), serving():
        raise RuntimeError("the run failed")
    assert server.terminated


def test_one_that_never_answers_is_stopped_and_the_block_still_runs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server = _Server()
    _answers(monkeypatch, False)
    _spawn(monkeypatch, server)
    ran = []

    with serving(wait=0) as note:
        ran.append(note)
    assert "did not answer" in ran[0]
    assert server.terminated


def test_one_that_exits_on_start_is_reported(monkeypatch: pytest.MonkeyPatch) -> None:
    _answers(monkeypatch, False)
    _spawn(monkeypatch, _Server(exits=1))

    with serving() as note:
        assert "exited (1)" in note


def test_without_ollama_installed_the_block_still_runs(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _answers(monkeypatch, False)
    monkeypatch.setattr(ollama.shutil, "which", lambda name: None)
    monkeypatch.setattr(ollama, "_APP_BINARY", tmp_path / "missing")

    with serving() as note:
        assert "not installed" in note
