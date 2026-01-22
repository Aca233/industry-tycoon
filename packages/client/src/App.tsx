import { useEffect, useState } from 'react';
import { MarketGalaxy, ProductionCard, NeuralFeed, BuildingShop, FinancialReport, CompetitorPanel, ResearchLab, IndustryPanel, EconomyCenter, SettingsModal } from './components/game';
import { useGameStore, useActivePanel, usePlayerCompany, useIsPaused, useCurrentTick, useGameSpeed, useFinancials } from './stores';
import { gameWebSocket } from './services/websocket';

export function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFinancialReport, setShowFinancialReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const activePanel = useActivePanel();
  const playerCompany = usePlayerCompany();
  const isPaused = useIsPaused();
  const currentTick = useCurrentTick();
  const gameSpeed = useGameSpeed();
  const financials = useFinancials();
  
  const initializeGame = useGameStore((state) => state.initializeGame);
  const setActivePanel = useGameStore((state) => state.setActivePanel);
  const setGameSpeed = useGameStore((state) => state.setGameSpeed);
  const togglePause = useGameStore((state) => state.togglePause);
  const showProductionCard = useGameStore((state) => state.showProductionCard);

  useEffect(() => {
    if (gameStarted) {
      initializeGame('game-1');
      
      // Listen for game reset
      const unsubscribe = gameWebSocket.on('gameReset', (_msg) => {
        // Force refresh by reloading the page
        window.location.reload();
      });
      
      return () => {
        unsubscribe();
      };
    }
  }, [gameStarted, initializeGame]);
  
  const handleResetGame = () => {
    gameWebSocket.resetGame();
    setShowResetConfirm(false);
  };

  if (!gameStarted) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-4">
            供应链指挥官
          </h1>
          <h2 className="text-2xl text-blue-300 mb-8">算法都市</h2>
          <p className="text-gray-400 mb-12 max-w-md mx-auto">
            一款 LLM 驱动的动态市场商业模拟游戏。
            建立你的商业帝国，与 AI 对手谈判，塑造城市的未来。
          </p>
          <button
            onClick={() => setGameStarted(true)}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-cyan-500/25 transform hover:scale-105 transition-all duration-200"
          >
            开始新游戏
          </button>
        </div>
      </div>
    );
  }

  const formatMoney = (amount: number | undefined | null) => {
    // Handle undefined, null, or NaN values
    if (amount === undefined || amount === null || !Number.isFinite(amount)) {
      return '¥0';
    }
    // 注意：后端发送的金额单位是"元"（不是分），所以不需要除以100
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDayFromTick = (tick: number) => Math.floor(tick / 24) + 1;

  return (
    <div className="h-screen w-screen bg-slate-900 flex overflow-hidden">
      {/* Left Sidebar - Navigation */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {playerCompany?.name || '我的公司'}
          </h2>
          <p className="text-sm text-green-400">
            {playerCompany ? formatMoney(playerCompany.cash) : '¥0'}
          </p>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-gray-400">股价:</span>
            <span className="text-cyan-400">
              {playerCompany ? formatMoney(playerCompany.stockPrice) : '¥0'}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-600/50 text-gray-300 border border-slate-500/30 rounded hover:bg-slate-600 transition-colors"
            >
              ⚙️ 设置
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex-1 px-3 py-1.5 text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded hover:bg-red-600/30 transition-colors"
            >
              🔄 重置
            </button>
          </div>
        </div>
        <nav className="flex-1 p-2">
          <NavItem
            icon="🏭"
            label="工业产能"
            active={activePanel === 'industries'}
            onClick={() => setActivePanel('industries')}
          />
          <NavItem
            icon="📊"
            label="市场行情"
            active={activePanel === 'market'}
            onClick={() => setActivePanel('market')}
          />
          <NavItem
            icon="🔬"
            label="科技研发"
            active={activePanel === 'research'}
            onClick={() => setActivePanel('research')}
          />
          <NavItem
            icon="🤝"
            label="商业外交"
            active={activePanel === 'diplomacy'}
            onClick={() => setActivePanel('diplomacy')}
          />
          <div className="mt-4 pt-4 border-t border-slate-600">
            <div className="text-xs text-gray-500 px-4 mb-2">经济系统</div>
            <NavItem
              icon="💰"
              label="经济管理中心"
              active={activePanel === 'economy'}
              onClick={() => setActivePanel('economy')}
            />
          </div>
        </nav>
        
        {/* Financial Summary */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-400">财务概况（平均）</h3>
            <button
              onClick={() => setShowFinancialReport(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              详情 →
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">收入/Tick</span>
            <span className="text-green-400">
              +{financials ? formatMoney(financials.totalIncome) : '¥0'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">支出/Tick</span>
            <span className="text-red-400">
              -{financials ? formatMoney(financials.totalMaintenance) : '¥0'}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-600">
            <span className="text-gray-300 font-medium">平均净利润</span>
            <span className={financials && (financials.avgNetProfit ?? financials.netProfit) >= 0 ? 'text-cyan-400 font-medium' : 'text-red-400 font-medium'}>
              {financials ? ((financials.avgNetProfit ?? financials.netProfit) >= 0 ? '+' : '') + formatMoney(financials.avgNetProfit ?? financials.netProfit) : '¥0'}
            </span>
          </div>
        </div>
        </div>
        
        {/* Quick stats */}
        <div className="p-4 border-t border-slate-700 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">企业声誉</span>
            <span className="text-green-400">{playerCompany?.publicReputation || 0}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">信用评级</span>
            <span className="text-yellow-400">{playerCompany?.creditRating || '无'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {activePanel === 'industries' && (
          <div className="relative h-full">
            <IndustryPanel />
            {/* Build Button - Positioned at bottom-left */}
            <button
              onClick={() => setShowShop(true)}
              className="absolute bottom-24 left-4 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:shadow-green-500/25 transform hover:scale-105 transition-all flex items-center gap-2 z-10"
            >
              <span className="text-xl">🏗️</span>
              <span>建造新建筑</span>
            </button>
          </div>
        )}
        {activePanel === 'market' && <MarketGalaxy />}
        {activePanel === 'research' && <ResearchLab />}
        {activePanel === 'diplomacy' && <CompetitorPanel />}
        {activePanel === 'economy' && <EconomyCenter />}
        
        {/* Bottom Bar - Time Controls */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-800/90 backdrop-blur border-t border-slate-700 flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <button 
              onClick={togglePause}
              className={`px-3 py-1.5 rounded text-white transition-colors ${
                isPaused ? 'bg-slate-600' : 'bg-cyan-600'
              }`}
            >
              {isPaused ? '⏸️' : '▶️'}
            </button>
            <button 
              onClick={() => setGameSpeed(1 as any)}
              className={`px-3 py-1.5 rounded text-white transition-colors ${
                gameSpeed === 1 ? 'bg-cyan-600' : 'bg-slate-600'
              }`}
            >
              1×
            </button>
            <button 
              onClick={() => setGameSpeed(2 as any)}
              className={`px-3 py-1.5 rounded text-white transition-colors ${
                gameSpeed === 2 ? 'bg-cyan-600' : 'bg-slate-600'
              }`}
            >
              2×
            </button>
            <button 
              onClick={() => setGameSpeed(4 as any)}
              className={`px-3 py-1.5 rounded text-white transition-colors ${
                gameSpeed === 4 ? 'bg-cyan-600' : 'bg-slate-600'
              }`}
            >
              4×
            </button>
          </div>
          <div className="text-white flex items-center gap-4">
            <span className="text-gray-400">第 {getDayFromTick(currentTick)} 天</span>
            <span className="text-gray-600">|</span>
            <span className="text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              市场：平稳
            </span>
          </div>
        </div>
      </main>

      {/* Right Sidebar - AI Assistant */}
      <aside className="w-80 border-l border-slate-700 flex-shrink-0">
        <NeuralFeed />
      </aside>

      {/* Production Card Modal */}
      {showProductionCard && <ProductionCard />}
      
      {/* Building Shop Modal */}
      {showShop && <BuildingShop onClose={() => setShowShop(false)} />}
      
      {/* Financial Report Modal */}
      {showFinancialReport && <FinancialReport onClose={() => setShowFinancialReport(false)} />}
      
      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      
      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl p-6 max-w-sm mx-4 shadow-2xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-2">确认重置游戏？</h3>
            <p className="text-gray-400 mb-6">
              这将清除所有建筑和进度，资金将重置为初始值。此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleResetGame}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ 
  icon, 
  label, 
  active = false,
  onClick 
}: { 
  icon: string; 
  label: string; 
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
        active
          ? 'bg-cyan-600/20 text-cyan-400'
          : 'text-gray-400 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </button>
  );
}