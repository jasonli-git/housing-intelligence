import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TrendsExplorer } from "./TrendsExplorer";
it("optionally wraps each chart in an exhibit while preserving its source table", () => {
  const series=[{metricId:"test",title:"Test measure",short:"test",unit:"count",points:[{period_end:"2020-12-31",value:10},{period_end:"2024-12-31",value:20}],table:<p>Exact source table</p>}];
  const html=renderToStaticMarkup(<TrendsExplorer series={series} exhibits />);
  expect(html).toContain('data-exhibit="Measure over time"');
  expect(html).toContain('data-metric="test"');
  expect(html).toContain("Exact source table");
  expect(renderToStaticMarkup(<TrendsExplorer series={series} />)).not.toContain('data-exhibit=');
});
