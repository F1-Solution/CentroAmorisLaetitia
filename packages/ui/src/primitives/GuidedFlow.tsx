import type { ReactNode } from 'react';
import { Button } from './Button';
import { Alert } from './Alert';
import './GuidedFlow.css';

export interface GuidedFlowStep {
  key: string;
  title: string;
  content: ReactNode;
}

export interface GuidedFlowProps {
  steps: GuidedFlowStep[];
  currentStepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  loading?: boolean;
  errorText?: string;
  disabled?: boolean;
  finishLabel?: string;
}

/**
 * Componente 54: percorso a passi numerati, riservato alle **operazioni rare e
 * delicate**, mai a quelle quotidiane (prestito 1 dalla proposta 2
 * «Accoglienza»). In Fase 1 non ha un caso d'uso obbligato: si costruisce qui
 * e si usa quando un'operazione rara lo richiede.
 */
export function GuidedFlow({
  steps,
  currentStepIndex,
  onBack,
  onNext,
  onFinish,
  loading = false,
  errorText,
  disabled = false,
  finishLabel = 'Concludi',
}: GuidedFlowProps): React.JSX.Element {
  const safeIndex = Math.min(Math.max(0, currentStepIndex), steps.length - 1);
  const step = steps[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === steps.length - 1;

  return (
    <div>
      <ol className="amoris-guided-flow__steps">
        {steps.map((s, index) => (
          <li
            key={s.key}
            className={[
              'amoris-guided-flow__step',
              index === safeIndex ? 'amoris-guided-flow__step--current' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={index === safeIndex ? 'step' : undefined}
          >
            <span className="amoris-guided-flow__step-number">{index + 1}</span>
            {s.title}
          </li>
        ))}
      </ol>

      {step ? (
        <div>
          <h2 className="amoris-guided-flow__title">{step.title}</h2>
          {errorText ? (
            <Alert variant="error" title="Non è stato possibile continuare">
              {errorText}
            </Alert>
          ) : null}
          {step.content}
        </div>
      ) : null}

      <div className="amoris-guided-flow__actions">
        <Button variant="secondary" onClick={onBack} disabled={disabled || loading || isFirst}>
          Indietro
        </Button>
        {isLast ? (
          <Button variant="primary" onClick={onFinish} disabled={disabled} loading={loading}>
            {finishLabel}
          </Button>
        ) : (
          <Button variant="primary" onClick={onNext} disabled={disabled} loading={loading}>
            Avanti
          </Button>
        )}
      </div>
    </div>
  );
}
