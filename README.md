# Footwear Demand & Supply Intelligence — Fiscal-Year Edition

**Power BI-style interactive HTML dashboard** for a fictional Indian footwear manufacturer. Includes **two full financial years of historical data**, year-to-date actuals, forward demand planning, production and inventory risk.

[Footwear Fiscal Demand and Supply Control Tower](assets/linkedin_01_executive.jpg)

> **All data is synthetic and designed for a portfolio demonstration.** Product names, factory capacity, sales, production history, demand forecasts, stock movements and accuracy figures are fictitious. Archived forecast/backtest estimates and future forecasts are illustrative, **not trained ML predictions**.

## Financial-year coverage (April–March)

| Period | Status | Months in dataset | Use |
|---|---|---:|---|
| **FY 2024–25** | Complete actual | Apr 2024 – Mar 2025 (12) | Historical demand, accuracy, production and month-end stock |
| **FY 2025–26** | Complete actual | Apr 2025 – Mar 2026 (12) | Historical year-on-year comparison and backtest |
| **FY 2026–27** | Current mixed FY | Apr–Oct 2026 **actual** (7), Nov 2026–Mar 2027 **plan** (5) | YTD performance + balance-of-year S&OP |
| **FY 2027–28** | Partial forward FY | Apr–Oct 2027 **forecast** (7) | Extended horizon; future FY not complete |

**Last observed date:** October 31, 2026. **Forward baseline:** November 2026–October 2027 (12 months). The FY selector also offers **All Financial Years**.

## Interactive dashboard

Six pages: **Executive Overview**, **Demand Forecast**, **Production & Capacity**, **Inventory & Risk**, **Forecast Performance** and **Data Explorer**.

- **Power BI-like slicers**: Financial Year (Apr–Mar), footwear category, brand, manufacturing plant, region, trade channel, historical window and planning window.
- **FY reporting semantics**: completed FYs show observed demand and historic *simulated backtest forecasts*; current FY combines YTD actuals with remaining FY forecasts; FY 2027–28 shows forward planning only.
- **Comparable FY reporting**: the executive chart compares **April–October demand across FY2024–25, FY2025–26 and FY2026–27** to avoid misleading seven-month versus full-year comparisons.
- **Executive KPIs**: actual demand, forward or archived demand estimates, sales proxy/revenue forecast, like-for-like FY YoY, historical WAPE, fill rate, utilization and stock-risk SKU counts.
- **Intelligent rules-based insights** respond to FY/attribute filters; forecast bias, inventory coverage, production exceptions and SKU prioritization are visible.
- **Demand scenario studio** varies macro demand (-20% to +30%) and promotional uplift (0% to +15%) for current/future forecasts; unavailable for completed FYs.
- **Manufacturing stock flow** bridges November–March before FY 2027–28 forecasts, so the April 2027 opening stock isn't erroneously treated as October 2026 stock.
- Chart data labels use **12px font**, visible in SVG. No external JS, charting CDN, Power BI paid license or API key required.
- Excel dataset, individual CSVs, screenshots, downloadable filtered CSVs and an offline single-HTML edition included.

**Important aggregation rule:** plant production/capacity and inventory are at SKU/plant/month or SKU/month-end grain. **Region and channel slicers modify demand, but do not duplicate or slice plant-level production/inventory**; otherwise aggregations would be wrong. Dimension filters (category, brand, plant) affect both.

## Dataset model

| CSV | Grain | Rows |
|---|---|---:|
| `demand_history.csv` | month × SKU × region × sales channel | 6,696 |
| `demand_forecast.csv` | month × SKU × region × sales channel | 2,592 |
| `production_plan.csv` | month × SKU × plant | 774 |
| `inventory_history.csv` | observed month-end × SKU | 558 |
| `inventory_snapshot.csv` | 31 October 2026 snapshot × SKU | 18 |
| `product_master.csv` | footwear SKU dimension | 18 |
| `fiscal_calendar.csv` | fiscal month dimension | 43 |
| `monthly_summary.csv` | one row per month, observed or forecast | 43 |

18 SKUs, 3 fictional plants (Kolkata, Agra and Chennai), 4 Indian distribution zones, 3 sales channels and Men/Women/Kids footwear. Amounts are INR and volumes are footwear **pairs**.

### Excel workbook

`data/Footwear_Demand_Planning_FY2024-28.xlsx` contains **START HERE**, **FY Comparison** and eight data sheets (Fiscal Calendar, Monthly Summary, Product Master, Demand History, Demand Forecast, Production Plan, Inventory History, Inventory Snapshot). The fiscal comparison calculations use Excel formulas and row-level absolute errors aggregated into Monthly Summary.

### Main measures

- **Demand:** sum of actual or estimated units within the selected FY months.
- **WAPE:** `Σ at row level |Actual - Archived Backtest| ÷ Σ Actual × 100`. Backtest is synthetic.
- **Forecast bias:** `Σ (Backtest - Actual) ÷ Σ Actual × 100`. Positive means over-forecast.
- **Fill rate:** `Σ Fulfilled Units ÷ Σ Actual Demand Units × 100`.
- **Capacity utilization:** `Σ Recorded or Planned Factory Units ÷ Σ Available Factory Capacity Units × 100`.
- **Like-for-like YoY:** FY current 7 observed months versus the **same** seven fiscal months in prior FY; prior full FY versus the full prior FY.
- **Inventory projection:** `Ending Stock = MAX(0, Opening Stock + Planned Production - Forecast Demand)`; unmet demand tracked independently.
- **Indicative sales/revenue:** fulfilled historical pairs × SKU list price; future demand pairs × SKU list price. This is **not booked financial revenue** or an audited P&L.

## Regenerate synthetic source data

Use `python3 scripts/generate_sample_data.py` from the repository root (Python standard library only) to regenerate the CSV samples and bundled `dashboard-data.js`. The checked-in Excel workbook is a separate formatted delivery and must be rebuilt after major data regeneration.

## Launch offline

Download `Footwear_Demand_Intelligence_Offline.html` (included separately), double-click it and open in Chrome, Safari or Edge. This self-contained single file bundles CSS, JavaScript and all sample data. No server required.

Alternatively extract the repository ZIP and open `index.html` with its folders intact. It uses `data/dashboard-data.js` in offline mode.

**Stack:** HTML5 · CSS3 · JavaScript · SVG · Excel · CSV · GitHub Pages · Financial Year / Fiscal Calendar Analytics · Demand Planning · S&OP.

<img width="2333" height="2870" alt="production_full" src="https://github.com/user-attachments/assets/a78bce5c-54c7-4d5e-b4d1-103a303d5c1e" />
<img width="2333" height="3839" alt="overview_full" src="https://github.com/user-attachments/assets/de4c440a-c3d2-4bac-9e66-42e23ba9649d" />
<img width="2333" height="2750" alt="inventory_full" src="https://github.com/user-attachments/assets/38e8dd88-4703-4808-a1ea-2969100d07a3" />
<img width="2333" height="3113" alt="forecast_full" src="https://github.com/user-attachments/assets/261f1ffc-100e-4c5b-a16b-5895061113d9" />
<img width="2333" height="1773" alt="explorer_full" src="https://github.com/user-attachments/assets/892a00d0-1aff-4fb9-8990-694cc1a91893" />
<img width="2333" height="2472" alt="accuracy_full" src="https://github.com/user-attachments/assets/26a63f92-d34e-4431-a6b5-b484f4b77376" />



 
 
