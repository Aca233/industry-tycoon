/**
 * Store exports
 */

export { useGameStore } from './gameStore.js';
export type { ClientGameState, GameStoreActions, FinancialSummary, BuildingProfit, PriceHistoryEntry, BuildingFinanceEntry, AICompanyClient, CompetitionEventClient, MarketEventClient, InventorySnapshot, InventoryStockItem, BuildingShortage } from './gameStore.js';
export {
  usePlayerCompany,
  useCurrentTick,
  useGameSpeed,
  useIsPaused,
  useActivePanel,
  useChatMessages,
  useIsAssistantTyping,
  useFinancials,
  useShowFinancialReport,
  useMarketPrices,
  usePriceHistory,
  useBuildingFinanceHistory,
  useInventory,
  useBuildingShortages,
  useEconomySelectedGoodsId,
  useNavigateToEconomyGoods,
} from './gameStore.js';