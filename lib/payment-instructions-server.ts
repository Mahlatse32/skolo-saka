import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminSupabase, paystackRequest, serverSupabase } from '@/lib/paystack-server';

export type PaymentKind = 'one_off' | 'recurring';

type AllocationRow = {
  id: string;
  school_id: string;
  commitment_id: string | null;
  amount_cents: number;
};

type InstructionRow = {
  id: string;
  user_id: string;
  kind: PaymentKind;
  cadence: string | null;
  term_months: number | null;
  amount_cents: number;
  currency: string;
  status: string;
  provider_plan_code: string | null;
  provider_subscription_code: string | null;
  provider_email_token: string | null;
  provider_reference: string | null;
};

export async function authenticatedUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = serverSupabase(token);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { user, token, supabase };
}

export async function fetchInstruction(db: SupabaseClient, instructionId: string): Promise<InstructionRow | null> {
  const { data, error } = await db
    .from('payment_instructions')
    .select('id,user_id,kind,cadence,term_months,amount_cents,currency,status,provider_plan_code,provider_subscription_code,provider_email_token,provider_reference')
    .eq('id', instructionId)
    .maybeSingle();
  if (error) throw error;
  return data as InstructionRow | null;
}

export async function instructionAllocations(db: SupabaseClient, instructionId: string): Promise<AllocationRow[]> {
  const { data, error } = await db
    .from('payment_instruction_allocations')
    .select('id,school_id,commitment_id,amount_cents')
    .eq('payment_instruction_id', instructionId)
    .order('created_at');
  if (error) throw error;
  return (data || []) as AllocationRow[];
}

export async function recordInstructionCharge(args: {
  db?: SupabaseClient;
  instruction: InstructionRow;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string | null;
  transactionId?: string | number | null;
  channel?: string | null;
}) {
  const db = args.db || adminSupabase();
  const instruction = args.instruction;
  const currency = String(args.currency || '').toUpperCase();
  if (!args.reference) throw new Error('Payment reference is missing.');
  if (Number(args.amount) !== Number(instruction.amount_cents)) throw new Error('Payment amount does not match the instruction.');
  if (currency !== String(instruction.currency).toUpperCase()) throw new Error('Payment currency does not match the instruction.');

  const allocations = await instructionAllocations(db, instruction.id);
  const allocationTotal = allocations.reduce((sum, row) => sum + Number(row.amount_cents), 0);
  if (!allocations.length || allocationTotal !== Number(instruction.amount_cents)) {
    throw new Error('Payment allocation does not match the instruction total.');
  }

  const occurredAt = new Date(args.paidAt || Date.now()).toISOString();
  for (const allocation of allocations) {
    const externalReference = `${args.reference}:${allocation.school_id}`;
    const { error } = await db.from('ledger_transactions').upsert({
      user_id: instruction.user_id,
      school_id: allocation.school_id,
      commitment_id: instruction.kind === 'recurring' ? allocation.commitment_id : null,
      type: 'contribution',
      amount_cents: Number(allocation.amount_cents),
      currency: instruction.currency,
      external_reference: externalReference,
      metadata: {
        provider: 'paystack',
        provider_reference: args.reference,
        payment_instruction_id: instruction.id,
        payment_kind: instruction.kind,
        transaction_id: args.transactionId ?? null,
        channel: args.channel ?? null,
      },
      occurred_at: occurredAt,
    }, { onConflict: 'external_reference' });
    if (error) throw error;
  }

  const instructionPatch = instruction.kind === 'one_off'
    ? { status: 'completed', provider_reference: args.reference, started_at: occurredAt, completed_at: occurredAt, updated_at: new Date().toISOString() }
    : { status: 'active', provider_reference: args.reference, started_at: occurredAt, cancelled_at: null, updated_at: new Date().toISOString() };
  const { error: instructionError } = await db.from('payment_instructions').update(instructionPatch).eq('id', instruction.id).not('status', 'in', '(cancelled,non_renewing,completed)');
  if (instructionError) throw instructionError;

  if (instruction.kind === 'recurring' && !['cancelled','non_renewing','completed'].includes(instruction.status)) {
    for (const allocation of allocations) {
      if (!allocation.commitment_id) continue;
      const { error } = await db.from('commitments').update({
        status: 'active',
        payment_provider: 'paystack',
        provider_reference: args.reference,
        payment_instruction_id: instruction.id,
        started_at: occurredAt,
        cancelled_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', allocation.commitment_id).eq('user_id', instruction.user_id).eq('payment_instruction_id', instruction.id).neq('status', 'cancelled');
      if (error) throw error;
    }
  }

  return allocations;
}

export type PaystackSubscription = {
  status: boolean;
  data: {
    status?: string;
    subscription_code?: string;
    email_token?: string;
    next_payment_date?: string | null;
  };
};

export async function fetchPaystackSubscription(code: string) {
  return paystackRequest<PaystackSubscription>(`/subscription/${encodeURIComponent(code)}`);
}

export async function disablePaystackSubscription(code: string, token: string) {
  return paystackRequest<{ status: boolean; message: string }>('/subscription/disable', {
    method: 'POST',
    body: JSON.stringify({ code, token }),
  });
}
