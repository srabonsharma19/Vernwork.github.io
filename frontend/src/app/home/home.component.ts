import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

declare const google: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  currentSlide = 1;
  totalSlides = 8;

  username = '';
  password = '';

  selectedCountry = '';
  selectedStatus = '';
  selectedExperience = '';
  selectedSchedule = '';

  googleConnected = false;
  showError = false;

  private googleInitialized = false;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  /* -----------------------------------------
     INITIALIZATION
     ----------------------------------------- */
  ngOnInit() {
    const id = localStorage.getItem('vernwork_id');
    if (id) {
      this.router.navigate(['/profile', id]);
      return;
    }

    this.initializeGoogleSignIn();
  }

  /* -----------------------------------------
     GOOGLE INIT
     ----------------------------------------- */
  private initializeGoogleSignIn() {
    if (this.googleInitialized) return;

    if (typeof google === 'undefined' || !google.accounts?.id) {
      console.error('Google Identity Services library is not loaded.');
      return;
    }

    try {
      google.accounts.id.initialize({
        client_id: '154910487693-f8ma15lghaons0s39uugqb147lnka5rd.apps.googleusercontent.com',
        callback: (response: any) => this.handleGoogleLogin(response),
        ux_mode: 'popup',
        auto_select: false,
        itp_support: true
      });

      this.googleInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Sign-In:', error);
    }
  }

  /* -----------------------------------------
     SLIDE NAVIGATION
     ----------------------------------------- */
  updateProgress() {
    return (this.currentSlide / this.totalSlides) * 100;
  }

  nextSlide() {
    this.currentSlide++;
  }

  selectCard() {
    setTimeout(() => this.nextSlide(), 300);
  }

  /* -----------------------------------------
     AUTH NAVIGATION
     ----------------------------------------- */
  handleForgotPassword() {
    this.router.navigate(['/forgot']);
  }

  handleLoginRedirect() {
    this.router.navigate(['/login']);
  }

  /* -----------------------------------------
     CREATE ACCOUNT (Google + Slide 1)
     ----------------------------------------- */
  createAccount() {

    // FIRST PRESS → Google login
    if (!this.googleConnected) {
      try {
        let googleButtonDiv = document.getElementById('google-oauth-popup-button');

        if (!googleButtonDiv) {
          googleButtonDiv = document.createElement('div');
          googleButtonDiv.id = 'google-oauth-popup-button';
          googleButtonDiv.style.display = 'none';
          document.body.appendChild(googleButtonDiv);
        }

        google.accounts.id.renderButton(googleButtonDiv, {
          theme: 'outline',
          size: 'large',
          text: 'signup_with',
          locale: 'en'
        });

        const oauthButton = googleButtonDiv.querySelector('[role="button"]') as HTMLElement;

        if (oauthButton) {
          oauthButton.click();
        }
      } catch (error) {
        alert('Google Sign-In failed. Please try again.');
      }

      return;
    }

    // SECOND PRESS → Validate username/password only
    if (!this.username || !this.password) {
      this.showError = true;
      return;
    }

    // Move to slide 2
    this.nextSlide();
  }

  /* -----------------------------------------
     FINAL SAVE AFTER SLIDE 8
     ----------------------------------------- */
  finishOnboarding() {

    if (!this.selectedCountry ||
        !this.selectedStatus ||
        !this.selectedExperience ||
        !this.selectedSchedule) {

      this.showError = true;
      return;
    }

    const id = localStorage.getItem("vernwork_id");

    this.http.post("http://localhost:8000/api/auth/update-profile", {
      id: id,
      username: this.username,
      password: this.password,
      country: this.selectedCountry,
      student_status: this.selectedStatus,
      experience_level: this.selectedExperience,
      schedule_preference: this.selectedSchedule
    }).subscribe(res => {
      console.log('Profile updated:', res);
      this.router.navigate(['/main']);
    });
  }

  /* -----------------------------------------
     GOOGLE LOGIN CALLBACK
     ----------------------------------------- */
  handleGoogleLogin(response: any) {
    if (!response?.credential) return;

    const decoded = JSON.parse(atob(response.credential.split('.')[1]));
    const email = decoded.email;

    this.loginWithGoogle(email);

    this.googleConnected = true;

    // Stay on slide 1 until username/password are filled
  }

  /* -----------------------------------------
     BACKEND LOGIN CALL
     ----------------------------------------- */
  loginWithGoogle(email: string) {
    this.http.post('http://localhost:8000/api/auth/connect', {
      email: email,
      provider: 'google'
    }).subscribe((res: any) => {

      localStorage.setItem('vernwork_id', res.id);

      // User stays on slide 1 to complete username/password
    });
  }
}
