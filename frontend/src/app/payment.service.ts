import { Injectable } from '@angular/core';
import { PaymentOrder } from './booking.service';

interface RazorpayOptions { key: string; order_id: string; amount: number; currency: string; handler: () => void; modal: { ondismiss: () => void }; }
interface RazorpayInstance { open(): void; }
export interface RazorpayConstructor { new(options: RazorpayOptions): RazorpayInstance; }

@Injectable({ providedIn: 'root' })
export class RazorpayWrapper { open(options: RazorpayOptions): void { const Constructor = (window as Window & { Razorpay?: RazorpayConstructor }).Razorpay; if (!Constructor) throw new Error('Checkout unavailable'); new Constructor(options).open(); } }

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private scriptPromise?: Promise<void>;
  constructor(private readonly wrapper: RazorpayWrapper) {}
  load(): Promise<void> {
    if (!this.scriptPromise) this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
      if (existing) { if ((window as Window & { Razorpay?: RazorpayConstructor }).Razorpay) { resolve(); return; } existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Secure checkout could not be loaded. Check your connection or browser settings and try again.')), { once: true }); return; }
      const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true; script.dataset['razorpayCheckout'] = 'true';
      script.onload = () => resolve(); script.onerror = () => reject(new Error('Secure checkout could not be loaded. Check your connection or browser settings and try again.')); document.head.appendChild(script);
    });
    return this.scriptPromise;
  }
  async open(order: PaymentOrder, handler: () => void, dismissed: () => void): Promise<void> { await this.load(); this.wrapper.open({ key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency, handler, modal: { ondismiss: dismissed } }); }
}
