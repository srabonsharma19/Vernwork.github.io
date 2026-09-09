import { Routes } from '@angular/router';

import { DashboardComponent } from './pages/Dashboard/Dashboard.component';
import { HomeComponent } from './home/home.component';
import { MainpageComponent } from './mainpage/mainpage.component';
import { ProfileComponent } from './profile/profile.component';

export const routes: Routes = [
  // Default page → opens Mainpage first
  { path: '', redirectTo: 'main', pathMatch: 'full' },

  // Main page
  { path: 'main', component: MainpageComponent },

  // Dashboard page
  { path: 'dashboard', component: DashboardComponent },

  // Home page
  { path: 'home', component: HomeComponent },

  // ⭐ Profile page (name is passed from routerLink)
  { path: 'profile/:name', component: ProfileComponent }
];
