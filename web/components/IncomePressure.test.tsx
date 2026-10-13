// @vitest-environment jsdom
import {afterEach,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {IncomePressure} from "./IncomePressure";
import type {HousingPressure} from "@/lib/api";
afterEach(cleanup);
const data:HousingPressure={region_id:12,period:"2018–2022",basis:"direct",areas:1,source:"HUD CHAS",source_url:"https://www.huduser.gov/portal/datasets/cp.html",releases:[],bands:[{tenure:"renter",band:0,total:100,burdened:80,severe:60,unknown:10,share:.8,margin:.1},{tenure:"owner",band:0,total:0,burdened:0,severe:0,unknown:0,share:null,margin:null}]};
it("separates tenures and shows uncomputed households and uncertainty",()=>{
 render(<IncomePressure data={data}/>);expect(screen.getByText("80%")).toBeTruthy();expect(screen.getByText(/10 uncomputed/)).toBeTruthy();expect(screen.getByText(/±10.0 points/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Owners'}));expect(screen.getByText('Not available')).toBeTruthy();expect(screen.queryByText('80%')).toBeNull();
});
it("labels a statewide county sum and omits unsupported geography",()=>{
 const {container,rerender}=render(<IncomePressure data={{...data,basis:'county_sum',areas:21}}/>);expect(screen.getByText(/sum of estimates for all 21 counties/)).toBeTruthy();rerender(<IncomePressure data={null}/>);expect(container.innerHTML).toBe('');
});
