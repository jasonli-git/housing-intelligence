// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {act,cleanup,renderHook} from "@testing-library/react";
import {useAtlasCamera,type AtlasCamera} from "./useAtlasCamera";

const base:AtlasCamera={lon:-96,lat:30,scale:370,zoom:1,x:0,y:0};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function setup(reduced=false) {
  let now=0,id=0;
  const pending=new Map<number,FrameRequestCallback>();
  vi.stubGlobal("matchMedia",()=>({matches:reduced,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  vi.spyOn(performance,"now").mockImplementation(()=>now);
  vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>{pending.set(++id,callback);return id;});
  vi.stubGlobal("cancelAnimationFrame",(key:number)=>pending.delete(key));
  return {pending,frame(time:number){act(()=>{now=time;const frames=[...pending.values()];pending.clear();frames.forEach(callback=>callback(time));});}};
}
it("eases real camera values and retargets without a queue",()=>{
  const clock=setup();
  const hook=renderHook(({target,direct})=>useAtlasCamera(target,direct),{initialProps:{target:base,direct:false}});
  clock.frame(400);
  hook.rerender({target:{...base,scale:462.5},direct:false});clock.frame(500);
  const middle=hook.result.current.scale;expect(middle).toBeGreaterThan(370);expect(middle).toBeLessThan(462.5);
  hook.rerender({target:{...base,scale:577.5},direct:false});
  expect(clock.pending.size).toBe(1);clock.frame(900);
  expect(hook.result.current.scale).toBe(577.5);expect(clock.pending.size).toBe(0);
});
it("returns direct drag and reduced-motion targets immediately",()=>{
  setup(true);
  const hook=renderHook(({target,direct})=>useAtlasCamera(target,direct),{initialProps:{target:base,direct:false}});
  const moved={...base,scale:800,x:45,y:90};hook.rerender({target:moved,direct:false});expect(hook.result.current).toEqual(moved);
  hook.rerender({target:base,direct:true});expect(hook.result.current).toEqual(base);
});
it("takes the short longitude arc at the antimeridian",()=>{
  const clock=setup();const start={...base,lon:179};
  const hook=renderHook(({target})=>useAtlasCamera(target,false),{initialProps:{target:start}});clock.frame(400);
  hook.rerender({target:{...base,lon:-179}});clock.frame(500);
  expect(hook.result.current.lon).toBeGreaterThan(179);expect(hook.result.current.lon).toBeLessThan(181);
  clock.frame(800);expect(hook.result.current.lon).toBe(-179);
});
it("cancels scheduled frames on unmount",()=>{
  const clock=setup();const hook=renderHook(()=>useAtlasCamera(base,false));
  expect(clock.pending.size).toBe(1);hook.unmount();expect(clock.pending.size).toBe(0);
});
