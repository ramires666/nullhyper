import type { Trade, StrategyLevel } from '../types';

export interface OverlayRenderOptions {
  showTrades?: boolean;
  showLevels?: boolean;
  maxTrades?: number;
}

/**
 * Renders strategy trade executions (arrows, entry-exit lines) and session range levels
 * directly on the LuxAlgo Vela WebGL2 chart canvas using native drawings & timeline marks.
 */
export function renderTradesAndLevelsOnChart(
  chart: any,
  trades: Trade[] = [],
  levels: StrategyLevel[] = [],
  options: OverlayRenderOptions = {},
  previousDrawingIds: string[] = []
): string[] {
  if (!chart || !chart.drawings) {
    return [];
  }

  const { showTrades = true, showLevels = true, maxTrades = 1000 } = options;
  const newDrawingIds: string[] = [];

  try {
    // 1. Clean up previously generated overlay drawings
    if (previousDrawingIds && previousDrawingIds.length > 0) {
      try {
        chart.drawings.removeMany?.(previousDrawingIds);
      } catch (err) {
        // Fallback single-remove
        for (const id of previousDrawingIds) {
          try {
            chart.drawings.remove?.(id);
          } catch {}
        }
      }
    }

    // 2. Render Strategy Session Range Levels (e.g. 02:00 NY High/Low & Breakout Triggers)
    if (showLevels && levels && levels.length > 0) {
      for (const level of levels) {
        try {
          if (level.type === 'box' && level.highPrice != null && level.lowPrice != null) {
            const boxDrawing = chart.drawings.add('box', {
              paneId: 'price',
              anchors: [
                { time: level.startTime, price: level.highPrice },
                { time: level.endTime, price: level.lowPrice },
              ],
              style: {
                lineColor: level.color,
                lineWidth: 1,
                lineStyle: 'solid',
                fillColor: `${level.color}15`,
              },
            });
            if (boxDrawing?.id) newDrawingIds.push(boxDrawing.id);
          } else if (level.type === 'line' && level.price != null) {
            const lineDrawing = chart.drawings.add('trendline', {
              paneId: 'price',
              anchors: [
                { time: level.startTime, price: level.price },
                { time: level.endTime, price: level.price },
              ],
              style: {
                lineColor: level.color,
                lineWidth: 1.5,
                lineStyle: level.lineStyle || 'solid',
              },
            });
            if (lineDrawing?.id) newDrawingIds.push(lineDrawing.id);
          }
        } catch (levelErr) {
          console.warn('Error drawing level:', level.id, levelErr);
        }
      }
    }

    // 3. Render Trades (Entry Arrows, Exit Arrows, & Connector Lines)
    if (showTrades && trades && trades.length > 0) {
      // Render trades up to maxTrades (default 1000 covers full backtest histories)
      const tradesToRender = trades.length > maxTrades ? trades.slice(-maxTrades) : trades;

      const timelineMarks: any[] = [];

      for (const trade of tradesToRender) {
        try {
          const isLong = trade.type === 'long';
          const isWin = trade.pnl >= 0;
          const entryColor = isLong ? '#089981' : '#f23645';
          const exitColor = isWin ? '#26a69a' : '#ef5350';
          const pnlColor = isWin ? '#089981' : '#f23645';

          // A. Entry Order Marker (Arrow)
          const entryArrowType = isLong ? 'arrowmarkup' : 'arrowmarkdown';
          const arrowDrawing = chart.drawings.add(entryArrowType, {
            paneId: 'price',
            anchors: [{ time: trade.entryTime, price: trade.entryPrice }],
            style: {
              lineColor: entryColor,
              lineWidth: 2,
            },
          });
          if (arrowDrawing?.id) newDrawingIds.push(arrowDrawing.id);

          // B. Exit Order Marker (Opposite Arrow at Exit Time & Price)
          if (trade.exitTime && trade.exitPrice) {
            const exitArrowType = isLong ? 'arrowmarkdown' : 'arrowmarkup';
            const exitDrawing = chart.drawings.add(exitArrowType, {
              paneId: 'price',
              anchors: [{ time: trade.exitTime, price: trade.exitPrice }],
              style: {
                lineColor: exitColor,
                lineWidth: 2,
              },
            });
            if (exitDrawing?.id) newDrawingIds.push(exitDrawing.id);

            // C. Connector Line (Entry candle to Exit candle)
            const connector = chart.drawings.add('trendline', {
              paneId: 'price',
              anchors: [
                { time: trade.entryTime, price: trade.entryPrice },
                { time: trade.exitTime, price: trade.exitPrice },
              ],
              style: {
                lineColor: pnlColor,
                lineWidth: 1.5,
                lineStyle: 'dashed',
              },
            });
            if (connector?.id) newDrawingIds.push(connector.id);
          }

          // C. Timeline Interactive Mark (Pinned to Bar with Popup Inspection)
          timelineMarks.push({
            id: `tm_entry_${trade.id}`,
            time: trade.entryTime,
            title: `Trade #${trade.id} (${trade.type.toUpperCase()})`,
            glyph: {
              shape: isLong ? 'circle' : 'diamond',
              color: entryColor,
              letter: isLong ? 'L' : 'S',
            },
            tooltip: `${trade.type.toUpperCase()} Entry @ $${trade.entryPrice.toFixed(2)}${
              trade.exitPrice
                ? ` -> Exit @ $${trade.exitPrice.toFixed(2)} (${isWin ? '+' : ''}$${trade.pnl.toFixed(
                    2
                  )}, ${trade.pnlPercent.toFixed(2)}%) [${trade.exitReason || 'Exit'}]`
                : ''
            }`,
            group: 'trades',
            content: {
              panel: {
                items: [
                  { type: 'field', label: 'Side', value: trade.type.toUpperCase() },
                  { type: 'field', label: 'Entry Price', value: `$${trade.entryPrice.toFixed(2)}` },
                  {
                    type: 'field',
                    label: 'Exit Price',
                    value: trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : 'Active',
                  },
                  {
                    type: 'field',
                    label: 'PnL',
                    value: `${isWin ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(
                      2
                    )}%)`,
                  },
                  { type: 'field', label: 'Exit Reason', value: trade.exitReason || 'Signal Close' },
                  { type: 'field', label: 'Bars Held', value: `${trade.barsHeld} bars` },
                ],
              },
            },
          });
        } catch (tradeErr) {
          console.warn('Error rendering trade drawing:', trade.id, tradeErr);
        }
      }

      // Sync interactive marks on the time axis
      if (chart.marks && typeof chart.marks.set === 'function') {
        try {
          chart.marks.set(timelineMarks);
        } catch (marksErr) {
          console.warn('Marks sync notice:', marksErr);
        }
      }
    } else {
      // Clear timeline marks if trades hidden
      if (chart.marks && typeof chart.marks.clear === 'function') {
        try {
          chart.marks.clear();
        } catch {}
      }
    }
  } catch (err) {
    console.error('Failed to render strategy overlays on Vela chart:', err);
  }

  return newDrawingIds;
}

/**
 * Focuses / centers the chart view on a specific trade
 */
export function focusTradeOnChart(chart: any, trade: Trade) {
  if (!chart || !chart.setVisibleRange) return;
  const tradeDuration = Math.max(3600000, (trade.exitTime || trade.entryTime) - trade.entryTime);
  // Provide ~18-24 bars of context around the trade for clean framing
  const paddingMs = Math.max(3600000 * 16, Math.round(tradeDuration * 1.8));
  const from = trade.entryTime - paddingMs;
  const to = (trade.exitTime || trade.entryTime) + paddingMs;
  chart.setVisibleRange({ from, to });
}
