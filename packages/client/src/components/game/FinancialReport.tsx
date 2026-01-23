/**
 * FinancialReport - Detailed financial report modal
 */

import { useGameStore, useFinancials, type BuildingProfit } from '../../stores';
import { formatMoneyShort } from '../../utils/formatters';

interface FinancialReportProps {
  onClose: () => void;
}

export function FinancialReport({ onClose }: FinancialReportProps) {
  const financials = useFinancials();
  const buildings = useGameStore((state) => state.buildings);

  // formatMoney 和 formatMoneyShort 现在从 utils/formatters 导入

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <h2 className="text-xl font-bold text-white">财务报告</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Summary Section */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">收益概览（平均每 Tick）</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">平均销售收入</div>
              <div className="text-lg font-bold text-green-400">
                {financials ? formatMoneyShort(financials.totalIncome) : '¥0'}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">平均原料成本</div>
              <div className="text-lg font-bold text-orange-400">
                {financials ? formatMoneyShort(financials.totalInputCost ?? 0) : '¥0'}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">平均维护成本</div>
              <div className="text-lg font-bold text-red-400">
                {financials ? formatMoneyShort(financials.totalMaintenance) : '¥0'}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">平均净利润</div>
              <div className={`text-lg font-bold ${
                financials && (financials.avgNetProfit ?? financials.netProfit) >= 0 ? 'text-cyan-400' : 'text-red-400'
              }`}>
                {financials ? formatMoneyShort(financials.avgNetProfit ?? financials.netProfit) : '¥0'}
              </div>
            </div>
          </div>
        </div>

        {/* Building Details */}
        <div className="p-4 overflow-y-auto max-h-[40vh]">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            建筑收益明细 ({buildings.size} 座建筑)
          </h3>
          
          {!financials || financials.buildingProfits.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🏗️</div>
              <p>暂无建筑</p>
              <p className="text-sm">购买建筑后将在此显示收益详情</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="grid grid-cols-5 gap-2 text-xs text-gray-500 px-3 py-2 bg-slate-700/30 rounded">
                <div>建筑名称</div>
                <div className="text-right">销售收入</div>
                <div className="text-right">原料成本</div>
                <div className="text-right">维护成本</div>
                <div className="text-right">平均净收益</div>
              </div>
              
              {/* Table Rows */}
              {financials.buildingProfits.map((profit: BuildingProfit) => {
                // 使用滚动平均值来显示稳定的净收益
                const displayNet = profit.avgNet ?? profit.net;
                return (
                <div
                  key={profit.buildingId}
                  className={`grid grid-cols-5 gap-2 text-sm px-3 py-2 rounded transition-colors ${
                    profit.produced ? 'bg-emerald-900/30 hover:bg-emerald-900/50' : 'bg-slate-700/20 hover:bg-slate-700/40'
                  }`}
                >
                  <div className="text-white font-medium truncate flex items-center gap-1" title={profit.name}>
                    {profit.produced && <span className="text-emerald-400">✓</span>}
                    {profit.name}
                  </div>
                  <div className="text-right text-green-400">
                    {profit.income > 0 ? `+${formatMoneyShort(profit.income)}` : '-'}
                  </div>
                  <div className="text-right text-orange-400">
                    {profit.inputCost && profit.inputCost > 0 ? `-${formatMoneyShort(profit.inputCost)}` : '-'}
                  </div>
                  <div className="text-right text-red-400">
                    -{formatMoneyShort(profit.maintenance)}
                  </div>
                  <div className={`text-right font-medium ${
                    displayNet >= 0 ? 'text-cyan-400' : 'text-red-400'
                  }`}>
                    {displayNet >= 0 ? '+' : ''}{formatMoneyShort(displayNet)}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="text-xs text-gray-500 text-center">
            <span className="inline-flex items-center gap-1">
              <span className="text-emerald-400">✓</span> = 本 Tick 完成了生产周期
            </span>
            <span className="mx-2">·</span>
            平均净收益 = 最近5个生产周期的滚动平均值
          </div>
        </div>
      </div>
    </div>
  );
}