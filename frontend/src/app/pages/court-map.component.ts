import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { Court, courtCoordinates } from '../court.service';

@Component({
  selector: 'app-court-map', standalone: true,
  template: '<div #map class="map" role="application" aria-label="Map of nearby courts"></div>',
  styles: [':host { display: block; min-height: 420px; height: 100%; } .map { width: 100%; height: 100%; min-height: 420px; border-radius: 12px; }']
})
export class CourtMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('map', { static: true }) private mapElement!: ElementRef<HTMLDivElement>;
  @Input() courts: Court[] = [];
  @Input() center: [number, number] = [0, 0];
  @Input() selectedId: string | null = null;
  @Output() courtSelected = new EventEmitter<string>();
  @Output() centerChanged = new EventEmitter<[number, number]>();
  private readonly courtIcon = L.icon({
    iconUrl: '/leaflet/marker-icon.png',
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    shadowUrl: '/leaflet/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  private map?: L.Map;
  private readonly markers = new Map<string, L.Marker>();

  ngAfterViewInit(): void {
    this.map = L.map(this.mapElement.nativeElement).setView(this.center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 19
    }).addTo(this.map);
    this.map.on('moveend', () => {
      const current = this.map?.getCenter();
      if (current) this.centerChanged.emit([current.lat, current.lng]);
    });
    this.updateMarkers();
    requestAnimationFrame(() => this.map?.invalidateSize());
    setTimeout(() => this.map?.invalidateSize(), 150);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['center'] && !changes['courts']) {
      const current = this.map.getCenter();
      if (current.lat !== this.center[0] || current.lng !== this.center[1]) this.map.setView(this.center);
    }
    if (changes['courts']) this.updateMarkers();
    if (changes['selectedId'] && this.selectedId) this.openCourt(this.selectedId);
  }

  focusCourt(id: string): void { this.openCourt(id); }

  private openCourt(id: string): void {
    const court = this.courts.find((item) => item._id === id);
    const marker = this.markers.get(id);
    if (!court || !marker || !this.map) return;
    this.map.panTo(courtCoordinates(court));
    marker.openPopup();
  }

  private updateMarkers(): void {
    if (!this.map) return;
    this.markers.forEach((marker) => marker.remove());
    this.markers.clear();
    for (const court of this.courts) {
      const marker = L.marker(courtCoordinates(court), { icon: this.courtIcon }).addTo(this.map);
      marker.bindPopup(`<strong>${this.escape(court.name)}</strong><br>${this.escape(court.address)}<br>${this.escape(court.sport)}${typeof court.distance === 'number' ? `<br>${court.distance.toFixed(1)} km away` : ''}`);
      marker.on('click', () => this.courtSelected.emit(court._id));
      this.markers.set(court._id, marker);
    }
  }

  private escape(value: string): string {
    const node = document.createElement('span');
    node.textContent = value;
    return node.innerHTML;
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.markers.clear();
  }
}
