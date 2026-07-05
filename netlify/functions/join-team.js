import { createClient } from '@supabase/supabase-js';
import { rateLimit, clientIp, tooManyRequests } from './lib/rateLimiter.js';
import { isUuid, isStr, isEnum, isEmail, err422 } from './lib/validate.js';

const TEAM_CODE_RE = /^[A-Z0-9\-]{1,20}$/i;
const ALLOWED_ROLES = ['athlete', 'cox'];

// Service role client bypasses ALL RLS — safe here because all inputs
// are validated server-side before any DB write.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { limited, retryAfter } = rateLimit(clientIp(event.headers), { max: 5, windowMs: 15 * 60 * 1000 });
  if (limited) return tooManyRequests(retryAfter);

  let userId, teamCode, role, fullName, email;
  try {
    ({ userId, teamCode, role, fullName, email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!isUuid(userId))                              return err422('userId must be a valid UUID');
  if (!isStr(teamCode, 20) || !TEAM_CODE_RE.test(teamCode)) return err422('teamCode must be 1–20 alphanumeric characters');
  if (!isEnum(role?.toLowerCase(), ALLOWED_ROLES))  return err422('role must be "athlete" or "cox"');
  if (fullName  != null && !isStr(fullName, 100))   return err422('fullName must be 100 characters or fewer');
  if (email     != null && !isEmail(email))          return err422('email must be a valid address (max 254 characters)');

  // ── Step 1: look up team by code (case-insensitive) ──────────
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name, code')
    .ilike('code', teamCode.trim())
    .maybeSingle();

  if (teamError) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: teamError.message }),
    };
  }

  if (!team) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Team code not found' }),
    };
  }

  // ── Step 2: insert pending membership row ─────────────────────
  const memberRow = {
    user_id:  userId,
    team_id:  team.id,
    role:     role.toLowerCase(),
    status:   'pending',
    full_name: fullName?.trim() || null,
    email:    email?.trim().toLowerCase() || null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('team_members')
    .insert(memberRow)
    .select()
    .single();

  if (insertError) {
    // Unique violation (user already in this team) — treat as success
    if (insertError.code === '23505') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, alreadyMember: true }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: insertError.message, code: insertError.code }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId: team.id, memberId: inserted.id }),
  };
};
