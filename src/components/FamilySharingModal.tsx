/**
 * Family Sharing modal: invite members, list members, remove (admin only).
 * Used by both Family Sharing and Roles & Permissions cards.
 */

import React, { useState, useEffect } from 'react';
import { X, Copy, Mail, MessageCircle, Share2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthProvider';
import { useUserRole } from '../context/UserRoleProvider';
import { useToast } from '../context/ToastProvider';
import { APP_URL } from '../lib/appConfig';
import type { UsersDataMember } from '../lib/drive';

function roleLabel(role: string, t: (k: string) => string): string {
  if (role === 'admin') return t('roles_admin');
  if (role === 'editor') return t('roles_editor');
  return t('roles_viewer');
}

interface FamilySharingModalProps {
  open: boolean;
  onClose: () => void;
  /** When true, show as "Roles & Permissions" (members focus). When false, show as "Family Sharing" (invite focus). */
  rolesMode?: boolean;
}

export function FamilySharingModal({ open, onClose, rolesMode }: FamilySharingModalProps) {
  const { t } = useI18n();
  const { isConnected, email } = useAuth();
  const { userRole, members, isLoading, refreshMembers, addMember, removeMember, updateMemberRole } = useUserRole();
  const { showToast } = useToast();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [changingRoleEmail, setChangingRoleEmail] = useState<string | null>(null);
  const [showInvitePanel, setShowInvitePanel] = useState(false);

  const isAdmin = userRole === 'admin';

  const inviteSubject = t('invite_msg_subject');
  const inviteBody = t('invite_msg_body').replace('{appUrl}', APP_URL);
  const inviteFullText = `${inviteSubject}\n\n${inviteBody}`;

  useEffect(() => {
    if (open && isConnected) {
      refreshMembers();
    }
    if (!open) setShowInvitePanel(false);
  }, [open, isConnected, refreshMembers]);

  const handleInvite = async () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed) return;
    if (!isAdmin) return;
    setIsInviting(true);
    try {
      await addMember(trimmed, inviteRole);
      setInviteEmail('');
      setShowInvitePanel(true);
      showToast(t('sharing_invite_success'), 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already')) {
        showToast(t('sharing_member_already'), 'error');
      } else {
        showToast(`${t('sharing_invite_error')}: ${msg}`, 'error');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (m: UsersDataMember) => {
    if (!isAdmin) return;
    if (email && m.email.toLowerCase() === email.toLowerCase()) {
      showToast(t('sharing_cannot_remove_self'), 'error');
      return;
    }
    if (!window.confirm(t('sharing_remove_confirm').replace('{email}', m.email))) return;
    setRemovingEmail(m.email);
    try {
      await removeMember(m.email);
      showToast(t('sharing_remove_success'), 'success');
    } catch (e) {
      showToast(`${t('sharing_remove_error')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setRemovingEmail(null);
    }
  };

  const handleChangeRole = async (m: UsersDataMember, newRole: 'viewer' | 'editor') => {
    if (!isAdmin) return;
    if (m.role === 'admin') return;
    setChangingRoleEmail(m.email);
    try {
      await updateMemberRole(m.email, newRole);
      showToast(t('sharing_role_updated'), 'success');
    } catch (e) {
      showToast(`${t('sharing_remove_error')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setChangingRoleEmail(null);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteFullText);
      showToast(t('invite_copied_toast'), 'success');
    } catch {
      showToast(t('sharing_invite_error'), 'error');
    }
  };

  const handleMailto = () => {
    const mailto = `mailto:?subject=${encodeURIComponent(inviteSubject)}&body=${encodeURIComponent(inviteBody)}`;
    window.open(mailto, '_blank', 'noopener');
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(inviteFullText)}`;
    window.open(url, '_blank', 'noopener');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: inviteSubject,
          text: inviteBody,
          url: APP_URL,
        });
        showToast(t('sharing_invite_success'), 'success');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const modalTitle = rolesMode ? t('roles_modal_title') : t('sharing_modal_title');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-semibold text-stone-900">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {!isConnected ? (
            <p className="text-stone-600 text-sm">{t('sharing_connect_required')}</p>
          ) : (
            <>
              {isAdmin && !rolesMode && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-stone-700">{t('sharing_invite_title')}</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t('sharing_invite_email_placeholder')}
                      className="flex-1 min-h-[44px] px-4 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'editor')}
                      className="min-h-[44px] px-4 rounded-xl border border-stone-200 text-stone-900"
                    >
                      <option value="viewer">{t('sharing_role_viewer')}</option>
                      <option value="editor">{t('sharing_role_editor')}</option>
                    </select>
                    <button
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || isInviting}
                      className="min-h-[44px] px-4 py-2 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {t('sharing_invite_btn')}
                    </button>
                  </div>
                </div>
              )}

              {showInvitePanel && (
                <div className="space-y-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <h3 className="text-sm font-medium text-stone-700">{t('invite_msg_panel_title')}</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="min-h-[44px] px-4 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      {t('invite_copy_btn')}
                    </button>
                    <button
                      type="button"
                      onClick={handleMailto}
                      className="min-h-[44px] px-4 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      {t('invite_mailto_btn')}
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsApp}
                      className="min-h-[44px] px-4 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {t('invite_whatsapp_btn')}
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="min-h-[44px] px-4 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      {t('invite_share_btn')}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-stone-700">{t('sharing_members_title')}</h3>
                {isLoading ? (
                  <p className="text-stone-500 text-sm">...</p>
                ) : members.length === 0 ? (
                  <p className="text-stone-500 text-sm">{t('no_people')}</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((m) => {
                      const isSelf = email && m.email.toLowerCase() === email.toLowerCase();
                      const canRemove = isAdmin && !isSelf && m.permissionId;
                      const canChangeRole = isAdmin && !isSelf && m.role !== 'admin';
                      return (
                        <li
                          key={m.email}
                          className="flex items-center justify-between gap-2 p-3 rounded-xl bg-stone-50 border border-stone-100"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-stone-900 font-medium truncate">{m.email}</p>
                            <p className="text-xs text-stone-500">{roleLabel(m.role, t)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {canChangeRole && (
                              <select
                                value={m.role}
                                onChange={(e) => handleChangeRole(m, e.target.value as 'viewer' | 'editor')}
                                disabled={changingRoleEmail === m.email}
                                className="text-sm min-h-[36px] px-2 rounded-lg border border-stone-200 text-stone-700"
                              >
                                <option value="viewer">{t('sharing_role_viewer')}</option>
                                <option value="editor">{t('sharing_role_editor')}</option>
                              </select>
                            )}
                            {canRemove && (
                              <button
                                onClick={() => handleRemove(m)}
                                disabled={removingEmail === m.email}
                                className="min-h-[36px] px-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                              >
                                {t('sharing_member_remove')}
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-stone-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full min-h-[44px] px-4 py-3 rounded-xl font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
