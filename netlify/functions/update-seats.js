import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, clientIp, tooManyRequests } from './lib/rateLimiter.js';
import { isUuid, err422 } from './lib/validate.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { limited, retryAfter } = rateLimit(clientIp(event.headers), { max: 10, windowMs: 15 * 60 * 1000 });
  if (limited) return tooManyRequests(retryAfter);

  let coach_id, delta;
  try {
    ({ coach_id, delta } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  if (!isUuid(coach_id))           return err422('coach_id must be a valid UUID');
  if (delta !== 1 && delta !== -1) return err422('delta must be 1 or -1');

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('id, stripe_subscription_id')
    .eq('coach_id', coach_id)
    .single();

  if (teamErr || !team) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Team not found' }) };
  }

  if (!team.stripe_subscription_id) {
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'No active subscription' }) };
  }

  // Count active members directly from the DB rather than reading from Stripe
  // and adding delta. This eliminates the race condition where two concurrent
  // approve/remove calls each read the same Stripe quantity and produce the
  // wrong result. Both calls will now converge on the same correct count.
  const { count: activeCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .eq('status', 'active');

  const newQuantity = Math.max(1, activeCount ?? 1);

  const subscription = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
  const item = subscription.items.data[0];
  if (!item) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No subscription item found' }) };
  }

  await stripe.subscriptionItems.update(item.id, { quantity: newQuantity });

  await supabase
    .from('teams')
    .update({ seat_count: newQuantity })
    .eq('coach_id', coach_id);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seat_count: newQuantity }),
  };
};
