export function qualificationName(qualification) {
  if (typeof qualification === 'string') return qualification.trim();
  if (!qualification || typeof qualification !== 'object') return '';
  return String(qualification.name ?? qualification.title ?? qualification.code ?? '').trim();
}

export function mergeQualifications(existing = [], requestedNames = []) {
  const existingByName = new Map(existing
    .map((qualification) => [qualificationName(qualification).toLocaleLowerCase('en-US'), qualification])
    .filter(([name]) => name));

  return requestedNames.map((name) => {
    const previous = existingByName.get(name.toLocaleLowerCase('en-US'));
    // Keep evidence metadata for unchanged entries. New free-text entries remain
    // unverified; profile synchronization later links them only as claimed.
    return previous && typeof previous === 'object'
      ? { ...previous, name }
      : { name, category: 'capability' };
  });
}

export function companyProfileTagEntries(technologies = [], qualifications = []) {
  const entries = new Map();
  for (const technology of technologies) {
    if (typeof technology !== 'string' || technology.trim().length < 2) continue;
    const name = technology.trim();
    const key = `technology:${name.toLocaleLowerCase('en-US')}`;
    if (!entries.has(key)) entries.set(key, {
      name, category: 'technology', evidence: `Self-reported company profile technology: ${name}`
    });
  }
  for (const qualification of qualifications) {
    const name = qualificationName(qualification);
    if (name.length < 2) continue;
    const key = `capability:${name.toLocaleLowerCase('en-US')}`;
    if (!entries.has(key)) entries.set(key, {
      name, category: 'capability', evidence: `Self-reported company profile qualification: ${name}`
    });
  }
  return [...entries.values()];
}

// Profile edits own only self-reported links; independent evidence stays intact.
export function mergeProfileAssignments(existing = [], derived = []) {
  const managed = assignment => assignment.source === 'manual'
    && assignment.verificationLevel === 'claimed'
    && typeof assignment.evidence === 'string'
    && (assignment.evidence.startsWith('Self-reported company profile ')
      || assignment.evidence.startsWith('Self-reported company service selection: ')
      || assignment.evidence === 'Selected from company profile.');
  const preserved = existing.filter(assignment => !managed(assignment));
  const ids = new Set(preserved.map(assignment => String(assignment.tagId)));
  return [...preserved, ...derived.filter(assignment => {
    const id = String(assignment.tagId);
    if (ids.has(id)) return false;
    ids.add(id); return true;
  })];
}
