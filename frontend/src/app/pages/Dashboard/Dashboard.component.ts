import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './Dashboard.component.html',
  styleUrls: ['./Dashboard.component.scss']
})
export class DashboardComponent {

  constructor(private router: Router) {}

  goHome() {
    this.router.navigate(['/home']);
  }
}

