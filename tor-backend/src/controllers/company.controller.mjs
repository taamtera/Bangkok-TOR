import { findCompanyById, syncCompanyProfileTagAssignments, updateCompanyProfile } from '../repositories/company.repository.mjs';
import { toCompanyProfile } from '../serializers/company.serializer.mjs';
import { refreshCompanyRequirementMatches } from '../services/requirement-matching.service.mjs';
import { httpError } from '../utils/http-error.mjs';
import { validateCompanyProfile } from '../validators/company.validators.mjs';

function companyIdOf(request) {
  if (!request.user?.companyId) {
    throw httpError(403, 'COMPANY_REQUIRED', 'A linked company profile is required.');
  }
  return request.user.companyId;
}

async function refreshAfterSave(companyId) {
  try { await refreshCompanyRequirementMatches(companyId); }
  catch { console.warn('Company profile saved; matching refresh will retry on the next matching request.'); }
}

export async function getMyProfile(request, response) {
  const company = await findCompanyById(companyIdOf(request));
  if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'The linked company profile does not exist.');
  response.json({ company: toCompanyProfile(company) });
}

export async function updateMyProfile(request, response) {
  const companyId = companyIdOf(request);
  const profile = validateCompanyProfile(request.body);
  const company = await updateCompanyProfile(companyId, profile);
  if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'The linked company profile does not exist.');
  await syncCompanyProfileTagAssignments(companyId);
  await refreshAfterSave(companyId);
  response.json({ company: toCompanyProfile(company) });
}

export async function syncMyMatchingTags(request, response) {
  const companyId = companyIdOf(request);
  const assignments = await syncCompanyProfileTagAssignments(companyId);
  await refreshAfterSave(companyId);
  response.json({ linkedCapabilities: assignments?.length ?? 0 });
}
