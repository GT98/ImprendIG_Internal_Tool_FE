import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const DURATION = 4500;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(type: ToastType, message: string): void {
    const id = ++this.counter;
    this._toasts.update(t => [...t, { id, type, message }]);
    setTimeout(() => this.dismiss(id), DURATION);
  }

  success(message: string): void { this.show('success', message); }
  error(message: string): void   { this.show('error',   message); }
  warning(message: string): void { this.show('warning', message); }

  dismiss(id: number): void {
    this._toasts.update(t => t.filter(toast => toast.id !== id));
  }
}
