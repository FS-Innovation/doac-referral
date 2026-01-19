import { Request } from 'express';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  referral_code: string;
  points: number;
  is_admin: boolean;
  first_name: string | null;
  age_range: string | null;
  country: string | null;
  marketing_consent: boolean;
  email_verified: boolean;
  verification_token: string | null;
  verification_token_expires: Date | null;
  verification_sent_at: Date | null;
  // Profile completion fields
  phone: string | null;
  phone_verified: boolean;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
  date_of_birth: Date | null;
  dob_variant: 'date_picker' | 'age_range' | null;
  profile_completed_at: Date | null;
  profile_completion_skipped: boolean;
  profile_completion_step: number;
  completed_fields: string[];
  created_at: Date;
  updated_at: Date;
}

export interface ReferralClick {
  id: number;
  user_id: number;
  ip_address: string;
  user_agent: string;
  clicked_at: Date;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  point_cost: number;
  image_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Purchase {
  id: number;
  user_id: number;
  product_id: number | null;
  product_name: string;
  points_spent: number;
  purchased_at: Date;
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    is_admin: boolean;
  };
}

export interface PrizeTier {
  id: number;
  tier_number: number;
  name: string;
  description: string;
  points_required: number;
  prize_type: 'discount_code' | 'physical_product' | 'mystery';
  discount_percentage: number | null;
  is_mystery: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PrizeCode {
  id: number;
  tier_id: number;
  code: string;
  claimed_by: number | null;
  claimed_at: Date | null;
  expires_at: Date | null;
  is_used: boolean;
  created_at: Date;
}

export interface UserPrizeClaim {
  id: number;
  user_id: number;
  tier_id: number;
  prize_code_id: number | null;
  points_at_claim: number;
  claimed_at: Date;
}

export interface PrizeTierWithStatus extends PrizeTier {
  status: 'locked' | 'unlocked';
  progress: number; // 0-100 percentage
  has_claimed_before: boolean; // Whether user has ever redeemed this prize
  claim_count: number; // Number of times user has redeemed this prize
  last_claimed_at?: Date; // When they last claimed it
}

// Profile Completion Types
export interface Interest {
  id: number;
  slug: string;
  display_name: string;
  category_label: string;
  display_order: number;
  is_active: boolean;
}

export interface UserInterest {
  id: number;
  user_id: number;
  interest_id: number;
  created_at: Date;
}

export interface MarketingChannel {
  id: number;
  slug: string;
  display_name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

export interface UserMarketingPreference {
  id: number;
  user_id: number;
  channel_id: number;
  opted_in: boolean;
  opted_in_at: Date | null;
  opted_out_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// A/B Testing Types
export interface Experiment {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  variants: string[];
  traffic_split: Record<string, number>;
  is_active: boolean;
  start_date: Date;
  end_date: Date | null;
  created_at: Date;
}

export interface UserExperimentAssignment {
  id: number;
  user_id: number;
  experiment_id: number;
  variant: string;
  assigned_at: Date;
  converted_at: Date | null;
  conversion_data: Record<string, any> | null;
}

export interface ProfileCompletionAnalytics {
  id: number;
  user_id: number;
  step: string;
  action: 'started' | 'completed' | 'skipped' | 'abandoned';
  fields_completed: string[] | null;
  time_spent_seconds: number | null;
  metadata: Record<string, any> | null;
  created_at: Date;
}

// Profile Completion Request Types
export interface ProfileCompletionData {
  phone?: string;
  interests?: string[];
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  dobVariant?: 'date_picker' | 'age_range';
  dateOfBirth?: string;
  ageRange?: string;
  marketingPreferences?: string[];
}

export interface ProfileCompletionStatus {
  currentStep: 'verify_email' | 'profile_completion' | 'complete';
  emailVerified: boolean;
  profileCompleted: boolean;
  profileSkipped: boolean;
  completedFields: {
    firstName: boolean;
    phone: boolean;
    gender: boolean;
    dob: boolean;
    country: boolean;
    interests: boolean;
    marketingPrefs: boolean;
  };
}
