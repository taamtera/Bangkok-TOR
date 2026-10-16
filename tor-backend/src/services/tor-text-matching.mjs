const GENERIC_SINGLE_WORD_TAGS = new Set([
  'app', 'application', 'data', 'development', 'government', 'hospital', 'network',
  'service', 'software', 'system', 'web'
]);

function sourceText(tor) {
  const parts = [
    ['Announcement title', tor.title],
    ['Announcement description', tor.description]
  ].filter(([, text]) => typeof text === 'string' && text.trim());

  // e-GP item parameters are source fields too. Keep their labels in evidence
  // so users can tell where a phrase came from.
  function visit(value, path, depth = 0) {
    if (depth > 4 || value == null) return;
    if (typeof value === 'string' && value.trim()) {
      parts.push([`Announcement field: ${path}`, value]);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
    } else if (typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) visit(item, `${path}.${key}`, depth + 1);
    }
  }

  visit(tor.itemParams, 'itemParams');
  return parts;
}

function isUsefulTerm(term) {
  const normalized = term.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
  if (normalized.length < 3) return false;
  if (/^[\p{L}\p{N}]+$/u.test(normalized) && GENERIC_SINGLE_WORD_TAGS.has(normalized)) return false;
  return true;
}

function findTerm(text, term) {
  const normalizedText = text.normalize('NFC');
  const normalizedTerm = term.normalize('NFC').trim().replace(/\s+/gu, ' ');

  // English/Latin terms use token boundaries; Thai and other scripts without
  // whitespace word boundaries use exact phrase containment.
  if (/^[\p{Script=Latin}\p{N}\s._+/#-]+$/u.test(normalizedTerm)) {
    const escaped = normalizedTerm.split(/\s+/u).map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('\\s+');
    const match = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').exec(normalizedText);
    return match ? { index: match.index, text: match[0] } : null;
  }

  const index = normalizedText.toLocaleLowerCase().indexOf(normalizedTerm.toLocaleLowerCase());
  return index < 0 ? null : { index, text: normalizedText.slice(index, index + normalizedTerm.length) };
}

function excerpt(text, match) {
  const start = Math.max(0, match.index - 100);
  const end = Math.min(text.length, match.index + match.text.length + 100);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Build non-persisted, source-cited candidate signals from the actual crawled
 * announcement fields. An exact mention is deliberately called "mentioned",
 * not a confirmed required/preferred tender term. The full TOR/PDF is not
 * indexed by the crawler today, so we never invent document-level evidence.
 */
export function detectTorTextTagMentions(tor, activeTags) {
  const sources = sourceText(tor);
  const detected = new Map();

  for (const tag of activeTags) {
    const terms = [...new Set([tag.name, ...(Array.isArray(tag.aliases) ? tag.aliases : [])]
      .filter((term) => typeof term === 'string' && isUsefulTerm(term)))];
    for (const [sourceLabel, text] of sources) {
      const match = terms.map((term) => findTerm(text, term)).find(Boolean);
      if (!match) continue;
      detected.set(tag._id.toString(), {
        tagId: tag._id,
        requirementLevel: 'mentioned',
        source: 'announcement_text',
        confidence: 1,
        reviewStatus: 'auto_detected',
        evidence: `${sourceLabel}: ${excerpt(text, match)}`,
        sourceDocumentUrl: tor.documentUrl || tor.url || null,
        sourcePage: sourceLabel,
        assignedAt: null
      });
      break;
    }
  }

  return [...detected.values()];
}
