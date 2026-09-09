import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { JsonPipe } from '@angular/common';   // ⭐ IMPORTANT

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [JsonPipe],   // ⭐ Add JsonPipe here
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {

  name: string | null = null;
  userJson: any = {};   // Stores full user data

  constructor(private route: ActivatedRoute, private http: HttpClient) {

    // Get the name from the URL
    this.name = this.route.snapshot.paramMap.get('name');

    // Fetch user data from backend
    this.http.get(`http://localhost:8000/user/${this.name}`).subscribe(data => {
      this.userJson = data;
      console.log("Fetched user:", this.userJson);
    });
  }
}

