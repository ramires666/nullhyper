# 🚀 NullHyper

> **High-Performance Local TradingView Alternative & Pine Script v6 Backtesting Platform**  
> Run TradingView Pine Script v6 strategies locally on your own machine — no subscriptions, no bar limits, no cloud lock-in. Powered by **DuckDB-WASM**, **LuxAlgo Vela**, and **Vite**.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Requirements](#-system-requirements)
- [Quickstart (30 Seconds)](#-quickstart-30-seconds)
- [Step-by-Step Installation Guide](#-step-by-step-installation-guide)
  - [1. Prerequisites Installation](#1-prerequisites-installation)
  - [2. Clone the Repository](#2-clone-the-repository)
  - [3. Install Node.js Dependencies](#3-install-nodejs-dependencies)
  - [4. Launch the Application](#4-launch-the-application)
- [How to Use NullHyper](#-how-to-use-nullhyper)
  - [1. Interface Overview](#1-interface-overview)
  - [2. Selecting Assets & Fetching Market Data](#2-selecting-assets--fetching-market-data)
  - [3. Writing & Loading Pine Script Strategies](#3-writing--loading-pine-script-strategies)
  - [4. Running Backtests & Reading Metrics](#4-running-backtests--reading-metrics)
  - [5. Using the DuckDB SQL Data Console](#5-using-the-duckdb-sql-data-console)
- [Adding Your Own Strategies](#-adding-your-own-strategies)
- [Project Directory Structure](#-project-directory-structure)
- [Available npm Scripts](#-available-npm-scripts)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [License](#-license)

---

## 🌟 Overview

**NullHyper** brings the charting elegance of TradingView and the analytical power of a local quantitative backtesting laboratory into a single, blazing-fast web desktop application.

Standard online platforms restrict historical data depth, cap indicator counts, and require expensive subscriptions for complex strategy backtesting. NullHyper solves this by running entirely on your local hardware:
- **Local Strategy Engine**: Executes Pine Script v6 code directly in the client.
- **In-Browser Columnar Database**: Utilizes embedded **DuckDB-WASM** for real-time, analytical queries over hundreds of thousands of market candles.
- **Local Filesystem Hot Reload**: Edit strategy files in VS Code or in the built-in Monaco editor; NullHyper detects changes and updates on the fly.
- **Real Market Data**: Seamlessly downloads market data for Crypto (via Binance) and Futures / Equities (via Yahoo Finance).

---

## ⚡ Key Features

- 📈 **TradingView-Grade Interactive Charts**
  - Smooth candlestick rendering powered by `@luxalgo/vela`.
  - Multi-timeframe support: `1m`, `5m`, `15m`, `1h`, `4h`, `1D`.
  - Rich technical drawing toolbar: trendlines, horizontal rays, Fibonacci retracements, measure rulers, and brushes.
- 🧪 **Pine Script v6 Runtime & Backtester**
  - Full support for TradingView Pine Script v6 syntax (`strategy()`, `indicator()`, `ta.ema()`, `ta.rsi()`, `strategy.entry()`, `strategy.exit()`, etc.).
  - Realistic trade execution: slippage, commission, stop-loss, take-profit, position sizing, and margin handling.
- 📁 **Direct Local Strategy Sync**
  - Reads `.pine`, `.pine6`, and `.ps` files straight from your local `./strategies/` folder.
  - Live filesystem watcher with instant WebSocket updates upon saving.
  - Built-in Monaco code editor (VS Code's editor engine) with syntax highlighting, compiler diagnostics, and instant disk save.
- 🦆 **Embedded DuckDB-WASM OLAP Engine**
  - High-performance columnar SQL storage right inside your browser.
  - Query your OHLCV data using standard SQL in the built-in console.
  - Client-side IndexedDB persistence via Dexie for offline speed.
- 🌐 **Free Integrated Market Data**
  - **Crypto**: Real-time and historical k-lines from Binance (BTC, ETH, SOL, etc.).
  - **Futures & Stocks**: E-mini Nasdaq (`NQ=F`), S&P 500 (`ES=F`), SPY, QQQ, and single stocks via a local CORS-free proxy.
  - **Custom Data**: Support for uploading custom CSV / Parquet datasets.
- 📊 **Institutional-Grade Performance Metrics**
  - Net Profit ($ and %), Profit Factor, Win Rate, Gross Profit/Loss.
  - Max Drawdown ($ and %), Sharpe Ratio, Sortino Ratio, Average Trade.
  - Detailed trade log table with entry/exit timestamps, trade duration, run-up, and drawdown.
  - Interactive portfolio equity curve chart.

---

## 💻 System Requirements

- **Operating System**: Windows 10/11, macOS (Intel / Apple Silicon), or Linux.
- **Node.js**: Version **18.0.0** or higher (Node.js **20+ LTS** or **24+** recommended).
- **Package Manager**: `npm` (comes bundled with Node.js) or `pnpm` / `yarn`.
- **Browser**: Any modern browser supporting WebAssembly and WebWorkers (Google Chrome, Microsoft Edge, Brave, or Firefox).

---

## ⏱️ Quickstart (30 Seconds)

If you already have **Node.js** and **Git** installed:

```bash
# 1. Clone the repository
git clone https://github.com/ramires666/nullhyper.git
cd nullhyper

# 2. Install dependencies
npm install

# 3. Start the application
npm run dev
```

Then open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

> 💡 **Windows Users**: You can simply double-click the included `start.bat` file to install and run everything automatically!

---

## 📖 Step-by-Step Installation Guide

### 1. Prerequisites Installation

#### Check if Node.js is already installed
Open your terminal (PowerShell, Command Prompt, or Terminal) and run:
```bash
node -v
npm -v
```
If you see versions like `v20.x.x` or `v24.x.x`, you are good to go.

#### If you do NOT have Node.js:
1. Go to the official website: [https://nodejs.org/](https://nodejs.org/)
2. Download the **LTS (Long Term Support)** installer for your operating system.
3. Run the installer, accept the default settings, and finish the installation.
4. Restart your terminal window to ensure environment variables are updated.

#### Check if Git is installed
Run:
```bash
git --version
```
If not installed, download it from [https://git-scm.com/](https://git-scm.com/) or install via your package manager.

---

### 2. Clone the Repository

Clone the project to any folder on your computer:

```bash
git clone https://github.com/ramires666/nullhyper.git
cd nullhyper
```

---

### 3. Install Node.js Dependencies

Inside the project directory, run:

```bash
npm install
```

This will download all necessary packages:
- React 19 & TypeScript
- Vite 8
- `@duckdb/duckdb-wasm` (in-browser SQL engine)
- `@luxalgo/vela` & `@luxalgo/vela-pinets` (charting and Pine Script engine)
- `@monaco-editor/react` (code editor)
- `dexie` (IndexedDB storage)
- `lucide-react` (icons)

---

### 4. Launch the Application

#### Option A: Windows One-Click Launch (Easiest)
Double-click the `start.bat` file in the project folder.  
It will start the local development server and automatically open your default browser to `http://localhost:5173/`.

#### Option B: Terminal Command (All Platforms)
Run:
```bash
npm run dev
```

You will see output similar to:
```text
  VITE v8.3.0  ready in 250 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your web browser.

---

## 🎯 How to Use NullHyper

### 1. Interface Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│ TopNav: Symbol Selector | Timeframe (1m-1D) | Data Source | Download   │
├─────────┬──────────────────────────────────────────────────────────────┤
│ Toolbar │ Main Candlestick Chart (Vela Engine)                         │
│ [Draw]  │ • Interactive candlesticks with pan & zoom                   │
│ [Rays]  │ • OHLCV hover tooltip                                        │
│ [Trend] │ • Indicator overlays and buy/sell trade markers              │
├─────────┴──────────────────────────────────────────────────────────────┤
│ Bottom Dock:                                                           │
│ [Strategy Tester]  [Pine Editor]  [Data Manager (DuckDB)]  [Logs]      │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Top Navigation Bar**: Select symbols, change chart timeframes, switch data providers, or trigger historical candle downloads.
2. **Left Drawing Toolbar**: Choose drawing tools (trendlines, rays, measurement tools, eraser).
3. **Center Chart Area**: Candlestick chart with mouse-wheel zoom and drag-to-pan.
4. **Bottom Dock**: The multi-tab control center for testing, editing code, querying data, and inspecting logs.

---

### 2. Selecting Assets & Fetching Market Data

1. **Choose a Symbol**:
   - In the top bar, click the symbol dropdown (e.g., `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `NQ=F`, `ES=F`, `SPY`, `QQQ`).
2. **Select Timeframe**:
   - Click `1m`, `5m`, `15m`, `1h`, `4h`, or `1D`.
3. **Download Historical Quotes**:
   - Click the **Download** button in the top bar.
   - The app will pull historical candles from Binance (for crypto) or Yahoo Finance (for futures/stocks) via the Vite backend proxy.
   - All bars are automatically indexed and saved to **DuckDB-WASM** and browser storage.

---

### 3. Writing & Loading Pine Script Strategies

1. Click on the **Pine Editor** tab in the bottom dock.
2. **Browse Strategies**:
   - In the left sidebar of the editor, you will see strategies stored in your local `./strategies/` folder.
   - Click any strategy (e.g. `dual_ema_crossover.pine`, `momentum_scalp_v6.pine`, `supertrend_breakout.pine`) to load it.
3. **Edit Code**:
   - The Monaco editor provides syntax highlighting, auto-completion, line numbers, and error detection.
4. **Save to Disk**:
   - Click **Save Strategy** (or press `Ctrl + S`).
   - The code is immediately saved directly into your local `.pine` file on your hard drive!
5. **Add New Files from Your OS**:
   - You can also create and edit files directly in `./strategies/` using VS Code, Sublime Text, or any external editor. NullHyper's file watcher will automatically detect and sync new files.

---

### 4. Running Backtests & Reading Metrics

1. In the **Pine Editor** or bottom dock toolbar, click **▶ Run Backtest**.
2. Switch to the **Strategy Tester** tab.
3. **Overview Sub-tab**:
   - **Net Profit**: Total dollar gain and percentage return.
   - **Profit Factor**: Ratio of gross profit to gross loss.
   - **Win Rate**: Percentage of profitable trades.
   - **Max Drawdown**: Maximum peak-to-trough decline (in $ and %).
   - **Sharpe & Sortino Ratios**: Risk-adjusted performance indicators.
4. **List of Trades Sub-tab**:
   - Detailed breakdown of every single order executed: entry time, long/short side, entry price, exit time, exit price, contracts traded, and trade PnL.
5. **Equity Curve**:
   - Visual trajectory of account balance growth over the backtest duration.

---

### 5. Using the DuckDB SQL Data Console

NullHyper features an embedded, full-blown analytical database right inside your browser tab:

1. Click the **Data Manager** tab in the bottom dock.
2. View real-time database statistics:
   - Total bars stored across all symbols.
   - Table schema and date ranges per timeframe.
3. **Run Custom SQL**:
   - Type any valid DuckDB SQL query into the query box. Example:
     ```sql
     SELECT 
       symbol, 
       timeframe, 
       COUNT(*) AS total_bars, 
       ROUND(AVG(volume), 2) AS avg_volume,
       ROUND(MAX(high), 2) AS all_time_high,
       ROUND(MIN(low), 2) AS all_time_low
     FROM market_bars
     GROUP BY symbol, timeframe
     ORDER BY total_bars DESC;
     ```
   - Click **Execute SQL** (runs in single-digit milliseconds).
   - View results in an interactive data table.
4. **Clear Cache**:
   - If you want to reset your local database, click **Purge Data Cache**.

---

## ✍️ Adding Your Own Strategies

To add a new Pine Script strategy:

1. Open the `./strategies/` folder in your file explorer or terminal.
2. Create a new file, for example: `strategies/my_breakout.pine`.
3. Paste standard Pine Script v6 code:

```pinescript
//@version=6
strategy("My Breakout Strategy", overlay=true, margin_long=100, margin_short=100)

// Inputs
lookback = input.int(20, "Lookback Period")
takeProfitPct = input.float(2.0, "Take Profit %")
stopLossPct = input.float(1.0, "Stop Loss %")

// High/Low Range
highestHigh = ta.highest(high, lookback)[1]
lowestLow = ta.lowest(low, lookback)[1]

// Plots
plot(highestHigh, "20-Bar High", color=color.green)
plot(lowestLow, "20-Bar Low", color=color.red)

// Conditions
bullishBreak = ta.crossover(close, highestHigh)
bearishBreak = ta.crossunder(close, lowestLow)

// Trade Executions
if (bullishBreak)
    sl = close * (1 - stopLossPct / 100)
    tp = close * (1 + takeProfitPct / 100)
    strategy.entry("Long", strategy.long)
    strategy.exit("Exit Long", "Long", stop=sl, limit=tp)

if (bearishBreak)
    sl = close * (1 + stopLossPct / 100)
    tp = close * (1 - takeProfitPct / 100)
    strategy.entry("Short", strategy.short)
    strategy.exit("Exit Short", "Short", stop=sl, limit=tp)
```

4. Go back to NullHyper: the strategy will immediately appear in the **Pine Editor** strategy list. Select it and click **Run Backtest**!

---

## 📂 Project Directory Structure

```text
nullhyper/
├── public/                  # Static assets
├── src/
│   ├── assets/              # Icons and styling assets
│   ├── components/
│   │   ├── Chart/           # LuxAlgo Vela chart engine integration
│   │   ├── Dock/            # Bottom dock (Tester, Monaco Editor, DuckDB Manager)
│   │   ├── Header/          # Top navigation bar (Symbol, Timeframe, Downloader)
│   │   ├── Sidebar/         # Watchlist and asset navigator
│   │   └── Toolbar/         # Technical drawing tools toolbar
│   ├── services/
│   │   ├── providers/       # Binance & Yahoo Finance data connectors
│   │   ├── backtester.ts    # Pine Script v6 backtesting simulation engine
│   │   ├── db.ts            # Dexie IndexedDB client-side database
│   │   ├── duckdb.ts        # Embedded DuckDB-WASM OLAP engine connector
│   │   ├── pineBridge.ts    # Bridge executing Pine Script against chart bars
│   │   ├── pineFileSystem.ts# Client API communicating with local file server
│   │   ├── pineTemplates.ts # Built-in reference strategies & templates
│   │   ├── resampler.ts     # Multi-timeframe bar resampling utility
│   │   └── validator.ts     # Pine Script syntax parser and validator
│   ├── types/               # TypeScript interfaces (Bar, Trade, Report, etc.)
│   ├── App.tsx              # Main application root
│   ├── index.css            # Dark-mode professional trading UI design system
│   └── main.tsx             # React entrypoint
├── strategies/              # Local folder containing your .pine script files
├── index.html               # Web application HTML shell
├── package.json             # NPM dependencies and build commands
├── start.bat                # Windows 1-click launcher script
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite server config with filesystem watcher & CORS proxy
```

---

## 🛠️ Available npm Scripts

In the project root, you can run:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the local development server at `http://localhost:5173/` with hot module replacement (HMR). |
| `npm run build` | Compiles TypeScript and builds production-ready bundles into the `dist/` directory. |
| `npm run preview` | Locally serves the production build created by `npm run build` to verify production performance. |
| `npm run lint` | Runs the high-speed `oxlint` linter to check code quality. |

---

## ❓ Troubleshooting & FAQ

### Q1: `node: command not found` or `npm: command not found`
**Solution**: Node.js is not installed or not added to your system's `PATH`. Download and install Node.js (LTS version) from [https://nodejs.org/](https://nodejs.org/), then restart your terminal.

### Q2: Port 5173 is already in use
**Solution**: Another application or an existing instance of Vite is using port 5173. You can either close that process or run Vite on a different port:
```bash
npm run dev -- --port 5174
```

### Q3: Why does Yahoo Finance data occasionally fail to load?
**Solution**: Yahoo Finance enforces rate limits on public queries. If a query returns 429 (Too Many Requests), wait 30 seconds and try again, or switch to **Binance** (which has generous rate limits for crypto) or use synthetic data. All API calls pass through the Vite proxy in `vite.config.ts` (`/api/yahoo` and `/api/binance`) to prevent browser CORS blocks.

### Q4: DuckDB-WASM or WebAssembly performance tips
**Solution**: For optimal performance when working with hundreds of thousands of candles, use a Chromium-based browser (Google Chrome, Microsoft Edge, Brave) or Firefox with hardware acceleration enabled.

### Q5: How do I reset all cached data?
**Solution**: 
1. In NullHyper, go to the **Data Manager** tab in the bottom dock and click **Purge Data Cache**.
2. Or open your browser Developer Tools (`F12`), navigate to **Application** -> **Storage**, and click **Clear site data**.

---

## 📄 License

NullHyper is provided for personal, educational, and quantitative trading research purposes. Check individual dependency licenses for third-party libraries (`@luxalgo/vela`, `@duckdb/duckdb-wasm`, `pinets`).
