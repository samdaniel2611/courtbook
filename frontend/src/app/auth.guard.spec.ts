import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

function tokenWithExpiry(exp: number): string {
  return `header.${btoa(JSON.stringify({ exp })).replace(/=/g, '')}.signature`;
}

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  });

  afterEach(() => localStorage.clear());

  it('redirects to login when there is no valid token', () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('allows access with a valid token', () => {
    localStorage.setItem('courtbook_token', tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600));
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBeTrue();
    expect(TestBed.inject(AuthService).isLoggedIn()).toBeTrue();
  });
});
