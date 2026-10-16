function qualificationName(qualification) {
  if (typeof qualification === 'string') return qualification.trim();
  if (!qualification || typeof qualification !== 'object') return '';
  return String(qualification.name ?? qualification.title ?? qualification.code ?? '').trim();
}

// Keep the company-profile response intentionally limited to editable profile
// fields. Tag assignments and internal ownership data use their own APIs.
export function toCompanyProfile(company) {
  if (!company) return null;
  return {
    displayName: company.displayName ?? company.legalName ?? '',
    companySize: company.companySize === 'Not specified' ? '' : (company.companySize ?? ''),
    district: company.district ?? '',
    contactEmail: company.contact?.email ?? '',
    technologies: Array.isArray(company.technologies) ? company.technologies : [],
    qualifications: Array.isArray(company.qualifications)
      ? company.qualifications.map(qualificationName).filter(Boolean)
      : []
  };
}
