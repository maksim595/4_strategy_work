
// ===== ЧАСТЬ 1: LIGHTWEIGHT-CHARTS VARIABLES =====
let lwcChart = null;
let lwcCandleSeries = null;
let lwcResizeObserver = null;
let lwcMarkersHandle = null;  // ЧАСТЬ 2: primitive для маркеров (v5)
let pineVizHandle = null;  // ЧАСТЬ 3: для очистки предыдущего Pine-рендера

const BOT_VERSION='0.25';
const MAX_TRADES_COUNT=500,MAX_LOG_ENTRIES=100,MAX_BARS_COUNT=1000,TRADES_CLEANUP_THRESHOLD=50,MAX_POSITIONS=10;
let virtualBalance=10000,positions=[],tradesHistory=[],totalTradesCount=0,winTradesCount=0,lossTradesCount=0,netProfitSum=0;
let riskConfig={value:1,unit:'percent'},tpConfig={value:2,unit:'percent'},slConfig={value:1,unit:'percent'};
let holdBarsCount=null,fractalPeriod=2,userBackstep=2,invertSignal=false,noCandleCheck=false,selectedTimeframe="1h",botActive=false,currentInstrument='ETHUSDT';
let multiModeConfig={mode:'off',multiplier:1};
let strategyFlags={sameSideRisk:false,resetLossSeries:false,excludeOnlyOpposite:false};
let notificationsConfig={telegram:{enabled:false,botToken:'',chatId:'',timeout:15,retries:2,signalNotify:'all'}};
let realTimeBars=[],currentPrice=0,lastSignalBarIndex=-1,lastProcessedCandleTime=null;
let chartBars=[]; // Данные, которые реально отрисованы на графике (для синхронизации с Pine)
let pollingTimer=null,pollingConnected=false;
let tgPendingQueue=[],tgProcessing=false;
let currentProfileName='не загружен',lossStreak=[];
let autoPulseTimer=null,forceAnalysisTimer=null,lastBarAddedTime=0;
let mskOffset=3*60*60*1000; // МСК UTC+3

const $=id=>document.getElementById(id);
function getMskTime(){return new Date()}
function formatTimeMsk(){return getMskTime().toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour12:false})}
function formatFullTimeMsk(){return getMskTime().toLocaleString('ru-RU',{timeZone:'Europe/Moscow',hour12:false})}
function addLog(msg,type){type=type||'info';eventLogs.unshift({time:formatTimeMsk(),msg:msg,type:type});if(eventLogs.length>MAX_LOG_ENTRIES)eventLogs.splice(MAX_LOG_ENTRIES,TRADES_CLEANUP_THRESHOLD);updateLogUI()}
function updateLogUI(){if(!$('eventLog'))return;$('eventLog').innerHTML=eventLogs.map(function(l){var bc='#cbd5e1';if(l.type==='signal')bc='#f59e0b';if(l.type==='trade')bc='#2563eb';if(l.type==='error')bc='#ef4444';if(l.type==='multi')bc='#f59e0b';if(l.type==='tg_sent')bc='#10b981';if(l.type==='tg_error')bc='#ef4444';if(l.type==='trailing')bc='#0891b2';if(l.type==='settings')bc='#8b5cf6';if(l.type==='pine')bc='#ec4899';return'<div class="log-entry" style="border-left-color:'+bc+'">['+l.time+'] '+l.msg+'</div>'}).join('');if($('logCountBadge'))$('logCountBadge').textContent=eventLogs.length+' / '+MAX_LOG_ENTRIES}
var eventLogs=[];
function formatUSD(val){return(val||0).toFixed(2)+' $'}
function calculateWinRate(){if(totalTradesCount===0)return{winRate:0,lossRate:0};return{winRate:((winTradesCount/totalTradesCount)*100).toFixed(1),lossRate:((lossTradesCount/totalTradesCount)*100).toFixed(1)}}
function addTrade(trade){tradesHistory.push(trade);if(tradesHistory.length>MAX_TRADES_COUNT)tradesHistory.splice(0,tradesHistory.length-MAX_TRADES_COUNT+TRADES_CLEANUP_THRESHOLD);updateTradesUI()}
function clearTradesHistory(){tradesHistory=[];lossStreak=[];updateTradesUI()}
function getValueInUSD(config,baseValue){if(!config||config.value===null||config.value===''||config.value===undefined)return null;if(config.unit==='percent'){if(!baseValue)baseValue=virtualBalance;return baseValue*(parseFloat(config.value)/100)}return parseFloat(config.value)}
function getBaseRiskAmount(){return getValueInUSD(riskConfig)}
function getLossStreakSum(){return lossStreak.reduce(function(s,l){return s+l.amount},0)}
function getTotalOpenSLAmount(sideOnly){var sl=getValueInUSD(slConfig)||0;if(sideOnly)return positions.filter(function(p){return p.side===sideOnly}).length*sl;return positions.length*sl}
function getPositionsBySide(side){return positions.filter(function(p){return p.side===side})}
function hasAnyPosition(){return positions.length>0}

function openPosition(side,price,barIndex,isMulti,riskOverride){isMulti=isMulti||false;riskOverride=riskOverride||null;if(!currentPrice||currentPrice<100){return false}var riskAmount=riskOverride!==null?riskOverride:getBaseRiskAmount();var size=riskAmount/price;if(size<0.001)size=0.001;if(positions.length>=MAX_POSITIONS){addLog('Лимит позиций','error');return false}var slPrice=side==='long'?price*(1-slConfig.value/100):price*(1+slConfig.value/100);positions.push({id:Date.now()+Math.random(),side:side,entryPrice:price,size:size,entryBarIndex:barIndex,riskAmount:riskAmount,isMultipled:isMulti,initialStopPrice:slPrice,dynamicStopPrice:slPrice,highestProfitPrice:price});var multMark=isMulti?' [M:'+multiModeConfig.multiplier+']':'';addLog('ОТКРЫТА '+side.toUpperCase()+' | '+size.toFixed(4)+' @ '+price.toFixed(2)+' | SL: '+slPrice.toFixed(2)+multMark,'trade');sendTgMessage('ОТКРЫТА '+side.toUpperCase()+'\n'+currentInstrument+' | '+selectedTimeframe+'\n🕐 '+formatTimeMsk()+'\nРазмер: '+size.toFixed(4)+'\nЦена: '+price.toFixed(2)+'\nSL: '+slPrice.toFixed(2)+multMark+'\nБот v'+BOT_VERSION);updateUI();return true}
function updateTrailingStops(price){if(positions.length===0||slConfig.value<=0)return;var slPct=slConfig.value/100;positions.forEach(function(p){if(p.side==='long'&&price>p.highestProfitPrice){p.highestProfitPrice=price;var ns=price*(1-slPct);if(ns>p.dynamicStopPrice){p.dynamicStopPrice=ns;addLog('Трейлинг #'+p.id.toString().slice(-4)+': SL '+ns.toFixed(2),'trailing')}}else if(p.side==='short'&&price<p.highestProfitPrice){p.highestProfitPrice=price;var ns=price*(1+slPct);if(ns<p.dynamicStopPrice){p.dynamicStopPrice=ns;addLog('Трейлинг #'+p.id.toString().slice(-4)+': SL '+ns.toFixed(2),'trailing')}}})}
function checkTrailingStop(){var closed=false;positions.slice().forEach(function(p){if(p.side==='long'&&currentPrice<=p.dynamicStopPrice){closePositionById(p.id,currentPrice,'Trailing SL');closed=true}else if(p.side==='short'&&currentPrice>=p.dynamicStopPrice){closePositionById(p.id,currentPrice,'Trailing SL');closed=true}});return closed}
function resetLossStreakIfProfitable(pnl){if(pnl>0&&strategyFlags.resetLossSeries&&lossStreak.length>0){lossStreak=[];addLog('Серия убытков сброшена','multi')}}
function closePositionById(positionId,exitPrice,reason){var idx=positions.findIndex(function(p){return p.id===positionId});if(idx===-1)return false;var p=positions[idx];var pnl=p.side==='long'?(exitPrice-p.entryPrice)*p.size:(p.entryPrice-exitPrice)*p.size;virtualBalance+=pnl;netProfitSum+=pnl;totalTradesCount++;var isWin=pnl>0;if(isWin){winTradesCount++;resetLossStreakIfProfitable(pnl)}else{lossTradesCount++;lossStreak.push({amount:Math.abs(pnl)})}addTrade({time:formatFullTimeMsk(),side:p.side,entryPrice:p.entryPrice,exitPrice:exitPrice,pnl:pnl,reason:reason});addLog('Закрыта '+p.side.toUpperCase()+' | П/У: '+(pnl>=0?'+':'')+pnl.toFixed(2)+'$ ('+reason+')','trade');sendTgMessage((isWin?'✅':'❌')+' ЗАКРЫТА '+p.side.toUpperCase()+'\n'+currentInstrument+' | '+selectedTimeframe+'\n🕐 '+formatTimeMsk()+'\nВход: '+p.entryPrice.toFixed(2)+'\nВыход: '+exitPrice.toFixed(2)+'\nП/У: '+(pnl>=0?'+':'')+pnl.toFixed(2)+'$\nПричина: '+reason+'\nДепозит: '+virtualBalance.toFixed(2)+'$\nСделок: '+totalTradesCount+' | Успех: '+calculateWinRate().winRate+'%\nБот v'+BOT_VERSION);positions.splice(idx,1);if(positions.length>0)updateTrailingStops(currentPrice);updateUI();return true}
function closeAllPositions(exitPrice,reason){positions.slice().forEach(function(p){closePositionById(p.id,exitPrice,reason)})}
function closeOppositePositions(keepSide,exitPrice,reason){var opp=keepSide==='long'?'short':'long';positions.filter(function(p){return p.side===opp}).forEach(function(p){closePositionById(p.id,exitPrice,reason)})}
function checkStopLoss(){if(!positions.length)return false;var slAmt=getValueInUSD(slConfig);if(!slAmt||slAmt<=0)return false;var closed=false;positions.slice().forEach(function(p){var pl=p.side==='long'?(currentPrice-p.entryPrice)*p.size:(p.entryPrice-currentPrice)*p.size;if(pl<=-slAmt){addLog('🛑 SL! P&L: $'+pl.toFixed(2),'trade');closePositionById(p.id,currentPrice,'SL');closed=true}});return closed}
function checkTakeProfit(){if(!positions.length)return false;var tpAmt=getValueInUSD(tpConfig);if(!tpAmt||tpAmt<=0)return false;var closed=false;positions.slice().forEach(function(p){var pl=p.side==='long'?(currentPrice-p.entryPrice)*p.size:(p.entryPrice-currentPrice)*p.size;if(pl>=tpAmt){addLog('🎯 TP! P&L: $'+pl.toFixed(2),'trade');closePositionById(p.id,currentPrice,'TP');closed=true}});return closed}
function checkExitConditions(){if(!positions.length)return;updateTrailingStops(currentPrice);checkTrailingStop();checkStopLoss();checkTakeProfit();if(holdBarsCount!==null)positions.slice().forEach(function(p){if(p.entryBarIndex!==undefined&&realTimeBars.length-1-p.entryBarIndex>=holdBarsCount)closePositionById(p.id,currentPrice,'Таймер ('+holdBarsCount+' бар)')})}
function detectFractalSignalRaw(){var L=fractalPeriod,B=noCandleCheck?0:userBackstep,len=realTimeBars.length;if(len<(L*2+1)+B)return null;var centerIdx=len-L-1-B;if(centerIdx<L||centerIdx>=len-L)return null;var center=realTimeBars[centerIdx],isHighFractal=true,isLowFractal=true;for(var i=centerIdx-L;i<=centerIdx+L;i++){if(i===centerIdx||i<0||i>=len)continue;if(realTimeBars[i].high>=center.high)isHighFractal=false;if(realTimeBars[i].low<=center.low)isLowFractal=false}var rawSignal=null;if(!noCandleCheck){if(isLowFractal&&center.close>center.low)rawSignal='long';else if(isHighFractal&&center.close<center.high)rawSignal='short'}else{if(isLowFractal)rawSignal='long';else if(isHighFractal)rawSignal='short'}if(!rawSignal)return null;return{type:rawSignal,priceLevel:rawSignal==='long'?center.low:center.high,barIndex:centerIdx}}
function sendTgMessage(text,attempt){attempt=attempt||1;if(!notificationsConfig.telegram.enabled||!notificationsConfig.telegram.botToken||!notificationsConfig.telegram.chatId)return;tgPendingQueue.push({text:text,attempt:attempt,timestamp:Date.now()});if(!tgProcessing)processTgQueue()}
async function processTgQueue(){if(tgPendingQueue.length===0){tgProcessing=false;return}tgProcessing=true;var now=Date.now();tgPendingQueue=tgPendingQueue.filter(function(i){return now-i.timestamp<60000});if(tgPendingQueue.length===0){tgProcessing=false;return}var item=tgPendingQueue.shift();var maxRetries=notificationsConfig.telegram.retries||2;var timeout=(notificationsConfig.telegram.timeout||15)*1000;var fullText=item.attempt>0?'Повтор #'+(item.attempt+1)+'\n'+item.text:item.text;try{var controller=new AbortController();var timer=setTimeout(function(){controller.abort()},timeout);var resp=await fetch('https://api.telegram.org/bot'+notificationsConfig.telegram.botToken+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:notificationsConfig.telegram.chatId,text:fullText,parse_mode:'HTML'}),signal:controller.signal});clearTimeout(timer);var result=await resp.json();if(result.ok){addLog('Telegram: доставлено','tg_sent')}else{throw new Error(result.description||'HTTP '+resp.status)}}catch(err){addLog('Telegram: '+err.message,'tg_error');if(item.attempt<maxRetries){await new Promise(function(r){setTimeout(r,3000)});tgPendingQueue.unshift({text:item.text,attempt:item.attempt+1,timestamp:Date.now()})}else{addLog('Telegram: превышено повторов','error')}}finally{if(tgPendingQueue.length>0)setTimeout(function(){processTgQueue()},1500);else{tgProcessing=false}}}
function handleSignal(signal,barIndex){var rawType=signal.type;var tradeDirection=invertSignal?(rawType==='long'?'short':'long'):rawType;var signalText=rawType==='long'?'LONG':'SHORT';var invText=invertSignal?' [ИНВЕРСИЯ]':'';var ncText=noCandleCheck?' [БЕЗ СВЕЧИ]':'';var bsText=' [BS='+(noCandleCheck?0:userBackstep)+']';addLog('СИГНАЛ: '+signalText+invText+ncText+bsText+' | Уровень: '+signal.priceLevel.toFixed(2),'signal');if($('signalLabel')){$('signalLabel').className='signal-badge '+(rawType==='long'?'signal-long':'signal-short');$('signalLabel').innerHTML=rawType==='long'?'🟢 LONG':'🔴 SHORT'}sendTgMessage('СИГНАЛ: '+signalText+invText+ncText+bsText+'\n'+currentInstrument+' | '+selectedTimeframe+'\n🕐 '+formatTimeMsk()+'\nУровень: '+signal.priceLevel.toFixed(2)+'\nЦена: '+currentPrice.toFixed(2)+'\nБот v'+BOT_VERSION);if(!botActive)return;if(multiModeConfig.mode==='off'){if(!hasAnyPosition())openPosition(tradeDirection,currentPrice,barIndex,false)}else if(multiModeConfig.mode==='add'){var opp=tradeDirection==='long'?'short':'long';var same=getPositionsBySide(tradeDirection);var oppP=getPositionsBySide(opp);if(!hasAnyPosition()){openPosition(tradeDirection,currentPrice,barIndex,false)}else if(same.length>0){var slAmt=strategyFlags.sameSideRisk?getTotalOpenSLAmount(tradeDirection):getTotalOpenSLAmount();openPosition(tradeDirection,currentPrice,barIndex,true,getBaseRiskAmount()+slAmt*multiModeConfig.multiplier)}else if(oppP.length>0){openPosition(tradeDirection,currentPrice,barIndex,true,getBaseRiskAmount()+getLossStreakSum()*multiModeConfig.multiplier)}}else if(multiModeConfig.mode==='exclude'){var opp=tradeDirection==='long'?'short':'long';var oppP=getPositionsBySide(opp);if(!hasAnyPosition()){var ls=getLossStreakSum();openPosition(tradeDirection,currentPrice,barIndex,false,ls>0?getBaseRiskAmount()+ls*multiModeConfig.multiplier:null)}else if(oppP.length>0){if(strategyFlags.excludeOnlyOpposite){closeOppositePositions(tradeDirection,currentPrice,'Исключение (противоп.)')}else{closeAllPositions(currentPrice,'Исключение')}openPosition(tradeDirection,currentPrice,barIndex,true,getBaseRiskAmount()+getLossStreakSum()*multiModeConfig.multiplier)}else{addLog('Мульти-исключение: сонаправленный, ждем','multi')}}}
function processStrategyOnNewBar(barIndex,barCloseTime){if(lastProcessedCandleTime===barCloseTime)return;lastProcessedCandleTime=barCloseTime;var signal=detectFractalSignalRaw();if(signal&&lastSignalBarIndex!==signal.barIndex){lastSignalBarIndex=signal.barIndex;handleSignal(signal,barIndex)}else if(!signal&&$('signalLabel')){$('signalLabel').className='signal-badge signal-wait';$('signalLabel').innerHTML='⚪ НЕТ СИГНАЛА'}checkExitConditions();updateUI()}
function startAutoPulse(){stopAutoPulse();autoPulseTimer=setInterval(function(){if(lastBarAddedTime>0&&Date.now()-lastBarAddedTime>300000){addLog('Пульс: бот жив, '+Math.round((Date.now()-lastBarAddedTime)/1000)+'с без новых свечей','pulse')}},60000)}
function stopAutoPulse(){if(autoPulseTimer){clearInterval(autoPulseTimer);autoPulseTimer=null}if(forceAnalysisTimer){clearInterval(forceAnalysisTimer);forceAnalysisTimer=null}if(pollingTimer){clearInterval(pollingTimer);pollingTimer=null}}
async function startPolling(tf,symbol){stopPolling();pollingConnected=true;if($('wsStatusBadge')){$('wsStatusBadge').innerHTML='📡 API: ✅ '+symbol;$('wsStatusBadge').className='real-badge'}addLog('📡 Загрузка баров: '+symbol+' '+tf);await loadHistoryBars();updateChartFromBars();updateFractalMarkers();if(lwcChart)lwcChart.timeScale().fitContent();pollingTimer=setInterval(function(){loadLastBar();if(positions.length>0){checkExitConditions()}},5000)}
function stopPolling(){if(pollingTimer){clearInterval(pollingTimer);pollingTimer=null}pollingConnected=false;if($('wsStatusBadge')){$('wsStatusBadge').innerHTML='📡 API: —';$('wsStatusBadge').className='real-badge'}}
function loadLastBar(){fetch('https://api.binance.com/api/v3/klines?symbol='+currentInstrument+'&interval='+selectedTimeframe+'&limit=2').then(function(r){return r.json()}).then(function(d){if(!d||d.length===0)return;var current=d[d.length-1];currentPrice=parseFloat(current[4]);if($('currentPriceVal'))$('currentPriceVal').innerText=currentPrice.toFixed(2);if(d.length<2)return;var lastClosed=d[d.length-2];var t=parseFloat(lastClosed[6]);if(t>lastBarAddedTime){var isDuplicate=realTimeBars.some(function(b){return b.timestamp===t});if(!isDuplicate){lastBarAddedTime=t;var newBar={open:parseFloat(lastClosed[1]),high:parseFloat(lastClosed[2]),low:parseFloat(lastClosed[3]),close:parseFloat(lastClosed[4]),volume:parseFloat(lastClosed[5]),timestamp:t,index:realTimeBars.length};realTimeBars.push(newBar);if(realTimeBars.length>MAX_BARS_COUNT)realTimeBars.splice(0,TRADES_CLEANUP_THRESHOLD);processStrategyOnNewBar(realTimeBars.length-1,t);updateChartFromBars();updateFractalMarkers()}}}).catch(function(e){addLog('⚠️ Ошибка API: '+e.message,'error')})}

// ===== ЧАСТЬ 1: LIGHTWEIGHT-CHARTS INIT =====
function initLightweightChart(){var container=$('tvWidgetContainer');if(!container){addLog('❌ Контейнер графика не найден','error');return}if(typeof LightweightCharts==='undefined'){addLog('❌ lightweight-charts не загружен (CDN заблокирован?)','error');return}container.innerHTML='';lwcChart=LightweightCharts.createChart(container,{width:container.clientWidth,height:container.clientHeight||520,layout:{background:{type:'solid',color:'#ffffff'},textColor:'#1a2634'},grid:{vertLines:{color:'#e9edf2'},horzLines:{color:'#e9edf2'}},timeScale:{timeVisible:true,secondsVisible:false,borderColor:'#cbd5e1',tickMarkFormatter:function(time,tickMarkType){var d=new Date((time+3*3600)*1000);if(tickMarkType===0)return d.getUTCFullYear().toString();else if(tickMarkType===1)return['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];else if(tickMarkType===2)return d.getUTCDate().toString();else if(tickMarkType===3||tickMarkType===4)return('0'+d.getUTCHours()).slice(-2)+':'+('0'+d.getUTCMinutes()).slice(-2)}},localization:{timeFormatter:function(time){var d=new Date((time+3*3600)*1000);var pad=function(n){return('0'+n).slice(-2)};return pad(d.getUTCDate())+'.'+pad(d.getUTCMonth()+1)+'.'+d.getUTCFullYear()+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())}},rightPriceScale:{borderColor:'#cbd5e1'}});lwcCandleSeries=lwcChart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#10b981',downColor:'#ef4444',borderUpColor:'#10b981',borderDownColor:'#ef4444',wickUpColor:'#10b981',wickDownColor:'#ef4444'});if(lwcResizeObserver)lwcResizeObserver.disconnect();lwcResizeObserver=new ResizeObserver(function(entries){if(!lwcChart||!entries[0])return;lwcChart.applyOptions({width:entries[0].contentRect.width})});lwcResizeObserver.observe(container);addLog('📊 lightweight-charts инициализирован','info');updateChartFromBars();if(lwcChart)lwcChart.timeScale().fitContent()}
function updateChartFromBars(){if(!lwcCandleSeries||!realTimeBars||realTimeBars.length===0)return;var seen=new Set();var data=[];for(var i=0;i<realTimeBars.length;i++){var b=realTimeBars[i];var t=Math.floor((b.timestamp||0)/1000);if(!t||seen.has(t))continue;seen.add(t);data.push({time:t,open:b.open,high:b.high,low:b.low,close:b.close})}if(data.length===0)return;data.sort(function(a,b){return a.time-b.time});chartBars=data; // Сохраняем для Pine (синхронизация данных)lwcCandleSeries.setData(data)}
function setChartHeight(px){var container=$('tvWidgetContainer');if(container)container.style.height=px+'px';if(lwcChart)lwcChart.applyOptions({height:parseInt(px,10)||520})}

// ===== ЧАСТЬ 2: ФРАКТАЛЬНЫЕ МАРКЕРЫ =====
function updateFractalMarkers(){
    if(!lwcCandleSeries||!realTimeBars||realTimeBars.length<5)return;
    if(typeof LightweightCharts.createSeriesMarkers!=='function'){
        if(!window.__markersWarned){addLog('⚠️ createSeriesMarkers недоступен — маркеры отключены','error');window.__markersWarned=true}
        return;
    }
    if(lwcMarkersHandle&&typeof lwcMarkersHandle.setMarkers==='function'){lwcMarkersHandle.setMarkers([])}
    lwcMarkersHandle=LightweightCharts.createSeriesMarkers(lwcCandleSeries,[]);
    var L=fractalPeriod||2;
    var markers=[];
    var seenTimes=new Set();
    var len=realTimeBars.length;
    for(var centerIdx=L;centerIdx<len-L;centerIdx++){
        var center=realTimeBars[centerIdx];
        if(!center||!center.timestamp)continue;
        var isHigh=true,isLow=true;
        for(var j=centerIdx-L;j<=centerIdx+L;j++){
            if(j===centerIdx||j<0||j>=len)continue;
            if(realTimeBars[j].high>=center.high)isHigh=false;
            if(realTimeBars[j].low<=center.low)isLow=false;
        }
        var type=null;
        if(!noCandleCheck){
            if(isLow&&center.close>center.low)type='long';
            else if(isHigh&&center.close<center.high)type='short';
        }else{
            if(isLow)type='long';
            else if(isHigh)type='short';
        }
        if(!type)continue;
        var t=Math.floor(center.timestamp/1000);
        if(seenTimes.has(t))continue;
        seenTimes.add(t);
        markers.push({time:t,position:type==='long'?'belowBar':'aboveBar',color:type==='long'?'#10b981':'#ef4444',shape:type==='long'?'arrowUp':'arrowDown',text:(type==='long'?'L':'S')+'('+L+')'});
    }
    markers.sort(function(a,b){return a.time-b.time});
    lwcMarkersHandle.setMarkers(markers);
}

// ===== ЧАСТЬ 3: PINE SCRIPT BRIDGE =====
async function loadPineScript(pineSource){
    if(typeof ResinBridge==='undefined'){addLog('❌ resin-bundle.js не загружен','pine');return}
    if(!lwcChart){addLog('❌ График не инициализирован','pine');return}
    if(!pineSource||!pineSource.trim()){addLog('❌ Pine-код пуст','pine');return}
    if(realTimeBars.length<10||realTimeBars[0].timestamp<1000000000000){
        addLog('⚠️ Загрузите реальные данные (смените ТФ/инструмент) перед Pine Script','pine');
        return;
    }
    // Проверка сортировки (дубликаты уже отфильтрованы в loadLastBar)
    var times=realTimeBars.map(function(b){return b.timestamp});
    for(var i=1;i<times.length;i++){
        if(times[i]<times[i-1]){
            addLog('❌ Ошибка: бары не отсортированы','pine');
            return;
        }
    }
    // Синхронизация данных: используем chartBars (точно те же данные, что на графике)
    if(chartBars.length<10){
        addLog('⚠️ Недостаточно данных на графике для Pine','pine');
        return;
    }
    var result;
    try{result=ResinBridge.transpile(pineSource)}catch(e){addLog('❌ Ошибка компиляции Pine: '+e.message,'pine');return}
    if(!result.ok){addLog('❌ Pine не скомпилирован: '+(result.errors||[]).join('; '),'pine');return}
    var barsObj={
        time:chartBars.map(function(b){return b.time}),
        open:chartBars.map(function(b){return b.open}),
        high:chartBars.map(function(b){return b.high}),
        low:chartBars.map(function(b){return b.low}),
        close:chartBars.map(function(b){return b.close}),
        volume:chartBars.map(function(b){return 0}) // volume не критичен для SMA
    };
    var len=barsObj.time.length;
    if(barsObj.open.length!==len||barsObj.high.length!==len||barsObj.low.length!==len||barsObj.close.length!==len||barsObj.volume.length!==len){
        addLog('❌ Массивы разной длины! time:'+len+' open:'+barsObj.open.length+' close:'+barsObj.close.length,'pine');
        return;
    }
    if(len<2){addLog('❌ Недостаточно данных для Pine','pine');return}
    if(pineVizHandle&&typeof pineVizHandle.remove==='function'){try{pineVizHandle.remove()}catch(e){}pineVizHandle=null}
    try{
        var runResult=ResinBridge.run(result,barsObj);
        var viz=runResult.viz||runResult;
        pineVizHandle=ResinBridge.applyResinViz(lwcChart,viz,barsObj,{mainSeries:false});
        // Принудительная ревалидация основной серии (обход бага Value is null)
        if(lwcCandleSeries&&realTimeBars.length>0){
            var lastBar=realTimeBars[realTimeBars.length-1];
            lwcCandleSeries.update({
                time:Math.floor(lastBar.timestamp/1000),
                open:lastBar.open,
                high:lastBar.high,
                low:lastBar.low,
                close:lastBar.close
            });
        }
        addLog('✅ Pine-скрипт наложен ('+len+' баров)','pine')
    }catch(e){addLog('❌ Ошибка рендера Pine: '+e.message,'pine')}
}
window.loadPineScript=loadPineScript;

function initHeightControl(){var sl=$('chartHeightSlider'),hs=$('heightValue');if(!sl)return;sl.addEventListener('input',function(e){if(hs)hs.innerText=e.target.value+'px';setChartHeight(e.target.value)})}
function updateFlagStyles(){['SameRisk','ResetSeries','ExcludeOnly'].forEach(function(k){var flag=$('flag'+k);var checked=$('checkbox'+k)?.checked;if(flag)flag.className='strategy-flag'+(checked?' checked':'')})}
async function testTelegramNotification(){var bt=$('tgBotToken')?.value,ci=$('tgChatId')?.value;if(!bt||!ci){addLog('Заполните Token и Chat ID','error');return}try{var c=new AbortController();var t=setTimeout(function(){c.abort()},10000);var r=await fetch('https://api.telegram.org/bot'+bt+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:ci,text:'ТЕСТ '+currentInstrument+' | '+selectedTimeframe+'\n🕐 '+formatFullTimeMsk()+'\nБот v'+BOT_VERSION}),signal:c.signal});clearTimeout(t);var j=await r.json();if(j.ok)addLog('Telegram тест успешен','tg_sent');else addLog(j.description,'tg_error')}catch(err){addLog(err.message,'tg_error')}}
function saveProfile(){var p={name:'profile_'+Date.now(),timestamp:new Date().toISOString(),instrument:currentInstrument,timeframe:selectedTimeframe,settings:{risk:riskConfig,tp:tpConfig,sl:slConfig,holdBars:holdBarsCount,fractalPeriod:fractalPeriod,userBackstep:userBackstep,invertSignal:invertSignal,noCandleCheck:noCandleCheck,multiMode:multiModeConfig,strategyFlags:strategyFlags,notifications:notificationsConfig},state:{virtualBalance:virtualBalance,totalTradesCount:totalTradesCount,winTradesCount:winTradesCount,lossTradesCount:lossTradesCount,netProfitSum:netProfitSum,tradesHistory:tradesHistory,positions:positions,lossStreak:lossStreak}};var b=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download='profile.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);addLog('Профиль сохранен','info')}
function loadProfile(file){var r=new FileReader();r.onload=function(e){try{var p=JSON.parse(e.target.result);if(p.settings){riskConfig=p.settings.risk||riskConfig;tpConfig=p.settings.tp||tpConfig;slConfig=p.settings.sl||slConfig;holdBarsCount=p.settings.holdBars;fractalPeriod=p.settings.fractalPeriod||2;userBackstep=p.settings.userBackstep||2;invertSignal=p.settings.invertSignal||false;noCandleCheck=p.settings.noCandleCheck||false;if(p.settings.multiMode)multiModeConfig=p.settings.multiMode;if(p.settings.strategyFlags)strategyFlags=p.settings.strategyFlags;if(p.settings.notifications)notificationsConfig=p.settings.notifications}if(p.state){virtualBalance=p.state.virtualBalance||10000;totalTradesCount=p.state.totalTradesCount||0;winTradesCount=p.state.winTradesCount||0;lossTradesCount=p.state.lossTradesCount||0;netProfitSum=p.state.netProfitSum||0;tradesHistory=p.state.tradesHistory||[];lossStreak=p.state.lossStreak||[]}if(p.instrument)changeInstrument(p.instrument);if(p.timeframe){selectedTimeframe=p.timeframe;$('timeframeSelect').value=selectedTimeframe;if($('currentTFDisplay'))$('currentTFDisplay').innerText=selectedTimeframe}$('riskValue').value=riskConfig.value;$('riskUnit').value=riskConfig.unit;$('tpValue').value=tpConfig.value!==null?tpConfig.value:'';$('tpUnit').value=tpConfig.unit;$('slValue').value=slConfig.value!==null?slConfig.value:'';$('slUnit').value=slConfig.unit;$('holdBars').value=holdBarsCount||'';$('fractalPeriod').value=fractalPeriod;$('backstepSlider').value=userBackstep;$('invertSignal').value=invertSignal.toString();$('noCandleCheck').checked=noCandleCheck;$('multiModeSelect').value=multiModeConfig.mode;$('multiplierValue').value=multiModeConfig.multiplier;$('checkboxSameRisk').checked=strategyFlags.sameSideRisk;$('checkboxResetSeries').checked=strategyFlags.resetLossSeries;$('checkboxExcludeOnly').checked=strategyFlags.excludeOnlyOpposite;$('tgBotToken').value=notificationsConfig.telegram.botToken;$('tgChatId').value=notificationsConfig.telegram.chatId;$('tgEnabled').checked=notificationsConfig.telegram.enabled;$('tgTimeout').value=notificationsConfig.telegram.timeout||15;$('tgRetries').value=notificationsConfig.telegram.retries||2;$('tgSignalNotify').value=notificationsConfig.telegram.signalNotify||'all';updateFlagStyles();updateUI()}catch(err){addLog('Ошибка профиля: '+err.message,'error')}};r.readAsText(file)}
function updatePositionsUI(){if(!$('positionsPanel')||!$('positionsList'))return;if(positions.length===0){$('positionsPanel').style.display='none';return}$('positionsPanel').style.display='block';var totalUnrealized=positions.reduce(function(sum,pos){var pnl=pos.side==='long'?(currentPrice-pos.entryPrice)*pos.size:(pos.entryPrice-currentPrice)*pos.size;return sum+pnl},0);$('positionsList').innerHTML=positions.map(function(pos,idx){var pnl=pos.side==='long'?(currentPrice-pos.entryPrice)*pos.size:(pos.entryPrice-currentPrice)*pos.size;var pnlClass=pnl>=0?'positive':'negative';var multMark=pos.isMultipled?' ×'+multiModeConfig.multiplier:'';var slInfo=pos.dynamicStopPrice?' | SL: '+pos.dynamicStopPrice.toFixed(2):'';return'<div class="position-item"><span>#'+(idx+1)+' '+pos.side.toUpperCase()+' '+pos.size.toFixed(4)+' @ '+pos.entryPrice.toFixed(2)+multMark+slInfo+'</span><span class="'+pnlClass+'">'+(pnl>=0?'+':'')+pnl.toFixed(2)+'$</span></div>'}).join('')+'<div class="position-item" style="font-weight:600;border-top:2px solid #7dd3fc;margin-top:8px;padding-top:8px"><span>Σ P&L:</span><span class="'+(totalUnrealized>=0?'positive':'negative')+'">'+(totalUnrealized>=0?'+':'')+totalUnrealized.toFixed(2)+'$</span></div>'}
function updateUI(){if($('virtualBalanceDisplay'))$('virtualBalanceDisplay').innerText=formatUSD(virtualBalance);if($('totalTrades'))$('totalTrades').innerText=totalTradesCount;var rates=calculateWinRate();if($('winTrades'))$('winTrades').innerText=winTradesCount+' ('+rates.winRate+'%)';if($('lossTrades'))$('lossTrades').innerText=lossTradesCount+' ('+rates.lossRate+'%)';if($('netProfit'))$('netProfit').innerText=(netProfitSum>=0?'+':'')+formatUSD(netProfitSum);if(positions.length===0){if($('positionStatus'))$('positionStatus').innerText='Нет';if($('unrealizedPL'))$('unrealizedPL').innerText=formatUSD(0)}else{var lc=positions.filter(function(p){return p.side==='long'}).length;var sc=positions.filter(function(p){return p.side==='short'}).length;var ts=positions.reduce(function(s,p){return s+p.size},0);if($('positionStatus'))$('positionStatus').innerText=lc+'L/'+sc+'S ('+ts.toFixed(4)+')';var upl=positions.reduce(function(s,p){return s+(p.side==='long'?(currentPrice-p.entryPrice)*p.size:(p.entryPrice-currentPrice)*p.size)},0);if($('unrealizedPL'))$('unrealizedPL').innerText=(upl>=0?'+':'')+formatUSD(upl)}updatePositionsUI();updateTradesUI();updateBotStatusIndicator();if($('heartbeatBadge')){var el=lastBarAddedTime>0?Math.round((Date.now()-lastBarAddedTime)/1000):'-';$('heartbeatBadge').textContent='пульс: '+el+'с'}if($('currentPriceVal'))$('currentPriceVal').innerText=currentPrice.toFixed(2)}
function updateTradesUI(){if(!$('tradesTableBody'))return;$('tradesTableBody').innerHTML=tradesHistory.length===0?'<tr><td colspan="6">Нет сделок</td></tr>':tradesHistory.slice().reverse().slice(0,50).map(function(t){return'<tr><td>'+t.time+'</td><td>'+t.side.toUpperCase()+'</td><td>'+t.entryPrice.toFixed(2)+'</td><td>'+(t.exitPrice?.toFixed(2)||'-')+'</td><td style="color:'+(t.pnl>=0?'#10b981':'#ef4444')+'">'+(t.pnl>=0?'+':'')+t.pnl.toFixed(2)+'$</td><td>'+(t.reason||'-')+'</td></tr>'}).join('');if($('tradesCountBadge'))$('tradesCountBadge').textContent=tradesHistory.length+' / '+MAX_TRADES_COUNT}
function updateBotStatusIndicator(){if($('botStatusDot')&&$('botStatusText')){if(botActive){$('botStatusDot').className='status-dot active';$('botStatusText').textContent='Бот работает'}else{$('botStatusDot').className='status-dot';$('botStatusText').textContent='Ожидание'}}}
function startBot(){if(botActive)return;botActive=true;if($('botModeIndicator'))$('botModeIndicator').innerHTML='🤖 АВТО-СДЕЛКИ';if($('signalLabel')){$('signalLabel').className='signal-badge signal-wait';$('signalLabel').innerHTML='⚪ Ожидание'}updateBotStatusIndicator();var leverageInfo='';addLog('БОТ ЗАПУЩЕН'+leverageInfo,'trade');sendTgMessage('БОТ ЗАПУЩЕН\n'+currentInstrument+' | '+selectedTimeframe+'\n🕐 '+formatTimeMsk()+'\nДепозит: '+virtualBalance.toFixed(2)+'$\nРиск: '+riskConfig.value+riskConfig.unit+'\nTP: '+(tpConfig.value||'—')+tpConfig.unit+' | SL: '+(slConfig.value||'—')+slConfig.unit+'\nBackstep: '+userBackstep+' | Без свечи: '+(noCandleCheck?'Да':'Нет')+'\nБот v'+BOT_VERSION);updateUI()}
function stopBot(){if(!botActive)return;botActive=false;if($('botModeIndicator'))$('botModeIndicator').innerHTML='⚙️ СИГНАЛЫ (бот выкл)';if($('signalLabel')){$('signalLabel').className='signal-badge signal-wait';$('signalLabel').innerHTML='⚪ Остановлен'}updateBotStatusIndicator();if(positions.length>0)closeAllPositions(currentPrice,'Остановка');sendTgMessage('БОТ ОСТАНОВЛЕН\n'+currentInstrument+' | '+selectedTimeframe+'\n🕐 '+formatTimeMsk()+'\nДепозит: '+virtualBalance.toFixed(2)+'$\nЧистый P&L: '+(netProfitSum>=0?'+':'')+netProfitSum.toFixed(2)+'$\nСделок: '+totalTradesCount+'\nБот v'+BOT_VERSION);updateUI()}
function setDeposit(){var v=parseFloat($('depositInput')?.value);if(isNaN(v)||v<=0)v=10000;virtualBalance=v;updateUI()}
function resetAccount(){if(positions.length>0)closeAllPositions(currentPrice,'Сброс');virtualBalance=parseFloat($('depositInput')?.value)||10000;netProfitSum=0;totalTradesCount=0;winTradesCount=0;lossTradesCount=0;clearTradesHistory();positions=[];lossStreak=[];updateUI()}
function loadSettingsFromUI(log){log=log!==false;riskConfig.value=parseFloat($('riskValue')?.value||1);riskConfig.unit=$('riskUnit')?.value||'percent';var tv=$('tpValue')?.value;tpConfig.value=tv===''?null:parseFloat(tv);tpConfig.unit=$('tpUnit')?.value||'percent';var sv=$('slValue')?.value;slConfig.value=sv===''?null:parseFloat(sv);slConfig.unit=$('slUnit')?.value||'percent';var hv=$('holdBars')?.value;holdBarsCount=hv?parseInt(hv):null;fractalPeriod=parseInt($('fractalPeriod')?.value||2);userBackstep=parseInt($('backstepSlider')?.value||2);invertSignal=$('invertSignal')?.value==='true';noCandleCheck=$('noCandleCheck')?.checked||false;multiModeConfig.mode=$('multiModeSelect')?.value||'off';multiModeConfig.multiplier=parseFloat($('multiplierValue')?.value||1);strategyFlags.sameSideRisk=$('checkboxSameRisk')?.checked||false;strategyFlags.resetLossSeries=$('checkboxResetSeries')?.checked||false;strategyFlags.excludeOnlyOpposite=$('checkboxExcludeOnly')?.checked||false;notificationsConfig.telegram.enabled=$('tgEnabled')?.checked||false;notificationsConfig.telegram.botToken=$('tgBotToken')?.value||'';notificationsConfig.telegram.chatId=$('tgChatId')?.value||'';notificationsConfig.telegram.timeout=parseInt($('tgTimeout')?.value||15);notificationsConfig.telegram.retries=parseInt($('tgRetries')?.value||2);notificationsConfig.telegram.signalNotify=$('tgSignalNotify')?.value||'all';if(log)addLog('Настройки: риск '+riskConfig.value+riskConfig.unit+', TP '+(tpConfig.value||'—')+tpConfig.unit+', SL '+(slConfig.value||'—')+slConfig.unit+', таймер '+(holdBarsCount||'не уст.')+'б, L='+fractalPeriod+', backstep='+userBackstep,'settings')}
function seedInitialBars(){var now=Date.now();for(var i=0;i<20;i++){var open,high,low,close;if(i<15){open=3300-i*10;high=3310-i*9;low=3280-i*10;close=3290-i*9}else if(i===15){open=3200;high=3210;low=3180;close=3190}else if(i===16){open=3190;high=3200;low=3175;close=3185}else if(i===17){open=3170;high=3180;low=3150;close=3165}else if(i===18){open=3180;high=3200;low=3160;close=3190}else{open=3200;high=3220;low=3185;close=3210}realTimeBars.push({open:open,high:high,low:low,close:close,timestamp:now-(20-i)*60000,index:i})}currentPrice=realTimeBars[realTimeBars.length-1].close}
async function loadHistoryBars(){try{var r=await fetch('https://api.binance.com/api/v3/klines?symbol='+currentInstrument+'&interval='+selectedTimeframe+'&limit=1000');if(!r.ok)return;var d=await r.json();if(!Array.isArray(d)||d.length===0)return;realTimeBars=[];d.forEach(function(k){var bt=k[6]||k[0];realTimeBars.push({open:parseFloat(k[1]),high:parseFloat(k[2]),low:parseFloat(k[3]),close:parseFloat(k[4]),volume:parseFloat(k[5]),timestamp:bt,index:realTimeBars.length})});realTimeBars.sort(function(a,b){return a.timestamp-b.timestamp});if(realTimeBars.length>MAX_BARS_COUNT)realTimeBars.splice(0,realTimeBars.length-MAX_BARS_COUNT);realTimeBars.forEach(function(b,i){b.index=i});currentPrice=realTimeBars[realTimeBars.length-1].close;lastBarAddedTime=realTimeBars[realTimeBars.length-1].timestamp;addLog('Загружено '+d.length+' баров ('+selectedTimeframe+')')}catch(e){addLog('Ошибка загрузки истории: '+e.message,'error')}}

// ========== ОБРАБОТЧИКИ ==========
$('startBotBtn')?.addEventListener('click',startBot);
$('stopBotBtn')?.addEventListener('click',stopBot);
$('resetAccountBtn')?.addEventListener('click',resetAccount);
$('clearLogBtn')?.addEventListener('click',function(){eventLogs=[];updateLogUI()});
$('setDepositBtn')?.addEventListener('click',setDeposit);
$('changeInstrumentBtn')?.addEventListener('click',async function(){
    var ns=$('instrumentInput')?.value.toUpperCase().replace('/','')||'ETHUSDT';
    var tf=$('timeframeSelect')?.value||'1h';
    if(ns===currentInstrument&&tf===selectedTimeframe&&pollingConnected)return;
    stopPolling();
    if(positions.length>0)closeAllPositions(currentPrice||0,'Смена');
    currentInstrument=ns;
    selectedTimeframe=tf;
    if($('instrumentDisplay'))$('instrumentDisplay').textContent=ns.replace('USDT','/USDT');
    if($('currentTFDisplay'))$('currentTFDisplay').innerText=tf;
    lastProcessedCandleTime=null;
    lastBarAddedTime=0;
    lastSignalBarIndex=-1;
    lossStreak=[];
    realTimeBars=[];
    if(lwcCandleSeries)lwcCandleSeries.setData([]);
    if(lwcMarkersHandle)lwcMarkersHandle.setMarkers([]);
    await startPolling(tf,ns);
    updateUI();
});
$('instrumentInput')?.addEventListener('keypress',function(e){if(e.key==='Enter'){e.preventDefault();$('changeInstrumentBtn')?.click()}});
$('saveProfileBtn')?.addEventListener('click',saveProfile);
$('loadProfileBtn')?.addEventListener('click',function(){$('profileFileInput')?.click()});
$('profileFileInput')?.addEventListener('change',function(e){if(e.target.files?.[0])loadProfile(e.target.files[0]);e.target.value=''});
$('testTgBtn')?.addEventListener('click',testTelegramNotification);
$('backstepSlider')?.addEventListener('input',function(){userBackstep=parseInt(this.value);$('backstepValue').textContent=userBackstep;var s='';if(userBackstep===0)s='Мгновенный анализ';else if(userBackstep<=2)s=userBackstep+' бара подтверждения';else s=userBackstep+' баров подтверждения';$('backstepStatus').textContent=s});
$('backstepSlider')?.addEventListener('change',function(){userBackstep=parseInt(this.value);$('backstepValue').textContent=userBackstep;var s='';if(userBackstep===0)s='Мгновенный анализ';else if(userBackstep<=2)s=userBackstep+' бара подтверждения';else s=userBackstep+' баров подтверждения';$('backstepStatus').textContent=s;addLog('Backstep='+userBackstep,'settings')});
$('noCandleCheck')?.addEventListener('change',function(){noCandleCheck=this.checked;addLog('Без свечи: '+(noCandleCheck?'ДА':'НЕТ'),'settings')});
// ЧАСТЬ 2: Лог при смене L
$('fractalPeriod')?.addEventListener('change',function(){var newL=parseInt(this.value)||2;if(newL<1)newL=1;if(newL>5)newL=5;this.value=newL;fractalPeriod=newL;addLog('Фрактал L='+newL+' ('+(newL*2+1)+'-барное окно)','settings');updateFractalMarkers()});
$('checkboxSameRisk')?.addEventListener('change',function(){strategyFlags.sameSideRisk=this.checked;updateFlagStyles()});
$('checkboxResetSeries')?.addEventListener('change',function(){strategyFlags.resetLossSeries=this.checked;updateFlagStyles();if(this.checked)lossStreak=[]});
$('checkboxExcludeOnly')?.addEventListener('change',function(){strategyFlags.excludeOnlyOpposite=this.checked;updateFlagStyles()});
['riskValue','riskUnit','tpValue','tpUnit','slValue','slUnit','holdBars','invertSignal','multiModeSelect','multiplierValue','tgBotToken','tgChatId','tgEnabled','tgTimeout','tgRetries','tgSignalNotify'].forEach(function(id){var el=$(id);if(el)el.addEventListener('change',function(){loadSettingsFromUI()})});
$('timeframeSelect')?.addEventListener('change',async function(e){
    selectedTimeframe=e.target.value;
    if($('currentTFDisplay'))$('currentTFDisplay').innerText=selectedTimeframe;
    lastProcessedCandleTime=null;
    lastBarAddedTime=0;
    lastSignalBarIndex=-1;
    realTimeBars=[];
    if(lwcCandleSeries)lwcCandleSeries.setData([]);
    if(lwcMarkersHandle)lwcMarkersHandle.setMarkers([]);
    await startPolling(selectedTimeframe,currentInstrument);
});
$('depositInput')?.addEventListener('change',setDeposit);

async function boot(){
    loadSettingsFromUI(false);
    updateFlagStyles();
    initLightweightChart();
    await startPolling(selectedTimeframe,currentInstrument);
    updateUI();
    updateLogUI();
    addLog('v'+BOT_VERSION+' готов | lightweight-charts v5 | REST API','info');
}

async function changeInstrument(symbol){
    var ns=(symbol||'').toUpperCase().replace('BINANCE:','').replace('/','');
    if(!ns)return;
    var inp=$('instrumentInput');if(inp)inp.value=ns;
    var btn=$('changeInstrumentBtn');if(btn)btn.click();
}

boot();
