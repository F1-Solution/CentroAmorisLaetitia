import react from '@amoris/config/eslint/react';

/**
 * ADR-008 §3.3 regola 3: il sito pubblico **non importa** da `@amoris/ui`.
 * DR-018 vuole due estetiche distinte, e condividere componenti visivi le
 * farebbe convergere senza che nessuno lo decida. Qui la regola e' verificata dal
 * lint, non affidata alla buona volonta'.
 */
export default [
  ...react,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@amoris/ui', '@amoris/ui/*'],
              message:
                "Il sito pubblico non usa i componenti dell'area amministrativa (ADR-008 §3.3, DR-018).",
            },
          ],
        },
      ],
    },
  },
];
