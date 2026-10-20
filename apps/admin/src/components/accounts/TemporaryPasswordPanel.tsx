'use client';

import { Button } from '@amoris/ui';
import { useEffect, useRef, useState } from 'react';

export interface TemporaryPasswordPanelProps {
  readonly personName: string;
  readonly password: string;
  readonly onDismiss: () => void;
}

/**
 * Password temporanea, mostrata una sola volta (DR-228). Vive solo nello stato
 * del genitore: nessuna copia in `localStorage` né altrove, e sparisce con la
 * chiusura del pannello o con la navigazione.
 */
export function TemporaryPasswordPanel({
  personName,
  password,
  onDismiss,
}: TemporaryPasswordPanelProps): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(password);
      setCopied('yes');
    } catch {
      setCopied('no');
    }
  }

  return (
    <section
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-label="Password temporanea"
      className="amoris-accounts__password"
    >
      <h2 className="amoris-accounts__password-title">Password temporanea per {personName}</h2>
      <p className="amoris-accounts__password-value">
        <code>{password}</code>
      </p>
      <p className="amoris-accounts__password-warning">
        Questa password non verrà mostrata di nuovo: consegnala di persona alla persona interessata.
      </p>
      <div className="amoris-accounts__actions">
        <Button variant="secondary" onClick={() => void copy()}>
          Copia la password
        </Button>
        <Button onClick={onDismiss}>Ho consegnato la password</Button>
      </div>
      {copied === 'yes' ? <p role="status">Password copiata.</p> : null}
      {copied === 'no' ? (
        <p role="status">Non è stato possibile copiarla: selezionala e copiala a mano.</p>
      ) : null}
    </section>
  );
}
