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
import { VoiceRecorderComponent } from '../calls/voice-recorder.component';

interface NavItem  { path: string; label: string; icon: string; adminOnly?: boolean; clientOnly?: boolean; hideFromClient?: boolean }
interface NavGroup { id: string; label: string; items: NavItem[]; adminOnly?: boolean; clientOnly?: boolean; hideFromClient?: boolean }

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'cliente', label: 'La mia area', clientOnly: true,
    items: [
      { path: 'area-cliente', label: 'Dashboard', icon: 'home', clientOnly: true },
      { path: 'area-cliente/leads', label: 'Lead', icon: 'phone', clientOnly: true },
      { path: 'area-cliente/vendite', label: 'Vendite', icon: 'users', clientOnly: true },
    ],
  },
  {
    id: 'commerciale', label: 'Commerciale', hideFromClient: true,
    items: [
      { path: 'chiamate', label: 'Chiamate', icon: 'phone' },
      { path: 'clienti', label: 'Vendite', icon: 'users' },
      { path: 'leads', label: 'Lead', icon: 'target', adminOnly: true },
    ],
  },
  {
    id: 'finanza', label: 'Finanza', hideFromClient: true,
    items: [
      { path: 'provvigioni', label: 'Provvigioni', icon: 'chart' },
      { path: 'rendicontazioni', label: 'Rendicontazioni', icon: 'receipt' },
    ],
  },
  {
    id: 'strumenti', label: 'Strumenti', hideFromClient: true,
    items: [
      { path: 'catalogo', label: 'Link pagamento', icon: 'card' },
      // TODO: implementare Task Tracker
      // { path: 'task-tracker', label: 'Task Tracker', icon: 'checkSquare' },
    ],
  },
  {
    id: 'formazione', label: 'Formazione', hideFromClient: true,
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
      // TODO: implementare Bot AI
      // { path: 'bot-log', label: 'Attività Bot', icon: 'activity' },
    ],
  },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AvatarComponent, ToastContainerComponent, AiChatbotComponent, VoiceRecorderComponent],
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
    const role = this.auth.currentUser()?.role;
    const isAdmin = role === 'admin';
    const isClient = role === 'client';
    return NAV_GROUPS
      .map(g => ({ ...g, items: g.items.filter(i => (!i.adminOnly || isAdmin) && (!i.clientOnly || isClient)) }))
      .filter(g =>
        (!g.adminOnly || isAdmin) &&
        (!g.clientOnly || isClient) &&
        (!g.hideFromClient || !isClient) &&
        g.items.length > 0,
      );
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
