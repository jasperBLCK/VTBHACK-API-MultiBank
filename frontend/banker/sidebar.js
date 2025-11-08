// Общий компонент бокового меню для Banker Portal

export function createSidebar(activePage) {
    const bankerLogin = localStorage.getItem('banker_login') || 'admin';
    
    return `
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>🏦 Banker Portal</h1>
                <p>HackAPI 2025</p>
                <div class="banker-info">
                    <span class="banker-icon">👤</span>
                    <span class="banker-name">${bankerLogin}</span>
                </div>
            </div>

            <nav class="sidebar-nav">
                <a href="monitoring.html" class="nav-item ${activePage === 'monitoring' ? 'active' : ''}">
                    <span class="nav-item-icon">📊</span>
                    Мониторинг
                </a>
                <a href="clients.html" class="nav-item ${activePage === 'clients' ? 'active' : ''}">
                    <span class="nav-item-icon">👥</span>
                    Клиенты
                </a>
                <a href="products.html" class="nav-item ${activePage === 'products' ? 'active' : ''}">
                    <span class="nav-item-icon">🎁</span>
                    Продукты
                </a>
                <a href="consents.html" class="nav-item ${activePage === 'consents' ? 'active' : ''}">
                    <span class="nav-item-icon">📝</span>
                    Согласия
                </a>
                <a href="teams.html" class="nav-item ${activePage === 'teams' ? 'active' : ''}">
                    <span class="nav-item-icon">👨‍💼</span>
                    Команды
                </a>
            </nav>

            <div class="sidebar-footer">
                <button class="theme-toggle" id="themeToggle" title="Переключить тему">
                    <span id="themeIcon">🌙</span>
                </button>
                <button class="logout-btn" onclick="logout()">
                    <span>🚪</span> Выйти
                </button>
            </div>
        </aside>
    `;
}

export function initSidebar(activePage) {
    // Вставить sidebar в начало body
    document.body.insertAdjacentHTML('afterbegin', createSidebar(activePage));
}

// Общий logout
window.logout = function() {
    localStorage.removeItem('banker_token');
    localStorage.removeItem('banker_role');
    localStorage.removeItem('banker_login');
    window.location.href = 'index.html';
};

// Общие стили для sidebar
export const sidebarStyles = `
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    :root {
        --sidebar-width: 260px;
        --primary-color: #2563eb;
        --danger-color: #dc2626;
        --success-color: #16a34a;
        --warning-color: #f59e0b;
    }

    [data-theme="light"] {
        --bg-primary: #f5f7fa;
        --bg-secondary: #ffffff;
        --text-primary: #1f2937;
        --text-secondary: #6b7280;
        --text-muted: #9ca3af;
        --border-color: #e5e7eb;
        --shadow: 0 2px 8px rgba(0,0,0,0.1);
        --sidebar-bg: #ffffff;
        --sidebar-border: #e5e7eb;
    }

    [data-theme="dark"] {
        --bg-primary: #111827;
        --bg-secondary: #1f2937;
        --text-primary: #f9fafb;
        --text-secondary: #d1d5db;
        --text-muted: #9ca3af;
        --border-color: #374151;
        --shadow: 0 2px 8px rgba(0,0,0,0.3);
        --sidebar-bg: #1f2937;
        --sidebar-border: #374151;
    }

    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg-primary);
        color: var(--text-primary);
        min-height: 100vh;
        display: flex;
    }

    /* Sidebar */
    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        width: var(--sidebar-width);
        background: var(--sidebar-bg);
        border-right: 1px solid var(--sidebar-border);
        display: flex;
        flex-direction: column;
        z-index: 1000;
    }

    .sidebar-header {
        padding: 24px 20px;
        border-bottom: 1px solid var(--border-color);
    }

    .sidebar-header h1 {
        font-size: 20px;
        margin-bottom: 4px;
        color: var(--text-primary);
    }

    .sidebar-header p {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 12px;
    }

    .banker-info {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--bg-primary);
        border-radius: 8px;
        margin-top: 12px;
    }

    .banker-icon {
        font-size: 18px;
    }

    .banker-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
    }

    .sidebar-nav {
        flex: 1;
        padding: 20px 12px;
        overflow-y: auto;
    }

    .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        margin-bottom: 4px;
        text-decoration: none;
        color: var(--text-secondary);
        border-radius: 8px;
        transition: all 0.2s;
        font-size: 15px;
    }

    .nav-item:hover {
        background: var(--bg-primary);
        color: var(--text-primary);
    }

    .nav-item.active {
        background: var(--primary-color);
        color: white;
    }

    .nav-item-icon {
        font-size: 20px;
    }

    .sidebar-footer {
        padding: 16px;
        border-top: 1px solid var(--border-color);
        display: flex;
        gap: 8px;
    }

    .theme-toggle {
        flex: 0 0 44px;
        height: 44px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: var(--bg-primary);
        cursor: pointer;
        font-size: 20px;
        transition: all 0.2s;
    }

    .theme-toggle:hover {
        transform: scale(1.05);
        border-color: var(--primary-color);
    }

    .logout-btn {
        flex: 1;
        height: 44px;
        border-radius: 8px;
        border: 1px solid var(--danger-color);
        background: transparent;
        color: var(--danger-color);
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }

    .logout-btn:hover {
        background: var(--danger-color);
        color: white;
    }

    /* Main Content */
    .main-content {
        margin-left: var(--sidebar-width);
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    .top-bar {
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-color);
        padding: 20px 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 100;
    }

    .top-bar-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary);
    }

    .content-area {
        flex: 1;
        padding: 32px;
        overflow-y: auto;
    }

    .container {
        max-width: 1400px;
        margin: 0 auto;
    }

    /* Common components */
    .loading {
        text-align: center;
        padding: 40px;
        color: var(--text-muted);
        font-size: 16px;
    }

    .error {
        text-align: center;
        padding: 40px;
        color: var(--danger-color);
        font-size: 16px;
    }
`;

