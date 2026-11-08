import { Routes } from '@angular/router';

import { DashboardComponent } from './pages/Dashboard/Dashboard.component';
import { HomeComponent } from './home/home.component';
import { MainpageComponent } from './mainpage/mainpage.component';
import { ProfileComponent } from './profile/profile.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  // Default page → opens Mainpage first
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Main page
  { path: 'main', component: MainpageComponent },

  // Dashboard page
  { path: 'dashboard', component: DashboardComponent },

  // Home page
  { path: 'home', component: HomeComponent },

  // Profile page uses the user id so the backend can load the correct record
  { path: 'profile/:id', component: ProfileComponent },
  { path: 'settings', component: SettingsComponent }
];
