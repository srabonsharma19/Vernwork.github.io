import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

interface EditableProfile {
  username: string;
  full_name: string | null;
  email: string;
  location: string;
  country: string;
  student_status: string;
  experience_level: string;
  schedule_preference: string;
  social_platform: string;
  program_type: string;
  availability: string;
  has_password: boolean;
  google_linked: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  profile: EditableProfile = {
    username: '', full_name: '', email: '', location: '', country: '', student_status: '', experience_level: '',
    schedule_preference: '', social_platform: '', program_type: '', availability: '', has_password: false, google_linked: false
  };
  loading = true;
  saving = false;
  message = '';
  error = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordMessage = '';
  passwordError = '';
  savingPassword = false;
  loadFailed = false;

  constructor(private http: HttpClient, private changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.http.get<EditableProfile>('/api/users/me').subscribe({
      next: (profile) => {
        this.profile = { ...this.profile, ...profile };
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
        this.error = 'Sign in to view and update your settings.';
        this.changeDetector.detectChanges();
      }
    });
  }

  save(): void {
    this.saving = true;
    this.message = '';
    this.error = '';
    this.http.put<EditableProfile>('/api/users/me', this.profile).subscribe({
      next: (profile) => {
        this.profile = { ...this.profile, ...profile };
        this.saving = false;
        this.message = 'Your profile settings have been saved.';
        this.changeDetector.detectChanges();
      },
      error: (response) => {
        this.saving = false;
        this.error = response.error?.detail || 'We could not save your profile. Please try again.';
        this.changeDetector.detectChanges();
      }
    });
  }

  savePassword(): void {
    this.passwordError = '';
    this.passwordMessage = '';
    if (this.newPassword.length < 10) {
      this.passwordError = 'Use at least 10 characters for your password.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'The new password and confirmation do not match.';
      return;
    }

    this.savingPassword = true;
    this.http.put<{ message: string }>('/api/users/me/password', {
      current_password: this.currentPassword || null,
      new_password: this.newPassword
    }).subscribe({
      next: (result) => {
        this.savingPassword = false;
        this.profile.has_password = true;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordMessage = result.message;
        this.changeDetector.detectChanges();
      },
      error: (response) => {
        this.savingPassword = false;
        this.passwordError = response.error?.detail || 'We could not save your password.';
        this.changeDetector.detectChanges();
      }
    });
  }

  signOut(): void {
    this.http.post('/api/auth/logout', {}).subscribe({
      next: () => this.finishSignOut(),
      error: () => this.finishSignOut()
    });
  }

  private finishSignOut(): void {
    localStorage.removeItem('vernwork_id');
    window.location.assign('/');
  }
}