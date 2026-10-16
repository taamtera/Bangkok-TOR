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
    companySize: company.companySize === 'Not specified' ? '' : company.companySize,
    district: company.district || '',
    email: company.contactEmail || profile.email,
    properties: company.qualifications || [],
    technologies: company.technologies || []
  };
}

export function profileToCompanyData(profile: SoftwareHouseProfile): CompanyProfileData {
  return {
    displayName: profile.companyName,
    companySize: profile.companySize,
    district: profile.district,
    contactEmail: profile.email,
    technologies: profile.technologies,
    qualifications: profile.properties
  };
}
