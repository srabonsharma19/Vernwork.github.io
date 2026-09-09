import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-mainpage',
  standalone: true,
  imports: [CommonModule , RouterModule],
  templateUrl: './mainpage.component.html',
  styleUrls: ['./mainpage.component.scss']
})
export class MainpageComponent {

  berries = 780;

  // Two available profile pictures
  profileOptions: Record<string, string> = {
    pfp1: 'assets/profile1.jpg',
    pfp2: 'assets/profile2.jpg'
  };

  leftJobs = [
    {
      name: 'John Carter',
      username: 'johncarter', 
      title: 'Frontend Developer',
      description: 'Need a React developer for dashboard redesign.',
      budget: '$300',
      chosenPfp: 'pfp1'
    }
  ];

  rightJobs = [
    {
      name: 'Sara Kim',
      title: 'Content Writer',
      description: 'Write SEO articles for travel website.',
      budget: '$80',
      chosenPfp: 'pfp2'
    }
  ];

  // Convert chosen profile to actual image path
  getProfileImage(pfp: string) {
    return this.profileOptions[pfp];
  }

}
