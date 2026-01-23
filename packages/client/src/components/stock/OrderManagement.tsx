/**
 * 订单管理组件
 * 显示用户的挂单列表，支持撤单操作
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { StockOrder, Money } from '@scc/shared';
import { StockOrderStatus, StockOrderSide } from '@scc/shared';

interface OrderWithStock extends StockOrder {
  ticker: string;
  currentPrice: Money;
}

interface OrderManagementProps {
  companyId: string;
  className?: string;
  onOrderCancelled?: () => void;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({
  companyId,
  className = '',
  onOrderCancelled,
}) => {
  const [orders, setOrders] = useState<OrderWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  
  // 加载订单
  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/stocks/orders/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setOrders(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);
  
  useEffect(() => {
    loadOrders();
    
    // 定时刷新
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);
  
  // 撤单
  const cancelOrder = async (order: OrderWithStock) => {
    if (cancelling) return;
    
    setCancelling(order.id);
    try {
      const response = await fetch(`/api/v1/stocks/order/${order.stockId}/${order.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          loadOrders();
          onOrderCancelled?.();
        }
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
    } finally {
      setCancelling(null);
    }
  };
  
  // 格式化价格
  const formatPrice = (price: Money) => `$${(price / 100).toFixed(2)}`;
  
  // 获取状态标签
  const getStatusLabel = (status: StockOrderStatus) => {
    switch (status) {
      case StockOrderStatus.Open:
        return { text: '待成交', color: 'text-blue-400 bg-blue-500/20' };
      case StockOrderStatus.Partial:
        return { text: '部分成交', color: 'text-yellow-400 bg-yellow-500/20' };
      case StockOrderStatus.Filled:
        return { text: '已成交', color: 'text-green-400 bg-green-500/20' };
      case StockOrderStatus.Cancelled:
        return { text: '已撤单', color: 'text-slate-400 bg-slate-500/20' };
      case StockOrderStatus.Expired:
        return { text: '已过期', color: 'text-slate-400 bg-slate-500/20' };
      default:
        return { text: '未知', color: 'text-slate-400 bg-slate-500/20' };
    }
  };
  
  if (loading) {
    return (
      <div className={`bg-slate-800/50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-slate-800/50 rounded-lg overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <span className="text-slate-300 font-medium">我的委托</span>
        <span className="text-xs text-slate-500">{orders.length} 笔</span>
      </div>
      
      {orders.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">
          暂无挂单
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-700">
                <th className="py-2 px-3 text-left">股票</th>
                <th className="py-2 px-3 text-center">方向</th>
                <th className="py-2 px-3 text-right">委托价</th>
                <th className="py-2 px-3 text-right">数量</th>
                <th className="py-2 px-3 text-right">已成交</th>
                <th className="py-2 px-3 text-center">状态</th>
                <th className="py-2 px-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const status = getStatusLabel(order.status);
                const isBuy = order.side === StockOrderSide.Buy;
                const canCancel = order.status === StockOrderStatus.Open || 
                                  order.status === StockOrderStatus.Partial;
                
                return (
                  <tr key={order.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30">
                    <td className="py-2 px-3">
                      <div className="font-medium text-white">{order.ticker}</div>
                      <div className="text-xs text-slate-500">
                        现价: {formatPrice(order.currentPrice)}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {isBuy ? '买入' : '卖出'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-white">
                      {order.limitPrice ? formatPrice(order.limitPrice) : '市价'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                      {order.quantity}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-400">
                      {order.filledQuantity}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${status.color}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {canCancel && (
                        <button
                          onClick={() => cancelOrder(order)}
                          disabled={cancelling === order.id}
                          className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                        >
                          {cancelling === order.id ? '撤单中...' : '撤单'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;