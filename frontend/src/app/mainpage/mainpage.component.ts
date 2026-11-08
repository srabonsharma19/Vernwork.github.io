import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface MarketplaceJob {
  id: number;
  title: string;
  client: string;
  initials: string;
  category: string;
  description: string;
  budget: number;
  budgetType: 'Fixed price' | 'Hourly';
  skills: string[];
  posted: string;
  proposals: number;
  client_id?: number;
  client_avatar_url?: string | null;
}

type MarketplaceView = 'browse' | 'saved' | 'proposals';

@Component({
  selector: 'app-mainpage',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './mainpage.component.html',
  styleUrls: ['./mainpage.component.scss']
})
export class MainpageComponent implements OnInit {
  readonly categories = ['All work', 'Development', 'Design', 'Writing', 'Marketing'];
  readonly sampleJobs: MarketplaceJob[] = [
    { id: -1, title: 'Build a clean, responsive analytics dashboard', client: 'Northstar Studio', initials: 'NS', category: 'Development', description: 'We need a frontend partner to turn our product data into a fast, thoughtful dashboard. Figma screens and API documentation are ready.', budget: 1200, budgetType: 'Fixed price', skills: ['Angular', 'TypeScript', 'Charts'], posted: '2 hours ago', proposals: 8 },
    { id: -2, title: 'Brand identity for an independent coffee company', client: 'Common Grounds', initials: 'CG', category: 'Design', description: 'Create a warm, distinctive visual identity for a neighborhood coffee roaster launching online this spring.', budget: 45, budgetType: 'Hourly', skills: ['Branding', 'Illustrator', 'Packaging'], posted: '4 hours ago', proposals: 12 },
    { id: -3, title: 'Write five practical guides for first-time founders', client: 'Launchpad Media', initials: 'LM', category: 'Writing', description: 'Looking for a clear, research-minded writer who can make company formation and early hiring feel approachable.', budget: 650, budgetType: 'Fixed price', skills: ['Copywriting', 'Research', 'B2B'], posted: 'Yesterday', proposals: 17 },
    { id: -4, title: 'Improve the onboarding flow for a mobile app', client: 'Morrow Health', initials: 'MH', category: 'Design', description: 'Audit our current onboarding and design a concise, accessible flow that helps new members reach their first useful moment.', budget: 1800, budgetType: 'Fixed price', skills: ['Product design', 'Figma', 'UX research'], posted: 'Yesterday', proposals: 6 },
    { id: -5, title: 'Set up a reliable weekly newsletter program', client: 'Fieldnotes', initials: 'F', category: 'Marketing', description: 'Own the editorial calendar, newsletter setup, and first month of thoughtful audience growth for a small outdoor brand.', budget: 32, budgetType: 'Hourly', skills: ['Email marketing', 'Klaviyo', 'Analytics'], posted: '2 days ago', proposals: 21 },
    { id: -6, title: 'Connect a FastAPI service to a PostgreSQL database', client: 'Cedar Labs', initials: 'CL', category: 'Development', description: 'Help us finish our API data layer, add migrations, and document a straightforward Linux deployment.', budget: 950, budgetType: 'Fixed price', skills: ['Python', 'FastAPI', 'PostgreSQL'], posted: '2 days ago', proposals: 9 }
  ];
  jobs: MarketplaceJob[] = [...this.sampleJobs];
  loadingJobs = true;
  loadError = '';

  searchText = '';
  selectedCategory = this.categories[0];
  activeView: MarketplaceView = 'browse';
  savedJobIds = this.readNumberList('vernwork_saved_jobs');
  proposalJobIds = this.readNumberList('vernwork_proposals');
  modal: 'proposal' | 'job' | null = null;
  selectedJob: MarketplaceJob | null = null;
  proposalText = '';
  proposalRate: number | null = null;
  jobTitle = '';
  jobCategory = 'Development';
  jobBudget: number | null = null;
  jobDescription = '';
  postingJob = false;
  formError = '';
  notice = '';

  constructor(private router: Router, private http: HttpClient, private changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.http.get<MarketplaceJob[]>('/api/jobs').subscribe({
      next: (persistedJobs) => {
        this.jobs = [...persistedJobs, ...this.sampleJobs];
        this.loadingJobs = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.loadingJobs = false;
        this.loadError = 'Saved projects could not be loaded. Refresh to try again.';
        this.changeDetector.detectChanges();
      }
    });
  }

  get visibleJobs(): MarketplaceJob[] {
    const normalizedQuery = this.searchText.trim().toLowerCase();
    return this.jobs.filter((job) => {
      const matchesView = this.activeView === 'browse'
        || (this.activeView === 'saved' && this.savedJobIds.includes(job.id))
        || (this.activeView === 'proposals' && this.proposalJobIds.includes(job.id));
      const matchesCategory = this.selectedCategory === 'All work' || job.category === this.selectedCategory;
      const searchableText = `${job.title} ${job.client} ${job.description} ${job.skills.join(' ')}`.toLowerCase();
      return matchesView && matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }

  selectView(view: MarketplaceView): void {
    this.activeView = view;
    this.selectedCategory = this.categories[0];
    this.notice = '';
  }

  toggleSaved(job: MarketplaceJob): void {
    this.savedJobIds = this.savedJobIds.includes(job.id)
      ? this.savedJobIds.filter((id) => id !== job.id)
      : [...this.savedJobIds, job.id];
    localStorage.setItem('vernwork_saved_jobs', JSON.stringify(this.savedJobIds));
  }

  openProposal(job: MarketplaceJob): void {
    this.selectedJob = job;
    this.proposalText = '';
    this.proposalRate = job.budget;
    this.formError = '';
    this.modal = 'proposal';
  }

  submitProposal(): void {
    if (!this.selectedJob || this.proposalText.trim().length < 20 || !this.proposalRate || this.proposalRate <= 0) {
      this.formError = 'Add a proposal of at least 20 characters and a valid amount.';
      return;
    }
    if (!this.proposalJobIds.includes(this.selectedJob.id)) {
      this.proposalJobIds = [...this.proposalJobIds, this.selectedJob.id];
      localStorage.setItem('vernwork_proposals', JSON.stringify(this.proposalJobIds));
    }
    this.modal = null;
    this.notice = 'Proposal saved. You can review it in My proposals.';
  }

  openJobForm(): void {
    this.jobTitle = '';
    this.jobBudget = null;
    this.jobDescription = '';
    this.formError = '';
    this.modal = 'job';
  }

  publishJob(): void {
    if (this.jobTitle.trim().length < 8 || this.jobDescription.trim().length < 30 || !this.jobBudget || this.jobBudget <= 0) {
      this.formError = 'Add a title, at least 30 description characters, and a valid budget.';
      return;
    }
    this.formError = '';
    this.postingJob = true;
    this.http.post<MarketplaceJob>('/api/jobs', {
      title: this.jobTitle.trim(),
      category: this.jobCategory,
      description: this.jobDescription.trim(),
      budget: this.jobBudget
    }).subscribe({
      next: (job) => {
        this.jobs = [job, ...this.jobs];
        this.selectedCategory = 'All work';
        this.activeView = 'browse';
        this.searchText = '';
        this.modal = null;
        this.notice = 'Your project is published and saved.';
        this.postingJob = false;
        this.changeDetector.detectChanges();
      },
      error: (response) => {
        this.formError = response.error?.detail || 'Sign in before posting a project, then try again.';
        this.postingJob = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  closeModal(): void {
    this.modal = null;
    this.formError = '';
  }

  openProfile(): void {
    const userId = localStorage.getItem('vernwork_id');
    if (userId) {
      this.router.navigate(['/profile', userId]);
    } else {
      this.router.navigate(['/home']);
    }
  }

  private readNumberList(key: string): number[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];
    } catch {
      return [];
    }
  }

}
