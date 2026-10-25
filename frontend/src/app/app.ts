import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  accessChecked = false;
  pinRequired = true;
  unlocked = false;
  pin = '';
  busy = false;
  accessError = '';

  constructor(private http: HttpClient, private changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.http.get<{ pin_required: boolean; unlocked: boolean }>('/api/access/status').subscribe({
      next: (status) => {
        this.pinRequired = status.pin_required;
        this.unlocked = status.unlocked || !status.pin_required;
        this.accessChecked = true;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.accessChecked = true;
        this.accessError = 'The Vernwork API is not reachable. Start the API service and reload this page.';
        this.changeDetector.detectChanges();
      }
    });
  }

  unlock(): void {
    this.accessError = '';
    this.busy = true;
    this.http.post('/api/access/unlock', { pin: this.pin }).subscribe({
      next: () => {
        this.unlocked = true;
        this.busy = false;
        this.pin = '';
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.busy = false;
        this.accessError = error.error?.detail || 'The access PIN was rejected.';
        this.changeDetector.detectChanges();
      }
    });
  }
}
