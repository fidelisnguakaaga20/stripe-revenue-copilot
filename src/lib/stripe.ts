import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

// Use a fixed, supported API version
export const stripe = new Stripe(key, { apiVersion: '2024-06-20' });
