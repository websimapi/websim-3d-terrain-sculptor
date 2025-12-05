const logs = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function captureLog(type, args) {
    try {
        const msg = args.map(a => {
            if (a instanceof Error) return a.stack || a.message;
            if (typeof a === 'object') return JSON.stringify(a, null, 2);
            return String(a);
        }).join(' ');
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        logs.push(`[${timestamp}] [${type}] ${msg}`);
        if (logs.length > 500) logs.shift();
    } catch (e) {
        // Fail silently in logger
    }
}

export function initLogger() {
    console.log = (...args) => { captureLog('LOG', args); originalLog.apply(console, args); };
    console.warn = (...args) => { captureLog('WARN', args); originalWarn.apply(console, args); };
    console.error = (...args) => { captureLog('ERR', args); originalError.apply(console, args); };

    window.onerror = (msg, url, line, col, error) => {
        captureLog('UNCAUGHT', [msg, url, line, col, error]);
        alert('An error occurred. Tap the 🐛 icon to copy logs.');
        return false;
    };

    // Bug Report Button
    const bugBtn = document.getElementById('btn-bug');
    if (bugBtn) {
        bugBtn.addEventListener('click', async () => {
            try {
                const logText = logs.join('\\n');
                await navigator.clipboard.writeText(logText);
                alert('Debug logs copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy logs:', err);
                alert('Failed to copy logs. Check console.');
            }
        });
    }
}