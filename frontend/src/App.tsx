import React, { useState, useEffect } from 'react';
import useWebSocket from 'react-use-websocket';
import axios from 'axios';

// API базовый URL (для локальной разработки)
const API_URL = 'http://localhost:8000/api';
const WS_URL = 'ws://localhost:8000/api/ws';

interface Trade {
  id: number;
  instrument: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: string;
  status: string;
  profit: number | null;
}

interface Stats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_profit: number;
  win_rate: number;
  avg_profit: number;
  avg_loss: number;
  max_drawdown: number;
}

interface Strategy {
  key: string;
  instrument: string;
  name: string;
  is_active: boolean;
  stats: {
    total: number;
    wins: number;
    losses: number;
    win_rate: number;
    profit: number;
  };
}

function App() {
  const [balance, setBalance] = useState({ balance: 0, available: 0, currency: 'RUB' });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsMessage, setWsMessage] = useState('');

  // WebSocket для реального времени
  const { lastJsonMessage, sendMessage } = useWebSocket(WS_URL, {
    onOpen: () => console.log('WebSocket подключён'),
    onError: (event) => console.error('WebSocket ошибка:', event),
    shouldReconnect: (closeEvent) => true,
    reconnectInterval: 3000,
  });

  // Обработка WebSocket сообщений
  useEffect(() => {
    if (lastJsonMessage) {
      console.log('WebSocket сообщение:', lastJsonMessage);
      setWsMessage(JSON.stringify(lastJsonMessage, null, 2));
      
      // Если пришла новая котировка или сделка, обновляем данные
      if (lastJsonMessage.type === 'quote' || lastJsonMessage.type === 'trade') {
        fetchData();
      }
    }
  }, [lastJsonMessage]);

  // Загрузка данных при монтировании
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [balanceRes, tradesRes, statsRes, strategiesRes] = await Promise.all([
        axios.get(`${API_URL}/balance`),
        axios.get(`${API_URL}/trades?limit=20`),
        axios.get(`${API_URL}/stats`),
        axios.get(`${API_URL}/strategies`),
      ]);

      setBalance(balanceRes.data);
      setTrades(tradesRes.data);
      setStats(statsRes.data);
      setStrategies(strategiesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setLoading(false);
    }
  };

  const startStrategy = async (instrument: string, type: string = 'impulse') => {
    try {
      await axios.post(`${API_URL}/strategies/start`, null, {
        params: { instrument, strategy_type: type },
      });
      await fetchData();
    } catch (error) {
      console.error('Ошибка запуска стратегии:', error);
    }
  };

  const stopStrategy = async (instrument: string, type: string = 'impulse') => {
    try {
      await axios.post(`${API_URL}/strategies/stop`, null, {
        params: { instrument, strategy_type: type },
      });
      await fetchData();
    } catch (error) {
      console.error('Ошибка остановки стратегии:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Futures Scalping Bot</h1>
            <p className="text-gray-400 mt-1">Автоматическая торговля фьючерсами RTS и Si</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Баланс</p>
            <p className="text-2xl font-bold text-green-500">
              {balance.balance.toLocaleString()} {balance.currency}
            </p>
          </div>
        </header>

        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card">
              <p className="text-gray-400 text-sm">Всего сделок</p>
              <p className="text-2xl font-bold text-white">{stats.total_trades}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Профит</p>
              <p className={`text-2xl font-bold ${stats.total_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats.total_profit.toFixed(2)} ₽
              </p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Win Rate</p>
              <p className="text-2xl font-bold text-white">{stats.win_rate.toFixed(1)}%</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Max Drawdown</p>
              <p className="text-2xl font-bold text-red-500">{stats.max_drawdown.toFixed(2)} ₽</p>
            </div>
          </div>
        )}

        {/* Стратегии */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">RTS — Импульсный пробой</h2>
            <div className="flex items-center gap-4 mb-4">
              <span className={`status-badge ${strategies.find(s => s.instrument === 'RTS')?.is_active ? 'active' : 'inactive'}`}>
                {strategies.find(s => s.instrument === 'RTS')?.is_active ? 'Активна' : 'Остановлена'}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => startStrategy('RTS')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Запустить
              </button>
              <button
                onClick={() => stopStrategy('RTS')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Остановить
              </button>
            </div>
            {strategies.find(s => s.instrument === 'RTS') && (
              <div className="mt-4 text-sm text-gray-400">
                <p>Сделок: {strategies.find(s => s.instrument === 'RTS')?.stats.total || 0}</p>
                <p>Профит: {strategies.find(s => s.instrument === 'RTS')?.stats.profit.toFixed(2) || 0} ₽</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Si — Отскок от уровней</h2>
            <div className="flex items-center gap-4 mb-4">
              <span className={`status-badge ${strategies.find(s => s.instrument === 'Si')?.is_active ? 'active' : 'inactive'}`}>
                {strategies.find(s => s.instrument === 'Si')?.is_active ? 'Активна' : 'Остановлена'}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => startStrategy('Si', 'level')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Запустить
              </button>
              <button
                onClick={() => stopStrategy('Si', 'level')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Остановить
              </button>
            </div>
            {strategies.find(s => s.instrument === 'Si') && (
              <div className="mt-4 text-sm text-gray-400">
                <p>Сделок: {strategies.find(s => s.instrument === 'Si')?.stats.total || 0}</p>
                <p>Профит: {strategies.find(s => s.instrument === 'Si')?.stats.profit.toFixed(2) || 0} ₽</p>
              </div>
            )}
          </div>
        </div>

        {/* WebSocket статус */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">WebSocket</h2>
          <p className="text-sm text-gray-400">Статус: {lastJsonMessage ? '✅ Подключён' : '⏳ Ожидание...'}</p>
          {wsMessage && (
            <pre className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-300 overflow-x-auto max-h-20">
              {wsMessage}
            </pre>
          )}
        </div>

        {/* История сделок */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">История сделок</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2">Время</th>
                  <th className="pb-2">Инструмент</th>
                  <th className="pb-2">Направление</th>
                  <th className="pb-2">Цена</th>
                  <th className="pb-2">Кол-во</th>
                  <th className="pb-2">Статус</th>
                  <th className="pb-2 text-right">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-gray-800">
                    <td className="py-2 text-gray-300">{new Date(trade.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 text-gray-300">{trade.instrument}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${trade.side === 'buy' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {trade.side === 'buy' ? 'Покупка' : 'Продажа'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-300">{trade.price.toFixed(2)}</td>
                    <td className="py-2 text-gray-300">{trade.quantity}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${trade.status === 'filled' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                        {trade.status === 'filled' ? 'Исполнена' : 'В обработке'}
                      </span>
                    </td>
                    <td className={`py-2 text-right ${trade.profit && trade.profit > 0 ? 'text-green-500' : trade.profit && trade.profit < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {trade.profit !== null ? trade.profit.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
