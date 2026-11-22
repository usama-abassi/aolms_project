'use client';
import React, { createContext, startTransition, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize theme from localStorage
  const [theme,setThemeState]=useState<Theme>('light');
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let saved:string|null=null;try{saved=localStorage.getItem('theme');}catch{}
    // Let the visible shell hydrate before updating consumers inside the route boundary.
    startTransition(()=>{
      setThemeState(saved==='light'||saved==='dark'?saved:'light');
      setReady(true);
    });
  },[]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try { localStorage.setItem('theme', newTheme); } catch { /* Theme still works for this visit. */ }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Apply theme by toggling 'dark' class on document element
  useEffect(() => {
    if(!ready)return;
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme,ready]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
