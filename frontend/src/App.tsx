import React, { useState, useEffect } from 'react';
import useWebSocket from 'react-use-websocket';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';
const WS_URL = 'ws://localhost:8000/api/ws';

interface Quote {
  price: number;
  change: number;
  volume: number;
  high: number;
  low: number;
}

interface Balance {
  balance: number;
  available: number;
  currency: string;
  total_profit: number;
  positions_count: number;
}

interface Stats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_profit: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
}

interface Trade {
  id: number;
  instrument: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: string;
  profit: number;
  status: string;
}

function App() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [balance, setBalance] = useState<Balance | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const { lastJsonMessage } = useWebSocket(WS_URL, {
    onOpen: () => console.log('WebSocket подключён'),
    onError: (event) => console.error('WebSocket ошибка:', event),
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    if (lastJsonMessage) {
      const data = lastJsonMessage as any;
      if (data.type === 'update') {
        if (data.quotes) setQuotes(data.quotes);
        if (data.balance) setBalance(data.balance);
        if (data.stats) setStats(data.stats);
        if (data.trades) setTrades(data.trades);
      }
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [balanceRes, statsRes, tradesRes] = await Promise.all([
        axios.get(`${API_URL}/balance`),
        axios.get(`${API_URL}/stats`),
        axios.get(`${API_URL}/trades?limit=15`),
      ]);
      setBalance(balanceRes.data);
      setStats(statsRes.data);
      setTrades(tradesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      setLoading(false);
    }
  };

  const startStrategy = async (instrument: string) => {
    try {
      await axios.post(`${API_URL}/strategies/start`, null, {
        params: { instrument, strategy_type: instrument === 'RTS' ? 'impulse' : 'level' }
      });
    } catch (error) {
      console.error('Ошибка запуска:', error);
    }
  };

  const stopStrategy = async (instrument: string) => {
    try {
      await axios.post(`${API_URL}/strategies/stop`, null, {
        params: { instrument, strategy_type: instrument === 'RTS' ? 'impulse' : 'level' }
      });
    } catch (error) {
      console.error('Ошибка остановки:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 p-4 flex flex-col overflow-hidden">
      {/* Верхняя панель */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Scalping Bot</h1>
          <span className="text-xs text-gray-400">Демо-счёт • {new Date().toLocaleDateString()}</span>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Баланс</div>
          <div className="text-2xl font-bold text-green-500">
            {balance?.balance.toFixed(0)} ₽
            {balance && balance.total_profit !== 0 && (
              <span className={`text-sm ml-2 ${balance.total_profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {balance.total_profit > 0 ? '+' : ''}{balance.total_profit.toFixed(0)} ₽
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Основная сетка - без скролла, всё на экране */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Левый столбец - котировки и стратегии */}
        <div className="col-span-3 flex flex-col gap-3">
          {/* Котировки */}
          <div className="bg-gray-800 rounded-lg p-3 flex-1">
            <div className="text-xs text-gray-400 mb-2">📈 КОТИРОВКИ</div>
            {['RTS', 'Si'].map((inst) => {
              const q = quotes[inst];
              return (
                <div key={inst} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                  <span className="text-sm font-semibold text-gray-300">{inst}</span>
                  <div className="text-right">
                    <div className="text-white font-mono">{q?.price?.toFixed(2) || '--'}</div>
                    <div className={`text-xs ${q?.change && q.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {q?.change ? `${q.change > 0 ? '+' : ''}${q.change.toFixed(2)}%` : '--'}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="mt-2 text-xs text-gray-500">Обновление: каждые 2с</div>
          </div>

          {/* Стратегии */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2">⚡ СТРАТЕГИИ</div>
            <div className="flex flex-col gap-2">
              {['RTS', 'Si'].map((inst) => (
                <div key={inst} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{inst}</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => startStrategy(inst)}
                      className="px-2 py-0.5 text-xs bg-green-600 hover:bg-green-700 rounded"
                    >
                      ▶
                    </button>
                    <button 
                      onClick={() => stopStrategy(inst)}
                      className="px-2 py-0.5 text-xs bg-red-600 hover:bg-red-700 rounded"
                    >
                      ■
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Средний столбец - статистика и график P&L */}
        <div className="col-span-5 flex flex-col gap-3">
          {/* Карточки статистики */}
          <div className="grid grid-cols-4 gap-2 flex-shrink-0">
            <StatCard label="Всего сделок" value={stats?.total_trades || 0} />
            <StatCard label="Win Rate" value={`${stats?.win_rate?.toFixed(1) || 0}%`} color="green" />
            <StatCard label="Профит" value={`${stats?.total_profit?.toFixed(0) || 0} ₽`} 
              color={stats && stats.total_profit > 0 ? 'green' : 'red'} />
            <StatCard label="Просадка" value={`${stats?.max_drawdown?.toFixed(1) || 0}%`} color="yellow" />
          </div>

          {/* График P&L (простой спарклайн) */}
          <div className="bg-gray-800 rounded-lg p-3 flex-1">
            <div className="text-xs text-gray-400 mb-1">📉 P&L ТРЕНД</div>
            <div className="h-full flex items-end space-x-0.5">
              {trades.slice(-30).map((t, i) => {
                const height = Math.abs(t.profit || 0) / 100;
                const maxHeight = 80;
                const h = Math.min(height, maxHeight);
                const isGreen = t.profit > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full transition-all"
                      style={{
                        height: `${Math.max(h, 2)}px`,
                        backgroundColor: isGreen ? '#22c55e' : '#ef4444',
                        minHeight: '2px'
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Последние 30 сделок</span>
              <span>Прибыль: {stats?.total_profit?.toFixed(0) || 0} ₽</span>
            </div>
          </div>
        </div>

        {/* Правый столбец - сделки */}
        <div className="col-span-4 bg-gray-800 rounded-lg p-3 flex flex-col">
          <div className="text-xs text-gray-400 mb-2 flex-shrink-0">
            📋 ПОСЛЕДНИЕ СДЕЛКИ ({trades.length})
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="text-gray-500 sticky top-0 bg-gray-800">
                  <tr>
                    <th className="text-left py-1">Время</th>
                    <th className="text-left py-1">Инстр</th>
                    <th className="text-left py-1">Напр</th>
                    <th className="text-left py-1">Цена</th>
                    <th className="text-right py-1">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice().reverse().map((t) => (
                    <tr key={t.id} className="border-t border-gray-700">
                      <td className="py-1 text-gray-400">{new Date(t.timestamp).toLocaleTimeString()}</td>
                      <td className="py-1 text-gray-300">{t.instrument}</td>
                      <td className="py-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${t.side === 'buy' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                          {t.side === 'buy' ? 'Покуп' : 'Продаж'}
                        </span>
                      </td>
                      <td className="py-1 text-gray-300">{t.price.toFixed(2)}</td>
                      <td className={`py-1 text-right font-mono ${t.profit > 0 ? 'text-green-400' : t.profit < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {t.profit ? `${t.profit > 0 ? '+' : ''}${t.profit.toFixed(0)}` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ label, value, color = 'white' }: { label: string; value: string | number; color?: string }) => (
  <div className="bg-gray-800 rounded-lg p-2 text-center">
    <div className="text-xs text-gray-400">{label}</div>
    <div className={`text-base font-bold ${color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : color === 'yellow' ? 'text-yellow-400' : 'text-white'}`}>
      {value}
    </div>
  </div>
);

export default App;
