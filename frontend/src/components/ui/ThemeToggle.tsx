import { useTheme } from '../../context/ThemeContext';
import { IconSun, IconMoon } from '../icons/Icons';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
      aria-pressed={isDark}
      title={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
    >
      {isDark ? (
        <IconSun size={19} className="theme-icon sun" />
      ) : (
        <IconMoon size={19} className="theme-icon moon" />
      )}
    </button>
  );
}
