import { z } from 'zod';
import { normalizeText, plainText, safeLink } from './rich-text.js';
const richText = (LIMIT) =>
  z
    .string()
    .max(300000)
    .transform((value, ctx) => {
      try {
        return normalizeText(value, LIMIT);
      } catch (e) {
        ctx.addIssue({
          code: 'custom',
          message: e instanceof Error ? e.message : 'Invalid text formatting.',
        });
        return '';
      }
    });
export const scriptInput = z
  .object({
    title: z.string().trim().max(150),
    summary: richText(300).default(''),
    notes: richText(5000),
    status: z.enum(['draft', 'published']),
    folder: z.enum(['general', 'first-10', 'engagement', 'study-sim']).default('general'),
    subfolder: z.enum(['', 'stealthgpt', 'humanchatgpt']).optional(),
    urgent: z.boolean().optional(),
    references: z
      .array(
        z.object({
          label: z.string().trim().max(100),
          url: z
            .string()
            .trim()
            .max(2048)
            .refine((value) => {
              const url = safeLink(value);
              return !!url && /^https?:\/\//.test(url);
            }, 'Reference videos need a valid http:// or https:// link.'),
        }),
      )
      .max(10)
      .default([]),
    revision: z.number().int().nonnegative().optional(),
    creationId: z.string().uuid().optional(),
    requestId: z.string().uuid().optional(),
    blocks: z
      .array(
        z.discriminatedUnion('type', [
          z.object({
            type: z.literal('text'),
            text: richText(20000),
            section: z
              .enum([
                'Note',
                'On-screen text',
                'Script',
                'CTA',
                'Captions',
                'Audio',
                'Background',
                'Description',
              ])
              .optional(),
            audio: z
              .object({
                mode: z.enum(['link', 'none']),
                url: z
                  .string()
                  .trim()
                  .max(2048)
                  .refine((value) => {
                    if (!value) return true;
                    const url = safeLink(value);
                    return !!url && /^https?:\/\//.test(url);
                  }, 'Audio needs a valid http:// or https:// link.')
                  .default(''),
              })
              .optional(),
          }),
          z.object({
            type: z.literal('image'),
            assetId: z.string().uuid(),
            caption: richText(500),
          }),
        ]),
      )
      .max(48),
  })
  .superRefine((s, ctx) => {
    if (s.subfolder && s.folder !== 'general')
      ctx.addIssue({ code: 'custom', message: 'Choose StealthGPT Scripts for this subfolder.' });
    if (
      s.status === 'published' &&
      (!s.title || !s.blocks.some((b) => b.type === 'image' || plainText(b.text).trim()))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Add a title and script content before publishing.',
      });
  });
export function assertRevision(existing, revision) {
  if (!existing || existing.status === 'deleted')
    throw Object.assign(new Error('This script was deleted or is unavailable.'), { status: 409 });
  if (existing.revision !== revision)
    throw Object.assign(
      new Error(
        'Another coach saved a newer version. Your edits are still here. Open the latest script in a new tab before saving.',
      ),
      { status: 409 },
    );
}
export function nextRecord(existing, input, user, now) {
  if (existing) {
    assertRevision(existing, input.revision);
    if (existing.status === 'published' && input.status === 'draft')
      throw Object.assign(new Error('Published scripts must be saved as published scripts.'), {
        status: 400,
      });
  }
  const folder = input.folder ?? existing?.folder ?? 'general';
  return {
    ...existing,
    title: input.title || 'Untitled script',
    summary: input.summary,
    notes: input.notes,
    blocks: input.blocks,
    status: input.status,
    folder,
    subfolder:
      folder === 'general'
        ? (input.subfolder ?? (existing?.folder === 'general' ? existing?.subfolder : '') ?? '')
        : '',
    urgent: input.urgent ?? existing?.urgent ?? false,
    references: input.references ?? existing?.references ?? [],
    revision: existing ? existing.revision + 1 : 0,
    author: existing?.author || user.name || 'Coaching team',
    authorId: existing?.authorId || user.uid,
    createdAt:
      existing?.status === 'published'
        ? existing.createdAt
        : existing?.status === 'draft' && input.status === 'draft'
          ? existing.createdAt
          : now,
    updatedAt: now,
    updatedBy: user.name || user.email,
  };
}
export function imageIds(s) {
  return [...new Set((s?.blocks || []).filter((b) => b.type === 'image').map((b) => b.assetId))];
}
export function detectMime(b) {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (/^GIF8[79]a$/.test(b.subarray(0, 6).toString())) return 'image/gif';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  return null;
}

export const ideaInput = z.object({
  title: z.string().trim().max(150).default(''),
  url: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => {
      const url = safeLink(value);
      return !!url && /^https?:\/\//.test(url);
    }, 'Enter a valid http:// or https:// video link.'),
  thoughts: richText(5000).default(''),
  revision: z.number().int().nonnegative().optional(),
});
