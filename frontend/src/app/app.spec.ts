import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/access/status').flush({ pin_required: false, unlocked: true, authenticated: false });
    http.verify();
  });

  it('should show the access PIN form while locked', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/access/status').flush({ pin_required: false, unlocked: false, authenticated: false });
    fixture.componentInstance.accessChecked = true;
    fixture.componentInstance.pinRequired = true;
    fixture.componentInstance.unlocked = false;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#access-pin')).toBeTruthy();
    http.verify();
  });
});
