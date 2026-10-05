import type { PacketLevel } from "./api";

export type HomeCheck = { id: string; title: string; text: string; metricId?: string; periodEnd?: string };

/** Stable priorities, triggered by published inputs—not model prose or inferred risk. */
export function homeChecks(levels: PacketLevel[]): HomeCheck[] {
  const find = (id: string) => levels.find((l) => l.metric_id === id && Number.isFinite(l.value));
  const check = (id: string, title: string, text: string, metric?: PacketLevel): HomeCheck => ({
    id, title, text, metricId: metric?.metric_id, periodEnd: metric?.period_end,
  });
  const tax = find("modiv_median_tax_bill");
  const price = find("zhvi_sfr") ?? find("sr1a_median_sale_price");
  const rent = find("zori_all");
  return [
    tax
      ? check("tax", "The home's tax bill", "The area's typical bill is not this property's bill. Look up the address and check the tax year.", tax)
      : check("tax", "The home's tax bill", "No typical tax bill is available here. That does not mean no tax is due; check the property's own bill."),
    price
      ? check("price", "The price of this home", price.metric_id === "zhvi_sfr"
        ? "A typical single-family value is not a listing price or an appraisal. Compare homes of a similar size, type and condition."
        : "The sales figure describes homes that changed hands during its stated window—not every home here or today's asking prices.", price)
      : check("price", "The price of this home", "No typical single-family value or qualifying sales median is available here. Use the actual purchase price when planning costs."),
    rent
      ? check("rent", "A comparable rental", "The rent figure covers different kinds of rental homes. Check a similar home's asking rent and which bills are included.", rent)
      : check("rent", "A comparable rental", "No typical rent figure is available here. Check actual listings and which bills are included."),
  ];
}
