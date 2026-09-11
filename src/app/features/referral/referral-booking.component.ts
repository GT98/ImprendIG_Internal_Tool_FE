import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ReferralApiService } from '../../referral/referral-api.service';

const WIX_BOOKING_URL = 'https://www.carlottaspinelli.com/booking-calendar/ugc-level-up';

type BookingStep = 'loading' | 'invalid' | 'form' | 'redirecting' | 'done' | 'error';

@Component({
  selector: 'app-referral-booking',
  imports: [FormsModule],
  templateUrl: './referral-booking.component.html',
  styleUrl: './referral-booking.component.css',
})
export class ReferralBookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ReferralApiService);

  readonly step = signal<BookingStep>('loading');
  readonly referrerName = signal<string | null>(null);
  readonly referralToken = signal<string>('');

  readonly name = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly formError = signal('');

  async ngOnInit() {
    const token = this.route.snapshot.paramMap.get('referralToken') ?? '';
    this.referralToken.set(token);

    if (this.route.snapshot.queryParamMap.get('booked') === '1') {
      this.step.set('done');
      return;
    }

    this.api.getPublicInfo(token).subscribe({
      next: info => {
        if (!info.isValid) { this.step.set('invalid'); return; }
        this.referrerName.set(info.referrerName);
        this.step.set('form');
      },
      error: () => this.step.set('invalid'),
    });
  }

  async submitBooking() {
    this.formError.set('');
    if (!this.name().trim() || !this.email().trim()) {
      this.formError.set('Nome ed email sono obbligatori');
      return;
    }
    this.step.set('redirecting');
    try {
      await firstValueFrom(this.api.submitReferral({
        referralToken: this.referralToken(),
        referredName: this.name().trim() || undefined,
        referredEmail: this.email().trim() || undefined,
        referredPhone: this.phone().trim() || undefined,
      }));
    } catch {
      // intent non critico: si procede comunque al redirect
    }
    const url = new URL(WIX_BOOKING_URL);
    url.searchParams.set('referral_code', this.referralToken());
    window.location.href = url.toString();
  }
}
