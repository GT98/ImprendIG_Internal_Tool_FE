import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';
import { AuthService } from './auth/auth.service';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Accedi',
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () =>
          inject(AuthService).currentUser()?.role === 'admin' ? 'dashboard' : 'chiamate',
      },
      {
        path: 'dashboard',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard',
      },
      {
        path: 'chiamate',
        loadComponent: () =>
          import('./features/calls/calls.component').then(m => m.CallsComponent),
        title: 'Chiamate',
      },
      {
        path: 'provvigioni',
        loadComponent: () =>
          import('./features/commissions/commissions.component').then(m => m.CommissionsComponent),
        title: 'Provvigioni',
      },
      {
        path: 'clienti',
        loadComponent: () =>
          import('./features/clients/clients.component').then(m => m.ClientsComponent),
        title: 'Vendite',
      },
      {
        path: 'catalogo',
        loadComponent: () =>
          import('./features/catalog/catalog.component').then(m => m.CatalogComponent),
        title: 'Catalogo',
      },
    ],
  },
];
