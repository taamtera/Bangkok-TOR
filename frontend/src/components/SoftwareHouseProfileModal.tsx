'use client';
import { useLanguage } from '@/lib/LanguageProvider';


import React, { useEffect, useRef, useState } from 'react';
import { SoftwareHouseProfile } from '@/types';
import { BANGKOK_DISTRICTS } from '@/data/mockData';
import { 
  X, 
  ShieldCheck, 
  Plus, 
  Trash2, 
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
  const [newProperty, setNewProperty] = useState('');
  const [newTech, setNewTech] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  if (!isOpen) return null;

  const handleAddProperty = () => {
    if (newProperty.trim()) {
      setProfile(prev => ({
        ...prev,
        properties: [...prev.properties, newProperty.trim()]
      }));
      setNewProperty('');
    }
  };

  const handleRemoveProperty = (index: number) => {
    setProfile(prev => ({
      ...prev,
      properties: prev.properties.filter((_, i) => i !== index)
    }));
  };

  const handleAddTech = () => {
    if (newTech.trim()) {
      setProfile(prev => ({
        ...prev,
        technologies: [...prev.technologies, newTech.trim()]
      }));
      setNewTech('');
    }
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

          {/* Section: คุณสมบัติ & ศักยภาพบริษัท (property list input matching wireframe 'property') */}
          <div className="bg-slate-50 dark:bg-slate-950/70 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>{t("property list")}</span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {profile.properties.length}{t("Active Items")} </span>
            </div>

            {/* List of active properties */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {profile.properties.map((prop, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span>{prop}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveProperty(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new property line */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={newProperty}
                onChange={(e) => setNewProperty(e.target.value)}
                placeholder={t("Add a qualification, such as ISO 27001 or GIS experience")}
                className="flex-1 px-4 py-2 theme-input rounded-xl text-xs placeholder-slate-400"
              />
              <button
                type="button"
                onClick={handleAddProperty}
                className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{t("Add property")}</span>
              </button>
            </div>
          </div>

          {/* Section: Technologies */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("Technology expertise")} </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {profile.technologies.map((tech, idx) => (
                <span key={idx} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700">
                  {tech}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                placeholder={t("For example: Docker, PostgreSQL, Flutter...")}
                className="flex-1 px-4 py-2 theme-input rounded-xl text-xs placeholder-slate-400"
              />
              <button
                type="button"
                onClick={handleAddTech}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all shrink-0 border border-slate-200 dark:border-slate-700"
              >{t("+ Add technology")} </button>
            </div>
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
