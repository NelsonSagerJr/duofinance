// Same logic as src/lib/theme.js, loaded blocking in <head> so the first paint already has the right theme.
try {
  var t = localStorage.getItem('duofinance-theme')
} catch (e) {}
if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark')
