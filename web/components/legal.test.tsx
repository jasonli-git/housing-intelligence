import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { CONTACT_EMAIL, FRED_TERMS_URL, OPERATOR, PRIVACY_EMAIL } from "@/lib/site";

// The masthead reads client state; these tests are about the policies' words.
vi.mock("@/components/Masthead", () => ({ Masthead: () => null }));

const text = (element: React.ReactElement) =>
  renderToStaticMarkup(element).replace(/<[^>]+>/g, " ").replace(/&#x27;|&rsquo;|’/g, "'").replace(/\s+/g, " ");

describe("the terms of use (#357)", () => {
  const html = renderToStaticMarkup(<TermsPage />);
  const words = text(<TermsPage />);

  it("carries the sentence FRED's API terms require of an application's terms of use", () => {
    expect(words).toContain("By using this site, you agree to be bound by the FRED® API Terms of Use");
    expect(html).toContain(`href="${FRED_TERMS_URL}"`);
  });

  it("names who runs the site and how to reach them", () => {
    expect(words).toContain(`run by ${OPERATOR}`);
    expect(html).toContain(`mailto:${CONTACT_EMAIL}`);
    expect(html).toContain(`mailto:${PRIVACY_EMAIL}`);
  });
});

describe("the privacy policy (#357)", () => {
  const words = text(<PrivacyPage />);

  it("says what the site does not do, and where removals go", () => {
    expect(words).toContain("no accounts, cookies, analytics, advertising or third-party trackers");
    expect(words).toContain(PRIVACY_EMAIL);
  });

  it("keeps nothing about how a reader browses", () => {
    expect(words).toContain("Nothing about how you browse, such as which sections you open, is kept");
  });

  it("says the typed address never leaves the browser", () => {
    expect(words).toContain("the full address you type is never sent");
  });
});
