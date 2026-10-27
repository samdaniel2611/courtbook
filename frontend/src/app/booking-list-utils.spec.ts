import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture } from '@angular/core/testing';
import { Booking } from './booking.service';
import { groupBookings, statusBadgeText } from './booking-list-utils';
import { BookingsPageComponent } from './pages/bookings-page.component';
import { apiBaseUrl } from './config';

const booking = (id: string, startsAt: string, createdAt: string): Booking => ({ _id: id, courtId: 'court-1', courtName: `Court ${id}`, startsAt, endsAt: startsAt, depositAmount: 5000, status: 'pending', createdAt });

describe('booking list', () => {
  it('groups bookings into upcoming and past using a fixed now', () => {
    const now = new Date('2026-10-28T12:00:00.000Z');
    const groups = groupBookings([
      booking('past', '2026-10-27T10:00:00.000Z', '2026-10-20T10:00:00.000Z'),
      booking('future-old', '2026-10-29T10:00:00.000Z', '2026-10-20T11:00:00.000Z'),
      booking('future-new', '2026-10-30T10:00:00.000Z', '2026-10-21T10:00:00.000Z')
    ], now);
    expect(groups.upcoming.map((item) => item._id)).toEqual(['future-new', 'future-old']);
    expect(groups.past.map((item) => item._id)).toEqual(['past']);
  });

  it('uses the backend status as the badge text', () => {
    expect(statusBadgeText('pending')).toBe('pending');
    expect(statusBadgeText('confirmed')).toBe('confirmed');
    expect(statusBadgeText('cancelled')).toBe('cancelled');
  });

  describe('empty page state', () => {
    let fixture: ComponentFixture<BookingsPageComponent>;
    let http: HttpTestingController;
    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [BookingsPageComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
      fixture = TestBed.createComponent(BookingsPageComponent);
      http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => http.verify());
    it('shows the empty message and a courts link', () => {
      fixture.detectChanges();
      http.expectOne(`${apiBaseUrl}/bookings`).flush([]);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No bookings yet');
      expect(fixture.nativeElement.querySelector('a[routerLink="/courts"]')).not.toBeNull();
    });
  });
});
