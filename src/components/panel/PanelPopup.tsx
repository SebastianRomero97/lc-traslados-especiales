'use client';

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';

export type PopupKind = 'success' | 'error' | 'warning';

type AlertPopup = {
  mode: 'alert';
  kind: PopupKind;
  message: string;
  title?: string;
};

type ConfirmPopup = {
  mode: 'confirm';
  kind: 'warning';
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (ok: boolean) => void;
};

type PopupState = AlertPopup | ConfirmPopup | null;

const KIND_META: Record<
  PopupKind,
  { icon: string; title: string; iconClass: string }
> = {
  success: { icon: '✓', title: 'Listo', iconClass: 'panel-popup__icon--success' },
  error: { icon: '✕', title: 'Error', iconClass: 'panel-popup__icon--error' },
  warning: { icon: '!', title: 'Atención', iconClass: 'panel-popup__icon--warning' },
};

export function PanelPopup({
  popup,
  onClose,
}: {
  popup: PopupState;
  onClose: () => void;
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!popup) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (popup.mode === 'confirm') popup.resolve(false);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popup, onClose]);

  if (!popup) return null;

  const meta = KIND_META[popup.kind];
  const title = popup.title ?? meta.title;

  const finishConfirm = (ok: boolean) => {
    if (popup.mode === 'confirm') popup.resolve(ok);
    onClose();
  };

  return (
    <div className="panel-popup" role="presentation" onClick={() => finishConfirm(false)}>
      <div
        className={`panel-popup__card panel-popup__card--${popup.kind}`}
        role={popup.mode === 'confirm' ? 'alertdialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`panel-popup__icon ${meta.iconClass}`} aria-hidden="true">
          {meta.icon}
        </div>
        <h3 id={titleId} className="panel-popup__title">
          {title}
        </h3>
        <p id={descId} className="panel-popup__message">
          {popup.message}
        </p>

        {popup.mode === 'confirm' ? (
          <div className="panel-popup__actions">
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => finishConfirm(false)}
            >
              {popup.cancelLabel ?? 'Cancelar'}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => finishConfirm(true)}
            >
              {popup.confirmLabel ?? 'Confirmar'}
            </button>
          </div>
        ) : (
          <div className="panel-popup__actions">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Aceptar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function usePanelPopup() {
  const [popup, setPopup] = useState<PopupState>(null);

  const close = useCallback(() => setPopup(null), []);

  const notify = useCallback((kind: PopupKind, message: string, title?: string) => {
    setPopup({ mode: 'alert', kind, message, title });
  }, []);

  const success = useCallback(
    (message: string, title?: string) => notify('success', message, title),
    [notify],
  );
  const error = useCallback(
    (message: string, title?: string) => notify('error', message, title),
    [notify],
  );
  const warning = useCallback(
    (message: string, title?: string) => notify('warning', message, title),
    [notify],
  );

  const confirm = useCallback(
    (options: {
      message: string;
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
    }) =>
      new Promise<boolean>((resolve) => {
        setPopup({
          mode: 'confirm',
          kind: 'warning',
          message: options.message,
          title: options.title ?? 'Confirmar acción',
          confirmLabel: options.confirmLabel,
          cancelLabel: options.cancelLabel,
          resolve,
        });
      }),
    [],
  );

  const popupNode: ReactNode = <PanelPopup popup={popup} onClose={close} />;

  return { success, error, warning, confirm, popupNode, close };
}
