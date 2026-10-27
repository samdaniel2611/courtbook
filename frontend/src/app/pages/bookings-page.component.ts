import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Booking, BookingService, paiseToRupees } from '../booking.service';
import { formatVenueDateTime, groupBookings, isPaymentIncomplete, statusBadgeText } from '../booking-list-utils';

@Component({
  selector: 'app-bookings-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="bookings-page">
      <header><p class="eyebrow">YOUR COURTBOOK</p><h1>My bookings</h1><p>Review your upcoming and past court bookings.</p></header>
      <p *ngIf="loading" class="notice" role="status">Loading your bookings…</p>
      <p *ngIf="error" class="notice error" role="alert">{{error}}</p>
      <section *ngIf="!loading && !error && bookings.length === 0" class="empty">
        <h2>No bookings yet</h2><p>Find a court and book your next game.</p><a class="primary" routerLink="/courts">Browse courts</a>
      </section>
      <ng-container *ngIf="!loading && !error && bookings.length">
        <section *ngIf="upcoming.length" aria-labelledby="upcoming-heading"><h2 id="upcoming-heading">Upcoming</h2><ng-container *ngTemplateOutlet="bookingCards; context: {$implicit: upcoming}" /></section>
        <section *ngIf="past.length" aria-labelledby="past-heading"><h2 id="past-heading">Past</h2><ng-container *ngTemplateOutlet="bookingCards; context: {$implicit: past}" /></section>
      </ng-container>
      <ng-template #bookingCards let-items><a *ngFor="let booking of items; trackBy: trackBooking" class="booking-card" [routerLink]="['/bookings', booking._id]">
        <div class="card-top"><span class="badge" [attr.data-status]="statusText(booking.status)">{{statusText(booking.status)}}</span><span class="date">{{venueDateTime(booking.startsAt)}}</span></div>
        <h3>{{booking.courtName}}</h3><p class="deposit">Deposit · ₹{{rupees(booking.depositAmount)}}</p>
        <p *ngIf="paymentIncomplete(booking)" class="pending-hint">Payment not completed</p>
      </a></ng-template>
    </section>
  `,
  styles: [`
    :host{display:block}.bookings-page{max-width:900px;margin:2.2rem auto 3rem;color:#0f172a}header{margin-bottom:1.5rem}.eyebrow{margin:0 0 .4rem;color:#0e7490;font-size:.72rem;font-weight:750;letter-spacing:.13em}h1{margin:0;font-size:clamp(1.8rem,4vw,2.35rem);letter-spacing:-.04em}header>p:last-child{color:#64748b;margin:.45rem 0 0}section[aria-labelledby]{margin:1.5rem 0}section[aria-labelledby]>h2{font-size:1.2rem;margin:0 0 .8rem}.booking-card{display:block;margin:.65rem 0;padding:1rem 1.1rem;border:1px solid #e2e8f0;border-radius:12px;background:white;color:inherit;text-decoration:none;transition:border-color .15s,box-shadow .15s}.booking-card:hover{border-color:#0891b2;box-shadow:0 0 0 2px #0891b21a}.card-top{display:flex;align-items:center;justify-content:space-between;gap:.75rem}.badge{padding:.3rem .65rem;border-radius:20px;background:#fef3c7;color:#92400e;font-size:.78rem;font-weight:750;text-transform:capitalize}.badge[data-status="confirmed"]{background:#dcfce7;color:#166534}.badge[data-status="cancelled"]{background:#e2e8f0;color:#475569}.date{color:#64748b;font-size:.9rem}h3{margin:.8rem 0 .25rem;font-size:1.05rem}.deposit{margin:0;color:#475569;font-size:.9rem}.pending-hint{margin:.55rem 0 0;color:#9a3412;font-size:.88rem;font-weight:650}.notice{color:#475569}.error{color:#9f3127}.empty{padding:2rem;text-align:center;border:1px solid #e2e8f0;border-radius:14px;background:#fff}.empty h2{margin:0}.empty p{color:#64748b}.primary{display:inline-block;padding:.7rem 1rem;border-radius:8px;background:#155e75;color:#fff;text-decoration:none;font-weight:700}@media(max-width:520px){.bookings-page{margin:1.5rem auto}.card-top{align-items:flex-start;flex-direction:column;gap:.5rem}}
  `]
})
export class BookingsPageComponent implements OnInit, OnDestroy {
  private readonly service = inject(BookingService);
  private readonly destroy$ = new Subject<void>();
  bookings: Booking[] = [];
  upcoming: Booking[] = [];
  past: Booking[] = [];
  loading = true;
  error = '';
  private readonly now = new Date();

  ngOnInit(): void {
    this.service.getMine().pipe(takeUntil(this.destroy$)).subscribe({
      next: (bookings) => { this.bookings = bookings; const groups = groupBookings(bookings, this.now); this.upcoming = groups.upcoming; this.past = groups.past; this.loading = false; },
      error: () => { this.loading = false; this.error = 'We could not load your bookings right now. Please try again.'; }
    });
  }

  trackBooking(_index: number, booking: Booking): string { return booking._id; }
  statusText(status: string): string { return statusBadgeText(status); }
  venueDateTime(value: string): string { return formatVenueDateTime(value); }
  rupees(paise: number): string { return paiseToRupees(paise); }
  paymentIncomplete(booking: Booking): boolean { return isPaymentIncomplete(booking, new Date()); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
