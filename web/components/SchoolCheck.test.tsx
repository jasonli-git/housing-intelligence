// @vitest-environment jsdom
import {it,expect} from "vitest";
import {render,cleanup} from "@testing-library/react";
import {SchoolCheck} from "./SchoolCheck";
import type {CommunityContext} from "@/lib/api";
it("shows district associations and assignment caveat without a disclosure",()=>{
  const data={districts:[{boundary:{payload:{district_id:"X",name:"Fixture District",district_type:"Unified"}},performance:null}]} as unknown as CommunityContext;
  const {container}=render(<SchoolCheck data={data} reportHref="/nj/princeton/report"/>);
  expect(container.textContent).toContain("Fixture District");expect(container.textContent).toContain("not school assignments");expect(container.querySelector('details')).toBeNull();expect(container.querySelector('a[href="/nj/princeton/report#report-community"]')).not.toBeNull();cleanup();
});
it("does not infer a district when matching is absent",()=>{const {container}=render(<SchoolCheck data={null} reportHref="/nj/princeton/report"/>);expect(container.textContent).toContain("No district association matched");cleanup();});
