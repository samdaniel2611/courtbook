import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BookingService, paiseToRupees } from './booking.service';
import { apiBaseUrl } from './config';

describe('BookingService', () => {
 let service:BookingService;let http:HttpTestingController;
 beforeEach(()=>{TestBed.configureTestingModule({providers:[BookingService,provideHttpClient(),provideHttpClientTesting()]});service=TestBed.inject(BookingService);http=TestBed.inject(HttpTestingController);});
 afterEach(()=>http.verify());
 it('converts paise to rupees without floating point formatting surprises',()=>{expect(paiseToRupees(5000)).toBe('50.00');expect(paiseToRupees(1)).toBe('0.01');});
 it('posts booking creation data through the gateway',()=>{service.create('c1','2026-10-30T04:00:00.000Z').subscribe();const req=http.expectOne(`${apiBaseUrl}/bookings`);expect(req.request.method).toBe('POST');expect(req.request.body).toEqual({courtId:'c1',startsAt:'2026-10-30T04:00:00.000Z'});req.flush({_id:'b1'});});
});
