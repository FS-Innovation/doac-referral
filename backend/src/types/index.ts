import { Request } from 'express';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  referral_code: string;
  points: number;
  is_admin: boolean;
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
  status: 'locked' | 'unlocked' | 'claimed';
  progress: number; // 0-100 percentage
  claimed_code?: string; // The code if claimed
  claimed_at?: Date;
}
