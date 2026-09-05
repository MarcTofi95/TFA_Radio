import { NextResponse } from 'next/server';
import { activatePromptVersion, deactivatePromptVersion, updatePromptVersion } from '../../../../../lib/promptVersions';

export const dynamic = 'force-dynamic';

// { action: 'activate' } makes this version the live one (and every other
// version inactive); { action: 'deactivate' } turns the live version off
// (script generation then falls back to the built-in default prompt until
// another version is made live); { action: 'update', label?, content? }
// edits the version's name and/or instructions in place, without touching
// its status.
export async function PATCH(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const action = body && body.action;
  if (action === 'update') {
    const patch = {};
    if (typeof body.label === 'string') patch.label = body.label;
    if (typeof body.content === 'string') patch.content = body.content;
    const updated = await updatePromptVersion(params.id, patch);
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(updated);
  }
  if (action !== 'activate' && action !== 'deactivate') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }
  const updated = action === 'activate'
    ? await activatePromptVersion(params.id)
    : await deactivatePromptVersion(params.id);
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(updated);
}
