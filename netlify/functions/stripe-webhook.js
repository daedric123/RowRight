import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object;
      const coach_id = session.metadata?.coach_id;
      const seat_count = parseInt(session.metadata?.seat_count || '0', 10);
      if (coach_id && session.subscription) {
        await supabase
          .from('teams')
          .update({
            stripe_subscription_id: session.subscription,
            seat_count,
          })
          .eq('coach_id', coach_id);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = stripeEvent.data.object;
      const coach_id = sub.metadata?.coach_id;
      if (coach_id) {
        const seat_count = sub.items.data.reduce((sum, item) => sum + (item.quantity || 0), 0);
        await supabase
          .from('teams')
          .update({ seat_count })
          .eq('coach_id', coach_id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = stripeEvent.data.object;
      const coach_id = sub.metadata?.coach_id;
      if (coach_id) {
        await supabase
          .from('teams')
          .update({ stripe_subscription_id: null, seat_count: 0 })
          .eq('coach_id', coach_id);
      }
      break;
    }

    default:
      break;
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
