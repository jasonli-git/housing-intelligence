import { eachMonth, overYears, type Inputs } from "./ownership";

/** Same selling-at-the-end comparison as the guide; no investment-return model. */
export function twoPaths(input: Inputs) {
  const month = eachMonth(input);
  const points = Array.from({length:30}, (_,i) => overYears({...input,years:i+1}));
  const selected = points[Math.max(0,Math.min(29,Math.round(input.years)-1))];
  const principalPaid = month.loan.amount-selected.balance;
  const valueChange = selected.salePrice-input.price;
  // Undo the assumed price gain in the engine's net cost. This also preserves
  // financed FHA premiums as costs rather than mistaking them for home equity.
  const spent = selected.net+valueChange;
  return {points,selected,principalPaid,valueChange,spent,down:month.loan.down};
}
