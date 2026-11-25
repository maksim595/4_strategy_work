P(`//@version=6
indicator("M.E.T.S. v2.3 (resin)", shorttitle="M.E.T.S. resin", overlay=true)

showEma   = input.bool(true,  "EMA 10 / 20 / 50 / 200")
showVol   = input.bool(true,  "Объём + средняя + порог 1.5x")
showSwing = input.bool(true,  "Swing-уровни")
showTrend = input.bool(true,  "Трендовая линия")
showRs    = input.bool(true,  "RS vs SPY")

swLen  = input.int(10, "Swing: баров слева", minval=2,  maxval=50)
swLenR = input.int(5,  "Swing: баров справа", minval=1, maxval=50)

e10 = ta.ema(close, 10)
e20 = ta.ema(close, 20)
e50 = ta.ema(close, 50)
e200 = ta.ema(close, 200)

plot(showEma ? e10 : na, "EMA10",  color=color.new(color.yellow, 0), linewidth=1)
plot(showEma ? e20 : na, "EMA20",  color=color.new(color.aqua, 0), linewidth=2)
plot(showEma ? e50 : na, "EMA50",  color=color.new(color.blue, 0), linewidth=2)
plot(showEma ? e200 : na, "EMA200", color=color.new(color.purple, 0), linewidth=2)

d50 = request.security(syminfo.tickerid, "D", ta.ema(close, 50), lookahead=barmerge.lookahead_off)
d200 = request.security(syminfo.tickerid, "D", ta.ema(close, 200), lookahead=barmerge.lookahead_off)
plot(showEma ? d50 : na,  "EMA50 (1D)", color=color.new(color.blue, 50), linewidth=1, style=plot.style_circles)
plot(showEma ? d200 : na, "EMA200 (1D)", color=color.new(color.purple, 50), linewidth=1, style=plot.style_circles)

avgVol = ta.sma(volume, 20)
volRatio = volume / avgVol
volHigh = volRatio >= 1.5
plot(showVol ? volume : na, "Объём", style=plot.style_columns, color=volHigh ? color.new(color.lime, 20) : color.new(color.gray, 40))
plot(showVol ? avgVol : na, "Средняя 20", color=color.new(color.orange, 30), linewidth=1)
plot(showVol ? avgVol * 1.5 : na, "Порог 1.5x", color=color.new(color.red, 40), linewidth=1, style=plot.style_linebr)

ph = ta.pivothigh(high, swLen, swLenR)
pl = ta.pivotlow(low, swLen, swLenR)
plotshape(showSwing and not na(ph), "Swing High", shape.labeldown, location.abovebar, color=color.new(color.red, 25), textcolor=color.white, size=size.tiny)
plotshape(showSwing and not na(pl), "Swing Low",  shape.labelup,   location.belowbar, color=color.new(color.lime, 25), textcolor=color.black, size=size.tiny)
plot(showSwing and not na(ph) ? ph : na, "Swing High Line", color=color.new(color.red, 25), linewidth=2, style=plot.style_linebr)
plot(showSwing and not na(pl) ? pl : na, "Swing Low Line",  color=color.new(color.lime, 25), linewidth=2, style=plot.style_linebr)

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

p10 = plot(showEma ? e10 : na, "EMA10_Fill", color=color.new(color.yellow, 100), display=display.none)
p20 = plot(showEma ? e20 : na, "EMA20_Fill", color=color.new(color.aqua, 100), display=display.none)
fill(p10, p20, color=color.new(color.aqua, 92), title="Зона EMA10-20")

plot(showTrend and not na(lastPH) ? lastPH : na, "Last PH", color=color.new(color.white, 40), linewidth=1, style=plot.style_linebr)
plot(showTrend and not na(lastPL) ? lastPL : na, "Last PL", color=color.new(color.white, 40), linewidth=1, style=plot.style_linebr)

rs = ta.roc(close, 21)
spyRoc = request.security(syminfo.tickerid, "D", ta.roc(close, 21), lookahead=barmerge.lookahead_off)
rsLead = rs > spyRoc

plot(showRs ? rs : na, "RS (21)", color=color.new(color.silver, 0), linewidth=2)
hline(0, color=color.new(color.gray, 50))
plot(showRs ? spyRoc : na, "SPY (21)", color=color.new(color.gray, 50), linewidth=1, style=plot.style_circles)
bgcolor(showRs and rsLead ? color.new(color.green, 92) : na)

isLast = barstate.islast
s2a = close > e50
s2b = close > e200
s2c = close > d200
s2d = volHigh
s2e = rsLead
s2total = (s2a ? 1 : 0) + (s2b ? 1 : 0) + (s2c ? 1 : 0) + (s2d ? 1 : 0) + (s2e ? 1 : 0)
s2ok = s2total >= 4

s3c = not na(lastPH)
s3d = not na(lastPL)
s3ok = not na(e10) and not na(e20) and s3c and s3d

s4ok = bullStruct

plotshape(isLast and s2ok ? high : na, "Шаг2 OK", shape.labelup, location.absolute, color=color.new(color.green, 20), textcolor=color.white, size=size.small, text="2✓")
plotshape(isLast and not s2ok ? high : na, "Шаг2 FAIL", shape.labeldown, location.absolute, color=color.new(color.red, 20), textcolor=color.white, size=size.small, text="2✗")
plotshape(isLast and s3ok ? low : na, "Шаг3 OK", shape.labelup, location.absolute, color=color.new(color.green, 20), textcolor=color.white, size=size.small, text="3✓")
plotshape(isLast and not s3ok ? low : na, "Шаг3 FAIL", shape.labeldown, location.absolute, color=color.new(color.red, 20), textcolor=color.white, size=size.small, text="3✗")
plotshape(isLast and s4ok ? close : na, "Шаг4 OK", shape.circle, location.absolute, color=color.new(color.green, 40), textcolor=color.white, size=size.tiny, text="4✓")
plotshape(isLast and not s4ok ? close : na, "Шаг4 FAIL", shape.circle, location.absolute, color=color.new(color.red, 40), textcolor=color.white, size=size.tiny, text="4✗")
`, {title: 'M.E.T.S. resin', overlay: true});