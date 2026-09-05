'use server';

import { revalidatePath } from 'next/cache';
import {
  createTrack, deleteTrack, updateTrack, deleteTracksBulk,
  createVoice, deleteVoice, updateVoice, deleteVoicesBulk,
} from '../../../lib/library';

// A connected Blob store on Vercel authenticates via OIDC by default —
// BLOB_STORE_ID + an auto-rotated VERCEL_OIDC_TOKEN — not the older static
// BLOB_READ_WRITE_TOKEN (that one is only present if explicitly generated for
// use outside Vercel, e.g. a CI job). The @vercel/blob SDK already knows how
// to use whichever credential is available, so we just need to detect that
// *some* form of Blob auth is configured before attempting an upload.
const BLOB_ENABLED = !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

// Uploads an audio file to Vercel Blob and returns its public URL, or ''
// if no file was chosen or no Blob store is configured at all — mirrors
// this codebase's pattern elsewhere of degrading gracefully rather than
// erroring out when an optional service isn't configured yet.
async function uploadAudioIfPresent(file, prefix) {
  if (!file || typeof file === 'string' || !file.size) return '';
  if (!BLOB_ENABLED) {
    console.log('[library] No Blob store configured (BLOB_STORE_ID/BLOB_READ_WRITE_TOKEN unset) — skipping audio upload for', file.name);
    return '';
  }
  const { put } = await import('@vercel/blob');
  const blob = await put(`${prefix}/${Date.now()}-${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true,
  });
  return blob.url;
}

export async function addTrackAction(formData) {
  const audioUrl = await uploadAudioIfPresent(formData.get('audioFile'), 'tracks');
  await createTrack({
    title: formData.get('title'),
    artist: formData.get('artist'),
    category: formData.get('category'),
    fileId: formData.get('fileId') || '',
    audioUrl,
  });
  revalidatePath('/dashboard/library');
}

export async function removeTrackAction(id) {
  await deleteTrack(id);
  revalidatePath('/dashboard/library');
}

// Edit an existing track in place — audioFile is optional here (unlike the
// add form, where it's just skipped if empty): only re-upload and replace
// audioUrl when the producer actually picked a new file, otherwise leave
// the existing audio alone.
export async function updateTrackAction(id, formData) {
  const audioFile = formData.get('audioFile');
  const patch = {
    title: formData.get('title'),
    artist: formData.get('artist'),
    category: formData.get('category'),
    fileId: formData.get('fileId') || '',
  };
  if (audioFile && typeof audioFile !== 'string' && audioFile.size) {
    patch.audioUrl = await uploadAudioIfPresent(audioFile, 'tracks');
  }
  await updateTrack(id, patch);
  revalidatePath('/dashboard/library');
}

// Batch delete — the library view's "select several, delete at once" flow
// submits every checked id in one FormData (repeated `id` entries) instead
// of firing removeTrackAction once per row.
export async function removeTracksBulkAction(formData) {
  const ids = formData.getAll('id').map(String).filter(Boolean);
  await deleteTracksBulk(ids);
  revalidatePath('/dashboard/library');
}

export async function addVoiceAction(formData) {
  const tagsRaw = formData.get('tags') || '';
  const tags = tagsRaw
    .toString()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const audioUrl = await uploadAudioIfPresent(formData.get('audioFile'), 'voices');
  await createVoice({
    name: formData.get('name'),
    gender: formData.get('gender'),
    ageRange: formData.get('ageRange'),
    tags,
    fileId: formData.get('fileId') || '',
    audioUrl,
  });
  revalidatePath('/dashboard/library');
}

export async function removeVoiceAction(id) {
  await deleteVoice(id);
  revalidatePath('/dashboard/library');
}

// See updateTrackAction above — same "only replace audio if a new file was
// actually chosen" behavior, voice side.
export async function updateVoiceAction(id, formData) {
  const tagsRaw = formData.get('tags') || '';
  const tags = tagsRaw.toString().split(',').map((t) => t.trim()).filter(Boolean);
  const audioFile = formData.get('audioFile');
  const patch = {
    name: formData.get('name'),
    gender: formData.get('gender'),
    ageRange: formData.get('ageRange'),
    tags,
    fileId: formData.get('fileId') || '',
  };
  if (audioFile && typeof audioFile !== 'string' && audioFile.size) {
    patch.audioUrl = await uploadAudioIfPresent(audioFile, 'voices');
  }
  await updateVoice(id, patch);
  revalidatePath('/dashboard/library');
}

// See removeTracksBulkAction above — voice side.
export async function removeVoicesBulkAction(formData) {
  const ids = formData.getAll('id').map(String).filter(Boolean);
  await deleteVoicesBulk(ids);
  revalidatePath('/dashboard/library');
}

// Bulk import — the drag-and-drop multi-file flow in LibraryClient stages N
// files client-side with an editable field set per file, then submits one
// FormData with indexed keys (track_0_title, track_0_audioFile, ...) which
// we loop through here and import one by one.
export async function addTracksBulkAction(formData) {
  const count = Number(formData.get('count') || 0);
  for (let i = 0; i < count; i++) {
    const audioFile = formData.get(`track_${i}_audioFile`);
    const audioUrl = await uploadAudioIfPresent(audioFile, 'tracks');
    await createTrack({
      title: formData.get(`track_${i}_title`),
      artist: formData.get(`track_${i}_artist`),
      category: formData.get(`track_${i}_category`),
      fileId: formData.get(`track_${i}_fileId`) || '',
      audioUrl,
    });
  }
  revalidatePath('/dashboard/library');
}

export async function addVoicesBulkAction(formData) {
  const count = Number(formData.get('count') || 0);
  for (let i = 0; i < count; i++) {
    const audioFile = formData.get(`voice_${i}_audioFile`);
    const audioUrl = await uploadAudioIfPresent(audioFile, 'voices');
    const tagsRaw = formData.get(`voice_${i}_tags`) || '';
    const tags = tagsRaw.toString().split(',').map((t) => t.trim()).filter(Boolean);
    await createVoice({
      name: formData.get(`voice_${i}_name`),
      gender: formData.get(`voice_${i}_gender`),
      ageRange: formData.get(`voice_${i}_ageRange`),
      tags,
      fileId: formData.get(`voice_${i}_fileId`) || '',
      audioUrl,
    });
  }
  revalidatePath('/dashboard/library');
}
