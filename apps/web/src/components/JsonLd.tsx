import { serializeJsonLd, type JsonLdGraph } from '../lib/structuredData';

/** Il blocco `application/ld+json` della pagina; il testo è già neutralizzato per lo script (DR-170). */
export function JsonLd({ graph }: { readonly graph: JsonLdGraph }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
