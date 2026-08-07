import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { AssignableUser, Task } from '../models';

const API_URL = environment.apiUrl;

export interface CreateTaskDto {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignedToId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);

  getAll(onlyMine?: boolean): Observable<Task[]> {
    const params: Record<string, string> = onlyMine ? { onlyMine: 'true' } : {};
    return this.http.get<Task[]>(`${API_URL}/tasks`, { params });
  }

  getOne(id: number): Observable<Task> {
    return this.http.get<Task>(`${API_URL}/tasks/${id}`);
  }

  create(dto: CreateTaskDto): Observable<Task> {
    return this.http.post<Task>(`${API_URL}/tasks`, dto);
  }

  update(id: number, dto: Partial<CreateTaskDto>): Observable<Task> {
    return this.http.patch<Task>(`${API_URL}/tasks/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/tasks/${id}`);
  }

  getAssignableUsers(): Observable<AssignableUser[]> {
    return this.http.get<AssignableUser[]>(`${API_URL}/users/assignable`);
  }
}
