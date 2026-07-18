import { ref } from 'vue';

interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const toasts = ref<ToastItem[]>([]);
let nextId = 0;

export function useToast() {
  function show(message: string, type: ToastItem['type'] = 'info', duration = 3000) {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
  }
  return { toasts, show };
}
