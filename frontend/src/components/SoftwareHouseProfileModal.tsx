'use client';
import { useLanguage } from '@/lib/LanguageProvider';


import React, { useEffect, useRef, useState } from 'react';
import { SoftwareHouseProfile } from '@/types';
import { BANGKOK_DISTRICTS } from '@/data/mockData';
import { ContractorServices } from './ContractorServices';
import { listTags, type ControlledTag } from '@/lib/tagApi';
import {
  X,
  Plus,
  Save,
  CheckCircle2
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SoftwareHouseProfile;
  onSave: (updatedProfile: SoftwareHouseProfile) => Promise<void>;
}

export const SoftwareHouseProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSave
}) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<SoftwareHouseProfile>({ ...currentUser });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ControlledTag[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const wasOpen = useRef(false);
  const lastCurrentUser = useRef(currentUser);

  useEffect(() => {
    const opening = isOpen && !wasOpen.current;
    const profileChanged = lastCurrentUser.current !== currentUser;
    if (isOpen && (opening || profileChanged)) {
      setProfile({ ...currentUser });
      if (opening) {
        setSaveError(null);
        setSavedSuccess(false);
      }
    }
    lastCurrentUser.current = currentUser;
    wasOpen.current = isOpen;
  }, [currentUser, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setCatalogError(false);
    setTagSearch('');
    void listTags().then(tags => {
      if (!cancelled) setCatalog(tags.filter(tag => tag.status !== 'inactive' && tag.contractorLabel));
    }).catch(() => { if (!cancelled) setCatalogError(true); });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Searchable catalog picker: capabilities can ONLY be chosen from the tag
  // catalog (shown by contractor label), never typed in as free text.
  const selectedTagIds = new Set((profile.tags ?? []).map((link) => link.tagId));
  const query = tagSearch.trim().toLocaleLowerCase('en-US');
  const tagMatches = query
    ? catalog
        .filter((tag) => !selectedTagIds.has(tag._id))
        .filter((tag) => [tag.contractorLabel, tag.text, tag.name, ...(tag.aliases ?? [])]
          .filter(Boolean).join(' ').toLocaleLowerCase('en-US').includes(query))
        .slice(0, 25)
    : [];

  const addTag = (tag: ControlledTag) => {
    setProfile((previous) => ({
      ...previous,
      tags: [...(previous.tags ?? []), {
        tagId: tag._id,
        contractorLabel: tag.contractorLabel,
        text: tag.text ?? tag.name,
        category: tag.category,
        type: tag.type,
        status: tag.status
      }]
    }));
    setTagSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(profile);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (error) {
      setSaveError((error as Error).message || 'The company profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden p-6 md:p-8 my-8 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header matching Desktop - data */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <img
            src={profile.avatar}
            alt={profile.companyName}
            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-sky-500/50"
          />
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t("Company profile")} <span className="text-slate-500 dark:text-slate-400 text-lg font-normal">{t("Software house profile")}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("Manage company capabilities and qualifications for matching TOR projects.")} </p>
          </div>
        </div>

        {/* Form Body matching Desktop - data wireframe */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* General Company Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t("Software company name")} </label>
              <input
                type="text"
                required
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                className="w-full px-4 py-2.5 theme-input rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t("Office location")} </label>
              <select
                value={profile.district}
                onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                className="w-full px-4 py-2.5 theme-input rounded-xl text-sm cursor-pointer"
              >
                {BANGKOK_DISTRICTS.map(d => (
                  <option key={d} value={d} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t("Company Size")} </label>
              <input
                type="text"
                value={profile.companySize}
                onChange={(e) => setProfile({ ...profile, companySize: e.target.value })}
                className="w-full px-4 py-2.5 theme-input rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t("Primary contact email")} </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-4 py-2.5 theme-input rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <ContractorServices tags={profile.tags ?? []} onRemove={tagId => setProfile(previous => ({ ...previous, tags: (previous.tags ?? []).filter(tag => tag.tagId !== tagId) }))} />
            <div className="space-y-2">
              <input
                type="text"
                value={tagSearch}
                onChange={event => setTagSearch(event.target.value)}
                placeholder={t('Search contractor services…')}
                aria-label={t('Search contractor services')}
                className="w-full theme-input rounded-lg px-3 py-2 text-sm placeholder-slate-400"
              />
              {tagSearch.trim() && (
                <ul className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {tagMatches.length ? tagMatches.map(tag => (
                    <li key={tag._id}>
                      <button
                        type="button"
                        onClick={() => addTag(tag)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Plus className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>{tag.contractorLabel || tag.text}</span>
                      </button>
                    </li>
                  )) : (
                    <li className="px-3 py-2 text-xs text-slate-500">{t('No matching services.')}</li>
                  )}
                </ul>
              )}
            </div>
            {catalogError && <p role="status" className="text-xs text-slate-500">{t('Could not load contractor services.')}</p>}
          </div>

          {/* Alert Success */}
          {savedSuccess && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
              <span>{t("Profile saved successfully.")}</span>
            </div>
          )}
          {saveError && (
            <div role="alert" className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
              {saveError}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
            >{t("Cancel")} </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving…' : t("Save Profile")}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
