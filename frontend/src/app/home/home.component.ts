import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
          renderButton(element: HTMLElement, config: { theme: string; size: string; text: string; shape: string }): void;
        };
      };
    };
  }
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements AfterViewInit {
  @ViewChild('googleButton') private googleButton?: ElementRef<HTMLDivElement>;

  mode: 'login' | 'register' = 'register';
  username = '';
  identity = '';
  email = '';
  password = '';
  busy = false;
  errorMessage = '';
  private googleReady = false;

  constructor(private http: HttpClient, private router: Router) {}

  ngAfterViewInit(): void {
    this.loadGoogleIdentity();
  }

  setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.errorMessage = '';
    this.password = '';
  }

  submit(): void {
    this.errorMessage = '';
    const normalizedEmail = this.email.trim();
    const normalizedUsername = this.username.trim();
    const normalizedIdentity = this.identity.trim();

    if (this.mode === 'register' && !/^[a-zA-Z0-9_.-]{3,40}$/.test(normalizedUsername)) {
      this.errorMessage = 'Username must be 3-40 characters and use only letters, numbers, dots, hyphens, or underscores.';
      return;
    }
    if (this.mode === 'register' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      this.errorMessage = 'Enter a valid email address.';
      return;
    }
    if (this.mode === 'login' && !normalizedIdentity) {
      this.errorMessage = 'Enter your username or email address.';
      return;
    }
    if (this.password.length < (this.mode === 'register' ? 10 : 1)) {
      this.errorMessage = this.mode === 'register'
        ? 'Password must be at least 10 characters.'
        : 'Enter your password.';
      return;
    }
    if (new TextEncoder().encode(this.password).length > 72) {
      this.errorMessage = 'Password must be no more than 72 bytes.';
      return;
    }

    this.busy = true;
    const url = this.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = this.mode === 'register'
      ? { username: normalizedUsername, email: normalizedEmail, password: this.password }
      : { identity: normalizedIdentity, password: this.password };

    this.http.post<{ id: number }>(url, payload).subscribe({
      next: (account) => this.finishSignIn(account.id),
      error: (error) => {
        this.busy = false;
        this.errorMessage = error.error?.detail || 'We could not sign you in. Check your details and try again.';
      }
    });
  }

  private loadGoogleIdentity(): void {
    const clientId = document.querySelector<HTMLMetaElement>('meta[name="google-client-id"]')?.content.trim();
    if (!clientId || !this.googleButton) return;

    const render = () => {
      if (this.googleReady || !window.google?.accounts.id || !this.googleButton) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => this.completeGoogleSignIn(response)
      });
      window.google.accounts.id.renderButton(this.googleButton.nativeElement, {
        theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular'
      });
      this.googleReady = true;
    };

    if (window.google?.accounts.id) {
      render();
      return;
    }

    const script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (script) {
      script.addEventListener('load', render, { once: true });
      return;
    }

    const identityScript = document.createElement('script');
    identityScript.src = 'https://accounts.google.com/gsi/client';
    identityScript.async = true;
    identityScript.defer = true;
    identityScript.dataset['googleIdentity'] = 'true';
    identityScript.addEventListener('load', render, { once: true });
    identityScript.addEventListener('error', () => {
      this.errorMessage = 'Google sign-in could not load. Use email and password or check the network.';
    }, { once: true });
    document.head.appendChild(identityScript);
  }

  private completeGoogleSignIn(response: GoogleCredentialResponse): void {
    this.busy = true;
    this.errorMessage = '';
    this.http.post<{ id: number }>('/api/auth/google', { credential: response.credential }).subscribe({
      next: (account) => this.finishSignIn(account.id),
      error: (error) => {
        this.busy = false;
        this.errorMessage = error.error?.detail || 'Google sign-in could not be verified.';
      }
    });
  }

  private finishSignIn(userId: number): void {
    localStorage.setItem('vernwork_id', String(userId));
    this.router.navigate(['/main']);
  }
}