import { dateKeyAfterDays, dateKeyInTimeZone, generateSlots } from './slot-utils';

describe('venue timezone slot generation', () => {
  const fixedNow = new Date('2026-10-28T05:00:00.000Z');

  it('converts an India wall-clock hour to its UTC instant', () => {
    const slots = generateSlots('2026-10-28', 'Asia/Kolkata', fixedNow);
    expect(slots[10].startsAt).toBe('2026-10-28T04:30:00.000Z');
  });

  it('converts venue midnight across the UTC date boundary', () => {
    const slots = generateSlots('2026-10-28', 'Asia/Kolkata', fixedNow);
    expect(slots[0].startsAt).toBe('2026-10-27T18:30:00.000Z');
  });

  it('disables all slots before a fixed now', () => {
    const slots = generateSlots('2026-10-28', 'Asia/Kolkata', fixedNow);
    expect(slots).toHaveSize(24);
    expect(slots[9].disabled).toBeTrue();
    expect(slots[10].disabled).toBeTrue();
    expect(slots[11].disabled).toBeFalse();
  });

  it('does not depend on the browser timezone', () => {
    const browserTimezoneOffset = spyOn(Date.prototype, 'getTimezoneOffset').and.returnValue(0);
    const utcBrowser = generateSlots('2026-10-28', 'Asia/Kolkata', fixedNow);
    browserTimezoneOffset.and.returnValue(420);
    const alternateBrowser = generateSlots('2026-10-28', 'Asia/Kolkata', fixedNow);
    expect(alternateBrowser).toEqual(utcBrowser);
  });

  it('supports whole-hour zones and computes venue date boundaries', () => {
    expect(generateSlots('2026-10-28', 'UTC', fixedNow)[10].startsAt).toBe('2026-10-28T10:00:00.000Z');
    expect(dateKeyInTimeZone(new Date('2026-10-27T20:00:00.000Z'), 'Asia/Kolkata')).toBe('2026-10-28');
    expect(dateKeyAfterDays('2026-12-25', 14)).toBe('2027-01-08');
  });
});
