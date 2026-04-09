# FolioMaster AI

FolioMaster AI is a mutual fund portfolio management demo built with React, TypeScript, and Vite. It simulates a distributor-facing wealth dashboard and a client-facing portfolio portal in a single frontend application.

The project focuses on:
- portfolio tracking across clients, folios, and funds
- holdings and return calculations from transaction history
- goal planning and family grouping
- live NAV refresh from MFAPI
- AI-assisted portfolio commentary with Gemini or a local fallback
- alerts, analytics, CSV export, and transaction import

## What The Project Does

The app supports two working modes:
- `DISTRIBUTOR`: manage multiple clients under an ARN, group families, review analytics, and drill down into an individual client portfolio
- `CLIENT`: view one client portfolio, transactions, goals, analytics, and AI advice

At startup, the app opens a role switcher modal. After a role is selected, the app loads data from `localStorage`, computes holdings and portfolio summary values, and optionally refreshes current fund prices from MFAPI.

If no stored data exists, the app auto-generates demo clients, families, goals, and transactions so the dashboard is immediately usable.

## Main Features

### 1. Role-based workspace
- Distributor and client views are controlled in `App.tsx`
- Distributor users can switch ARN, open client list, inspect families, and drill down into a client
- Client users work against a selected client profile directly

### 2. Portfolio dashboard
Implemented in `components/Dashboard.tsx`

The dashboard shows:
- invested amount, current value, gains, and XIRR
- allocation by category
- portfolio growth chart based on transaction history
- risk scoring derived from category mix and concentration
- goal progress blocks
- holding-level details in a modal
- tax forecasting for scoped client portfolios

### 3. Transaction management
Implemented in `components/Transactions.tsx`

Capabilities include:
- add buy or sell transactions manually
- classify transaction nature such as `SIP`, `SWP`, `LUMPSUM`, `STP`, `SWITCH`
- search funds using MFAPI-backed search
- filter by fund, type, and date range
- paginate transaction history
- export visible transactions to CSV
- import bulk transactions using CSV or DBF files

### 4. Goal management
Implemented in `components/GoalManagement.tsx`

The goal module lets users:
- create, edit, and delete financial goals
- link goals to selected folios
- calculate progress against current holdings
- estimate gaps and projected completion dates

### 5. Family grouping
Implemented in `components/FamilyGrouping.tsx`

Distributor users can:
- group related clients into families
- keep family members within the same ARN scope
- view combined portfolio summary for a family
- inspect member contribution to family assets

### 6. Fund comparison
Implemented in `components/FundComparison.tsx`

This screen:
- loads a few default schemes on mount
- allows searching and adding more funds
- fetches detailed metrics for each selected fund
- compares expense ratio, AUM, returns, beta, alpha, and volatility

### 7. Analytics view
Implemented in `components/AnalyticsView.tsx`

It summarizes:
- monthly invested vs redeemed amounts
- allocation by category
- net monthly cashflow trend
- buy vs sell activity split

### 8. AI portfolio advisor
Implemented in `components/AIAdvisor.tsx` and `services/geminiService.ts`

Behavior:
- if a Gemini API key is configured, the app sends holdings data to Gemini for analysis
- if AI is unavailable, the app falls back to a deterministic local analysis engine
- returns include a portfolio summary, risk score, and suggestions

### 9. Alert system
Implemented in `services/alertsService.ts`

Alerts are generated from current portfolio context for:
- portfolio drawdown
- concentration risk
- at-risk goals
- heavy recent redemption activity

Alert state is persisted in `localStorage` so read and dismissed alerts survive refreshes.

## How The App Works Internally

## 1. Application shell and routing
The app is mounted from `index.tsx`.

`App.tsx` holds the top-level state:
- current role
- current screen/view
- selected ARN
- selected client
- theme mode
- transactions, holdings, goals, summary
- notifications and refresh state

The app does not use React Router. Instead, it uses a `currentView` string and conditionally renders lazily loaded components.

## 2. Data loading flow
The central refresh cycle is the `refreshData()` function in `App.tsx`.

Flow:
1. Build filters from the selected role, ARN, and client
2. Load transactions from storage
3. Load goals for the selected client context
4. Calculate holdings using stored transaction NAV values first
5. Build the summary from holdings
6. Optionally fetch live NAV values from MFAPI
7. Recalculate holdings and summary with live prices
8. Regenerate alert state from the latest portfolio context

This gives the UI a fast initial render and then upgrades values when live prices arrive.

## 3. Local persistence
The project uses browser `localStorage` as its main data layer through `services/storageService.ts`.

Stored collections:
- transactions
- clients
- goals
- families
- alert state
- theme preference

Important detail:
- on a fresh browser session, `getClients()` and `getTransactions()` can trigger mock data generation automatically
- reset actions can clear storage and optionally regenerate sample data from the UI

## 4. Holdings calculation engine
Holdings are computed in `calculateHoldings()` inside `services/storageService.ts`.

Calculation logic:
- transactions are grouped by `folioNumber + schemeCode/fundName`
- buy transactions increase units and invested amount
- sell transactions reduce units and proportionally reduce invested amount
- current NAV defaults to the last transaction NAV
- if live prices are available, they may replace stored NAVs
- a sanity check avoids suspicious live price mismatches for recent transactions
- current value, absolute return, return percentage, and XIRR are derived per holding

Portfolio totals are then aggregated by `getPortfolioSummary()`.

## 5. XIRR calculation
Implemented in `utils/financeUtils.ts`

The app uses:
- Newton-Raphson iteration for XIRR
- validation for invalid cashflow patterns
- fallback CAGR-style logic if XIRR fails to converge
- output clamping to avoid extreme broken values

This makes the demo resilient even when imported or generated data is noisy.

## 6. Live market data integration
Implemented in `services/amfiService.ts`

External data features:
- fund search from `https://api.mfapi.in/mf/search`
- latest NAV fetch from `https://api.mfapi.in/mf/{schemeCode}`
- basic browser cache usage for 5 minutes
- batch price fetch helpers to reduce repeated calls

The live pricing layer is used in:
- portfolio refresh
- client list valuation
- fund comparison

## 7. Import pipeline
Implemented in `components/FileImporter.tsx`

Supported import formats:
- CSV
- DBF

Import behavior:
- parse transaction rows
- infer buy/sell and transaction nature from common RTA-like fields
- create missing clients automatically when PAN is new
- preview transactions before import completes
- bulk save transactions and newly detected clients into local storage

## 8. Notification and alert workflow
Implemented across `services/alertsService.ts` and `components/NotificationPanel.tsx`

Each data refresh regenerates alerts from:
- summary performance
- holding concentration
- goal urgency
- recent redemption frequency

Users can mark alerts as read, dismiss them, or mark all as read. Dismissed alerts are hidden in future renders because their status is stored persistently.

## Data Model

Core types are defined in `types.ts`.

Main entities:
- `Client`: investor identity with PAN, ARN, and optional family link
- `Transaction`: fund buy/sell record with folio, NAV, units, and transaction nature
- `Holding`: computed portfolio position derived from transactions
- `PortfolioSummary`: aggregated invested value, current value, gain, and XIRR
- `Goal`: target-based financial planning item
- `Family`: logical grouping of clients under the same ARN
- `PortfolioAlert`: generated portfolio warning/info item

## Project Structure

```text
foliomaster-ai/
|-- App.tsx
|-- index.tsx
|-- index.css
|-- types.ts
|-- components/
|   |-- Dashboard.tsx
|   |-- Transactions.tsx
|   |-- GoalManagement.tsx
|   |-- FundComparison.tsx
|   |-- AIAdvisor.tsx
|   |-- ClientList.tsx
|   |-- FamilyGrouping.tsx
|   |-- AnalyticsView.tsx
|   |-- FileImporter.tsx
|   |-- FundDetailsModal.tsx
|   |-- NotificationPanel.tsx
|   |-- Sidebar.tsx
|-- services/
|   |-- storageService.ts
|   |-- amfiService.ts
|   |-- geminiService.ts
|   |-- alertsService.ts
|-- utils/
|   |-- financeUtils.ts
|-- public/
|   |-- branding/
|-- foliomaster_flutter/
```

## Tech Stack

Frontend:
- React 19
- TypeScript
- Vite
- Recharts
- Lucide React

Data and integration:
- browser `localStorage`
- MFAPI for mutual fund data
- Google Gemini via `@google/genai`
- `shapefile` package for DBF parsing

## Setup And Run

## Prerequisites
- Node.js 18+
- npm

## Install
```bash
npm install
```

## Environment configuration
Create or update `.env.local` with:

```env
GEMINI_API_KEY=your_key_here
```

Build-time env mapping is configured in `vite.config.ts`, which exposes `GEMINI_API_KEY` to the app as both:
- `process.env.API_KEY`
- `process.env.GEMINI_API_KEY`

If the key is missing, the AI Advisor still works using the built-in local analysis fallback.

## Start development server
```bash
npm run dev
```

The Vite server is configured for:
- host: `0.0.0.0`
- port: `3000`

## Production build
```bash
npm run build
```

## Preview production build
```bash
npm run preview
```

## Demo Data Behavior

On first load, the storage layer can generate seeded demo data automatically.

That demo dataset includes:
- multiple ARNs
- multiple clients per ARN
- transaction histories across years
- mixed SIP, lumpsum, and redemption behavior
- goal records
- family groups

This makes the app usable without any backend.

## Notes And Limitations

- This project is currently frontend-only. There is no backend database or authentication server.
- Role switching is simulated in the UI and is not a secure auth implementation.
- Some fund metrics in comparison mode are mock-enriched values layered on top of MFAPI responses.
- Portfolio values depend on browser storage, so changing browser or clearing site data resets the local dataset.
- The `foliomaster_flutter/` directory is a separate Flutter client scaffold and is not part of the Vite app runtime.

## Detailed Screen Map

- `dashboard`: portfolio KPIs, growth, risk, tax forecast, allocation, goal progress
- `clients`: distributor-only client directory with live-valued summaries
- `transactions`: add, filter, import, export, and delete transactions
- `goals`: manage target planning and folio-linked goals
- `fund-comparison`: compare schemes side by side
- `families`: create and manage family groups under an ARN
- `analytics`: charts for flows, activity, and allocation
- `advisor`: AI or local advisory insights for client portfolios

## Keyboard And UX Details

The app also includes a few convenience behaviors in `App.tsx`:
- `Ctrl/Cmd + R` refreshes prices
- `Ctrl/Cmd + D` toggles dark mode
- `Alt + 1` to `Alt + 8` switches screens when allowed by the active role
- `Escape` returns to dashboard or closes notification popover behavior via separate handlers

## If You Want To Extend It

Natural next areas for improvement:
1. add a real backend and authenticated multi-user accounts
2. replace mock fund metrics with complete market data providers
3. persist imported files and audit trails on the server
4. add automated tests for holdings, XIRR, and alert generation
5. connect the Flutter app to the same shared data model or backend
