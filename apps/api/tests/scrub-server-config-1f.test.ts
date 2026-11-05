import { DEFAULT_MEDIA_LIMITS } from '@amoris/contracts';
import { describe, expect, it } from 'vitest';
import { readScrubServerConfig, tmpSpaceIssue } from '../src/scrubServerConfig.js';

/**
 * Configurazione del servizio di pulizia (1F-W2 T6): il limite dei file ricevuti viene dalle
 * stesse chiavi dei limiti dell'API, così i due non possono divergere nel Compose.
 */

const TOKEN = 'gettone-sintetico-del-servizio-di-pulizia-1f';
const MIB = 1024 * 1024;

describe('configurazione del servizio di pulizia', () => {
  it('senza limiti usa il più grande dei limiti predefiniti di PDF e video', () => {
    const result = readScrubServerConfig({ SCRUB_SERVICE_TOKEN: TOKEN });
    expect(result.ok && result.config.maxBodyBytes).toBe(
      Math.max(DEFAULT_MEDIA_LIMITS.pdfBytes, DEFAULT_MEDIA_LIMITS.videoBytes),
    );
  });

  it('legge MEDIA_MAX_PDF_BYTES e MEDIA_MAX_VIDEO_BYTES come l’API e prende il maggiore', () => {
    const pdf = readScrubServerConfig({
      SCRUB_SERVICE_TOKEN: TOKEN,
      MEDIA_MAX_PDF_BYTES: String(300 * MIB),
      MEDIA_MAX_VIDEO_BYTES: String(50 * MIB),
    });
    expect(pdf.ok && pdf.config.maxBodyBytes).toBe(300 * MIB);
    const video = readScrubServerConfig({
      SCRUB_SERVICE_TOKEN: TOKEN,
      MEDIA_MAX_PDF_BYTES: '1000',
      MEDIA_MAX_VIDEO_BYTES: '2000',
    });
    expect(video.ok && video.config.maxBodyBytes).toBe(2000);
  });

  it('senza gettone o con un limite non valido non parte e nomina la chiave senza il valore', () => {
    const missing = readScrubServerConfig({});
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.issues.join('\n')).toContain('SCRUB_SERVICE_TOKEN');

    const bad = readScrubServerConfig({
      SCRUB_SERVICE_TOKEN: TOKEN,
      MEDIA_MAX_VIDEO_BYTES: 'zero',
    });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.issues.join('\n')).toContain('MEDIA_MAX_VIDEO_BYTES');

    const short = readScrubServerConfig({ SCRUB_SERVICE_TOKEN: 'corto-e-segreto' });
    expect(!short.ok && short.issues.join('\n')).not.toContain('corto-e-segreto');
  });

  it('chiede alla cartella temporanea lo spazio per originale e file ripulito', () => {
    expect(tmpSpaceIssue(200 * MIB, 100 * MIB)).toBeUndefined();
    const issue = tmpSpaceIssue(150 * MIB, 100 * MIB);
    expect(issue).toContain('TMPDIR');
    expect(issue).toContain('200 MiB');
  });
});
