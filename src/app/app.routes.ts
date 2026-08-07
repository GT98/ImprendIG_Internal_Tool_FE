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
    path: 'form/:token',
    loadComponent: () =>
      import('./features/onboarding-form/onboarding-form.component').then(m => m.OnboardingFormComponent),
    title: 'Form onboarding',
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
      {
        path: 'onboarding',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
        title: 'Onboarding',
      },
      {
        path: 'team',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/team/team.component').then(m => m.TeamComponent),
        title: 'Team',
      },
      {
        path: 'customers',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/customers/customers-list.component').then(m => m.CustomersListComponent),
        title: 'Clienti',
      },
      {
        path: 'leads',
        loadComponent: () =>
          import('./features/leads/leads-list.component').then(m => m.LeadsListComponent),
        title: 'Lead',
      },
      {
        path: 'task-tracker',
        loadComponent: () =>
          import('./features/tasks/tasks.component').then(m => m.TasksComponent),
        title: 'Attività',
      },
      {
        path: 'commesse',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/commesse/commesse.component').then(m => m.CommesseComponent),
        title: 'Commesse',
      },
      {
        path: 'rendicontazioni',
        loadComponent: () =>
          import('./features/rendicontazioni/rendicontazioni.component').then(m => m.RendicontazioniComponent),
        title: 'Rendicontazioni',
      },
      {
        path: 'rendicontazioni/print',
        loadComponent: () =>
          import('./features/rendicontazioni/report-print.component').then(m => m.ReportPrintComponent),
        title: 'Report PDF',
      },
      {
        path: 'bot-log',
        loadComponent: () =>
          import('./features/bot-log/bot-log.component').then(m => m.BotLogComponent),
        title: 'Attività Bot',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(m => m.ProfileComponent),
        title: 'Il mio profilo',
      },
    ],
  },
];
