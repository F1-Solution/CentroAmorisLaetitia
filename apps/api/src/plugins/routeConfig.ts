/**
 * Configurazione che una rotta può dichiarare, oltre a quella di Fastify.
 *
 * Sta in un file solo perché i due hook che la leggono — quello anti-CSRF e
 * quello del registro delle operazioni — vedano la stessa forma, e perché il
 * compilatore rifiuti un nome scritto male invece di ignorarlo.
 */
declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * `false` toglie la rotta dal controllo anti-CSRF. Vale per l'accesso, che
     * una sessione da proteggere ancora non ce l'ha.
     */
    csrf?: false;
    /** Nome dell'azione a registro. Senza, si usa metodo e percorso della rotta. */
    audit?: { action: string; entityType?: string };
  }
}

export {};
