import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiBaseUrl } from './config';

export interface Court {
  _id: string;
  name: string;
  sport: string;
  address: string;
  lat: number;
  lng: number;
  location: { type: 'Point'; coordinates: [number, number] };
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
  distance?: number;
}

export interface NearbySearch {
  lat: number;
  lng: number;
  radiusKm: number;
  sport?: string;
}

/** Converts the stored GeoJSON [longitude, latitude] pair to Leaflet [latitude, longitude]. */
export function courtCoordinates(court: Pick<Court, 'location' | 'lat' | 'lng'>): [number, number] {
  const [lng, lat] = court.location.coordinates;
  return [lat, lng];
}

@Injectable({ providedIn: 'root' })
export class CourtService {
  private readonly http = inject(HttpClient);

  getNearby(search: NearbySearch): Observable<Court[]> {
    let params = new HttpParams()
      .set('lat', search.lat)
      .set('lng', search.lng)
      .set('radiusKm', search.radiusKm);
    const sport = search.sport?.trim();
    if (sport) params = params.set('sport', sport);
    return this.http.get<Court[]>(`${apiBaseUrl}/venues/nearby`, { params });
  }

  getCourt(id: string): Observable<Court> {
    return this.http.get<Court>(`${apiBaseUrl}/venues/${encodeURIComponent(id)}`);
  }
}
