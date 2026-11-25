//@version=6
indicator("M.E.T.S. (J Law) — визуальный чек-лист v2.3", shorttitle="M.E.T.S. v2.3", overlay=true, max_lines_count=500, max_labels_count=500)

// ─── Настройки ──────────────────────────────────────────────
g = "График"
showEma   = input.bool(true,  "EMA 10 / 20 / 50 / 200", group=g)
showVol   = input.bool(true,  "Объём + средняя + порог 1.5x", group=g)
showSwing = input.bool(true,  "Swing-уровни (pullback-зоны)", group=g)
showTrend = input.bool(true,  "Трендовая линия (для шага 3)", group=g)
showRs    = input.bool(true,  "RS vs SPY (шаг 2)", group=g)
showTbl   = input.bool(true,  "Таблица чек-листа", group=g)

g2 = "Уровни (если сделка 4/4)"
showLevels = input.bool(false, "Показать вход / стоп / цели", group=g2)
entryP = input.float(0, "Вход", group=g2)
stopP  = input.float(0, "Стоп", group=g2)
t1P    = input.float(0, "Цель 1", group=g2)
t2P    = input.float(0, "Цель 2", group=g2)
t3P    = input.float(0, "Цель 3 / трейлинг", group=g2)

g3 = "Структура"
swLen  = input.int(10, "Swing: баров слева", minval=2,  maxval=50, group=g3)
swLenR = input.int(5,  "Swing: баров справа", minval=1, maxval=50, group=g3)

// ─── EMA ───────────────────────────────────────────────────
e10 = ta.ema(close, 10)
e20 = ta.ema(close, 20)
e50 = ta.ema(close, 50)
e200 = ta.ema(close, 200)

plot(showEma ? e10 : na, "EMA10",  color=color.new(color.yellow, 0), linewidth=1)
plot(showEma ? e20 : na, "EMA20",  color=color.new(color.aqua, 0), linewidth=2)
plot(showEma ? e50 : na, "EMA50",  color=color.new(color.blue, 0), linewidth=2)
plot(showEma ? e200 : na, "EMA200", color=color.new(color.purple, 0), linewidth=2)

// EMA на 1D
[d50, d200] = request.security(syminfo.tickerid, "D", [ta.ema(close, 50), ta.ema(close, 200)], lookahead=barmerge.lookahead_off)
plot(showEma ? d50 : na,  "EMA50 (1D)", color=color.new(color.blue, 50), linewidth=1, style=plot.style_circles)
plot(showEma ? d200 : na, "EMA200 (1D)", color=color.new(color.purple, 50), linewidth=1, style=plot.style_circles)

// ─── Объём ─────────────────────────────────────────────────
avgVol = ta.sma(volume, 20)
volRatio = volume / avgVol
volHigh = volRatio >= 1.5

plot(showVol ? volume : na, "Объём", style=plot.style_columns, color=volHigh ? color.new(color.lime, 20) : color.new(color.gray, 40))
plot(showVol ? avgVol : na, "Средняя 20", color=color.new(color.orange, 30), linewidth=1)
plot(showVol ? avgVol * 1.5 : na, "Порог 1.5x", color=color.new(color.red, 40), linewidth=1, style=plot.style_linebr)

// ─── Swing-уровни ───────────────────────────────────────────
ph = ta.pivothigh(high, swLen, swLenR)
pl = ta.pivotlow(low, swLen, swLenR)

var line lnPh = na
var line lnPl = na
if not na(ph)
    if not na(lnPh)
        line.delete(lnPh)
    lnPh := line.new(bar_index - swLenR, ph, bar_index, ph, color = color.new(color.red, 25), width = 2)
if not na(pl)
    if not na(lnPl)
        line.delete(lnPl)
    lnPl := line.new(bar_index - swLenR, pl, bar_index, pl, color = color.new(color.lime, 25), width = 2)

// Зона EMA10/20 (fill принимает ID из plot)
p10 = plot(showEma ? e10 : na, "EMA10_Fill", color=color.new(color.yellow, 100), display=display.none)
p20 = plot(showEma ? e20 : na, "EMA20_Fill", color=color.new(color.aqua, 100), display=display.none)
fill(p10, p20, color=color.new(color.aqua, 92), title="Зона EMA10-20")

// ─── Структура (вычисления вынесены из if) ──────────────────
var float lastPH = na
var float lastPL = na
if not na(ph)
    lastPH := ph
if not na(pl)
    lastPL := pl

higherHigh = not na(lastPH) and not na(lastPH[1]) and lastPH > lastPH[1]
lowerHigh  = not na(lastPH) and not na(lastPH[1]) and lastPH < lastPH[1]
higherLow  = not na(lastPL) and not na(lastPL[1]) and lastPL > lastPL[1]
lowerLow   = not na(lastPL) and not na(lastPL[1]) and lastPL < lastPL[1]

bullStruct = higherHigh or higherLow
bearStruct = lowerHigh or lowerLow

plotshape(higherHigh and showSwing ? high : na, "HH", shape.labelup,   location.absolute, color=color.new(color.lime, 0),   textcolor=color.black, size=size.tiny)
plotshape(lowerHigh  and showSwing ? high : na, "LH", shape.labeldown, location.absolute, color=color.new(color.red, 0),    textcolor=color.white, size=size.tiny)
plotshape(higherLow  and showSwing ? low : na,  "HL", shape.labelup,   location.absolute, color=color.new(color.lime, 40),  textcolor=color.black, size=size.tiny)
plotshape(lowerLow   and showSwing ? low : na,  "LL", shape.labeldown, location.absolute, color=color.new(color.red, 40),   textcolor=color.white, size=size.tiny)

// ─── Трендовая линия (ta.* вынесены из if) ──────────────────
lastH = ta.highest(high, 50)[0]
lastL = ta.lowest(low, 50)[0]
x1 = ta.barssince(not na(ph))
x2 = ta.barssince(not na(pl))

var line tl = na
if barstate.islast and showTrend
    if x1 >= 0 and x2 >= 0 and not na(lastPH) and not na(lastPL)
        if not na(tl)
            line.delete(tl)
        tl := line.new(bar_index - x2, lastPL, bar_index - x1, lastPH, color = color.new(color.white, 40), style=line.style_dotted, width = 1)

// ─── RS vs SPY ──────────────────────────────────────────────
rs = ta.roc(close, 21)
spyRoc = request.security(syminfo.tickerid, "D", ta.roc(close, 21), lookahead=barmerge.lookahead_off)
rsLead = rs > spyRoc

plot(showRs ? rs : na, "RS (21)", color=color.new(color.silver, 0), linewidth=2)
hline(0, color=color.new(color.gray, 50))
plot(showRs ? spyRoc : na, "SPY (21)", color=color.new(color.gray, 50), linewidth=1, style=plot.style_circles)
bgcolor(showRs and rsLead ? color.new(color.green, 92) : na)

// ─── Уровни сделки ──────────────────────────────────────────
if showLevels
    line.new(bar_index - 5, entryP, bar_index + 10, entryP, color = color.white, width = 1, style=line.style_dashed)
    line.new(bar_index - 5, stopP,  bar_index + 10, stopP,  color = color.red,   width = 2)
    line.new(bar_index - 5, t1P,    bar_index + 10, t1P,    color = color.lime,  width = 1, style=line.style_dashed)
    line.new(bar_index - 5, t2P,    bar_index + 10, t2P,    color = color.lime,  width = 1, style=line.style_dashed)
    line.new(bar_index - 5, t3P,    bar_index + 10, t3P,    color = color.lime,  width = 1, style=line.style_dashed)
    label.new(bar_index + 10, entryP, "Вход", style=label.style_label_left, color=color.gray, textcolor=color.white, size=size.tiny)
    label.new(bar_index + 10, stopP,  "SL",   style=label.style_label_left, color=color.red,   textcolor=color.white, size=size.tiny)
    label.new(bar_index + 10, t1P,    "TP1",  style=label.style_label_left, color=color.new(color.lime, 30), textcolor=color.black, size=size.tiny)
    label.new(bar_index + 10, t2P,    "TP2",  style=label.style_label_left, color=color.new(color.lime, 40), textcolor=color.black, size=size.tiny)
    label.new(bar_index + 10, t3P,    "TP3",  style=label.style_label_left, color=color.new(color.lime, 50), textcolor=color.black, size=size.tiny)

// ─── Таблица чек-листа ──────────────────────────────────────
var table t = table.new(position.top_right, 2, 14)

if barstate.islast and showTbl
    s2a = close > e50   ? "✓" : "✗"
    s2b = close > e200  ? "✓" : "✗"
    s2c = close > d200  ? "✓" : "✗"
    s2d = volHigh       ? "✓" : "✗"
    s2e = rsLead        ? "✓" : "✗"
    
    s3a = not na(e10)    ? "✓" : "✗"
    s3b = not na(e20)    ? "✓" : "✗"
    s3c = not na(lastPH) ? "✓" : "✗"
    s3d = not na(lastPL) ? "✓" : "✗"
    
    s4a = bullStruct    ? "✓" : "✗"
    s4b = bearStruct    ? "✗" : "✓"
    
    table.cell(t, 0, 0, "M.E.T.S. " + syminfo.ticker, text_color=color.white, bgcolor=color.gray)
    table.cell(t, 1, 0, "4H / 1D", text_color=color.white, bgcolor=color.gray)
    
    table.cell(t, 0, 1, "Цена", text_color=color.white)
    table.cell(t, 1, 1, str.tostring(close, format.mintick), text_color=color.white)
    
    table.cell(t, 0, 2, "Шаг 2: Моментум (нужно 4/4)", text_color=color.white)
    table.cell(t, 1, 2, s2a + s2b + s2c + s2d + s2e, text_color=color.white)
    
    table.cell(t, 0, 3, "  > EMA50 4H", text_color=color.white)
    table.cell(t, 1, 3, s2a + " " + str.tostring(e50, format.mintick), text_color=s2a == "✓" ? color.lime : color.red)
    table.cell(t, 0, 4, "  > EMA200 4H", text_color=color.white)
    table.cell(t, 1, 4, s2b + " " + str.tostring(e200, format.mintick), text_color=s2b == "✓" ? color.lime : color.red)
    table.cell(t, 0, 5, "  > EMA200 1D", text_color=color.white)
    table.cell(t, 1, 5, s2c + " " + str.tostring(d200, format.mintick), text_color=s2c == "✓" ? color.lime : color.red)
    table.cell(t, 0, 6, "  Объём >1.5x", text_color=color.white)
    table.cell(t, 1, 6, s2d + " " + str.tostring(volRatio, "#.##") + "x", text_color=s2d == "✓" ? color.lime : color.red)
    table.cell(t, 0, 7, "  RS > SPY", text_color=color.white)
    table.cell(t, 1, 7, s2e + " " + str.tostring(rs, "#.##") + "%", text_color=s2e == "✓" ? color.lime : color.red)
    
    table.cell(t, 0, 8, "Шаг 3: Технические края (нужно 3-4/4)", text_color=color.white)
    table.cell(t, 1, 8, s3a + s3b + s3c + s3d, text_color=color.white)
    table.cell(t, 0, 9, "  EMA10", text_color=color.white)
    table.cell(t, 1, 9, s3a, text_color=s3a == "✓" ? color.lime : color.red)
    table.cell(t, 0, 10, "  EMA20", text_color=color.white)
    table.cell(t, 1, 10, s3b, text_color=s3b == "✓" ? color.lime : color.red)
    table.cell(t, 0, 11, "  Локальный макс/мин", text_color=color.white)
    table.cell(t, 1, 11, s3c + s3d, text_color=(s3c == "✓" and s3d == "✓") ? color.lime : color.orange)
    
    table.cell(t, 0, 12, "Шаг 4: Рыночная структура", text_color=color.white)
    table.cell(t, 1, 12, s4a + s4b + (bullStruct ? " (бычья)" : " (медвежья)"), text_color=bullStruct ? color.lime : color.orange)
    table.cell(t, 0, 13, "Swing max/min", text_color=color.white)
    table.cell(t, 1, 13, (not na(lastPH) ? str.tostring(lastPH, format.mintick) : "—") + " / " + (not na(lastPL) ? str.tostring(lastPL, format.mintick) : "—"), text_color=color.white)