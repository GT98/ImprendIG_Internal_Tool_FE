import { Injectable, signal, computed } from '@angular/core';
import { SELLERS, ADMIN, CALLS } from './mock-data';
import { ChartType, Layout, NavRoute, Role, Seller } from './models';

@Injectable({ providedIn: 'root' })
export class SalesStateService {
  readonly role = signal<Role>('venditore');
  readonly sellerId = signal<string>('marco');
  readonly teamFilter = signal<string>('team');
  readonly layout = signal<Layout>('lista');
  readonly chartType = signal<ChartType>('donut');
  readonly accent = signal<string>('#4f46e5');
  readonly route = signal<NavRoute>('chiamate');

  readonly sellers = SELLERS;
  readonly admin = ADMIN;

  readonly isAdmin = computed(() => this.role() === 'admin');

  readonly sellersById = computed<Record<string, Seller>>(() =>
    Object.fromEntries(SELLERS.map(s => [s.id, s]))
  );

  readonly currentUser = computed<Seller>(() =>
    this.isAdmin() ? ADMIN : this.sellersById()[this.sellerId()]
  );

  readonly scope = computed(() => this.isAdmin() ? this.teamFilter() : this.sellerId());

  private filterBy<T extends { sellerId: string }>(arr: T[]): T[] {
    const scope = this.scope();
    return scope === 'team' ? arr : arr.filter(x => x.sellerId === scope);
  }

  readonly calls = computed(() => this.filterBy(CALLS));

  readonly todoCount = computed(() =>
    this.calls().filter(c => c.status === 'da-fare').length
  );
}
