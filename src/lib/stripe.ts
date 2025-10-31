import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

// Use the version supported by stripe@14.x
export const stripe = new Stripe(key, { apiVersion: '2023-10-16' });
