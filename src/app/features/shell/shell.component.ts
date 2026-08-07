import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SalesStateService } from '../../sales-state.service';
import { AuthService } from '../../auth/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { ToastContainerComponent } from '../../shared/toast.component';
import { AiChatbotComponent } from '../ai/ai-chatbot.component';

interface NavItem  { path: string; label: string; icon: string }
interface NavGroup { id: string; label: string; items: NavItem[]; adminOnly?: boolean }

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'commerciale', label: 'Commerciale',
    items: [
      { path: 'chiamate', label: 'Chiamate', icon: 'phone' },
      { path: 'leads', label: 'Lead', icon: 'target' },
      { path: 'clienti', label: 'Vendite', icon: 'users' },
    ],
  },
  {
    id: 'finanza', label: 'Finanza',
    items: [
      { path: 'provvigioni', label: 'Provvigioni', icon: 'chart' },
      { path: 'rendicontazioni', label: 'Rendicontazioni', icon: 'receipt' },
    ],
  },
  {
    id: 'strumenti', label: 'Strumenti',
    items: [
      { path: 'catalogo', label: 'Link pagamento', icon: 'card' },
      { path: 'task-tracker', label: 'Task Tracker', icon: 'checkSquare' },
    ],
  },
  {
    id: 'formazione', label: 'Formazione',
    items: [], // pronto per Tutorial, Guide, ecc.
  },
  {
    id: 'amministrazione', label: 'Amministrazione', adminOnly: true,
    items: [
      { path: 'dashboard', label: 'Dashboard', icon: 'home' },
      { path: 'commesse', label: 'Commesse', icon: 'edit' },
      { path: 'customers', label: 'Clienti', icon: 'users' },
      { path: 'onboarding', label: 'Onboarding', icon: 'send' },
      { path: 'team', label: 'Team', icon: 'users' },
      { path: 'bot-log', label: 'Attività Bot', icon: 'activity' },
    ],
  },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AvatarComponent, ToastContainerComponent, AiChatbotComponent],
  templateUrl: './shell.component.html',
  host: { style: 'display:block;height:100%' },
})
export class ShellComponent {
  readonly state = inject(SalesStateService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly dropdownOpen = signal(false);
  readonly moreSheetOpen = signal(false);

  private readonly _collapsed = signal<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('nav-collapsed') ?? '[]') as string[]),
  );

  readonly visibleGroups = computed(() => {
    const isAdmin = this.auth.currentUser()?.role === 'admin';
    return NAV_GROUPS.filter(g => (!g.adminOnly || isAdmin) && g.items.length > 0);
  });

  readonly allNavItems = computed(() => this.visibleGroups().flatMap(g => g.items));
  readonly primaryMobileItems = computed(() => this.allNavItems().slice(0, 4));

  readonly userRoleLabel = computed(() => {
    const role = this.auth.currentUser()?.role ?? '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly currentPageLabel = computed(() => {
    const url = this.currentUrl();
    return this.allNavItems().find(n => url.includes(n.path))?.label ?? 'Chiamate';
  });

  isCollapsed(id: string): boolean { return this._collapsed().has(id); }

  toggleGroup(id: string): void {
    this._collapsed.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('nav-collapsed', JSON.stringify([...next]));
      return next;
    });
  }

  toggleDropdown(): void { this.dropdownOpen.update(v => !v); }
  closeDropdown(): void { this.dropdownOpen.set(false); }

  constructor() {
    effect(() => {
      document.documentElement.style.setProperty('--accent', this.state.accent());
    });
  }
}
