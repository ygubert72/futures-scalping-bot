import React, { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  IChartApi, 
  CandlestickData, 
  Time,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  HistogramData
} from 'lightweight-charts';
import useWebSocket from 'react-use-websocket';

interface ChartProps {
  symbol: string;
  timeframe: string;
}

interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Реальные интервалы для API
const TIMEFRAMES: Record<string, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1hour',
  '4h': '4hour',
  '1d': '1day',
  '1w': '1week',
};

const API_URL = 'http://localhost:8000/api';

export const Chart: React.FC<ChartProps> = ({ symbol, timeframe }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<CandlestickSeries> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<HistogramSeries> | null>(null);
  const [candleData, setCandleData] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Подписка на WebSocket для реальных котировок
  const { lastJsonMessage, sendMessage } = useWebSocket(
    `ws://localhost:8000/api/ws/chart/${symbol}`,
    {
      onOpen: () => {
        console.log(`WebSocket подключён для ${symbol}`);
        // Подписываемся на инструмент
        sendMessage(JSON.stringify({
          action: 'subscribe',
          symbol: symbol,
          timeframe: timeframe,
        }));
      },
      onError: (event) => {
        console.error('WebSocket ошибка:', event);
        setError('Ошибка подключения к WebSocket');
      },
      shouldReconnect: true,
      reconnectInterval: 3000,
    }
  );

  // Загрузка исторических данных
  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(
        `${API_URL}/history/${symbol}?timeframe=${TIMEFRAMES[timeframe] || '1min'}&limit=500`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        setCandleData(data);
      } else {
        // Если нет данных, генерируем тестовые
        setCandleData(generateMockData());
      }
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
      // В случае ошибки используем мок-данные
      setCandleData(generateMockData());
    } finally {
      setIsLoading(false);
    }
  };

  // Генерация тестовых данных (заглушка, пока нет реального API)
  const generateMockData = (): Candle[] => {
    const data: Candle[] = [];
    const now = Date.now();
    let price = 120000;
    
    for (let i = 0; i < 500; i++) {
      const time = (now - (500 - i) * 60000) / 1000;
      const change = (Math.random() - 0.5) * 200;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 100;
      const low = Math.min(open, close) - Math.random() * 100;
      price = close;
      
      data.push({
        time: time as Time,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 1000 + 100),
      });
    }
    return data;
  };

  // Обновление последней свечи по WebSocket данным
  useEffect(() => {
    if (lastJsonMessage && candlestickSeriesRef.current) {
      const msg = typeof lastJsonMessage === 'string' 
        ? JSON.parse(lastJsonMessage) 
        : lastJsonMessage;
      
      if (msg.type === 'quote') {
        const currentCandle = candleData[candleData.length - 1];
        if (currentCandle) {
          const updatedCandle = {
            ...currentCandle,
            high: Math.max(currentCandle.high, msg.price),
            low: Math.min(currentCandle.low, msg.price),
            close: msg.price,
          };
          setCandleData(prev => {
            const newData = [...prev];
            newData[newData.length - 1] = updatedCandle;
            return newData;
          });
        }
      }
    }
  }, [lastJsonMessage]);

  // Инициализация графика
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Создаем график с адаптивными настройками
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#4b5563',
        fixLeftEdge: false,
        fixRightEdge: false,
        allowBoldLabels: true,
        barSpacing: 6,
      },
      rightPriceScale: {
        borderColor: '#4b5563',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });

    chartRef.current = chart;

    // Добавляем свечной ряд
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Добавляем объем
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#6b7280',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    volumeSeriesRef.current = volumeSeries;

    // Обработка ресайза
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Зум колесиком мыши
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey && chartRef.current) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const currentSpacing = chartRef.current.timeScale().barSpacing();
        const newSpacing = Math.max(2, Math.min(50, currentSpacing + delta * 10));
        chartRef.current.timeScale().applyOptions({
          barSpacing: newSpacing,
        });
      }
    };

    chartContainerRef.current.addEventListener('wheel', handleWheel);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartContainerRef.current) {
        chartContainerRef.current.removeEventListener('wheel', handleWheel);
      }
      chart.remove();
    };
  }, []);

  // Обновление данных на графике
  useEffect(() => {
    if (candlestickSeriesRef.current && candleData.length > 0) {
      candlestickSeriesRef.current.setData(candleData);
      
      // Обновляем объем
      if (volumeSeriesRef.current) {
        const volumeData: HistogramData[] = candleData.map(c => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? '#10b981' : '#ef4444',
        }));
        volumeSeriesRef.current.setData(volumeData);
      }
      
      // Автомасштабирование
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [candleData]);

  // Загрузка истории при смене символа или таймфрейма
  useEffect(() => {
    loadHistory();
  }, [symbol, timeframe]);

  // Обработка изменения видимой области (для динамической подгрузки)
  const handleVisibleTimeRangeChange = (range: { from: Time; to: Time } | null) => {
    // Здесь можно реализовать подгрузку данных при скролле
    console.log('Visible range changed:', range);
  };

  // Метод для экспорта в полноэкранный режим
  const toggleFullscreen = () => {
    const container = chartContainerRef.current;
    if (!container) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 h-[500px] flex items-center justify-center">
        <div className="text-gray-400">Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-white font-semibold">{symbol}</h3>
          <span className="text-gray-400 text-sm">{timeframe}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white transition-colors"
            title="Полноэкранный режим"
          >
            ⛶
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-900/50 text-red-300 p-2 rounded mb-2 text-sm">
          {error}
        </div>
      )}
      
      <div 
        ref={chartContainerRef} 
        className="w-full h-[500px] relative"
        style={{ minHeight: '300px' }}
      >
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          Ctrl + колесо для зума
        </div>
      </div>
    </div>
  );
};
