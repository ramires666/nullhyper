import os
import glob
import json
import pandas as pd
import numpy as np

print("=== Building Unified Continuous NQ Dataset from W:/algo/GEX ===")

sources = [
    # 1. 2022 Databento benchmark
    'W:/algo/GEX/docs/research/midnight-asian-levels-2026-09-09/auxiliary/nq_2022_1m.parquet',
    'W:/algo/GEX/data/completion_2026_08_19/p3_2022_2024_smoke/databento_jan_2022_processed/nq_parent_ohlcv_1m.parquet',
    
    # 2. 2024 Contracts
    'W:/algo/GEX/data/nq_free/massive_extended_2024_08/contracts/NQU4.parquet',
    'W:/algo/GEX/data/nq_free/massive_extended_2024_08/contracts/NQZ4.parquet',
    'W:/algo/GEX/data/nq_free/massive_extended_2024_08/contracts/NQH5.parquet',
    
    # 3. Continuous 2025-2026 massive dataset
    'W:/algo/GEX/data/nq_free/massive/nq_continuous_1m.parquet',
    
    # 4. September 2026 latest contract download
    'W:/algo/GEX/docs/research/midnight-asian-levels-2026-09-09/downloads/nqu6_latest.parquet',
]

dfs = []
for p in sources:
    if os.path.exists(p):
        print(f"Reading: {p}")
        df = pd.read_parquet(p)
        ts_col = 'timestamp' if 'timestamp' in df.columns else 'time'
        ts = pd.to_datetime(df[ts_col], utc=True)
        
        sub = pd.DataFrame({
            'time': (ts.astype('int64') // 10**6), # epoch ms
            'open': df['open'].astype(float),
            'high': df['high'].astype(float),
            'low': df['low'].astype(float),
            'close': df['close'].astype(float),
            'volume': df['volume'].astype(float) if 'volume' in df.columns else 0.0
        })
        dfs.append(sub)

# Also load existing nullhyper nq_1m.json to retain September 14-18 bars
nullhyper_nq = './src/assets/real_data/nq_1m.json'
if os.path.exists(nullhyper_nq):
    print(f"Reading existing nullhyper NQ bars: {nullhyper_nq}")
    with open(nullhyper_nq, 'r') as fp:
        nh_data = json.load(fp)
    if nh_data and len(nh_data) > 0:
        nh_df = pd.DataFrame(nh_data)
        dfs.append(nh_df[['time', 'open', 'high', 'low', 'close', 'volume']])

combined = pd.concat(dfs, ignore_index=True)
print(f"Raw merged bars: {len(combined):,}")

# Clean and validate
combined = combined.dropna(subset=['time', 'open', 'high', 'low', 'close'])
combined['time'] = combined['time'].astype('int64')
combined = combined.drop_duplicates(subset=['time']).sort_values('time').reset_index(drop=True)

# Ensure OHLC integrity
combined['high'] = combined[['open', 'high', 'low', 'close']].max(axis=1)
combined['low'] = combined[['open', 'high', 'low', 'close']].min(axis=1)
combined['volume'] = combined['volume'].fillna(0.0).clip(lower=0.0)

print(f"Cleaned unique bars: {len(combined):,}")
start_dt = pd.to_datetime(combined['time'].iloc[0], unit='ms', utc=True)
end_dt = pd.to_datetime(combined['time'].iloc[-1], unit='ms', utc=True)
print(f"Date range: {start_dt} to {end_dt}")

# Ensure public/data directory exists
os.makedirs('./public/data', exist_ok=True)

# 1. Save full dataset as Parquet in public/data/
parquet_out = './public/data/nq_continuous_1m.parquet'
combined.to_parquet(parquet_out, compression='snappy', index=False)
print(f"Saved: {parquet_out} ({os.path.getsize(parquet_out):,} bytes)")

# 2. Resample function
def resample_df(df, rule_str):
    d = df.copy()
    d['dt'] = pd.to_datetime(d['time'], unit='ms', utc=True)
    d = d.set_index('dt')
    res = d.resample(rule_str).agg({
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'volume': 'sum'
    }).dropna().reset_index()
    res['time'] = res['dt'].astype('int64') // 10**6
    return res[['time', 'open', 'high', 'low', 'close', 'volume']]

timeframes = [
    ('5m', '5min', './public/data/nq_5m.json'),
    ('15m', '15min', './public/data/nq_15m.json'),
    ('1h', '1h', './public/data/nq_1h.json'),
    ('1D', '1D', './public/data/nq_1D.json'),
]

for tf_name, rule, out_path in timeframes:
    rdf = resample_df(combined, rule)
    records = rdf.to_dict(orient='records')
    with open(out_path, 'w') as fp:
        json.dump(records, fp)
    print(f"Saved {tf_name}: {out_path} ({len(records):,} bars, {os.path.getsize(out_path):,} bytes)")

# 3. Save compact 1m dataset (all 760,000+ bars as list of arrays [time, open, high, low, close, volume])
compact_records = combined[['time', 'open', 'high', 'low', 'close', 'volume']].values.tolist()
compact_out = './public/data/nq_1m_compact.json'
with open(compact_out, 'w') as fp:
    json.dump(compact_records, fp)
print(f"Saved compact 1m: {compact_out} ({len(compact_records):,} bars, {os.path.getsize(compact_out):,} bytes)")

# 4. Save recent 25,000 bars to src/assets/real_data/nq_1m.json for immediate instant synchronous bootstrap
recent_bootstrap = combined.tail(25000)
recent_records = recent_bootstrap.to_dict(orient='records')
with open(nullhyper_nq, 'w') as fp:
    json.dump(recent_records, fp)
print(f"Saved bootstrap to {nullhyper_nq} ({len(recent_records):,} bars, {os.path.getsize(nullhyper_nq):,} bytes)")

print("\n=== All NQ Datasets Built Successfully! ===")
