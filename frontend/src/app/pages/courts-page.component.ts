import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, catchError, map, of, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { Court, CourtService } from '../court.service';
import { defaultCenter } from '../config';
import { CourtMapComponent } from './court-map.component';

interface SearchState { courts: Court[]; loading: boolean; error: string; }

@Component({
  selector: 'app-courts-page', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CourtMapComponent],
  template: `
    <section class="courts-page">
      <header class="page-heading"><div><p class="eyebrow">FIND YOUR GAME</p><h1>Courts near you</h1><p>Explore places to play and choose a court that works for you.</p></div></header>
      <form class="filters" (ngSubmit)="searchArea()">
        <label>Radius <select name="radius" [(ngModel)]="radiusKm"><option *ngFor="let radius of radii" [ngValue]="radius">{{ radius }} km</option></select></label>
        <label class="sport-filter">Sport <input name="sport" [(ngModel)]="sport" placeholder="Any sport" /></label>
        <button type="submit">Search this area</button>
      </form>
      <p *ngIf="loading" class="status" role="status">Searching for courts…</p>
      <p *ngIf="errorMessage" class="status error" role="alert">{{ errorMessage }}</p>
      <div class="results-layout">
        <section class="map-panel" aria-label="Court map"><app-court-map #courtMap [courts]="courts" [center]="mapCenter" [selectedId]="selectedId" (courtSelected)="selectCourt($event)" (centerChanged)="mapCenter = $event" /></section>
        <section class="list-panel" aria-label="Nearby courts">
          <div class="list-heading"><h2>Courts</h2><span>{{ courts.length }} found</span></div>
          <p *ngIf="!loading && !errorMessage && courts.length === 0" class="empty">No courts within {{ radiusKm }} km, try a bigger radius.</p>
          <button *ngFor="let court of courts; trackBy: trackCourt" class="court-card" [class.selected]="selectedId === court._id" type="button" (click)="selectFromList(court._id)">
            <span class="sport-tag">{{ court.sport }}</span><strong>{{ court.name }}</strong><span class="address">{{ court.address }}</span>
            <span *ngIf="court.distance !== undefined" class="distance">{{ court.distance | number:'1.0-1' }} km away</span>
            <a [routerLink]="['/courts', court._id]" (click)="$event.stopPropagation()">View and book <span aria-hidden="true">→</span></a>
          </button>
        </section>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .courts-page { padding: 2.2rem 0 3rem; }
    .page-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 1.35rem; }
    .eyebrow { color: #0e7490; font-size: .72rem; font-weight: 750; letter-spacing: .13em; margin: 0 0 .45rem; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.35rem); letter-spacing: -.04em; margin: 0; }
    .page-heading p:last-child { color: #64748b; margin: .45rem 0 0; }
    .filters { display: flex; align-items: end; gap: .85rem; flex-wrap: wrap; padding: 1rem; background: white; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: .85rem; }
    .filters label { display: grid; gap: .35rem; color: #475569; font-size: .82rem; font-weight: 650; }
    input, select { min-width: 120px; padding: .65rem .75rem; border: 1px solid #cbd5e1; border-radius: 7px; color: #0f172a; background: white; font: inherit; }
    .sport-filter input { min-width: 180px; }
    .filters button { padding: .7rem 1rem; border: 0; border-radius: 7px; color: white; background: #155e75; font: inherit; font-weight: 650; cursor: pointer; }
    .filters button:hover { background: #0e7490; }
    .status { margin: .7rem 0; color: #475569; }.error { color: #9f3127; }
    .results-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .85fr); gap: 1rem; align-items: stretch; }
    .map-panel, .list-panel { min-width: 0; padding: .75rem; background: white; border: 1px solid #e2e8f0; border-radius: 14px; }
    .map-panel { min-height: 450px; }
    .list-panel { max-height: 590px; overflow: auto; }
    .list-heading { display: flex; align-items: center; justify-content: space-between; padding: .15rem .25rem .75rem; }
    .list-heading h2 { margin: 0; font-size: 1.05rem; }.list-heading span { color: #64748b; font-size: .83rem; }
    .empty { padding: 1rem .4rem; color: #64748b; line-height: 1.5; }
    .court-card { display: grid; width: 100%; gap: .4rem; padding: 1rem; margin-bottom: .6rem; text-align: left; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: #0f172a; font: inherit; cursor: pointer; }
    .court-card:hover, .court-card.selected { border-color: #0891b2; box-shadow: 0 0 0 2px #0891b21a; }
    .court-card strong { font-size: 1rem; }.sport-tag { color: #0e7490; font-size: .72rem; font-weight: 750; text-transform: capitalize; }
    .address, .distance { color: #64748b; font-size: .85rem; }.court-card a { justify-self: start; margin-top: .3rem; color: #0e7490; font-size: .88rem; font-weight: 700; text-decoration: none; }
    @media (max-width: 760px) { .courts-page { padding-top: 1.5rem; }.results-layout { grid-template-columns: 1fr; }.map-panel { min-height: 360px; }.list-panel { max-height: none; }.filters { align-items: stretch; }.filters button { align-self: end; } }
    @media (max-width: 450px) { .filters { display: grid; grid-template-columns: 1fr 1fr; }.sport-filter input { min-width: 0; width: 100%; }.filters button { grid-column: 1 / -1; } }
  `]
})
export class CourtsPageComponent implements OnInit, OnDestroy {
  @ViewChild('courtMap') private courtMap?: CourtMapComponent;
  private readonly courtService = inject(CourtService);
  private readonly searches = new Subject<{ lat: number; lng: number; radiusKm: number; sport?: string }>();
  private readonly destroy$ = new Subject<void>();
  readonly radii = [1, 3, 5, 10, 25, 50];
  radiusKm = 5;
  sport = '';
  mapCenter: [number, number] = defaultCenter;
  courts: Court[] = [];
  selectedId: string | null = null;
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.searches.pipe(
      tap(() => { this.loading = true; this.errorMessage = ''; }),
      switchMap((search) => this.courtService.getNearby(search).pipe(
        map((courts): SearchState => ({ courts, loading: false, error: '' })),
        catchError((error: unknown) => of({ courts: this.courts, loading: false, error: this.describeError(error) })),
        startWith({ courts: this.courts, loading: true, error: '' })
      )),
      takeUntil(this.destroy$)
    ).subscribe((state) => {
      this.courts = state.courts;
      this.loading = state.loading;
      this.errorMessage = state.error;
      if (!state.loading && !state.error) this.selectedId = null;
    });
    this.locateAndSearch();
  }

  searchArea(): void { this.searchAt(this.mapCenter); }
  selectCourt(id: string): void { this.selectedId = id; }
  selectFromList(id: string): void { this.selectedId = id; this.courtMap?.focusCourt(id); }
  trackCourt(_index: number, court: Court): string { return court._id; }

  private locateAndSearch(): void {
    let finished = false;
    const fallback = (): void => { if (!finished) { finished = true; this.mapCenter = defaultCenter; this.searchAt(this.mapCenter); } };
    const timer = setTimeout(fallback, 3000);
    if (!navigator.geolocation) { clearTimeout(timer); fallback(); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.mapCenter = [position.coords.latitude, position.coords.longitude];
        this.searchAt(this.mapCenter);
      },
      () => { clearTimeout(timer); fallback(); },
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
    );
  }

  private searchAt(center: [number, number]): void {
    this.mapCenter = center;
    const sport = this.sport.trim();
    this.searches.next({ lat: center[0], lng: center[1], radiusKm: this.radiusKm, ...(sport ? { sport } : {}) });
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 502)) {
      return 'We could not reach the court service. Check your connection and try again.';
    }
    return 'We could not load courts right now. Please try again.';
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); this.searches.complete(); }
}

@Component({
  selector: 'app-court-detail-placeholder', standalone: true,
  template: '<section class="coming-soon"><h1>Court details coming soon</h1><p>Booking details for this court will be available here.</p></section>',
  styles: [`.coming-soon { margin: 3rem auto; max-width: 620px; padding: 2rem; border: 1px solid #e2e8f0; border-radius: 14px; background: white; color: #334155; } h1 { margin-top: 0; color: #0f172a; } p { color: #64748b; }`]
})
export class CourtDetailPlaceholderComponent {}
