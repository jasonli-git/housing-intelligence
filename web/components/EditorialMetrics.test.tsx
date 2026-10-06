// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {EditorialMetrics} from "./EditorialMetrics";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
const items=[<p key="first">First figure</p>,<p key="second">Second figure</p>];
const media=(matches:boolean)=>vi.stubGlobal("matchMedia",()=>({matches,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
it("keeps reduced motion static without carousel controls",()=>{
  media(true);vi.useFakeTimers();render(<EditorialMetrics items={items}/>);
  act(()=>vi.advanceTimersByTime(24000));expect(screen.getByText("First figure")).toBeTruthy();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});
it("rotates every 10 seconds without a pause button and holds while hovered",()=>{
  media(false);vi.useFakeTimers();const {container}=render(<EditorialMetrics items={items}/>);
  act(()=>vi.advanceTimersByTime(9999));expect(screen.getByText("First figure")).toBeTruthy();
  act(()=>vi.advanceTimersByTime(1));expect(screen.getByText("Second figure")).toBeTruthy();
  fireEvent.mouseEnter(container.firstChild!);act(()=>vi.advanceTimersByTime(12000));expect(screen.getByText("Second figure")).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Pause computed figures"})).toBeNull();
  fireEvent.mouseLeave(container.firstChild!);
  act(()=>vi.advanceTimersByTime(10000));expect(screen.getByText("First figure")).toBeTruthy();
});
it("lets keyboard focus hold the figure without adding a button",()=>{
  media(false);vi.useFakeTimers();render(<EditorialMetrics items={items}/>);
  const group=screen.getByRole("group");fireEvent.focus(group);
  act(()=>vi.advanceTimersByTime(20000));expect(screen.getByText("First figure")).toBeTruthy();
  fireEvent.blur(group);act(()=>vi.advanceTimersByTime(10000));expect(screen.getByText("Second figure")).toBeTruthy();
});
