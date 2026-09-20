# 🛠️ NullHyper — Quick Installation & Setup Cheat Sheet

This guide provides a straightforward, no-nonsense walkthrough to get **NullHyper** running on your local machine in under 2 minutes.

---

## ⚡ TL;DR (Quickest Way to Start)

### For Windows Users:
1. Make sure you have **Node.js** installed ([Download here](https://nodejs.org/)).
2. Double-click the **`start.bat`** file in the project root folder.
3. Your browser will automatically open [http://localhost:5173/](http://localhost:5173/). That's it!

---

## 💻 Manual Setup (Windows, macOS, Linux)

### Step 1: Install Node.js
If you haven't installed Node.js yet:
- Download the LTS version from [https://nodejs.org/](https://nodejs.org/).
- Run the installer with default options.
- Verify the installation in your terminal:
  ```bash
  node -v
  npm -v
  ```
  *(Node version 18+ or higher is required, Node 20+ LTS is recommended).*

### Step 2: Open Terminal in Project Folder
Open your terminal (PowerShell, Command Prompt, or bash) and navigate to the project root directory:
```bash
cd /path/to/nullhyper
```

### Step 3: Install Packages
Run the install command to download all frontend, charting, and DuckDB dependencies:
```bash
npm install
```

### Step 4: Run the Development Server
Start the local server:
```bash
npm run dev
```

You will see:
```text
  VITE v8.3.0  ready in 250 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 5: Open NullHyper in Your Browser
Visit:
```text
http://localhost:5173/
```

---

## 🚀 How to Use the App (Fast Walkthrough)

1. **Load Market Data**:
   - In the top bar, pick a symbol (e.g., `BTCUSDT` for Bitcoin, or `NQ=F` for Nasdaq futures).
   - Pick a timeframe (`1m`, `5m`, `15m`, `1h`, etc.).
   - Click the **Download** button to fetch candles.
2. **Select or Write a Strategy**:
   - In the bottom dock, click the **Pine Editor** tab.
   - Select any sample strategy from the left list (e.g. `dual_ema_crossover.pine`).
   - Edit the code directly in the Monaco editor if desired, and click **Save Strategy** (`Ctrl+S`).
3. **Execute Backtest**:
   - Click the **▶ Run Backtest** button.
   - Switch to the **Strategy Tester** tab to inspect Net Profit, Profit Factor, Win Rate, Drawdown, and the full trade execution log.
4. **Inspect Data in DuckDB**:
   - Click the **Data Manager** tab in the bottom dock.
   - Run custom SQL queries against the `market_bars` table at native C++/WASM speed.

---

## 🛑 Common Errors & Fixes

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| `'node' is not recognized` | Node.js is not installed or not in PATH | Install Node.js from [nodejs.org](https://nodejs.org/) and restart terminal. |
| `Port 5173 is already in use` | Another dev server is already running | Run `npm run dev -- --port 5174` or close other Vite processes. |
| Chart doesn't render candles | No candles downloaded yet | Click the **Download** button in the top bar to fetch market quotes. |
| Yahoo Finance error (HTTP 429) | Rate limited by Yahoo | Wait 30 seconds, or use Binance symbols (`BTCUSDT`, `ETHUSDT`) or synthetic data. |

---

Enjoy backtesting with **NullHyper**!
