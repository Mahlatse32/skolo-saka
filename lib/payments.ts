export type MandateRequest = {
  commitmentId: string;
  userId: string;
  schoolId: string;
  amountCents: number;
  mobileNumber: string;
};

export type MandateResult = {
  status: 'pending' | 'authorised' | 'failed';
  provider: string;
  providerReference?: string;
  redirectUrl?: string;
  message?: string;
};

export interface RecurringPaymentProvider {
  readonly name: string;
  isConfigured(): boolean;
  createMandate(request: MandateRequest): Promise<MandateResult>;
}

/**
 * Fail-closed provider used until a real South African merchant account is connected.
 * This is intentional: the product must never turn a donor's intent into a fake payment.
 */
export const disabledPaymentProvider: RecurringPaymentProvider = {
  name: 'not-configured',
  isConfigured: () => false,
  async createMandate() {
    return {
      status: 'failed',
      provider: 'not-configured',
      message: 'Recurring collections are not enabled yet.',
    };
  },
};
