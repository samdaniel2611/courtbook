import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { apiBaseUrl } from './config';

function tokenWithExpiry(exp: number): string {
  const payload = btoa(JSON.stringify({ exp })).replace(/=/g, '');
  return `header.${payload}.signature`;
}

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); localStorage.clear(); });

  it('stores the token returned from login', () => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600);
    auth.login('player@example.com', 'password123').subscribe();
    const request = http.expectOne(`${apiBaseUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    request.flush({ token });
    expect(localStorage.getItem('courtbook_token')).toBe(token);
    expect(auth.isLoggedIn()).toBeTrue();
  });

  it('clears the token on logout', () => {
    localStorage.setItem('courtbook_token', tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600));
    auth.logout();
    expect(localStorage.getItem('courtbook_token')).toBeNull();
    expect(auth.isLoggedIn()).toBeFalse();
  });

  it('treats an expired token as logged out', () => {
    localStorage.setItem('courtbook_token', tokenWithExpiry(Math.floor(Date.now() / 1000) - 60));
    expect(auth.getToken()).toBeNull();
    expect(auth.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem('courtbook_token')).toBeNull();
  });
});
