import { useState, useEffect } from 'react';
import StockInPage from './pages/StockInPage';
import ShelfPage from './pages/ShelfPage';
import HandoverPage from './pages/HandoverPage';
import SearchPage from './pages/SearchPage';
import ExportPage from './pages/ExportPage';
import { initializeDemoData } from './utils/initData';
import './App.css';

type PageType = 'stock-in' | 'shelf' | 'handover' | 'search' | 'export';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('stock-in');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    initializeDemoData();
  }, []);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const menuItems = [
    { key: 'stock-in', label: '入库登记', icon: '📥' },
    { key: 'shelf', label: '柜位管理', icon: '🗄️' },
    { key: 'handover', label: '交接签收', icon: '📋' },
    { key: 'search', label: '查询搜索', icon: '🔍' },
    { key: 'export', label: '数据导出', icon: '📊' },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'stock-in':
        return <StockInPage key={refreshKey} onShelfChange={triggerRefresh} />;
      case 'shelf':
        return <ShelfPage key={refreshKey} onShelfChange={triggerRefresh} />;
      case 'handover':
        return <HandoverPage key={refreshKey} onHandoverChange={triggerRefresh} />;
      case 'search':
        return <SearchPage key={refreshKey} />;
      case 'export':
        return <ExportPage key={refreshKey} />;
      default:
        return <StockInPage key={refreshKey} onShelfChange={triggerRefresh} />;
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">🦷</div>
          <div className="app-title">
            <h1>隐形矫治器</h1>
            <p>收发台账管理系统</p>
          </div>
        </div>
        <nav className="nav-menu">
          {menuItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.key as PageType)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>库房管理 · 稳妥严谨</p>
        </div>
      </aside>
      <main className="main-content">
        <header className="page-header">
          <h2>{menuItems.find(m => m.key === currentPage)?.label}</h2>
          <div className="header-info">
            <span className="date-label">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </span>
          </div>
        </header>
        <div className="page-content">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
