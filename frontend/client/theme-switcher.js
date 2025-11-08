// Theme Switcher - темная/светлая тема

// Применить тему
export function applyTheme(theme) {
    if (!theme) {
        theme = localStorage.getItem('theme') || 'light';
    }
    
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Обновить иконку если кнопка существует
    updateThemeIcon();
}

// Переключить тему
export function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    return newTheme;
}

// Обновить иконку кнопки
function updateThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        const theme = localStorage.getItem('theme') || 'light';
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Применить при загрузке модуля
applyTheme();
