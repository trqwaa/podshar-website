import { z } from 'zod';

/**
 * Characters that change how a name *looks* without being part of it.
 *
 * Control characters, zero-width spaces and joiners, the byte-order mark, and —
 * the ones that matter — the bidirectional overrides. A display name with
 * U+202E in it renders the rest of itself backwards, so "Trqwaa" can be spelt
 * to look like anything; a zero-width space makes a name pixel-identical to
 * someone else's while being a different string. Every place a name is shown
 * on this site — who is online, who wrote a patch, who pinned a note — is a
 * place to impersonate someone with one.
 *
 * Stripped rather than rejected: the person typing never meant to put them
 * there, and a paste from a messenger carries them more often than you would
 * think.
 */
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export const cleanName = (value: string) => value.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();

/** A display name, cleaned first and measured after — so padding with invisibles cannot fake the length. */
export const DisplayName = z
  .string()
  .transform(cleanName)
  .pipe(z.string().min(2, 'nameTooShort').max(40));
