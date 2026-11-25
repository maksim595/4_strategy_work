// entry.js — IIFE формат с глобальной переменной LightweightCharts
import { transpile, run } from '@nullarch/resin';
import { applyResinViz, renderResinViz } from '@nullarch/resin-lightweight-charts';
import * as LWC from 'lightweight-charts';

// Даём вашему HTML глобальную переменную (как в standalone)
window.LightweightCharts = LWC;

// Шим для resin-lightweight-charts (он внутри использует require/import)
globalThis.require = function (name) {
  if (name === 'lightweight-charts') return LWC;
  throw new Error('Unknown module: ' + name);
};

// Экспорт в window
window.ResinBridge = { transpile, run, applyResinViz, renderResinViz };

console.log('✅ ResinBridge загружен:', typeof window.ResinBridge === 'object');
console.log('✅ LightweightCharts загружен:', typeof window.LightweightCharts === 'object');
