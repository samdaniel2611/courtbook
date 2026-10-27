import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, catchError, map, of, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { Court, CourtService } from '../court.service';
import { defaultCenter } from '../config';
import { CourtMapComponent } from './court-map.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BookingService, Booking, paiseToRupees } from '../booking.service';
import { PaymentService } from '../payment.service';
import { generateSlots, dateKeyInTimeZone, dateKeyAfterDays, Slot } from '../slot-utils';
import { venueTimeZone } from '../config';

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

@Component({ selector: 'app-court-detail', standalone: true, imports: [CommonModule, FormsModule, RouterLink, CourtMapComponent], template: `
<main class="detail"><a routerLink="/courts">← Courts</a><p *ngIf="loading">Loading court…</p><p *ngIf="error" role="alert" class="error">{{error}}</p>
<ng-container *ngIf="court"><header><span class="tag">{{court.sport}}</span><h1>{{court.name}}</h1><p>{{court.address}}</p></header><div class="map"><app-court-map [courts]="[court]" [center]="coordinates" [readOnly]="true" [zoom]="15"/></div>
<section class="panel"><h2>Choose a time</h2><label>Date <input type="date" [min]="today" [max]="lastDate" [(ngModel)]="date" (ngModelChange)="refreshSlots()"></label><p class="timezone-note">Times shown in {{timeZoneLabel}}</p><div class="slots"><button *ngFor="let slot of slots" type="button" [disabled]="slot.disabled || busy" [class.chosen]="selected === slot.startsAt" (click)="selected=slot.startsAt">{{slot.label}}</button></div>
<p class="deposit">Deposit: ₹{{deposit}}</p><button class="primary" [disabled]="!selected || busy" (click)="book()">{{busy ? 'Starting secure checkout…' : 'Book and pay deposit'}}</button><p *ngIf="message" role="status" class="message">{{message}} <button *ngIf="retry" (click)="retryPayment()">Try again</button></p></section></ng-container></main>`, styles: [`
    :host{display:block}.detail{max-width:900px;margin:2rem auto;padding:0 1rem 3rem;color:#0f172a}.detail>a{color:#0e7490;text-decoration:none;font-weight:650}header{padding:1.2rem 0}.tag{color:#0e7490;text-transform:capitalize;font-weight:700}h1{margin:.35rem 0;font-size:clamp(1.8rem,5vw,2.5rem)}header p{color:#64748b;margin:0}.map{height:250px;border-radius:12px;overflow:hidden}.map app-court-map{height:250px}.map ::ng-deep .map{min-height:250px!important}.panel{margin-top:1rem;padding:1.25rem;background:white;border:1px solid #e2e8f0;border-radius:14px}.panel h2{margin:0 0 1rem}.panel label{display:grid;gap:.4rem;font-weight:650;font-size:.85rem}.panel input{max-width:260px;padding:.65rem;border:1px solid #cbd5e1;border-radius:7px;font:inherit}.timezone-note{margin:.5rem 0;color:#64748b;font-size:.83rem}.slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:.5rem;margin:1rem 0}.slots button{padding:.65rem .35rem;background:white;border:1px solid #cbd5e1;border-radius:7px;color:#334155;cursor:pointer}.slots button.chosen{background:#155e75;color:#fff;border-color:#155e75}.slots button:disabled{opacity:.4;cursor:not-allowed}.deposit{font-weight:700}.primary{padding:.8rem 1rem;border:0;border-radius:8px;background:#155e75;color:white;font:inherit;font-weight:700;cursor:pointer}.primary:disabled{opacity:.55}.message{color:#334155}.error{color:#9f3127}@media(max-width:480px){.detail{margin-top:1.3rem}.map{height:210px}.map app-court-map{height:210px}.slots{grid-template-columns:repeat(3,1fr)}}
`] })
export class CourtDetailComponent implements OnInit, OnDestroy {
  private readonly route=inject(ActivatedRoute); private readonly router=inject(Router); private readonly courts=inject(CourtService); private readonly bookings=inject(BookingService); private readonly payment=inject(PaymentService);
  court?:Court; coordinates:[number,number]=defaultCenter; loading=true; error=''; busy=false; message=''; retry=false; booking?:Booking; selected=''; readonly timeZone=venueTimeZone; today=dateKeyInTimeZone(new Date(),venueTimeZone); lastDate=dateKeyAfterDays(this.today,14); date=this.today; slots:Slot[]=[]; deposit=paiseToRupees(5000); timeZoneLabel=new Intl.DateTimeFormat(undefined,{timeZone:venueTimeZone,timeZoneName:'long'}).formatToParts(new Date()).find(part=>part.type==='timeZoneName')?.value??venueTimeZone;
  ngOnInit():void { this.refreshSlots(); const id=this.route.snapshot.paramMap.get('id')??''; this.courts.getCourt(id).subscribe({next:c=>{this.court=c;this.coordinates=c.location?.coordinates?[c.location.coordinates[1],c.location.coordinates[0]]:[c.lat,c.lng];this.loading=false;},error:e=>{this.loading=false;this.error=e.status===404?'This court could not be found.':'We could not load this court right now. Please try again.';}}); }
  refreshSlots():void {this.slots=generateSlots(this.date,this.timeZone,new Date());this.selected='';}
  book():void {if(!this.court||!this.selected)return;this.busy=true;this.message='';this.bookings.create(this.court._id,this.selected).subscribe({next:b=>{this.booking=b;this.payBooking();},error:e=>{this.busy=false;this.message=e.status===409?'That slot was just taken, please pick another':e.status===404?'This court is no longer available.':e.status>=500?'Booking is temporarily unavailable. Please try again.':'Please choose a valid future time.';}});}
  retryPayment():void {if(this.booking)this.payBooking();}
  private payBooking():void {if(!this.booking)return;this.busy=true;this.bookings.pay(this.booking._id).subscribe({next:order=>{void this.payment.open(order,()=>{this.busy=false;void this.router.navigate(['/bookings',this.booking?._id]);},()=>{this.busy=false;this.message='Payment not completed';this.retry=true;}).catch(()=>{this.busy=false;this.message='Secure checkout could not be opened. Please try again.';});},error:e=>{this.busy=false;this.message=e.status===404?'Booking not found.':e.status===409?'This booking is no longer pending.':'Payment service is temporarily unavailable. Please try again.';this.retry=!!this.booking;}});}
  ngOnDestroy():void{}
}
