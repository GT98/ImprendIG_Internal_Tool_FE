import { Component, computed, effect, inject } from '@angular/core';
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

const BASE_NAV = [
  { path: 'chiamate', label: 'Chiamate', icon: 'phone' },
  { path: 'provvigioni', label: 'Provvigioni', icon: 'chart' },
  { path: 'clienti', label: 'Vendite', icon: 'users' },
  { path: 'catalogo', label: 'Catalogo', icon: 'grid' },
];
const ADMIN_NAV = [
  { path: 'dashboard', label: 'Dashboard', icon: 'home' },
  ...BASE_NAV,
  { path: 'team', label: 'Team', icon: 'users' },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AvatarComponent, ToastContainerComponent],
  templateUrl: './shell.component.html',
  host: { style: 'display:block;height:100%' },
})
export class ShellComponent {
  readonly state = inject(SalesStateService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly nav = computed(() =>
    this.auth.currentUser()?.role === 'admin' ? ADMIN_NAV : BASE_NAV
  );

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly currentPageLabel = computed(() => {
    const url = this.currentUrl();
    return this.nav().find(n => url.includes(n.path))?.label ?? 'Chiamate';
  });

  constructor() {
    effect(() => {
      document.documentElement.style.setProperty('--accent', this.state.accent());
    });
  }
}
