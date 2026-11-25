/* Applies the saved light/dark theme before first paint. External file so the CSP can forbid inline scripts. */
try { var t = localStorage.getItem('ta.theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* storage blocked */ }
