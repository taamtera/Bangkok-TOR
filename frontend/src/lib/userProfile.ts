import { SoftwareHouseProfile } from '@/types';
import type { SafeUser } from '@/lib/authApi';
import type { CompanyProfileData } from '@/lib/companyProfileApi';

// Maps the backend's safe account identity onto the UI profile shape. Company
// fields are hydrated separately from /api/companies/me.
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80';

export function safeUserToProfile(
  user: SafeUser,
  overrides: { companyName?: string; taxId?: string } = {}
): SoftwareHouseProfile {
  const name = [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ') || user.email;
  return {
    id: user.id,
    companyId: user.companyId,
    role: user.role,
    name,
    email: user.email,
    companyName: overrides.companyName || name,
    description: '',
    qualifications: [],
    taxId: overrides.taxId || '',
    avatar: user.profile.avatarUrl || DEFAULT_AVATAR,
    companySize: '',
    district: '',
    properties: [],
    technologies: [],
    certifications: [],
    minPreferredBudget: 0,
    maxPreferredBudget: 0,
    notificationsEnabled: true,
    matchedTORIds: []
  };
}

export function companyDataToProfile(
  profile: SoftwareHouseProfile,
  company: CompanyProfileData
): SoftwareHouseProfile {
  return {
    ...profile,
    companyName: company.displayName || profile.companyName,
    description: company.description ?? '',
    qualifications: company.qualifications ?? [],
    certifications: company.certifications ?? [],
    companySize: company.companySize === 'Not specified' ? '' : company.companySize,
    district: company.district || '',
    email: company.contactEmail || profile.email,
    // Capabilities are catalog tags only. Display them by their contractor label
    // (falling back to the catalog text when a tag has no label).
    properties: (company.tags ?? []).map((tag) => tag.contractorLabel || tag.text || '').filter(Boolean),
    technologies: company.technologies ?? profile.technologies ?? [],
    tags: company.tags ?? profile.tags
  };
}

export function profileToCompanyData(profile: SoftwareHouseProfile): CompanyProfileData {
  return {
    displayName: profile.companyName,
    description: profile.description ?? '',
    companySize: profile.companySize,
    district: profile.district,
    contactEmail: profile.email,
    // Keep profile details separate from selected catalog service links.
    technologies: profile.technologies ?? [],
    qualifications: (profile.qualifications ?? []).map(value => value.trim()).filter(Boolean),
    certifications: (profile.certifications ?? []).map(value => value.trim()).filter(Boolean),
    ...(profile.tags !== undefined ? { tags: profile.tags.map(({ tagId }) => ({ tagId })) } : {})
  };
}
