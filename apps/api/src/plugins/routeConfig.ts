/**
 * Configurazione che una rotta può dichiarare, oltre a quella di Fastify.
 *
 * Sta in un file solo perché i due hook che la leggono — quello anti-CSRF e
 * quello del registro delle operazioni — vedano la stessa forma, e perché il
 * compilatore rifiuti un nome scritto male invece di ignorarlo.
 */
import type { AdminArea } from '../auth/areas.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * `false` toglie la rotta dal controllo anti-CSRF. Vale per l'accesso, che
     * una sessione da proteggere ancora non ce l'ha.
     */
    csrf?: false;
    /** Nome dell'azione a registro. Senza, si usa metodo e percorso della rotta. */
    audit?: { action: string; entityType?: string };
    /**
     * Area a cui la rotta appartiene. Dichiarata per modulo in `app.ts`, non
     * rotta per rotta: un modulo sta in una sola area, e ripeterlo su ogni
     * rotta significherebbe soltanto poterlo scrivere diverso una volta.
     *
     * Una rotta senza area è raggiungibile da qualunque veste: sono l'accesso,
     * la scelta della veste, lo stato del servizio e la specifica.
     */
    area?: AdminArea;
  }
}

export {};
