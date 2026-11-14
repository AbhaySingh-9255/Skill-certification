import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Bell,
  Database,
  Download,
  ImagePlus,
  LockKeyhole,
  LogOut,
  Palette,
  Shield,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from './Button';
import { useAuthStore } from '../store/authStore';
import {
  downloadAccountData,
  fetchNotificationPreferences,
  fetchPrivacyPreferences,
  saveNotificationPreferences,
  savePrivacyPreferences,
  type NotificationPreferences,
  type PrivacyPreferences,
} from '../services/settingsService';

type SettingsTab = 'profile' | 'appearance' | 'security' | 'notifications' | 'privacy';
type Theme = 'light' | 'dark' | 'system';
type Density = 'comfortable' | 'compact';

const getStoredOption = <T extends string>(
  key: string,
  options: readonly T[],
  fallback: T,
): T => {
  const saved = window.localStorage.getItem(key);
  return options.find((option) => option === saved) ?? fallback;
};

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof UserRound }> = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: LockKeyhole },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Shield },
];

const resizeProfilePhoto = async (file: File): Promise<string> => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MB.');
  }
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not process this image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('Could not encode the selected image.')),
        'image/jpeg',
        0.82,
      );
    });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Could not read the selected image.'));
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.readAsDataURL(blob);
    });
    if (dataUrl.length > 900_000) throw new Error('Choose a smaller image.');
    return dataUrl;
  } finally {
    image.close();
  }
};

export const SettingsDialog = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { user, token, updateProfile, changePassword, logoutOtherSessions, deleteAccount } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto ?? null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [privacyPreferences, setPrivacyPreferences] = useState<PrivacyPreferences | null>(null);
  const [theme, setTheme] = useState<Theme>(() =>
    getStoredOption('skillcert-theme', ['light', 'dark', 'system'], 'light'),
  );
  const [density, setDensity] = useState<Density>(() =>
    getStoredOption('skillcert-density', ['comfortable', 'compact'], 'comfortable'),
  );
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [appearanceError, setAppearanceError] = useState('');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (!isOpen || !token || !['notifications', 'privacy'].includes(activeTab)) return;
    let active = true;
    const loadPreferences = async () => {
      setErrorMessage('');
      try {
        if (activeTab === 'notifications') {
          const preferences = await fetchNotificationPreferences(token);
          if (active) setNotificationPreferences(preferences);
        } else {
          const preferences = await fetchPrivacyPreferences(token);
          if (active) setPrivacyPreferences(preferences);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load preferences.');
        }
      }
    };
    void loadPreferences();
    return () => {
      active = false;
    };
  }, [activeTab, isOpen, token]);

  useEffect(() => {
    const applyTheme = () => {
      const isDark = theme === 'dark'
        || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    };

    applyTheme();
    document.documentElement.dataset.density = density;

    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [density, theme]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setBusy(true);
    try {
      await updateProfile(name, email, profilePhoto);
      setSuccessMessage('Your profile has been updated.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Profile update failed.');
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      setProfilePhoto(await resizeProfilePhoto(file));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Could not process the selected photo.');
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (newPassword.length < 12) {
      setErrorMessage('Your new password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('The new passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password updated. Your other sessions have been signed out.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Password change failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!token || !notificationPreferences) return;
    setErrorMessage('');
    setSuccessMessage('');
    setBusy(true);
    try {
      const saved = await saveNotificationPreferences(token, notificationPreferences);
      setNotificationPreferences(saved);
      setSuccessMessage('Notification preferences saved.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save notification preferences.');
    } finally {
      setBusy(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (!token || !privacyPreferences) return;
    setErrorMessage('');
    setSuccessMessage('');
    setBusy(true);
    try {
      const saved = await savePrivacyPreferences(token, privacyPreferences);
      setPrivacyPreferences(saved);
      setSuccessMessage('Privacy preferences saved.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save privacy preferences.');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    if (!token) return;
    setErrorMessage('');
    setSuccessMessage('');
    setBusy(true);
    try {
      await downloadAccountData(token);
      setSuccessMessage('Your account data export has been downloaded.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not export account data.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogoutOtherSessions = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setBusy(true);
    try {
      await logoutOtherSessions();
      setSuccessMessage('Other sessions have been signed out. This session remains active.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not sign out other sessions.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (deleteConfirmation !== 'DELETE') {
      setErrorMessage('Type DELETE exactly to confirm account deletion.');
      return;
    }
    setErrorMessage('');
    setBusy(true);
    try {
      await deleteAccount(deletePassword);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not delete the account.');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="flex max-h-[min(760px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-textMuted">Your account</p>
            <h2 id="settings-title" className="mt-1 text-2xl font-bold text-navy">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-navy"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[200px_1fr]">
          <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto border-b border-gray-100 p-3 md:flex-col md:border-b-0 md:border-r md:p-4">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={activeTab === id ? 'page' : undefined}
                onClick={() => {
                  setActiveTab(id);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  activeTab === id
                    ? 'bg-teal/10 text-teal'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-navy'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <div className="overflow-y-auto p-5 sm:p-7">
            {activeTab === 'profile' && (
              <form className="space-y-5" onSubmit={(event) => void handleProfileSubmit(event)}>
                <div>
                  <h3 className="text-lg font-semibold text-navy">Profile information</h3>
                  <p className="mt-1 text-sm text-textMuted">Update your name, email, and profile photo.</p>
                </div>
                <div className="flex items-center gap-4">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="Profile"
                      className="h-16 w-16 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-slateBg text-textMuted">
                      <UserRound size={28} aria-hidden="true" />
                    </span>
                  )}
                  <div className="space-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-slateBg">
                      <ImagePlus size={16} aria-hidden="true" />
                      Choose photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(event) => void handlePhotoChange(event)}
                      />
                    </label>
                    {profilePhoto && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfilePhoto(null);
                          setPhotoError('');
                        }}
                        className="ml-3 text-sm text-textMuted underline underline-offset-2 hover:text-navy"
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-xs text-textMuted">JPEG, PNG, or WebP. Resized before upload.</p>
                  </div>
                </div>
                {photoError && <p role="alert" className="text-sm text-red-700">{photoError}</p>}
                <div>
                  <label htmlFor="settings-name" className="mb-1.5 block text-sm font-medium text-gray-700">Display name</label>
                  <input
                    id="settings-name"
                    autoComplete="name"
                    maxLength={120}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-teal"
                  />
                </div>
                <div>
                  <label htmlFor="settings-email" className="mb-1.5 block text-sm font-medium text-gray-700">Email address</label>
                  <input
                    id="settings-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-teal"
                  />
                </div>
                <Button type="submit" variant="accent" disabled={busy}>
                  {busy ? 'Saving…' : 'Save profile'}
                </Button>
              </form>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-7">
                <div>
                  <h3 className="text-lg font-semibold text-navy">Appearance</h3>
                  <p className="mt-1 text-sm text-textMuted">Personalize how SkillCert Pro looks on this device.</p>
                </div>
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold text-navy">Color theme</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([
                      ['light', 'Light', 'Clean and bright'],
                      ['dark', 'Dark', 'Easy on the eyes'],
                      ['system', 'System', 'Follow your device'],
                    ] as const).map(([value, label, detail]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={theme === value}
                        onClick={() => {
                          setTheme(value);
                          try {
                            window.localStorage.setItem('skillcert-theme', value);
                            setAppearanceError('');
                          } catch {
                            setAppearanceError('Your preference is active for this visit but could not be saved in this browser.');
                          }
                        }}
                        className={`rounded-xl border p-4 text-left transition ${
                          theme === value ? 'border-teal bg-slateBg' : 'border-gray-200 hover:border-teal/50'
                        }`}
                      >
                        <span className="block text-sm font-semibold text-navy">{label}</span>
                        <span className="mt-1 block text-xs text-textMuted">{detail}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold text-navy">Interface density</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      ['comfortable', 'Comfortable', 'More space between elements'],
                      ['compact', 'Compact', 'Fit more content on screen'],
                    ] as const).map(([value, label, detail]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={density === value}
                        onClick={() => {
                          setDensity(value);
                          try {
                            window.localStorage.setItem('skillcert-density', value);
                            setAppearanceError('');
                          } catch {
                            setAppearanceError('Your preference is active for this visit but could not be saved in this browser.');
                          }
                        }}
                        className={`rounded-xl border p-4 text-left transition ${
                          density === value ? 'border-teal bg-slateBg' : 'border-gray-200 hover:border-teal/50'
                        }`}
                      >
                        <span className="block text-sm font-semibold text-navy">{label}</span>
                        <span className="mt-1 block text-xs text-textMuted">{detail}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {appearanceError && <p role="status" className="text-sm text-orange-700">{appearanceError}</p>}
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-8">
                <form className="space-y-5" onSubmit={(event) => void handlePasswordSubmit(event)}>
                  <div>
                    <h3 className="text-lg font-semibold text-navy">Change password</h3>
                    <p className="mt-1 text-sm text-textMuted">Use at least 12 characters. Changing it signs out other sessions.</p>
                  </div>
                  <div>
                    <label htmlFor="settings-current-password" className="mb-1.5 block text-sm font-medium text-gray-700">Current password</label>
                    <input
                      id="settings-current-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-teal"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-new-password" className="mb-1.5 block text-sm font-medium text-gray-700">New password</label>
                    <input
                      id="settings-new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-teal"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">Confirm new password</label>
                    <input
                      id="settings-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-teal"
                    />
                  </div>
                  <Button type="submit" variant="accent" disabled={busy}>
                    {busy ? 'Updating…' : 'Update password'}
                  </Button>
                </form>

                <section className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-navy">Sessions</h3>
                  <p className="mt-1 text-sm text-textMuted">
                    Sign out other devices and browsers. This session will stay active.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void handleLogoutOtherSessions()}
                    className="mt-4 gap-2"
                  >
                    <LogOut size={16} aria-hidden="true" />
                    Sign out other sessions
                  </Button>
                </section>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-navy">Notification preferences</h3>
                  <p className="mt-1 text-sm text-textMuted">Choose which account notifications you want enabled.</p>
                </div>
                {!notificationPreferences && !errorMessage && (
                  <p role="status" className="text-sm text-textMuted">Loading preferences…</p>
                )}
                {notificationPreferences && (
                  <>
                    <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.in_app_notifications_enabled}
                        onChange={(event) => setNotificationPreferences({
                          ...notificationPreferences,
                          in_app_notifications_enabled: event.target.checked,
                        })}
                        className="mt-1 accent-[#245B4A]"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-navy">In-app notifications</span>
                        <span className="mt-1 block text-sm text-textMuted">Show assessment result notifications in your account.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.email_notifications_enabled}
                        onChange={(event) => setNotificationPreferences({
                          ...notificationPreferences,
                          email_notifications_enabled: event.target.checked,
                        })}
                        className="mt-1 accent-[#245B4A]"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-navy">Email notification preference</span>
                        <span className="mt-1 block text-sm text-textMuted">
                          Saved as a preference only. Email delivery is not configured, so emails are not currently sent.
                        </span>
                      </span>
                    </label>
                    <Button type="button" variant="accent" disabled={busy} onClick={() => void handleSaveNotifications()}>
                      {busy ? 'Saving…' : 'Save notification preferences'}
                    </Button>
                  </>
                )}
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-navy">Privacy preferences</h3>
                    <p className="mt-1 text-sm text-textMuted">Manage how your account data is used.</p>
                  </div>
                  {!privacyPreferences && !errorMessage && (
                    <p role="status" className="text-sm text-textMuted">Loading preferences…</p>
                  )}
                  {privacyPreferences && (
                    <>
                      <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
                        <input
                          type="checkbox"
                          checked={privacyPreferences.share_usage_data}
                          onChange={(event) => setPrivacyPreferences({
                            share_usage_data: event.target.checked,
                          })}
                          className="mt-1 accent-[#245B4A]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-navy">Share optional usage data</span>
                          <span className="mt-1 block text-sm text-textMuted">
                            Preference is saved for your account. Product analytics collection is not currently enabled.
                          </span>
                        </span>
                      </label>
                      <Button type="button" variant="accent" disabled={busy} onClick={() => void handleSavePrivacy()}>
                        {busy ? 'Saving…' : 'Save privacy preferences'}
                      </Button>
                    </>
                  )}
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                  <div>
                    <h3 className="text-lg font-semibold text-navy">Your account data</h3>
                    <p className="mt-1 text-sm text-textMuted">Download a copy of your profile, results, notifications, and reports.</p>
                  </div>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleExport()} className="gap-2">
                    <Download size={16} aria-hidden="true" />
                    Download my data
                  </Button>
                </section>

                <section className="space-y-4 border-t border-gray-200 pt-6">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-navy">
                      <Database size={18} aria-hidden="true" />
                      Delete account
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-textMuted">
                      Your profile, photo, and preferences will be removed and you’ll be signed out. Assessment records may be retained in anonymized form to preserve shared course history.
                    </p>
                  </div>
                  <form className="space-y-3" onSubmit={(event) => void handleDeleteAccount(event)}>
                    <div>
                      <label htmlFor="delete-account-password" className="mb-1.5 block text-sm font-medium text-gray-700">Current password</label>
                      <input
                        id="delete-account-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={deletePassword}
                        onChange={(event) => setDeletePassword(event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-teal"
                      />
                    </div>
                    <div>
                      <label htmlFor="delete-account-confirmation" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Type <span className="font-bold">DELETE</span> to confirm
                      </label>
                      <input
                        id="delete-account-confirmation"
                        required
                        value={deleteConfirmation}
                        onChange={(event) => setDeleteConfirmation(event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-teal"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={busy || deleteConfirmation !== 'DELETE'}
                      className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      {busy ? 'Deleting…' : 'Permanently delete account'}
                    </Button>
                  </form>
                </section>
              </div>
            )}

            {(errorMessage || successMessage) && (
              <p
                role={errorMessage ? 'alert' : 'status'}
                className={`mt-5 rounded-lg border px-3 py-2.5 text-sm ${
                  errorMessage
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-green-200 bg-green-50 text-green-700'
                }`}
              >
                {errorMessage || successMessage}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
