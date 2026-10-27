function qualificationName(qualification) {
  if (typeof qualification === 'string') return qualification.trim();
  if (!qualification || typeof qualification !== 'object') return '';
  return String(qualification.name ?? qualification.title ?? qualification.code ?? '').trim();
}

// Keep the company-profile response intentionally limited to editable profile
// fields and resolved public catalog labels. Matching assignments and internal
// ownership data use their own APIs.
export function toCompanyProfile(company) {
  if (!company) return null;
  return {
    displayName: company.displayName ?? company.legalName ?? '',
    description: company.description ?? '',
    certifications: Array.isArray(company.certifications) ? company.certifications : [],
    companySize: company.companySize === 'Not specified' ? '' : (company.companySize ?? ''),
    district: company.district ?? '',
    contactEmail: company.contact?.email ?? '',
    technologies: Array.isArray(company.technologies) ? company.technologies : [],
    qualifications: Array.isArray(company.qualifications)
      ? company.qualifications.map(qualificationName).filter(Boolean)
      : [],
    tags: Array.isArray(company.tags) ? company.tags.filter((link) => link?.tagId).map((link) => ({
      tagId: link.tagId.toString(),
      contractorLabel: link.contractorLabel ?? null,
      text: link.text ?? null,
      category: link.category ?? null,
      type: link.type ?? null,
      status: link.status ?? null
    })) : []
  };
}
