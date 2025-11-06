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
