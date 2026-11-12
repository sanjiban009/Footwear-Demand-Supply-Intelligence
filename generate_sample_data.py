import csv,json,random,math
from pathlib import Path
from collections import defaultdict
r=random.Random(774126)
out=Path(__file__).resolve().parents[1];data=out/'data';data.mkdir(exist_ok=True,parents=True)
regions=['East','North','South','West']; channels=['Distributor','Modern Trade','E-commerce'];plants=['Kolkata Plant','Agra Plant','Chennai Plant']
models=[('Men','Running','AeroRun','STRIDE','Agra Plant',1799),('Men','Running','SprintPro','STRIDE','Agra Plant',2199),('Men','Casual','MetroWalk','URBAN','Kolkata Plant',1499),('Men','Casual','FlexStreet','URBAN','Kolkata Plant',1699),('Men','Formal','ClassicOxford','HERITAGE','Agra Plant',2499),('Men','Sandals','TrailLite','STRIDE','Chennai Plant',999),('Women','Running','SwiftFit','STRIDE','Chennai Plant',1899),('Women','Casual','CityBloom','URBAN','Kolkata Plant',1599),('Women','Casual','EverydaySlip','URBAN','Kolkata Plant',1299),('Women','Formal','Elegance','HERITAGE','Agra Plant',1999),('Women','Sandals','Coastline','STRIDE','Chennai Plant',1199),('Women','Sandals','ComfortFlex','URBAN','Chennai Plant',1099),('Kids','School','SchoolAce','HERITAGE','Kolkata Plant',999),('Kids','School','CampusMax','HERITAGE','Kolkata Plant',1099),('Kids','Sports','JuniorDash','STRIDE','Agra Plant',1299),('Kids','Sports','PlayRunner','STRIDE','Agra Plant',1399),('Kids','Sandals','TinySteps','URBAN','Chennai Plant',799),('Kids','Casual','HappyWalk','URBAN','Kolkata Plant',899)]
products=[]
for n,(cat,seg,name,brand,plant,price) in enumerate(models,1):
 products.append(dict(sku=f'FW-{n:03}',model=name,category=cat,segment=seg,brand=brand,plant=plant,unit_price_inr=price,unit_cost_inr=round(price*(.54+r.uniform(-.035,.045))),lead_time_days=r.choice([12,16,20,25,30]),size_range=('6-11' if cat=='Men' else '3-8' if cat=='Women' else '9C-5Y')))

def months(y,m,n):
 arr=[]
 for _ in range(n):arr.append(f'{y:04}-{m:02}');m+=1;y+=(m>12);m=1 if m>12 else m
 return arr
histmonths=months(2024,4,31);futuremonths=months(2026,11,12);allmonths=histmonths+futuremonths

def fy(month):
 y,m=int(month[:4]),int(month[5:]);a=y if m>=4 else y-1
 return f'FY {a}-{str(a+1)[-2:]}'
def fq(month):return f'Q{((int(month[5:])-4)%12)//3+1}'
def fm(month):return (int(month[5:])-4)%12+1
def fattrs(month):return dict(fy=fy(month),fiscal_quarter=fq(month),fiscal_month=fm(month))

def season(m,seg):
 d={1:.89,2:.91,3:.98,4:1.04,5:1.07,6:.98,7:.91,8:1.05,9:1.14,10:1.28,11:1.22,12:1.12}
 if seg=='School':d={1:1.07,2:1.12,3:1.23,4:1.34,5:1.20,6:1.01,7:1.06,8:1.17,9:1.00,10:.91,11:.86,12:.84}
 elif seg=='Sandals':d[4]=1.26;d[5]=1.24;d[10]=1.08;d[11]=.97
 elif seg=='Formal':d[10]=1.37;d[11]=1.30
 return d[int(m[-2:])]
regw={'East':1.17,'North':1.24,'South':1.01,'West':1.10};channelw={'Distributor':1.40,'Modern Trade':.79,'E-commerce':.69}
base_sku={p['sku']:r.randint(130,237) * (1+0.03*(i%4)) for i,p in enumerate(products)}
history=[]
for p in products:
 for j,month in enumerate(histmonths):
  for reg in regions:
   for chan in channels:
    year_growth=1.0 if month<'2025-04' else 1.105 if month<'2026-04' else 1.105*1.078
    channel_growth=1 if chan!='E-commerce' else 1+(.07 if month<'2025-04' else .15 if month<'2026-04' else .24)
    market_quirk=1+0.024*math.sin(j*1.41+int(p['sku'][-2:])*.87)
    qty=max(15,round(base_sku[p['sku']]*regw[reg]*channelw[chan]*season(month,p['segment'])*year_growth*channel_growth*market_quirk*r.uniform(.93,1.075)))
    # 2026 archived forecasts use slightly tighter simulated accuracy than in 2024.
    error=r.gauss(.007 if chan!='E-commerce' else .035,.093 if month<'2025-04' else .075)
    pred=max(1,round(qty*(1+error)))
    service=max(.938,min(.997,r.gauss(.981,.011)))
    fulfilled=min(qty,round(qty*service))
    history.append(dict(month=month,**fattrs(month),sku=p['sku'],category=p['category'],segment=p['segment'],brand=p['brand'],plant=p['plant'],region=reg,channel=chan,actual_units=qty,backtest_forecast_units=pred,fulfilled_units=fulfilled,net_sales_inr=fulfilled*p['unit_price_inr']))

by_sku_actual=defaultdict(int);by_sku_fulfilled=defaultdict(int);by_sku_pred=defaultdict(int);by_sku_reg=defaultdict(int)
for x in history:
 by_sku_actual[x['sku'],x['month']]+=x['actual_units'];by_sku_fulfilled[x['sku'],x['month']]+=x['fulfilled_units'];by_sku_pred[x['sku'],x['month']]+=x['backtest_forecast_units'];by_sku_reg[x['sku'],x['region'],x['channel'],x['month']]+=x['actual_units']

production=[];inventory_history=[];stock_by_sku={}
for p in products:
 sku=p['sku'];initial=round(by_sku_actual[sku,histmonths[0]]*r.uniform(.78,1.32));opening=initial
 for j,m in enumerate(histmonths):
  actual=by_sku_actual[sku,m];fulfilled=by_sku_fulfilled[sku,m];pred=by_sku_pred[sku,m]
  # Model stocking policy as a combination of safety stock and replenishment, with occasional factory downtime.
  season_target=actual*(.52 + r.uniform(-.10,.20));safety=round(actual*.47)
  if (int(sku[-3:]) in {2,5,8,11,14,17}) and j>=28:season_target=actual*r.uniform(.17,.28)
  needed=max(0,round(fulfilled+season_target-opening))
  cap=max(round(actual*r.uniform(1.13,1.31)),round(needed*1.03))
  prod=min(cap,max(0,round(needed*r.uniform(.96,1.045))))
  if (j%13==7 and int(sku[-3:])%5==0):prod=min(prod,round(actual*.85))
  prod=max(prod,fulfilled-opening+100) # cannot ship more pairs than available
  cap=max(cap,prod)
  closing=max(0,opening+prod-fulfilled)
  inventory_history.append(dict(month=m,**fattrs(m),sku=sku,category=p['category'],segment=p['segment'],brand=p['brand'],plant=p['plant'],on_hand_units=closing,safety_stock_units=safety,reorder_point_units=round(actual*.78),open_purchase_orders_units=round(actual*r.uniform(.19,.39)),unit_cost_inr=p['unit_cost_inr'],lead_time_days=p['lead_time_days']))
  production.append(dict(month=m,**fattrs(m),record_type='Actual',sku=sku,category=p['category'],segment=p['segment'],brand=p['brand'],plant=p['plant'],forecast_units=pred,planned_production_units=prod,production_capacity_units=cap,production_cost_inr=prod*p['unit_cost_inr']))
  opening=closing
 stock_by_sku[sku]=closing

inventory=[x for x in inventory_history if x['month']=='2026-10']
forecast=[]
for p in products:
 sku=p['sku'];last12=[by_sku_actual[sku,m] for m in histmonths[-12:]];l12=sum(last12)/12
 split={}
 for reg in regions:
  for chan in channels:split[reg,chan]=sum(by_sku_reg[sku,reg,chan,m] for m in histmonths[-12:])
 denom=sum(split.values())
 for j,m in enumerate(futuremonths):
  lastyear=f'{int(m[:4])-1}-{m[-2:]}';lastyear_qty=by_sku_actual.get((sku,lastyear))
  season_base=l12*season(m,p['segment'])/(sum(season(mm,p['segment']) for mm in histmonths[-12:])/12)
  # blend prior-year same-month with seasonally adjusted trailing run rate.
  base=season_base*1.085
  if lastyear_qty:base=.58*(lastyear_qty*1.086)+.42*base
  qty=max(5,round(base*(1+j*.002)*r.uniform(.986,1.018)))
  remaining=qty
  for idx,(reg,chan) in enumerate(split):
   part=remaining if idx==len(split)-1 else round(qty*split[reg,chan]/denom)
   remaining-=part
   forecast.append(dict(month=m,**fattrs(m),sku=sku,category=p['category'],segment=p['segment'],brand=p['brand'],plant=p['plant'],region=reg,channel=chan,forecast_units=part,forecast_revenue_inr=part*p['unit_price_inr'],forecast_version='Baseline Nov-2026'))
  capacity=max(round(qty*r.uniform(1.11,1.30)),round(qty*.94))
  scheduled=min(capacity,round(qty*r.uniform(1.008,1.06)))
  if int(sku[-3:]) in {2,5,8,11,14,17}:scheduled=min(scheduled,round(qty*r.uniform(.78,.90)))
  production.append(dict(month=m,**fattrs(m),record_type='Plan',sku=sku,category=p['category'],segment=p['segment'],brand=p['brand'],plant=p['plant'],forecast_units=qty,planned_production_units=scheduled,production_capacity_units=capacity,production_cost_inr=scheduled*p['unit_cost_inr']))

calendar=[dict(month=m,**fattrs(m),calendar_year=int(m[:4]),calendar_month=int(m[5:]),period_type=('Actual' if m in histmonths else 'Forecast'),fy_start=f'{int(m[:4]) if int(m[-2:])>=4 else int(m[:4])-1}-04-01') for m in allmonths]
summary=[]
for m in allmonths:
 h=[x for x in history if x['month']==m];f=[x for x in forecast if x['month']==m];s=[x for x in production if x['month']==m]
 summary.append(dict(month=m,**fattrs(m),period_type='Actual' if h else 'Forecast',actual_demand_pairs=sum(x['actual_units'] for x in h),backtest_forecast_pairs=sum(x['backtest_forecast_units'] for x in h),abs_error_pairs=sum(abs(x['actual_units']-x['backtest_forecast_units']) for x in h),fulfilled_pairs=sum(x['fulfilled_units'] for x in h),forward_forecast_pairs=sum(x['forecast_units'] for x in f),production_pairs=sum(x['planned_production_units'] for x in s),capacity_pairs=sum(x['production_capacity_units'] for x in s),revenue_inr=sum(x['net_sales_inr'] for x in h) if h else sum(x['forecast_revenue_inr'] for x in f)))

def writecsv(filename,arr):
 with (data/filename).open('w',newline='',encoding='utf-8') as f:
  w=csv.DictWriter(f,fieldnames=list(arr[0]));w.writeheader();w.writerows(arr)
for name,rows in [('demand_history.csv',history),('demand_forecast.csv',forecast),('production_plan.csv',production),('inventory_history.csv',inventory_history),('inventory_snapshot.csv',inventory),('product_master.csv',products),('fiscal_calendar.csv',calendar),('monthly_summary.csv',summary)]:writecsv(name,rows)
meta={'data_as_of':'2026-10-31','history_months':histmonths,'forecast_months':futuremonths,'fiscal_years':list(dict.fromkeys(fy(m) for m in allmonths)), 'fy_complete':['FY 2024-25','FY 2025-26'], 'fy_current':'FY 2026-27','fy_future':'FY 2027-28','units':'pairs','currency':'INR','note':'Synthetic illustrative data, not actual company transactions. Two complete April-March fiscal years, seven actual months of FY2026-27, and 12 months of forward baseline. Forecast backtests are simulated planning estimates; forward baseline uses a seasonal trend heuristic.'}
(data/'metadata.json').write_text(json.dumps(meta,indent=2))
embedded=dict(history=history,forecast=forecast,production=production,inventory=inventory,inventory_history=inventory_history,products=products,calendar=calendar,summary=summary,meta=meta)
(data/'dashboard-data.js').write_text('window.DASHBOARD_DATA='+json.dumps(embedded,separators=(',',':'),ensure_ascii=False)+';',encoding='utf-8')
print('DATA rows:',{x:len(y) for x,y in [('history',history),('forecast',forecast),('production',production),('inventory_history',inventory_history)]});print('FY:',meta['fiscal_years']);print('JSON MB:',round((data/'dashboard-data.js').stat().st_size/1e6,2))
for fyear in meta['fiscal_years']:
 v=sum(x['actual_units'] for x in history if x['fy']==fyear);fore=sum(x['forecast_units'] for x in forecast if x['fy']==fyear)
 print(fyear,'demand actual',v,'future',fore)
