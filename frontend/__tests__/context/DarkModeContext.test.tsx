import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DarkModeProvider, useDarkMode } from '../../context/DarkModeContext';

function ThemeProbe() {
  const { preference, resolvedTheme, setTheme } = useDarkMode();
  return (
    <button type="button" onClick={() => setTheme('light')}>
      {preference}:{resolvedTheme}
    </button>
  );
}

describe('DarkModeProvider', () => {
  it('resolves auto from the system and applies same-tab changes directly', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ theme: 'auto' }));
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<DarkModeProvider><ThemeProbe /></DarkModeProvider>);

    expect(screen.getByRole('button', { name: 'auto:dark' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'light:light' })).toBeInTheDocument());
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('userPreferences', JSON.stringify({ theme: 'light' }));
  });
});
