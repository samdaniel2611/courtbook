import { Booking } from './booking.service';
import { venueTimeZone } from './config';

export interface BookingGroups { upcoming: Booking[]; past: Booking[]; }

export function groupBookings(bookings: Booking[], now: Date): BookingGroups {
  const newestFirst = [...bookings].sort((left, right) => Date.parse(right.createdAt ?? right.startsAt) - Date.parse(left.createdAt ?? left.startsAt));
  return {
    upcoming: newestFirst.filter((booking) => Date.parse(booking.startsAt) >= now.getTime()),
    past: newestFirst.filter((booking) => Date.parse(booking.startsAt) < now.getTime()),
  };
}

export function statusBadgeText(status: string): string { return status; }

export function formatVenueDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: venueTimeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function isPaymentIncomplete(booking: Booking, now: Date): boolean {
  return booking.status === 'pending' && !!booking.createdAt && now.getTime() - Date.parse(booking.createdAt) >= 3 * 60 * 1000;
}
