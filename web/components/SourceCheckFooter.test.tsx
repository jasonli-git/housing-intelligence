// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SourceCheckFooter } from "./SourceCheckFooter";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps the full schedule and destination when status cannot load", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("unavailable"));
  vi.stubGlobal("fetch", fetcher);
  render(<SourceCheckFooter />);
  const footer = screen.getByRole("navigation", { name: "Source check status" });
  expect(within(footer).getByRole("link", { name: "Source checks scheduled Fridays" }).getAttribute("href")).toBe("/freshness");
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
});

it("preserves a published check date instead of claiming only a schedule", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checked_at: new Date().toISOString(), outcome: "current" }) }));
  render(<SourceCheckFooter />);
  expect(await screen.findByRole("link", { name: /^Sources checked/ })).toBeTruthy();
  expect(screen.queryByText("scheduled")).toBeNull();
});

it("preserves overdue context", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checked_at: "2000-01-01T12:00:00Z", outcome: "unreachable" }) }));
  render(<SourceCheckFooter />);
  const link = await screen.findByRole("link", { name: /Source check overdue/ });
  expect(link.getAttribute("data-overdue")).toBe("true");
  expect(link.textContent).toContain("last Jan 1");
});

it("keeps the unreachable-source qualification on a recent check", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checked_at: new Date().toISOString(), outcome: "unreachable" }) }));
  render(<SourceCheckFooter />);
  expect(await screen.findByRole("link", { name: /some unreachable/ })).toBeTruthy();
});

it("keeps the schedule for an HTTP error", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal("fetch", fetcher);
  render(<SourceCheckFooter />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("link", { name: "Source checks scheduled Fridays" })).toBeTruthy();
});
