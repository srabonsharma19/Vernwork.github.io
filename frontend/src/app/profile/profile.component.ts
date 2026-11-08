import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  name: string | null = null;
  userId: number | null = null;
  userJson: any = {};
  loadError = '';

  constructor(private route: ActivatedRoute, private http: HttpClient, private changeDetector: ChangeDetectorRef) {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.userId = idParam ? Number(idParam) : null;
    this.name = this.route.snapshot.paramMap.get('name');

    const targetId = this.userId ?? Number(this.name);

    if (!Number.isNaN(targetId) && targetId > 0) {
      const profileRequest = localStorage.getItem('vernwork_id') === String(targetId)
        ? this.http.get('/api/users/me')
        : this.http.get(`/api/users/${targetId}`);
      profileRequest.subscribe({
        next: (data) => {
          this.userJson = data;
          this.changeDetector.detectChanges();
        },
        error: () => {
          this.loadError = 'This profile could not be loaded.';
          this.changeDetector.detectChanges();
        }
      });
    } else {
      this.loadError = 'This profile link is invalid.';
    }
  }

  get displayName(): string {
    return this.userJson?.full_name || this.userJson?.username || this.name || 'User profile';
  }

  get createdAt(): string {
    return this.userJson?.created_at ? new Date(this.userJson.created_at).toLocaleDateString() : 'Not available';
  }
}

