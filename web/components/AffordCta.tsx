/**
 * "What can I afford?" as a call to action of its own (Milestone 23): an income box that
 * opens the affordability page with the income filled in. It had been a button beside
 * search, which read as search's own submit button; its own card, in the affordability
 * tool's orange, sets it apart by form and by color.
 *
 * A plain GET form, so it works with no script: `/afford?income=…` is read by the page
 * when it loads.
 */
export function AffordCta() {
  return (
    <form className="afford-cta" action="/afford" method="get">
      <p className="afford-cta-title">What can I afford?</p>
      <p className="afford-cta-sub">See where the typical home is within reach of your income.</p>
      <div className="afford-cta-row">
        <label className="money-input">
          <span className="visually-hidden">Household income, a year before tax</span>
          <span aria-hidden="true">$</span>
          <input name="income" inputMode="numeric" autoComplete="off" placeholder="100,000" />
        </label>
        <button type="submit" className="button">
          See where
        </button>
      </div>
    </form>
  );
}
