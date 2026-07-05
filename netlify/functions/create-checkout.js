import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, clientIp, tooManyRequests } from './lib/rateLimiter.js';
import { isUuid, isInt, err422 } from './lib/validate.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PRICE_ID = process.env.STRIPE_PRICE_ID;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { limited, retryAfter } = rateLimit(clientIp(event.headers), { max: 10, windowMs: 15 * 60 * 1000 });
  if (limited) return tooManyRequests(retryAfter);

  let coach_id, seat_count;
  try {
    ({ coach_id, seat_count } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  if (!isUuid(coach_id))          return err422('coach_id must be a valid UUID');
  if (!isInt(seat_count, 1, 500)) return err422('seat_count must be an integer between 1 and 500');

  // Verify the coach owns a team and determine the minimum billable quantity.
  // We never let the client dictate fewer seats than they already have active members.
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('coach_id', coach_id)
    .maybeSingle();

  if (!team) {
    return { statusCode: 404, body: JSON.stringify({ error: 'No team found for this coach.' }) };
  }

  const { count: activeCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .eq('status', 'active');

  // Use whichever is larger: what the coach requested or what they already have
  const quantity = Math.max(seat_count, activeCount ?? 0, 1);

  // SITE_URL is set in Netlify dashboard env vars (or auto-provided as URL by Netlify).
  const origin = process.env.SITE_URL || process.env.URL;
  if (!origin) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SITE_URL is not configured.' }) };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: PRICE_ID,
          quantity,
        },
      ],
      metadata: { coach_id, seat_count: String(quantity) },
      subscription_data: {
        metadata: { coach_id, seat_count: String(quantity) },
      },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url:  `${origin}/dashboard?checkout=cancelled`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
