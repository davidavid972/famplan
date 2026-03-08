import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-3 p-4 bg-muted border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-3 min-h-[44px] font-medium text-foreground bg-card border border-border rounded-xl hover:bg-muted transition-colors"
          >
            {cancelText || t('cancel')}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-3 min-h-[44px] font-medium text-white bg-destructive rounded-xl hover:bg-destructive/90 text-destructive-foreground transition-colors"
          >
            {confirmText || t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
};
