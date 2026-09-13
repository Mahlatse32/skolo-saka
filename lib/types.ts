export type SchoolLevel = 'primary' | 'high' | 'combined' | 'other';

export type School = {
  id: string;
  name: string;
  level: SchoolLevel;
  province: string;
  municipality: string | null;
  town: string | null;
  verified: boolean;
};

export type Project = {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  category: string | null;
  target_cents: number;
  status: string;
  priority: number;
};

export type Profile = {
  id: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type Membership = {
  id: string;
  school_id: string;
  graduation_year: number | null;
  start_year: number | null;
  end_year: number | null;
  grade_left: number | null;
  verified: boolean;
  schools?: School;
};

export type Commitment = {
  id: string;
  school_id: string;
  amount_cents: number;
  frequency: string;
  status: string;
  payment_provider: string | null;
};
