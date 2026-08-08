import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CallRecording } from '../../models';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/call-recordings`;

@Injectable({ providedIn: 'root' })
export class CallRecordingApiService {
  private readonly http = inject(HttpClient);

  upload(
    blob: Blob,
    mimeType: string,
    leadId: string | null,
    durationSeconds: number | null,
  ): Observable<CallRecording> {
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const fd = new FormData();
    fd.append('file', blob, `recording-${Date.now()}.${ext}`);
    if (leadId) fd.append('leadId', leadId);
    if (durationSeconds !== null) fd.append('durationSeconds', String(durationSeconds));
    return this.http.post<CallRecording>(`${BASE}/upload`, fd);
  }

  getByLead(leadId: string): Observable<CallRecording[]> {
    return this.http.get<CallRecording[]>(BASE, { params: { leadId } });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
