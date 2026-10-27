import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthPageComponent } from './pages/auth-page.component';
import { CourtDetailComponent, CourtsPageComponent } from './pages/courts-page.component';
import { BookingResultComponent } from './pages/booking-result.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'courts' },
  { path: 'login', component: AuthPageComponent, data: { mode: 'login' } },
  { path: 'register', component: AuthPageComponent, data: { mode: 'register' } },
  { path: 'courts', component: CourtsPageComponent, canActivate: [authGuard] },
  { path: 'courts/:id', component: CourtDetailComponent, canActivate: [authGuard] },
  { path: 'bookings/:id', component: BookingResultComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'courts' }
];
