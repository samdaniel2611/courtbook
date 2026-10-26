import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { apiBaseUrl } from './config';

interface AuthResponse {
  token?: string;
  accessToken?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'courtbook_token';
  readonly isLoggedIn = signal(this.hasValidToken());

  constructor(private readonly http: HttpClient) {}

  register(email: string, password: string): Observable<unknown> {
    return this.http.post(`${apiBaseUrl}/auth/register`, { email, password });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${apiBaseUrl}/auth/login`, { email, password }).pipe(
      tap((response) => {
        const token = response.token ?? response.accessToken;
        if (token) {
          localStorage.setItem(this.storageKey, token);
          this.isLoggedIn.set(this.isTokenValid(token));
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.isLoggedIn.set(false);
  }

  getToken(): string | null {
    const token = localStorage.getItem(this.storageKey);
    if (!token || !this.isTokenValid(token)) {
      if (token) this.logout();
      return null;
    }
    return token;
  }

  private hasValidToken(): boolean {
    const token = localStorage.getItem(this.storageKey);
    return !!token && this.isTokenValid(token);
  }

  private isTokenValid(token: string): boolean {
    try {
      const payload = token.split('.')[1];
      if (!payload) return false;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(normalized)) as { exp?: number };
      return typeof claims.exp === 'number' && claims.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
