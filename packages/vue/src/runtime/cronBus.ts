export interface CronHandle {
  disconnect(): void;
}

export function scheduleCron(cb: () => void, intervalMs: number): CronHandle {
  const id = setInterval(cb, intervalMs);
  return {
    disconnect() {
      clearInterval(id);
    },
  };
}

export function scheduleCronAfter(cb: () => void, delayMs: number): CronHandle {
  let fired = false;
  const id = setTimeout(() => {
    fired = true;
    cb();
  }, delayMs);
  return {
    disconnect() {
      if (!fired) clearTimeout(id);
    },
  };
}
