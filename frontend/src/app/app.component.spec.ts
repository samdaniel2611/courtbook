import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [AppComponent], providers: [provideRouter([]), provideHttpClient()] }).compileComponents();
  });

  it('creates the app and shows account links when logged out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance).toBeTruthy();
    expect(compiled.textContent).toContain('CourtBook');
    expect(compiled.textContent).toContain('Login');
    expect(compiled.textContent).toContain('Register');
  });
});
