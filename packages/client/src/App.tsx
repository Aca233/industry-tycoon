import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketGalaxy, ProductionCard, NeuralFeed, BuildingShop, FinancialReport, CompetitorPanel, ResearchLab, IndustryPanel, EconomyCenter, SettingsModal, StockMarket } from './components/game';
import { useGameStore, useActivePanel, usePlayerCompany, useIsPaused, useCurrentTick, useGameSpeed, useFinancials } from './stores';
import { gameWebSocket } from './services/websocket';
import { formatMoney, formatGameTime } from './utils/formatters';
import { useAudio, useUISound, useBGM } from './audio';
import { GlassPanel, PopupPanel } from './components/ui';
import { NeonButton } from './components/ui';
import { CurrencyDisplay, PercentageDisplay, StatusIndicator } from './components/ui';
import { MODAL_VARIANTS, MODAL_OVERLAY_VARIANTS } from './animations';

export function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFinancialReport, setShowFinancialReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 音效系统
  const { isInitialized: audioInitialized, resumeAudioContext } = useAudio();
  const { playClick, playPanelOpen, playPanelClose, playWarning } = useUISound();
  const { play: playBGM } = useBGM();
  
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

      // 游戏开始时播放背景音乐
      if (audioInitialized) {
        playBGM('bgm-gameplay-calm');
      }
      
      return () => {
        unsubscribe();
      };
    }
  }, [gameStarted, initializeGame, audioInitialized, playBGM]);
  
  // 处理游戏开始
  const handleStartGame = useCallback(() => {
    // 用户交互后恢复音频上下文
    resumeAudioContext();
    playClick();
    setGameStarted(true);
  }, [resumeAudioContext, playClick]);
  
  const handleResetGame = useCallback(() => {
    playWarning();
    gameWebSocket.resetGame();
    setShowResetConfirm(false);
  }, [playWarning]);

  // 面板显示处理
  const handleShowShop = useCallback(() => {
    playPanelOpen();
    setShowShop(true);
  }, [playPanelOpen]);

  const handleCloseShop = useCallback(() => {
    playPanelClose();
    setShowShop(false);
  }, [playPanelClose]);

  const handleShowFinancialReport = useCallback(() => {
    playPanelOpen();
    setShowFinancialReport(true);
  }, [playPanelOpen]);

  const handleCloseFinancialReport = useCallback(() => {
    playPanelClose();
    setShowFinancialReport(false);
  }, [playPanelClose]);

  const handleShowSettings = useCallback(() => {
    playPanelOpen();
    setShowSettings(true);
  }, [playPanelOpen]);

  const handleCloseSettings = useCallback(() => {
    playPanelClose();
    setShowSettings(false);
  }, [playPanelClose]);

  const handleShowResetConfirm = useCallback(() => {
    playWarning();
    setShowResetConfirm(true);
  }, [playWarning]);

  const handleCloseResetConfirm = useCallback(() => {
    playClick();
    setShowResetConfirm(false);
  }, [playClick]);

  if (!gameStarted) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center relative overflow-hidden">
        {/* 背景动画网格 */}
        <div className="absolute inset-0 holographic-grid opacity-30" />
        
        {/* 扫描线效果 */}
        <div className="absolute inset-0 pointer-events-none scanline-overlay" />
        
        <motion.div
          className="text-center relative z-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* 标题 - 霓虹效果 */}
          <motion.h1
            className="text-6xl font-bold neon-text-cyan mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            供应链指挥官
          </motion.h1>
          
          <motion.h2
            className="text-2xl text-cyan-300 mb-8 neon-text-subtle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            算法都市
          </motion.h2>
          
          <motion.p
            className="text-gray-400 mb-12 max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            一款 LLM 驱动的动态市场商业模拟游戏。
            建立你的商业帝国，与 AI 对手谈判，塑造城市的未来。
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <NeonButton
              onClick={handleStartGame}
              variant="primary"
              size="lg"
              glow={true}
              className="px-10 py-4 text-lg"
            >
              🚀 开始新游戏
            </NeonButton>
          </motion.div>
          
          {/* 装饰性元素 */}
          <motion.div
            className="absolute -top-20 -left-20 w-40 h-40 border border-cyan-500/20 rounded-full"
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
          />
          <motion.div
            className="absolute -bottom-20 -right-20 w-32 h-32 border border-cyan-500/20 rounded-full"
            animate={{
              rotate: -360,
              scale: [1, 1.2, 1],
            }}
            transition={{
              rotate: { duration: 15, repeat: Infinity, ease: "linear" },
              scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }}
          />
        </motion.div>
      </div>
    );
  }

  // formatMoney 和 formatGameTime 现在从 utils/formatters 导入

  return (
    <div className="h-screen w-screen bg-slate-900 flex overflow-hidden">
      {/* Left Sidebar - Navigation */}
      <aside className="w-64 flex flex-col flex-shrink-0 glass-panel border-r border-cyan-500/10">
        {/* 公司信息卡片 */}
        <GlassPanel variant="elevated" padding="md" className="m-2 mb-0">
          <h2 className="text-lg font-semibold text-white neon-text-subtle">
            {playerCompany?.name || '我的公司'}
          </h2>
          <div className="mt-2">
            <CurrencyDisplay
              value={playerCompany?.cash || 0}
              className="text-lg font-bold"
              showChange={true}
            />
          </div>
          <div className="flex gap-2 mt-2 text-xs items-center">
            <span className="text-gray-400">股价:</span>
            <CurrencyDisplay
              value={playerCompany?.stockPrice || 0}
              className="text-cyan-400"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <NeonButton
              onClick={handleShowSettings}
              variant="secondary"
              size="xs"
              className="flex-1"
            >
              ⚙️ 设置
            </NeonButton>
            <NeonButton
              onClick={handleShowResetConfirm}
              variant="danger"
              size="xs"
              className="flex-1"
            >
              🔄 重置
            </NeonButton>
          </div>
        </GlassPanel>
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
          <div className="mt-4 pt-4 border-t border-cyan-500/20">
            <div className="text-xs text-cyan-500/60 px-4 mb-2 neon-text-subtle">经济系统</div>
            <NavItem
              icon="💰"
              label="经济管理中心"
              active={activePanel === 'economy'}
              onClick={() => setActivePanel('economy')}
            />
            <NavItem
              icon="📈"
              label="股票市场"
              active={activePanel === 'stocks'}
              onClick={() => setActivePanel('stocks')}
            />
          </div>
        </nav>
        
        {/* Financial Summary */}
        <GlassPanel variant="inset" padding="sm" className="m-2 mt-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-400">财务概况（平均）</h3>
            <button
              onClick={handleShowFinancialReport}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors neon-text-subtle"
            >
              详情 →
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">收入/Tick</span>
              <span className="text-green-400 neon-text-profit">
                +{financials ? formatMoney(financials.totalIncome) : '¥0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">支出/Tick</span>
              <span className="text-red-400 neon-text-loss">
                -{financials ? formatMoney(financials.totalMaintenance) : '¥0'}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-cyan-500/20">
              <span className="text-gray-300 font-medium">平均净利润</span>
              <CurrencyDisplay
                value={financials?.avgNetProfit ?? financials?.netProfit ?? 0}
                className="font-medium"
                showChange={true}
              />
            </div>
          </div>
        </GlassPanel>
        
        {/* Quick stats */}
        <GlassPanel variant="default" padding="sm" className="m-2 mt-0">
          <div className="text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">企业声誉</span>
              <div className="flex items-center gap-2">
                <StatusIndicator status="success" size="xs" />
                <PercentageDisplay
                  value={playerCompany?.publicReputation || 0}
                  className="text-green-400"
                  showSign={false}
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">信用评级</span>
              <span className="text-yellow-400 neon-text-warning">{playerCompany?.creditRating || '无'}</span>
            </div>
          </div>
        </GlassPanel>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* 主内容区域 - 需要留出底部工具栏空间 */}
        <div className="flex-1 relative overflow-hidden">
          {activePanel === 'industries' && (
            <div className="relative h-full">
            <IndustryPanel />
            {/* Build Button - Positioned at bottom-left */}
            <button
              onClick={handleShowShop}
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
          {activePanel === 'stocks' && playerCompany && (
            <div className="h-full p-4 overflow-auto">
              <StockMarket gameId="game-1" playerCompanyId={playerCompany.id} />
            </div>
          )}
        </div>
        
        {/* Bottom Bar - Time Controls */}
        <GlassPanel
          variant="elevated"
          padding="none"
          className="h-16 flex-shrink-0 border-t border-cyan-500/20 flex items-center justify-between px-6"
        >
          <div className="flex items-center space-x-2">
            <NeonButton
              onClick={togglePause}
              variant={isPaused ? 'secondary' : 'primary'}
              size="sm"
            >
              {isPaused ? '⏸️' : '▶️'}
            </NeonButton>
            <div className="flex items-center border border-cyan-500/20 rounded-lg overflow-hidden">
              <NeonButton
                onClick={() => setGameSpeed(1 as any)}
                variant={gameSpeed === 1 ? 'primary' : 'ghost'}
                size="sm"
                glow={false}
                className="rounded-none border-0"
              >
                1×
              </NeonButton>
              <NeonButton
                onClick={() => setGameSpeed(2 as any)}
                variant={gameSpeed === 2 ? 'primary' : 'ghost'}
                size="sm"
                glow={false}
                className="rounded-none border-0 border-l border-cyan-500/20"
              >
                2×
              </NeonButton>
              <NeonButton
                onClick={() => setGameSpeed(4 as any)}
                variant={gameSpeed === 4 ? 'primary' : 'ghost'}
                size="sm"
                glow={false}
                className="rounded-none border-0 border-l border-cyan-500/20"
              >
                4×
              </NeonButton>
            </div>
          </div>
          <div className="text-white flex items-center gap-4">
            <span className="text-cyan-400 font-mono neon-text-subtle">{formatGameTime(currentTick, 'full')}</span>
            <span className="text-cyan-500/30">|</span>
            <span className="flex items-center gap-2">
              <StatusIndicator status="success" size="sm" pulse={true} />
              <span className="text-green-400 text-sm">市场：平稳</span>
            </span>
          </div>
        </GlassPanel>
      </main>

      {/* Right Sidebar - AI Assistant */}
      <aside className="w-80 border-l border-slate-700 flex-shrink-0">
        <NeuralFeed />
      </aside>

      {/* Production Card Modal */}
      {showProductionCard && <ProductionCard />}
      
      {/* Building Shop Modal */}
      {showShop && <BuildingShop onClose={handleCloseShop} />}
      
      {/* Financial Report Modal */}
      {showFinancialReport && <FinancialReport onClose={handleCloseFinancialReport} />}
      
      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={handleCloseSettings} />}
      
      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
            variants={MODAL_OVERLAY_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <motion.div
              variants={MODAL_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <PopupPanel className="max-w-sm mx-4 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">⚠️</span>
                  <h3 className="text-xl font-bold text-white neon-text-warning">确认重置游戏？</h3>
                </div>
                <p className="text-gray-400 mb-6">
                  这将清除所有建筑和进度，资金将重置为初始值。此操作不可撤销。
                </p>
                <div className="flex gap-3">
                  <NeonButton
                    onClick={handleCloseResetConfirm}
                    variant="secondary"
                    className="flex-1"
                  >
                    取消
                  </NeonButton>
                  <NeonButton
                    onClick={handleResetGame}
                    variant="danger"
                    className="flex-1"
                  >
                    确认重置
                  </NeonButton>
                </div>
              </PopupPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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