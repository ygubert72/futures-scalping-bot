import React, { useState, useEffect } from 'react';
import useWebSocket from 'react-use-websocket';
import axios from 'axios';
import { Chart } from './components/Chart';

// ... остальные интерфейсы и типы ...

function App() {
  const [balance, setBalance] = useState({ balance: 0, available: 0, currency: 'RUB' });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsMessage, setWsMessage] = useState('');
  
  // Состояние для графика
  const [selectedSymbol, setSelectedSymbol] = useState('RTS');
  const [selectedTimeframe, setSelectedTimeframe] = useState('5m');

  // ... остальные хуки и функции ...

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

        {/* График */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedSymbol('RTS')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedSymbol === 'RTS' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                RTS
              </button>
              <button
                onClick={() => setSelectedSymbol('Si')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedSymbol === 'Si' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Si
              </button>
            </div>
            
            <div className="flex gap-2 ml-4">
              {['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    selectedTimeframe === tf 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          
          <Chart symbol={selectedSymbol} timeframe={selectedTimeframe} />
        </div>

        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* ... статистика ... */}
          </div>
        )}

        {/* Стратегии */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* ... стратегии ... */}
        </div>

        {/* WebSocket статус */}
        <div className="card mb-8">
          {/* ... WebSocket статус ... */}
        </div>

        {/* История сделок */}
        <div className="card">
          {/* ... история сделок ... */}
        </div>
      </div>
    </div>
  );
}

export default App;
