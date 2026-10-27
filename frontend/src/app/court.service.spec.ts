import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CourtService, courtCoordinates, Court } from './court.service';
import { apiBaseUrl } from './config';

describe('CourtService', () => {
  let service: CourtService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CourtService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('builds nearby query parameters and omits an unset sport', () => {
    service.getNearby({ lat: 12.5, lng: 77.6, radiusKm: 5 }).subscribe();
    const request = http.expectOne((req) => req.url === `${apiBaseUrl}/venues/nearby`);
    expect(request.request.params.keys().sort()).toEqual(['lat', 'lng', 'radiusKm'].sort());
    expect(request.request.params.get('lat')).toBe('12.5');
    expect(request.request.params.get('lng')).toBe('77.6');
    expect(request.request.params.get('radiusKm')).toBe('5');
    expect(request.request.params.has('sport')).toBeFalse();
    request.flush([]);
  });

  it('includes a sport filter when supplied', () => {
    service.getNearby({ lat: 1, lng: 2, radiusKm: 3, sport: 'Tennis' }).subscribe();
    const request = http.expectOne((req) => req.url === `${apiBaseUrl}/venues/nearby`);
    expect(request.request.params.get('sport')).toBe('Tennis');
    request.flush([]);
  });

  it('converts GeoJSON [longitude, latitude] coordinates to Leaflet order', () => {
    const court = { location: { type: 'Point' as const, coordinates: [77.6, 12.5] as [number, number] }, lat: 12.5, lng: 77.6 } as Court;
    expect(courtCoordinates(court)).toEqual([12.5, 77.6]);
  });
});
