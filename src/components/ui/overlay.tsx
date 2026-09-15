import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Button } from './button';

// Menu suspenso: fecha com Esc, clique fora ou ao escolher um item
export function Menu({ trigger, items, align = 'end' }: { trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode; items: ({ label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; hint?: string } | 'divider')[]; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (event: ReactKeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value), id })}
      {open ? (
        <div id={id} role="menu" onKeyDown={onMenuKey} className={`fade-in absolute top-full z-40 mt-1.5 min-w-52 rounded-xl border border-line bg-panel py-1.5 shadow-pop ${align === 'end' ? 'right-0' : 'left-0'}`}>
          {items.map((item, index) =>
            item === 'divider' ? (
              <div key={`divider-${index}`} className="my-1.5 h-px bg-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm outline-none hover:bg-hover focus-visible:bg-hover ${item.danger ? 'text-down' : 'text-ink'}`}
              >
                {item.icon ? <item.icon size={17} strokeWidth={1.9} className={item.danger ? '' : 'text-ink-2'} aria-hidden /> : null}
                <span className="flex-1">{item.label}</span>
                {item.hint ? <kbd className="font-sans text-2xs text-ink-3">{item.hint}</kbd> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

// <dialog> nativo: foco preso, Esc fecha e o fundo fica inerte sem biblioteca
export function Dialog({ open, onClose, title, children, className = '' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={`fade-in m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-panel p-0 text-ink shadow-pop ${className}`}
    >
      {open ? (
        <div className="p-5">
          {title ? <h2 className="mb-2 text-base font-medium">{title}</h2> : null}
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose }: { open: boolean; title: string; description: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-ink-2">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
