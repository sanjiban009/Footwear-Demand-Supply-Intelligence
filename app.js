'use strict';
/* FOOTWEAR INTELLIGENCE — vanilla JS, SVG charts, no third-party libraries or internet required.
 * Demand slices: category / brand / plant / region / channel.
 * Supply & inventory slices: category / brand / plant. Region and channel DO NOT filter plant-level metrics.
 * Forward forecast: synthetic seasonal-trend heuristic, not a trained production forecasting model.
 */
const C={teal:'#27dfc0',sky:'#54baff',purple:'#a690ff',orange:'#f7b96c',red:'#ff728c',green:'#71ebbb',muted:'#90a6c0',grid:'#24334a'};
const $=(s)=>document.querySelector(s);
let DATA=window.DASHBOARD_DATA;
let activePage='overview', scenarioUplift=0, scenarioPromo=0, searchText='', tableKind='history', tablePage=0;
const filterIDs=['fy','category','brand','plant','region','channel','historyWindow','horizon'];
const fyOf=m=>`FY ${Number(m.slice(0,4))-(Number(m.slice(5,7))<4?1:0)}-${String(Number(m.slice(0,4))-(Number(m.slice(5,7))<4?0:-1)).slice(-2)}`;
const shiftYear=(m,n)=>`${Number(m.slice(0,4))+n}-${m.slice(5,7)}`;
const fiscalName=fy=>fy.replace('FY ','FY ').replace('-', '–');
const PAGE_META={overview:['EXECUTIVE OVERVIEW','Demand & Supply Command Center','Forecast confidence, production readiness and risk exposure across the footwear network.'],forecast:['DEMAND FORECAST','Demand Forecast & Scenario Studio','Monthly category outlook, growth trends and promotion-driven demand simulations.'],production:['PRODUCTION & CAPACITY','Factory Production Control Tower','Capacity utilization, production commitments and demand-to-supply gaps.'],inventory:['INVENTORY & RISK','Inventory & Stockout Risk','Working capital exposure, days of coverage and projected stockout warnings.'],accuracy:['FORECAST PERFORMANCE','Forecast Accuracy & Reliability','Backtest diagnostics, category bias and fulfilment performance.'],explorer:['DATA EXPLORER','Manufacturing Data Explorer','Inspect and export selected data points across demand and supply tables.']};
const fmtInt=n=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(Number.isFinite(+n)?+n:0);
const fmt1=n=>Number.isFinite(+n)?(+n).toFixed(1):'—';
const fmtPct=n=>Number.isFinite(+n)?`${(+n).toFixed(1)}%`:'—';
const fmtQty=n=>Math.abs(n)>=1e7?(n/1e7).toFixed(2)+'Cr':Math.abs(n)>=1e5?(n/1e5).toFixed(2)+'L':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'k':fmtInt(n);
const money=n=>'₹'+(Math.abs(n)>=1e7?(n/1e7).toFixed(2)+' Cr':Math.abs(n)>=1e5?(n/1e5).toFixed(2)+' L':fmtInt(n));
const sum=(a,key)=>a.reduce((v,r)=>v+(+r[key]||0),0);
const ratio=(a,b)=>b?100*a/b:0;
const shortMonth=m=>new Date(m+'-01T00:00:00').toLocaleDateString('en-US',{month:'short',year:'2-digit'});
const maxBy=(a,k)=>a.length?a.reduce((p,c)=>+c[k]>+p[k]?c:p):null;
const svgText=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const agg=(rows,key,value)=>{let result={};for(const r of rows){let k=r[key];result[k]=(result[k]||0)+(+r[value]||0)}return result};
const aggMonths=(rows,value)=>DATA.meta.history_months.concat(DATA.meta.forecast_months).reduce((o,m)=>(o[m]=sum(rows.filter(x=>x.month===m),value),o),{});
const svgtag=(content,w=780,h=268)=>`<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 ${w} ${h}" aria-label="Chart with visible data labels">${content}</svg>`;
const EL=(sel,html)=>{document.querySelector(sel).innerHTML=html};
function filters(){return Object.fromEntries(filterIDs.map(x=>[x,$('#'+x).value]))}
function buildOptions(){
 for(const id of ['category','brand','plant','region','channel']){
   const set=[...new Set((id==='region'?DATA.history:DATA.products).map(r=>r[id]))].sort();
   const vals=id==='channel'?['Distributor','Modern Trade','E-commerce']:set;
   EL('#'+id,`<option value="All">All ${id==='category'?'Categories':id==='brand'?'Brands':id==='plant'?'Plants':id==='region'?'Regions':'Channels'}</option>`+vals.map(v=>`<option value="${svgText(v)}">${svgText(v)}</option>`).join(''));
 }
}
function context(){
 const f=filters(),isArchived=DATA.meta.fy_complete.includes(f.fy),isFutureFY=f.fy===DATA.meta.fy_future;
 const supplyFilter=r=>['category','brand','plant'].every(k=>f[k]==='All'||r[k]===f[k]);
 const demandFilter=r=>supplyFilter(r)&&['region','channel'].every(k=>f[k]==='All'||r[k]===f[k]);
 const histAll=DATA.history.filter(demandFilter),histSku=DATA.history.filter(supplyFilter);
 const futureAll=DATA.forecast.filter(demandFilter),futureSku=DATA.forecast.filter(supplyFilter);
 const supplyAll=DATA.production.filter(supplyFilter);
 let hMonths=DATA.meta.history_months.filter(m=>f.fy==='All'||fyOf(m)===f.fy);
 if(f.historyWindow!=='all')hMonths=hMonths.slice(-Number(f.historyWindow));
 const history=histAll.filter(r=>hMonths.includes(r.month));
 let pMonths=(isArchived?hMonths:DATA.meta.forecast_months.filter(m=>f.fy==='All'||fyOf(m)===f.fy));
 if(f.horizon!=='all')pMonths=pMonths.slice(0,Number(f.horizon));
 const archive=r=>({...r,forecast_units:r.backtest_forecast_units,forecast_revenue_inr:r.backtest_forecast_units*(DATA.products.find(p=>p.sku===r.sku)?.unit_price_inr||0)});
 const forecast=isArchived?histAll.filter(r=>pMonths.includes(r.month)).map(archive):futureAll.filter(r=>pMonths.includes(r.month));
 const scopeFuture=isArchived?histSku.filter(r=>pMonths.includes(r.month)).map(archive):futureSku;
 const supply=supplyAll.filter(r=>pMonths.includes(r.month));
 let inventory=DATA.inventory.filter(supplyFilter),inventoryAsOf='31 Oct 2026 · Actual';
 let proj;
 if(isArchived){
   const last=hMonths.at(-1),snap=DATA.inventory_history.filter(r=>r.month===last&&supplyFilter(r));
   inventory=snap;inventoryAsOf=last?shortMonth(last)+' · Actual':'No historical snapshot';
   const snaps=DATA.inventory_history.filter(r=>pMonths.includes(r.month)&&supplyFilter(r));
   let pr=[],previous={};for(const rr of snaps){
     const m=rr.month,unit=supplyAll.find(x=>x.month===m&&x.sku===rr.sku),related=histSku.filter(x=>x.sku===rr.sku&&x.month===m);
     const missed=sum(related,'actual_units')-sum(related,'fulfilled_units');
     pr.push({sku:rr.sku,month:m,opening:previous[rr.sku]??rr.on_hand_units,demand:sum(related,'actual_units'),production:unit?.planned_production_units||0,closing:rr.on_hand_units,shortage:Math.max(0,missed),safety:rr.safety_stock_units,warning:rr.on_hand_units<rr.safety_stock_units});previous[rr.sku]=rr.on_hand_units;
   }
   proj={rows:pr,atRiskSkus:snap.filter(x=>x.on_hand_units<x.safety_stock_units).length,stockouts:sum(pr,'shortage'),warningCount:pr.filter(x=>x.warning).length};
 }else{
   // Simulate the ENTIRE 12-month forward path before showing the FY slice: FY27–28 opening stock is bridged through Nov–Mar.
   const allForwardSupply=supplyAll.filter(r=>DATA.meta.forecast_months.includes(r.month));
   const full=projection(inventory,allForwardSupply,DATA.meta.forecast_months,futureSku);
   if(isFutureFY){
     const prev=DATA.meta.forecast_months.filter(m=>m<pMonths[0]).at(-1);
     inventory=inventory.map(i=>({...i,on_hand_units:full.rows.find(r=>r.month===prev&&r.sku===i.sku)?.closing??i.on_hand_units}));
     inventoryAsOf=prev?shortMonth(prev)+' · Projected':'31 Oct 2026 · Actual';
   }
   const rows=full.rows.filter(x=>pMonths.includes(x.month));
   proj={rows,atRiskSkus:new Set(rows.filter(x=>x.warning).map(x=>x.sku)).size,stockouts:sum(rows,'shortage'),warningCount:rows.filter(x=>x.warning).length};
 }
 const histDemand=sum(history,'actual_units'),histPred=sum(history,'backtest_forecast_units');
 const err=history.reduce((v,r)=>v+Math.abs(r.actual_units-r.backtest_forecast_units),0);
 const comparisonMonths=f.fy==='All'?DATA.meta.history_months.slice(-7):hMonths;
 const matched=histAll.filter(r=>comparisonMonths.includes(r.month));
 const previous=histAll.filter(r=>comparisonMonths.map(m=>shiftYear(m,-1)).includes(r.month));
 const yoy=previous.length?100*(sum(matched,'actual_units')-sum(previous,'actual_units'))/sum(previous,'actual_units'):null;
 return {f,history,hist:histAll,forecast,future:futureAll,supply,inventory,scopeHist:histSku,scopeFuture,hMonths,pMonths,projection:proj,
  isArchived,isFutureFY,inventoryAsOf,yoy,hasHistory:history.length>0,periodLabel:f.fy==='All'?'ALL FISCAL YEARS':f.fy,
  histDemand,histPred,err,wape:ratio(err,histDemand),bias:ratio(histPred-histDemand,histDemand),fill:ratio(sum(history,'fulfilled_units'),histDemand),
  futureUnits:sum(forecast,'forecast_units'),futureRevenue:sum(forecast,'forecast_revenue_inr'),actualRevenue:sum(history,'net_sales_inr'),planUnits:sum(supply,'planned_production_units'),
  capacity:sum(supply,'production_capacity_units'),prodCost:sum(supply,'production_cost_inr'),stock:sum(inventory,'on_hand_units'),stockValue:inventory.reduce((v,r)=>v+r.on_hand_units*r.unit_cost_inr,0),
  supplyScopeIsGlobal:f.region==='All'&&f.channel==='All'};
}
function projection(inv,plans,months,forecast){
 const planBy={};for(let p of plans)planBy[p.sku+'|'+p.month]=p;
 const fd={};for(let r of forecast)fd[r.sku+'|'+r.month]=(fd[r.sku+'|'+r.month]||0)+r.forecast_units;
 let rows=[],badSkus=new Set(),peakShortage=0;
 for(let i of inv){let start=i.on_hand_units;for(let m of months){let p=planBy[i.sku+'|'+m];let d=fd[i.sku+'|'+m]||0;let produced=p?p.planned_production_units:0;
  let available=start+produced,missing=Math.max(0,d-available),end=Math.max(0,available-d),warning=end<i.safety_stock_units;
  if(warning||missing>0)badSkus.add(i.sku);
  rows.push({sku:i.sku,month:m,opening:start,demand:d,production:produced,closing:end,shortage:missing,safety:i.safety_stock_units,warning});start=end;peakShortage+=missing;
 }}
 return {rows,atRiskSkus:badSkus.size,stockouts:peakShortage,warningCount:rows.filter(r=>r.warning).length};
}
function heading(name,note=''){return `<div class="section-heading"><h2>${name}</h2><span class="meta">${note}</span></div>`}
function kpi(label,val,foot,accent=C.teal){return `<div class="kpi" style="--accent:${accent}"><div class="kpi-label">${label}</div><div class="kpi-val">${val}</div><div class="kpi-foot">${foot}</div></div>`}
function panel(title,desc,chart,leg=[],full=false){return `<article class="panel ${full?'full':''}"><div class="panel-head"><div><h3>${title}</h3><p class="description">${desc}</p></div><div class="legend">${leg.map(([v,color])=>`<div class="leg"><i style="--dot:${color}"></i>${v}</div>`).join('')}</div></div><div class="graph">${chart}</div></article>`}
function chartEmpty(msg='No records match this selection'){return `<div class="empty">${msg}</div>`}
function axisYTicks(max, x0,y0, plotW,plotH,num=4){let o='';for(let i=0;i<=num;i++){let n=max*i/num,y=y0+plotH-(i/num)*plotH;o+=`<line class="grid-line" x1="${x0}" y1="${y}" x2="${x0+plotW}" y2="${y}"/><text class="axis" x="${x0-11}" y="${y+4}" text-anchor="end">${fmtQty(n)}</text>`}return o}
function barChart(labels,series,opt={}){
 const w=opt.width||790,h=opt.height||260,left=72,right=18,top=31,bottom=49, plotW=w-left-right,plotH=h-top-bottom;
 const all=series.flatMap(s=>s.vals||[]),max=Math.max(1,...all)*1.22,groups=Math.max(1,labels.length);const gw=plotW/groups;
 if(!labels.length)return chartEmpty();let o=axisYTicks(max,left,top,plotW,plotH),n=series.length,bw=Math.max(5,Math.min(36,(gw-14)/n));
 for(let i=0;i<labels.length;i++){
  o+=`<text class="axis" x="${left+gw*i+gw/2}" y="${h-16}" text-anchor="middle">${svgText(labels[i])}</text>`;
  for(let si=0;si<n;si++){
   let s=series[si],v=+s.vals[i]||0,x=left+gw*i+gw/2-n*bw/2+si*bw+1,y=top+plotH*(1-v/max),bh=plotH*v/max;
   o+=`<rect x="${x}" y="${y}" width="${Math.max(3,bw-2)}" height="${bh}" rx="3" fill="${s.color}" opacity=".90"><title>${svgText(s.name)}: ${fmtInt(v)} pairs</title></rect>`;
   // All bars are labelled at 12px with scaled 0-decimal volume.
   o+=`<text class="dlabel" x="${x+(bw-2)/2}" y="${Math.max(16,y-6)}" text-anchor="middle" fill="${s.color}">${fmtQty(v)}</text>`;
  }
 }
 return svgtag(o,w,h);
}
function lineChart(labels,series,opt={}){
 let w=opt.width||790,h=opt.height||260,left=72,right=26,top=33,bottom=45,pW=w-left-right,pH=h-top-bottom;
 if(!labels.length)return chartEmpty();
 let max=Math.max(1,...series.flatMap(s=>s.vals).filter(Number.isFinite))*1.21;
 let o=axisYTicks(max,left,top,pW,pH),n=labels.length,xx=i=>left+(n===1?pW/2:i*pW/(n-1)),yy=v=>top+pH*(1-v/max);
 for(let i=0;i<n;i++)if(n<=12||i%2===0)o+=`<text class="axis" x="${xx(i)}" y="${h-13}" text-anchor="middle">${svgText(labels[i])}</text>`;
 for(let si=0;si<series.length;si++){
  let s=series[si],points=s.vals.map((v,i)=>v==null?null:[xx(i),yy(+v),v]);let segments=[],curr=[];
  for(let q of points){if(q){curr.push(q)}else if(curr.length){segments.push(curr);curr=[]}}if(curr.length)segments.push(curr);
  for(let seg of segments){if(seg.length<2)continue;let d='M'+seg.map(q=>q[0]+','+q[1]).join(' L');o+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ${s.dash?'stroke-dasharray="7 6"':''}/>`}
  for(let i=0;i<points.length;i++){
   let q=points[i];if(!q)continue;
   o+=`<circle cx="${q[0]}" cy="${q[1]}" r="4.5" fill="${s.color}" stroke="#142036" stroke-width="2"><title>${svgText(s.name)} · ${svgText(labels[i])}: ${fmtInt(q[2])}</title></circle>`;
   let labelY=q[1] - (si===0?11:-18);
   if(series.length>1)labelY=q[1]+(si===0?-13:21);
   if(opt.percent)o+=`<text class="dlabel" x="${q[0]}" y="${Math.max(14,Math.min(h-35,labelY))}" text-anchor="middle" fill="${s.color}">${fmt1(q[2])}%</text>`;
   else o+=`<text class="dlabel" x="${q[0]}" y="${Math.max(14,Math.min(h-35,labelY))}" text-anchor="middle" fill="${s.color}">${fmtQty(q[2])}</text>`;
  }
 }
 return svgtag(o,w,h);
}
function horizontalChart(entries,opt={}){
 let w=opt.width||640, rowH=35,h=Math.max(170,entries.length*rowH+45),left=143,right=68,top=13,pW=w-left-right,max=Math.max(1,...entries.map(x=>x.value))*1.12,o='';
 if(!entries.length)return chartEmpty();
 entries.forEach((r,i)=>{let y=top+i*rowH,val=Math.max(0,r.value);o+=`<text class="axis" x="${left-11}" y="${y+19}" text-anchor="end">${svgText(String(r.label).slice(0,18))}</text><rect x="${left}" y="${y+4}" height="18" width="${pW}" rx="5" fill="#1e3149"/><rect x="${left}" y="${y+4}" height="18" width="${Math.max(0,pW*val/max)}" rx="5" fill="${r.color||[C.teal,C.sky,C.purple,C.orange,C.red][i%5]}"/><text class="dlabel" x="${left+pW+8}" y="${y+19}">${opt.percent?fmt1(val)+'%':opt.days?fmt1(val)+'d':fmtQty(val)}</text>`});
 return svgtag(o,w,h);
}
function stackedChart(labels, series,opt={}){
 const w=opt.width||750,h=opt.height||258,left=71,right=18,top=27,bottom=47,pW=w-left-right,pH=h-top-bottom,n=labels.length;if(!n)return chartEmpty();
 let max=Math.max(1,...labels.map((l,i)=>series.reduce((s,r)=>s+(+r.vals[i]||0),0)))*1.19,o=axisYTicks(max,left,top,pW,pH),gw=pW/n,bw=Math.min(58,gw*.63);
 for(let i=0;i<n;i++){
  let x=left+gw*(i+.5)-bw/2,base=top+pH,total=0;
  for(let s of series){let v=+s.vals[i]||0,hh=pH*v/max,y=base-hh;
   o+=`<rect x="${x}" y="${y}" width="${bw}" height="${hh}" fill="${s.color}" opacity=".94"><title>${svgText(s.name)}: ${fmtInt(v)} pairs</title></rect>`;
   if(hh>24)o+=`<text class="dlabel" x="${x+bw/2}" y="${y+hh/2+4}" text-anchor="middle" fill="#fff">${fmtQty(v)}</text>`;
   total+=v;base=y;
  }
  o+=`<text class="dlabel" x="${x+bw/2}" y="${Math.max(16,base-7)}" text-anchor="middle">${fmtQty(total)}</text><text class="axis" x="${x+bw/2}" y="${h-15}" text-anchor="middle">${svgText(labels[i])}</text>`;
 }
 return svgtag(o,w,h);
}
function donutChart(entries){
 let total=entries.reduce((v,x)=>v+x.value,0);if(!total)return chartEmpty();
 let cx=175,cy=134,r=84,circ=2*Math.PI*r,acc=0,o=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1c3045" stroke-width="25"/>`;
 entries.forEach(e=>{let frac=e.value/total;o+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${e.color}" stroke-width="25" stroke-dasharray="${frac*circ} ${circ}" stroke-dashoffset="${-acc*circ}" transform="rotate(-90 ${cx} ${cy})"><title>${svgText(e.name)} ${fmtInt(e.value)} (${fmtPct(frac*100)})</title></circle>`;acc+=frac});
 o+=`<text x="${cx}" y="${cy-1}" text-anchor="middle" fill="#f1f8ff" font-size="27" font-weight="900">${fmtQty(total)}</text><text x="${cx}" y="${cy+19}" text-anchor="middle" class="axis">TOTAL SKUs</text>`;
 entries.forEach((e,i)=>{let y=71+i*49;o+=`<circle cx="340" cy="${y}" r="6" fill="${e.color}"/><text x="355" y="${y+4}" class="axis">${svgText(e.name)}</text><text x="470" y="${y+4}" fill="#eff8ff" font-size="13" font-weight="800">${fmtInt(e.value)} · ${fmtPct(ratio(e.value,total))}</text>`});
 return svgtag(o,590,265);
}
function heatmap(rows,months){
 let w=740,h=210,left=130,top=38,pw=580,cw=pw/months.length,ch=39,o='';
 for(let j=0;j<months.length;j++)o+=`<text x="${left+cw*(j+.5)}" y="23" text-anchor="middle" class="axis">${shortMonth(months[j])}</text>`;
 rows.forEach((rr,i)=>{let y=top+i*ch;o+=`<text x="${left-9}" y="${y+25}" text-anchor="end" class="axis">${svgText(rr.name)}</text>`;rr.vals.forEach((v,j)=>{let c=v>95?'#e2777f':v>86?'#b48757':v>70?'#258d91':'#234c58';let x=left+j*cw+4;
 o+=`<rect x="${x}" y="${y+1}" width="${cw-8}" height="34" rx="6" fill="${c}" opacity=".95"/><text x="${x+(cw-8)/2}" y="${y+23}" text-anchor="middle" fill="#fff" font-size="12" font-weight="800">${fmtInt(v)}%</text>`})});
 return svgtag(o,w,h);
}
function cardTable(head,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(c=>`<tr>${c.map(x=>`<td>${x}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${head.length}" class="empty">No matching records</td></tr>`}</tbody></table></div>`}
function statusTag(kind){let label=kind==='Critical'?'HIGH RISK':kind==='Watch'?'WATCH':'ON TRACK';return `<span class="tag ${kind==='Critical'?'danger':kind==='Watch'?'warn':'good'}">${label}</span>`}
function risks(ctx){
 const f=agg(ctx.scopeFuture.filter(x=>ctx.pMonths.includes(x.month)),'sku','forecast_units');const p=agg(ctx.supply,'sku','planned_production_units');
 return ctx.inventory.map(i=>{
  const d=f[i.sku]||0, pr=p[i.sku]||0, avg=d/Math.max(1,ctx.pMonths.length);
  const nextDemand=sum(ctx.scopeFuture.filter(x=>x.sku===i.sku&&x.month===(ctx.isArchived?ctx.pMonths.at(-1):ctx.pMonths[0])),'forecast_units');
  const days=nextDemand?i.on_hand_units/nextDemand*30:0;
  let proj=ctx.projection.rows.filter(x=>x.sku===i.sku),shortage=ctx.isArchived?0:sum(proj,'shortage'),minClose=ctx.isArchived?i.on_hand_units:Math.min(i.on_hand_units,...proj.map(x=>x.closing));
  const gap=Math.max(0,d-pr),risk=shortage>0||minClose<i.safety_stock_units*.45?'Critical':minClose<i.safety_stock_units||(!ctx.isArchived&&gap>avg*.3)?'Watch':'Healthy';
  return {...i,d,planned:pr,gap,days,shortage,minClose,risk,month1Demand:nextDemand};
 }).sort((a,b)=>({Critical:0,Watch:1,Healthy:2}[a.risk]-{Critical:0,Watch:1,Healthy:2}[b.risk])||(b.shortage-a.shortage)||(a.days-b.days));
}
function insightCards(ctx){
 const worstBy=[...new Set(ctx.history.map(x=>x.category))].map(c=>{let rr=ctx.history.filter(x=>x.category===c);return {label:c,value:ratio(rr.reduce((a,x)=>a+Math.abs(x.actual_units-x.backtest_forecast_units),0),sum(rr,'actual_units'))}}).sort((a,b)=>b.value-a.value);
 const worst=worstBy[0],rr=risks(ctx),critical=rr.filter(r=>r.risk==='Critical').length;
 const needed=sum(ctx.scopeFuture.filter(r=>ctx.pMonths.includes(r.month)),'forecast_units'),gap=Math.max(0,needed-ctx.planUnits),gapPct=ratio(gap,needed);
 const signal=ctx.yoy===null?`${ctx.isFutureFY?'New FY forecast':'No comparable prior FY'}`:`${ctx.yoy>=0?'+':''}${fmtPct(ctx.yoy)} like-for-like YoY`;
 const mode=ctx.isArchived?'archived estimates and recorded output':'baseline demand and committed production';
 const arr=[
 {tone:C.teal,k:'FISCAL DEMAND SIGNAL',h:signal,p:ctx.yoy===null?`Selected ${ctx.periodLabel} has no complete comparable observed period in the sample.`:`Matched April–March fiscal months against the prior year, avoiding misleading YTD vs full-year comparisons.`},
 {tone:C.purple,k:'FORECAST RELIABILITY',h:worst?`${worst.label} has highest WAPE`:'No observed history for this FY',p:worst?`${worst.label} forecast WAPE is ${fmtPct(worst.value)} in the FY selection. Review planning assumptions and SKU bias.`:'Forecast accuracy requires observed actuals; FY 2027–28 is an unobserved future period.'},
 {tone:gapPct>3?C.orange:C.teal,k:'SUPPLY GAP',h:`${fmtQty(gap)} pairs uncovered`,p:gap?`The ${mode} have a ${fmtPct(gapPct)} demand–supply variance over selected months.`:`The ${mode} cover the FY's aggregate requirement.`},
 {tone:critical?C.red:C.teal,k:'INVENTORY CONTROL',h:`${critical} SKU(s) in high-risk band`,p:ctx.isArchived?`Historical month-end stock at ${ctx.inventoryAsOf}; past shortages are descriptive, not future predictions.`:critical?`Projected stock-flow alerts for this FY indicate potential service shortfalls. Escalate SKU-level replenishment.`:'No critical inventory risks are identified for selected months.'}
 ];return `<div class="insights">${arr.map((r,i)=>`<div class="insight" style="--tone:${r.tone}"><div class="num">0${i+1} / ${r.k}</div><h4>${r.h}</h4><p>${r.p}</p></div>`).join('')}</div>`
}
function riskTable(ctx,top=8){let rs=risks(ctx).slice(0,top);return cardTable(['SKU / MODEL','CATEGORY','ON HAND','COVER DAYS','PLAN GAP','RISK'],rs.map(r=>[`<strong>${r.sku}</strong> · ${svgText((DATA.products.find(x=>x.sku===r.sku)||{}).model||'')}`,r.category,fmtInt(r.on_hand_units),fmt1(r.days)+' d',fmtQty(r.gap),statusTag(r.risk)]))}
function demandChart(ctx){
 const h=ctx.isArchived?ctx.hMonths:ctx.hMonths.slice(-6),p=ctx.pMonths;
 const labels=ctx.isArchived?h:[...h,...p];
 const actual=agg(ctx.history.filter(x=>h.includes(x.month)),'month','actual_units'),base=agg(ctx.forecast,'month','forecast_units');
 const asActual=labels.map(m=>h.includes(m)?actual[m]??null:null),asForecast=labels.map(m=>p.includes(m)?base[m]??null:null);
 return lineChart(labels.map(shortMonth),[{name:'Actual demand',color:C.sky,vals:asActual},{name:ctx.isArchived?'Archived backtest':'Forward baseline',color:C.teal,vals:asForecast,dash:true}],{width:1030,height:286});
}
function renderOverview(ctx){
 const allHistorical=DATA.history.filter(r=>['category','brand','plant','region','channel'].every(k=>ctx.f[k]==='All'||r[k]===ctx.f[k]));
 const yoyText=ctx.yoy===null?'—':`${ctx.yoy>=0?'+':''}${fmtPct(ctx.yoy)}`;
 const cat=agg(ctx.forecast,'category','forecast_units'),region=agg(ctx.forecast,'region','forecast_units');
 const rows=[
 kpi('Actual Demand · Selected FY',ctx.hasHistory?fmtQty(ctx.histDemand)+' pairs':'—',`${ctx.hMonths.length} observed months · ${ctx.periodLabel}`,C.sky),
 kpi(ctx.isArchived?'Archived Forecast Volume':'Forward Forecast Volume',fmtQty(ctx.futureUnits)+' pairs',ctx.isArchived?'Historical backtest, not a live forecast':`${ctx.pMonths.length} planned month(s) · selected slice`,C.teal),
 kpi(ctx.isArchived?'Historical Sales Proxy':ctx.hasHistory?'FY Revenue · Actual + Plan':'Forecast Revenue Opportunity',money(ctx.actualRevenue+(ctx.isArchived?0:ctx.futureRevenue)),ctx.isArchived?'Fulfilled units × SKU list price':ctx.hasHistory?'Observed sales proxy + forward estimate':'Indicative forecast at SKU list price',C.purple),
 kpi('Comparable Fiscal YoY',yoyText,'Same fiscal months in preceding FY',ctx.yoy===null?C.sky:ctx.yoy>=0?C.teal:C.red),
 kpi('Historical Forecast WAPE',ctx.hasHistory?fmtPct(ctx.wape):'—','Observed FY only · smaller is better',ctx.hasHistory&&ctx.wape<12?C.teal:C.orange),
 kpi('Historical Fill Rate',ctx.hasHistory?fmtPct(ctx.fill):'—','Fulfilled / demanded · actual periods',C.sky),
 kpi(ctx.isArchived?'Recorded Capacity Usage':'Planned Capacity Usage',ctx.capacity?fmtPct(ratio(ctx.planUnits,ctx.capacity)):'—','SKU / plant / selected fiscal months',C.purple),
 kpi('Stock Warning SKUs',fmtInt(ctx.projection.atRiskSkus),ctx.isArchived?'FY-end stock below safety level':'Selected future replenishment horizon',ctx.projection.atRiskSkus?C.red:C.teal)
 ];
 const catData=Object.entries(cat).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
 const regionData=Object.entries(region).map(([label,value])=>({label,value}));
 const fyNames=['FY 2024-25','FY 2025-26','FY 2026-27'];
 const aprOct=fyNames.map(y=>sum(allHistorical.filter(r=>r.fy===y&&r.fiscal_month<=7),'actual_units'));
 let text=heading('FISCAL EXECUTIVE SCORECARD',`${ctx.periodLabel} · ${ctx.hMonths.length} actual / ${ctx.pMonths.length} plan or backtest months`)+`<div class="kpi-grid">${rows.join('')}</div>`;
 text+=`<div class="notice"><strong>FY definition:</strong> 1 April–31 March. FY 2024–25 and FY 2025–26 are complete. FY 2026–27 contains Apr–Oct 2026 actuals and Nov–Mar 2027 forecasts. FY 2027–28 contains Apr–Oct 2027 forecasts only. ${ctx.isArchived?'Historical FY mode uses simulated archived backtests, not future projections.':''}</div>`;
 text+=heading('DEMAND & FY INTELLIGENCE','Every chart shows readable 12px data labels')+`<div class="chart-grid">${panel(ctx.isArchived?'Historical Demand vs Archived Backtest':'Actual Demand → Forward Baseline',ctx.isArchived?'FY monthly actual vs simulated backtest':'Latest observed months and future baseline',demandChart(ctx),[['Actual',C.sky],[ctx.isArchived?'Backtest':'Forecast',C.teal]],true)}${panel('Comparable April–October Demand by FY','Matched 7 fiscal months across all three years (not YTD versus full year)',barChart(fyNames.map(y=>y.replace('FY ','')),[{name:'Apr–Oct actual',color:C.purple,vals:aprOct}],{width:790,height:260}),[['Apr–Oct actual',C.purple]],true)}${panel('Footwear Category Mix',ctx.isArchived?'Historical baseline volume':'Forward demand volume',horizontalChart(catData))}${panel('Region Contribution',ctx.isArchived?'Archived monthly estimate distribution':'Forward demand by zone',horizontalChart(regionData,{width:640}))}</div>`;
 text+=heading('INTELLIGENT PLANNING INSIGHTS','Recalculated with FY and dimension slicers')+insightCards(ctx);
 text+=heading('SKU INVENTORY PRIORITY WATCHLIST',`Stock position: ${ctx.inventoryAsOf} · network-level`)+`<div class="panel">${riskTable(ctx)}</div>`;
 EL('#overview',text)
}
function renderForecast(ctx){
 let cat=Object.keys(agg(ctx.forecast,'category','forecast_units')).sort(),months=ctx.pMonths;
 let byMonth=agg(ctx.forecast,'month','forecast_units'),last=ctx.hist.filter(r=>months.map(m=>shiftYear(m,-1)).includes(r.month));
 let growth=ctx.isArchived?ctx.yoy:last.length?ratio(ctx.futureUnits-sum(last,'actual_units'),sum(last,'actual_units')):null;
 let catSeries=cat.map((k,i)=>({name:k,color:[C.teal,C.sky,C.purple,C.orange][i],vals:months.map(m=>sum(ctx.forecast.filter(r=>r.category===k&&r.month===m),'forecast_units'))}));
 let hist6=DATA.meta.history_months.slice(-6),a=agg(ctx.hist.filter(r=>hist6.includes(r.month)),'month','actual_units');
 let leadSKU=Object.entries(agg(ctx.forecast,'sku','forecast_units')).sort((a,b)=>b[1]-a[1]);
 let text=heading('DEMAND PLANNING METRICS')+`<div class="kpi-grid">${kpi(ctx.isArchived?'Archived Backtest Volume':'Forward Requirement',fmtQty(ctx.futureUnits),'FY-filtered regions / channels',C.teal)}${kpi(ctx.isArchived?'Archived Plan Value':'Revenue Opportunity',money(ctx.futureRevenue),'Illustrative list-price valuation',C.sky)}${kpi(ctx.isArchived?'Comparable YoY Demand':'Forecast Growth vs Prior FY',growth===null?'—':fmtPct(growth),'Same fiscal months versus previous FY',growth!==null&&growth>=0?C.teal:C.red)}${kpi('Historical WAPE',ctx.hasHistory?fmtPct(ctx.wape):'—','Simulated backtest errors only',C.purple)}</div>`;
 text+=heading(ctx.isArchived?'ARCHIVED FORECAST BACKTEST':'BASELINE DEMAND OUTLOOK')+`<div class="chart-grid">${panel('Category Forecast by Month','Monthly forecast grouped into men, women and kids footwear',stackedChart(months.map(shortMonth),catSeries),catSeries.map(s=>[s.name,s.color]),true)}${panel('Total Forecast Run-Rate','Projected monthly footwear pairs',barChart(months.map(shortMonth),[{name:'Demand',color:C.teal,vals:months.map(m=>byMonth[m]||0)}]))}${panel('Top Demand Models','SKU ranking by forward demand',horizontalChart(leadSKU.slice(0,6).map(([label,value])=>({label,value,color:C.sky}))))}</div>`;
 if(ctx.isArchived){text+=`<div class="notice"><strong>Historical FY:</strong> this is a simulated archived forecast/backtest. What-if scenarios only apply to current or future forecasts.</div>`;EL('#forecast',text);return;}
 text+=heading('WHAT-IF SCENARIO STUDIO','Change uplift / promotion to simulate demand · baseline files unchanged');
 text+=`<div class="slider-area"><div><label for="upliftSlider">Macro demand adjustment</label><div class="range-pair"><input id="upliftSlider" type="range" min="-20" max="30" step="1" value="${scenarioUplift}"><strong class="slider-number" id="upliftVal">${scenarioUplift>0?'+':''}${scenarioUplift}%</strong></div></div><div><label for="promoSlider">Promotion-driven uplift</label><div class="range-pair"><input id="promoSlider" type="range" min="0" max="15" step="1" value="${scenarioPromo}"><strong class="slider-number" id="promoVal">+${scenarioPromo}%</strong></div></div><div class="notice">Scenario is a linear illustrative stress test, not a trained elasticity model. It affects this forecast page only.</div></div>`;
 text+=`<div class="chart-grid">${panel('Baseline vs Scenario Demand','Scenario = baseline × (1 + macro %) × (1 + promo %)',`<div id="scenarioChart"></div>`,[['Baseline',C.sky],['Scenario',C.orange]],true)}</div><div id="scenarioKPIs"></div>`;
 EL('#forecast',text);
 for(let id of ['upliftSlider','promoSlider'])$('#'+id).addEventListener('input',()=>{scenarioUplift=Number($('#upliftSlider').value);scenarioPromo=Number($('#promoSlider').value);drawScenario(ctx)});
 drawScenario(ctx);
}
function drawScenario(ctx){
 const baseline=ctx.pMonths.map(m=>sum(ctx.forecast.filter(r=>r.month===m),'forecast_units')),
 factor=(1+scenarioUplift/100)*(1+scenarioPromo/100),simulated=baseline.map(x=>Math.round(x*factor)),supply=ctx.planUnits;
 $('#upliftVal').textContent=(scenarioUplift>0?'+':'')+scenarioUplift+'%';$('#promoVal').textContent='+'+scenarioPromo+'%';
 EL('#scenarioChart',lineChart(ctx.pMonths.map(shortMonth),[{name:'Baseline',color:C.sky,vals:baseline},{name:'Scenario',color:C.orange,vals:simulated}],{width:1030,height:255}));
 let demand=simulated.reduce((a,b)=>a+b,0),gap=Math.max(0,demand-supply),valueDelta=ctx.futureRevenue*(factor-1);
 EL('#scenarioKPIs',heading('SCENARIO IMPACT ANALYSIS')+`<div class="kpi-grid">${kpi('Scenario Volume',fmtQty(demand)+' pairs','Compared with current forecast',C.orange)}${kpi('Demand Change',fmtQty(demand-ctx.futureUnits)+' pairs','Incremental vs baseline',demand>=ctx.futureUnits?C.orange:C.teal)}${kpi('Sales Opportunity Shift',money(valueDelta),'Indicative revenue delta',C.purple)}${kpi('Production Gap',fmtQty(gap)+' pairs','Scenario requirement minus network plan',gap?C.red:C.teal)}</div>`)
}
function renderProduction(ctx){
 let months=ctx.pMonths,allMonthly=agg(ctx.scopeFuture.filter(r=>months.includes(r.month)),'month','forecast_units');
 let actualProd=agg(ctx.supply,'month','planned_production_units'),cap=agg(ctx.supply,'month','production_capacity_units');
 let plantNames=[...new Set(ctx.supply.map(r=>r.plant))].sort();
 let pl=plantNames.map(name=>{let r=ctx.supply.filter(p=>p.plant===name);return {name,production:sum(r,'planned_production_units'),cap:sum(r,'production_capacity_units'),ratio:ratio(sum(r,'planned_production_units'),sum(r,'production_capacity_units'))}});
 let req=Object.values(allMonthly).reduce((a,b)=>a+b,0);let gap=Math.max(0,req-ctx.planUnits);let danger=ctx.supply.filter(r=>r.planned_production_units<r.forecast_units).sort((a,b)=>(b.forecast_units-b.planned_production_units)-(a.forecast_units-a.planned_production_units));
 let text=heading('PRODUCTION & SUPPLY SCORECARD')+`<div class="kpi-grid">${kpi(ctx.isArchived?'Recorded Production':'Planned Production',fmtQty(ctx.planUnits)+' pairs',`Selected ${months.length}-month manufacturing horizon`,C.sky)}${kpi(ctx.isArchived?'Historical Line Capacity':'Available Capacity',fmtQty(ctx.capacity)+' pairs','Planned capacity across SKU lines',C.purple)}${kpi('Capacity Utilization',fmtPct(ratio(ctx.planUnits,ctx.capacity)),'Planned production / total capacity',C.teal)}${kpi(ctx.isArchived?'Archived Forecast Gap':'Net Production Gap',fmtQty(gap)+' pairs','Uncovered baseline demand volume',gap?C.red:C.teal)}</div>`;
 text+=`<div class="notice">Factory data is at SKU–plant–month level. Region/channel filters DO NOT alter network production or capacity totals. In a completed FY these are recorded quantities, not future commitments.</div>`;
 text+=heading('NETWORK CAPACITY & FACTORY OPERATIONS')+`<div class="chart-grid">${panel('Production vs Forecast',ctx.isArchived?'Recorded production vs archived forecast':'Network planned units vs future forecast',barChart(months.map(shortMonth),[{name:'Demand',color:C.sky,vals:months.map(m=>allMonthly[m]||0)},{name:'Production',color:C.teal,vals:months.map(m=>actualProd[m]||0)}],{width:790}),[['Demand',C.sky],['Production',C.teal]],true)}${panel('Capacity Utilization by Plant','Production relative to factory line capacity',horizontalChart(pl.map(x=>({label:x.name,value:x.ratio})),{percent:true}))}${panel('Plant-Month Capacity Heatmap','Red indicates high utilization beyond 95%',heatmap(plantNames.map(name=>({name,vals:months.map(m=>{let q=ctx.supply.filter(x=>x.plant===name&&x.month===m);return ratio(sum(q,'planned_production_units'),sum(q,'production_capacity_units'))})})),months))}</div>`;
 text+=heading('PRODUCTION EXCEPTIONS',`${danger.length} SKU-months with planned production below the baseline`)+`<div class="panel">${cardTable(['MONTH','SKU','PLANT','FORECAST','PLANNED','GAP','UTILIZATION'],danger.slice(0,14).map(x=>[shortMonth(x.month),x.sku,x.plant,fmtInt(x.forecast_units),fmtInt(x.planned_production_units),`<span style="color:${C.red}">${fmtInt(x.forecast_units-x.planned_production_units)}</span>`,fmtPct(ratio(x.planned_production_units,x.production_capacity_units))]))}</div>`;
 EL('#production',text)
}
function renderInventory(ctx){
 const rs=risks(ctx),monthly1=ctx.isArchived?ctx.pMonths.at(-1):ctx.pMonths[0],month1=sum(ctx.scopeFuture.filter(x=>x.month===monthly1),'forecast_units');
 const cover=month1?ctx.stock/month1*30:0,inventoryVal=ctx.stockValue;
 const critical=rs.filter(r=>r.risk==='Critical').length,watch=rs.filter(r=>r.risk==='Watch').length,healthy=rs.filter(r=>r.risk==='Healthy').length;
 const cat=[...new Set(ctx.inventory.map(x=>x.category))].map(category=>{let r=ctx.inventory.filter(x=>x.category===category),d=sum(ctx.scopeFuture.filter(x=>x.category===category&&x.month===monthly1),'forecast_units');return {label:category,value:d?sum(r,'on_hand_units')/d*30:0}});
 let series=ctx.pMonths.map(m=>sum(ctx.projection.rows.filter(x=>x.month===m),'closing'));
 let text=heading('INVENTORY HEALTH INDICATORS')+`<div class="kpi-grid">${kpi(ctx.isArchived?'FY-end On-Hand Stock':'Period Opening Stock',fmtQty(ctx.stock)+' pairs',`Stock position: ${ctx.inventoryAsOf}`,C.sky)}${kpi('Coverage Days',fmt1(cover)+' days',ctx.isArchived?'FY-end stock / last selected month demand × 30':'Opening stock / next-month demand × 30',cover<25?C.orange:C.teal)}${kpi('Inventory Value',money(inventoryVal),'Units × standard unit cost (illustrative)',C.purple)}${kpi('Critical SKU Risks',fmtInt(critical),ctx.isArchived?'FY-end stock below critical threshold':'Projected below safety / stockout',critical?C.red:C.teal)}</div>`;
 text+=heading('STOCK QUALITY & COVERAGE')+`<div class="chart-grid half">${panel('SKU Portfolio Risk Split','Projected safety-stock risk through selected horizon',donutChart([{name:'Healthy',value:healthy,color:C.teal},{name:'Watch',value:watch,color:C.orange},{name:'Critical',value:critical,color:C.red}]))}${panel('Stock Cover by Category',ctx.isArchived?'FY-end stock vs last observed month':'On-hand stock divided by next-month category demand',horizontalChart(cat,{days:true}))}</div>`;
 text+=heading(ctx.isArchived?'HISTORICAL INVENTORY MOVEMENTS':'PROJECTED RUNWAY')+`<div class="chart-grid">${panel(ctx.isArchived?'Recorded Month-End Inventory':'Network Closing Inventory Outlook',ctx.isArchived?'Recorded monthly SKU month-end stock (historical)':'Opening stock + planned output − forecast demand; floor 0',lineChart(ctx.pMonths.map(shortMonth),[{name:'Closing Inventory',color:C.purple,vals:series}],{width:1030}),[['Closing stock',C.purple]],true)}</div>`;
 text+=heading('SKU RISK REGISTER','Most urgent models first')+`<div class="panel">${cardTable(['SKU / MODEL','PLANT','STOCK','SAFETY STOCK','NEXT MONTH','COVER DAYS','SHORTFALL','RISK'],rs.map(r=>[`${r.sku} · ${svgText((DATA.products.find(x=>x.sku===r.sku)||{}).model||'')}`,r.plant,fmtInt(r.on_hand_units),fmtInt(r.safety_stock_units),fmtInt(r.month1Demand),fmt1(r.days)+' d',fmtQty(r.shortage),statusTag(r.risk)]))}</div>`;
 EL('#inventory',text)
}
function renderAccuracy(ctx){
 let months=ctx.hMonths,byMonth=months.map(m=>{let r=ctx.history.filter(x=>x.month===m),act=sum(r,'actual_units'),pred=sum(r,'backtest_forecast_units');return {m,actual:act,pred,wape:ratio(r.reduce((n,x)=>n+Math.abs(x.actual_units-x.backtest_forecast_units),0),act),bias:ratio(pred-act,act)}});
 const byCat=[...new Set(ctx.history.map(x=>x.category))].sort().map(c=>{let rr=ctx.history.filter(x=>x.category===c),act=sum(rr,'actual_units'),fore=sum(rr,'backtest_forecast_units');return {label:c,wape:ratio(rr.reduce((v,x)=>v+Math.abs(x.actual_units-x.backtest_forecast_units),0),act),bias:ratio(fore-act,act)}});
 const channels=[...new Set(ctx.history.map(x=>x.channel))].map(c=>{let rr=ctx.history.filter(x=>x.channel===c);return {label:c,value:ratio(rr.reduce((v,x)=>v+Math.abs(x.actual_units-x.backtest_forecast_units),0),sum(rr,'actual_units'))}});
 let text=heading('MODEL PERFORMANCE SCORECARD')+`<div class="kpi-grid">${kpi('Weighted Abs. % Error',ctx.hasHistory?fmtPct(ctx.wape):'—','WAPE = Σ |A−F| / Σ A',ctx.wape<12?C.teal:C.orange)}${kpi('Forecast Accuracy Proxy',ctx.hasHistory?fmtPct(Math.max(0,100-ctx.wape)):'—','100 − WAPE, reporting proxy',C.sky)}${kpi('Forecast Bias',ctx.hasHistory?`${ctx.bias>=0?'+':''}${fmtPct(ctx.bias)}`:'—','Σ (F−A) / Σ A; + means over-plan',Math.abs(ctx.bias)>5?C.orange:C.teal)}${kpi('Unit Fill Rate',ctx.hasHistory?fmtPct(ctx.fill):'—','Actual fulfilled pairs / demand',C.purple)}</div>`;
 if(!ctx.hasHistory){text+=`<div class="notice"><strong>Future fiscal year:</strong> observed actuals and backtest statistics are not yet available for ${ctx.periodLabel}. Choose FY 2025–26 or FY 2026–27 to see meaningful WAPE, forecast bias and fill-rate diagnostics.</div>`;EL('#accuracy',text);return;}
 text+=heading('HISTORICAL BACKTEST DETAIL')+`<div class="chart-grid">${panel('Monthly Forecast WAPE','Error rate for the selected historical period',lineChart(months.map(shortMonth),[{name:'WAPE',color:C.orange,vals:byMonth.map(x=>x.wape)}],{width:1030,height:272,percent:true}),[['WAPE',C.orange]],true)}${panel('Category Weighted Forecast Error','Smaller WAPE means more reliable forecast',horizontalChart(byCat.map(x=>({label:x.label,value:x.wape})),{percent:true}))}${panel('Channel Forecast Error','Backtest error by sales channel',horizontalChart(channels.map((x,i)=>({label:x.label,value:x.value,color:[C.purple,C.sky,C.teal][i]})),{percent:true}))}</div>`;
 text+=heading('MONTHLY OBSERVED VS PREDICTED','Historical forecast values are synthetic backtest samples')+`<div class="panel">${cardTable(['MONTH','ACTUAL PAIRS','BACKTEST FORECAST','ABS. ERROR (WAPE)','BIAS'],byMonth.map(x=>[shortMonth(x.m),fmtInt(x.actual),fmtInt(x.pred),fmtPct(x.wape),`<span style="color:${Math.abs(x.bias)>5?C.orange:C.teal}">${x.bias>=0?'+':''}${fmtPct(x.bias)}</span>`]))}</div>`;
 EL('#accuracy',text)
}
function renderExplorer(ctx){
 const kinds={history:['Historical Demand',ctx.history],forecast:['Forward Forecast',ctx.forecast],production:['Production Plan',ctx.supply],inventory:['Inventory Snapshot',ctx.inventory]};
 const [type,items]=kinds[tableKind];let rows=items.filter(r=>!searchText||Object.values(r).some(v=>String(v).toLowerCase().includes(searchText.toLowerCase())));
 const headers=({history:['month','fy','fiscal_quarter','sku','category','plant','region','channel','actual_units','backtest_forecast_units','fulfilled_units','net_sales_inr'],forecast:['month','fy','fiscal_quarter','sku','category','region','channel','forecast_units','forecast_revenue_inr'],production:['month','fy','record_type','sku','plant','forecast_units','planned_production_units','production_capacity_units'],inventory:['month','fy','sku','plant','category','on_hand_units','safety_stock_units','unit_cost_inr','lead_time_days']})[tableKind];
 const count=Math.ceil(rows.length/25);tablePage=Math.max(0,Math.min(tablePage,count-1));let itemsShown=rows.slice(tablePage*25,(tablePage+1)*25);
 let text=heading('DATA MODEL & ROW-LEVEL EXPLORER')+`<div class="kpi-grid">${kpi('Historical Rows',fmtInt(ctx.history.length),'Selected FY / history window',C.sky)}${kpi('Forecast Rows',fmtInt(ctx.forecast.length),'FY-selected planning / backtest rows',C.teal)}${kpi('SKU Master',fmtInt(DATA.products.length),'Unique footwear models',C.purple)}${kpi('Filtered Rows',fmtInt(rows.length),type,C.orange)}</div>`;
 text+=heading('TRANSACTION EXPLORER')+`<div class="panel"><div class="toolbar"><select id="tableKind">${Object.entries(kinds).map(([k,v])=>`<option value="${k}" ${tableKind===k?'selected':''}>${v[0]}</option>`).join('')}</select><input type="search" id="searchText" placeholder="Find SKU, region, category..." value="${svgText(searchText)}"><button class="top-btn" id="exportTable">↓ Download Filtered CSV</button><span class="pill">${fmtInt(rows.length)} records</span></div><div id="explorerTable">${cardTable(headers.map(x=>x.replace(/_/g,' ').toUpperCase()),itemsShown.map(r=>headers.map(h=>typeof r[h]==='number'?fmtInt(r[h]):svgText(r[h]))))}</div><div class="toolbar page-bottom"><button class="top-btn" id="prevPage">← Previous</button><span class="pill">Page ${count?tablePage+1:0} of ${count}</span><button class="top-btn" id="nextPage">Next →</button></div></div>`;
 text+=`<div class="notice">Data grain: demand = month × SKU × region × channel; production = month × SKU × plant; inventory = SKU snapshot. Do not directly sum capacity after joining region / channel demand tables because this duplicates plant-level values.</div>`;
 EL('#explorer',text);
 $('#tableKind').onchange=e=>{tableKind=e.target.value;tablePage=0;renderExplorer(context())};
 $('#searchText').oninput=e=>{searchText=e.target.value;tablePage=0;renderExplorer(context());$('#searchText').focus();$('#searchText').setSelectionRange(searchText.length,searchText.length)};
 $('#prevPage').onclick=()=>{tablePage--;renderExplorer(context())};$('#nextPage').onclick=()=>{tablePage++;renderExplorer(context())};
 $('#exportTable').onclick=()=>saveCSV(`footwear_${tableKind}_filtered.csv`,rows)
}
function render(){let ctx=context();let year=ctx.f.fy;$('#fyBadge').textContent=year==='All'?'ALL FISCAL YEARS':fiscalName(year);$('#periodLabel').textContent=ctx.isArchived?'APR–MAR · ACTUAL FY':ctx.isFutureFY?'APR–OCT 2027 · PLAN':year==='All'?'APR 2024 – OCT 2027':'APR 2026 – MAR 2027';$('#periodSub').textContent=ctx.isArchived?'COMPLETE HISTORICAL FY':ctx.isFutureFY?'FORECAST ONLY · PARTIAL FY':year==='All'?'ACTUAL + FUTURE · ALL FYS':'APR–OCT ACTUAL + NOV–MAR PLAN';renderOverview(ctx);renderForecast(ctx);renderProduction(ctx);renderInventory(ctx);renderAccuracy(ctx);renderExplorer(ctx);}
function navigate(page){activePage=page;document.querySelectorAll('.nav-btn').forEach(n=>n.classList.toggle('active',n.dataset.page===page));document.querySelectorAll('.nav-pages').forEach(n=>n.classList.toggle('active',n.id===page));let [crumb,title,sub]=PAGE_META[page];$('#breadcrumb').textContent=crumb;$('#mainTitle').textContent=title;$('#mainSubtitle').textContent=sub;window.scrollTo({top:0,behavior:'smooth'})}
function saveCSV(filename,rows){if(!rows.length){alert('No rows to export for these filters.');return}let cols=Object.keys(rows[0]),esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"',csv=[cols.map(esc).join(','),...rows.map(r=>cols.map(k=>esc(r[k])).join(','))].join('\r\n');let blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportView(){let ctx=context(),page=activePage,cols=[];
 if(page==='overview'){cols=ctx.forecast;}
 else if(page==='forecast')cols=ctx.forecast;
 else if(page==='production')cols=ctx.supply;
 else if(page==='inventory')cols=ctx.inventory;
 else if(page==='accuracy')cols=ctx.history;
 else cols=tableKind==='history'?ctx.history:tableKind==='forecast'?ctx.forecast:tableKind==='production'?ctx.supply:ctx.inventory;
 saveCSV(`footwear_${page}_export.csv`,cols)
}
function parseCSV(str){
 const lines=[],cols=[];let cur='',row=[],quoted=false;
 for(let i=0;i<str.length;i++){let c=str[i];if(c==='"'){if(quoted&&str[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cur);cur=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&str[i+1]==='\n')i++;row.push(cur);cur='';if(row.some(x=>x.trim()))lines.push(row);row=[]}else cur+=c}
 if(cur||row.length){row.push(cur);lines.push(row)}if(!lines.length)throw Error('CSV file is empty.');
 const header=lines.shift().map(x=>x.trim().replace(/^\ufeff/,''));
 let req=['month','sku','category','segment','brand','plant','region','channel','actual_units','backtest_forecast_units','fulfilled_units','net_sales_inr'];
 let miss=req.filter(x=>!header.includes(x));if(miss.length)throw Error('Missing columns: '+miss.join(', '));
 return lines.map((vals,i)=>{let result={};header.forEach((name,j)=>result[name]=name.endsWith('_units')||name.endsWith('_inr')?Number(vals[j]):(vals[j]||'').trim());if(!/^\d{4}-\d{2}$/.test(result.month)||!Number.isFinite(result.actual_units)||result.actual_units<0)throw Error('Invalid row '+(i+2));return result})
}
async function maybeLoadHostedCSV(){
 if(location.protocol==='file:'||!/^https?:$/.test(location.protocol))return;
 // A GitHub Pages site refreshes on navigation after the CSV files are committed.
 const names=[['history','demand_history.csv'],['forecast','demand_forecast.csv'],['production','production_plan.csv'],['inventory_history','inventory_history.csv'],['inventory','inventory_snapshot.csv'],['products','product_master.csv']];
 try{let next={...DATA};const responses=await Promise.all(names.map(async([k,file])=>{const res=await fetch('./data/'+file,{cache:'no-store'});if(!res.ok)throw Error(file+': HTTP '+res.status);return [k,parseGenericCSV(await res.text())]}));for(let [k,v] of responses)next[k]=v;DATA=next;buildOptions();render();$('#dataStatus').textContent='CSV-SYNCED DEMO'}catch(e){console.warn('Using embedded offline sample data:',e.message)}
}
function parseGenericCSV(str){const lines=[],row=[],headers=[];let cur='',quoted=false,fields=[];
 for(let i=0;i<str.length;i++){let c=str[i];if(c==='"'){if(quoted&&str[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){fields.push(cur);cur=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&str[i+1]==='\n')i++;fields.push(cur);if(fields.some(x=>x.trim()))lines.push(fields);fields=[];cur=''}else cur+=c}
 if(cur||fields.length){fields.push(cur);lines.push(fields)}if(!lines.length)return [];
 const header=lines.shift().map(x=>x.trim().replace(/^\ufeff/,''));return lines.map(vals=>{let x={};header.forEach((h,i)=>{let v=vals[i]??'';x[h]=/_units$|_inr$|_days$|^fiscal_month$/.test(h)?Number(v):v});return x})
}
function init(){buildOptions();$('#nav').addEventListener('click',e=>{let b=e.target.closest('[data-page]');if(b)navigate(b.dataset.page)});
 for(let id of filterIDs)$('#'+id).addEventListener('change',()=>{tablePage=0;render()});
 $('#resetFilters').onclick=()=>{for(let id of filterIDs)$('#'+id).value=id==='fy'?'FY 2026-27':['historyWindow','horizon'].includes(id)?'all':'All';scenarioUplift=0;scenarioPromo=0;searchText='';tablePage=0;render()};
 $('#exportBtn').onclick=exportView;$('#printBtn').onclick=()=>window.print();
 $('#importBtn').onclick=()=>$('#importInput').click();
 $('#importInput').onchange=async e=>{let file=e.target.files?.[0];if(!file)return;try{const rows=parseCSV(await file.text());DATA={...DATA,history:rows.map(x=>({...x,fy:x.fy||fyOf(x.month),fiscal_month:x.fiscal_month||((Number(x.month.slice(5,7))+8)%12+1),fiscal_quarter:x.fiscal_quarter||'Q'+Math.ceil(((Number(x.month.slice(5,7))+8)%12+1)/3)}))};buildOptions();render();$('#dataStatus').textContent='IMPORTED HISTORY';alert('Imported '+fmtInt(rows.length)+' history rows for this browser session. Forward plan and inventory remain demo data.');}catch(err){alert('Import failed: '+err.message)}finally{e.target.value=''}};
 render();navigate('overview');maybeLoadHostedCSV();
}
init();
