import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiBaseUrl } from './config';

export interface Booking { _id: string; courtId: string; courtName: string; startsAt: string; endsAt: string; depositAmount: number; status: 'pending' | 'confirmed' | 'cancelled'; }
export interface PaymentOrder { keyId: string; orderId: string; amount: number; currency: string; }
export function paiseToRupees(paise: number): string { return (paise / 100).toFixed(2); }

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  create(courtId: string, startsAt: string): Observable<Booking> { return this.http.post<Booking>(`${apiBaseUrl}/bookings`, { courtId, startsAt }); }
  pay(id: string): Observable<PaymentOrder> { return this.http.post<PaymentOrder>(`${apiBaseUrl}/bookings/${encodeURIComponent(id)}/pay`, {}); }
  get(id: string): Observable<Booking> { return this.http.get<Booking>(`${apiBaseUrl}/bookings/${encodeURIComponent(id)}`); }
}
