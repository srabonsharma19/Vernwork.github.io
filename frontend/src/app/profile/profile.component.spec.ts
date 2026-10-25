import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  it('renders a public profile without exposing an email field', async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.componentInstance.userId = 9;
    fixture.componentInstance.userJson = {
      id: 9,
      username: 'sam-dev',
      full_name: 'Sam Developer',
      avatar_url: 'https://example.com/sam.jpg',
      provider: 'google',
      created_at: '2025-01-01T00:00:00Z',
      location: 'Toronto',
      country: 'Canada'
    };
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Sam Developer');
    expect(page.querySelector('img.avatar-photo')?.getAttribute('src')).toBe('https://example.com/sam.jpg');
    expect(page.textContent).toContain('Toronto');
    expect(page.textContent).not.toContain('Email');
  });
});