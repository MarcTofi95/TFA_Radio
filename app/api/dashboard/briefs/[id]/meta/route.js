import { NextResponse } from 'next/server';
import { updateBriefTeamMeta } from '../../../../../../lib/db';

// Producer-only — gated by middleware.js, same as the status route.
// Updates the team-only assignedTo / dueDate fields on a brief.
export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body || {}, 'assignedTo')) patch.assignedTo = body.assignedTo;
  if (Object.prototype.hasOwnProperty.call(body || {}, 'dueDate')) patch.dueDate = body.dueDate;

  const brief = await updateBriefTeamMeta(params.id, patch);
  if (!brief) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(brief);
}
