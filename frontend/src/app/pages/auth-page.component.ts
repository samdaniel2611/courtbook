import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-auth-page', standalone: true, imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-card">
      <h1>{{ isRegister ? 'Create your account' : 'Welcome back' }}</h1>
      <p class="intro">{{ isRegister ? 'Register to continue to CourtBook.' : 'Log in to continue to CourtBook.' }}</p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label for="email">Email</label><input id="email" type="email" formControlName="email" autocomplete="email" />
        <small *ngIf="form.controls.email.touched && form.controls.email.invalid">Enter a valid email address.</small>
        <label for="password">Password</label><input id="password" type="password" formControlName="password" [attr.autocomplete]="isRegister ? 'new-password' : 'current-password'" />
        <small *ngIf="form.controls.password.touched && form.controls.password.invalid">Password must be at least 8 characters.</small>
        <p class="error" role="alert" *ngIf="errorMessage">{{ errorMessage }}</p>
        <button type="submit" [disabled]="form.invalid || submitting">{{ submitting ? 'Please wait…' : (isRegister ? 'Register' : 'Log in') }}</button>
      </form>
      <p class="switch">{{ isRegister ? 'Already have an account?' : 'New to CourtBook?' }} <a [routerLink]="isRegister ? '/login' : '/register'">{{ isRegister ? 'Log in' : 'Register' }}</a></p>
    </section>
  `,
  styles: [`
    .auth-card { width: min(100%, 420px); margin: 3rem auto; padding: 2rem; background: white; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 32px #0f172a0b; }
    h1 { margin: 0 0 .5rem; font-size: 1.6rem; } .intro, .switch { color: #64748b; }
    form { display: grid; gap: .55rem; margin-top: 1.5rem; } label { margin-top: .5rem; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; padding: .75rem; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
    small, .error { color: #b42318; } .error { margin: .4rem 0; }
    button { margin-top: .7rem; padding: .8rem; border: 0; border-radius: 8px; background: #155e75; color: white; font: inherit; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: .6; cursor: not-allowed; } .switch { margin: 1.4rem 0 0; } a { color: #0e7490; font-weight: 600; }
  `]
})
export class AuthPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly isRegister = inject(ActivatedRoute).snapshot.data['mode'] === 'register';
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });
  errorMessage = '';
  submitting = false;

  submit(): void {
    if (this.form.invalid || this.submitting) return;
    this.errorMessage = '';
    this.submitting = true;
    const { email, password } = this.form.getRawValue();
    const request = this.isRegister ? this.auth.register(email, password) : this.auth.login(email, password);
    request.subscribe({
      next: () => {
        this.submitting = false;
        if (this.isRegister) void this.router.navigate(['/login']);
        else void this.router.navigate(['/courts']);
      },
      error: (error: unknown) => { this.submitting = false; this.errorMessage = this.describeError(error); }
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown } | null;
      if (typeof body?.message === 'string' && body.message.trim()) return body.message;
      if (error.status === 401) return 'The email or password is incorrect.';
      if (error.status === 409) return 'An account with this email already exists.';
      if (error.status === 0) return 'Could not reach CourtBook. Check your connection and try again.';
      return 'We could not complete your request. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
