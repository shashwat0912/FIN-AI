import { decodeToken } from '../utils/jwtUtils';

export interface ProfileIdentity {
  name: string;
  contact: string;
  initials: string;
}

const fallbackIdentity: ProfileIdentity = { name: 'User', contact: '', initials: 'U' };

const isEmailLike = (value?: unknown) => typeof value === 'string' && value.includes('@');

const isPhoneLike = (value?: unknown) => {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && (value.trim().startsWith('+') || digits.length >= value.replace(/\s/g, '').length * 0.7);
};

const initialsFor = (source: string) =>
  source
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';

export const readProfileIdentity = (): ProfileIdentity => {
  try {
    const token = localStorage.getItem('accessToken');
    const tokenUser = token ? decodeToken(token) : null;
    const candidates = [tokenUser?.email, tokenUser?.phone, tokenUser?.identifier, tokenUser?.loginId, tokenUser?.username];
    const email = candidates.find(isEmailLike) || '';
    const phone = candidates.find(isPhoneLike) || '';
    const id = tokenUser?.userId || email || phone || 'default';
    const savedProfile = localStorage.getItem(`userProfile_${id}`);
    const profile = savedProfile ? JSON.parse(savedProfile) : {};
    const name = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : 'User';
    const initialsSource = name !== 'User' ? name : email || phone || name;

    return { name, contact: email || phone, initials: initialsFor(initialsSource) };
  } catch {
    return fallbackIdentity;
  }
};
