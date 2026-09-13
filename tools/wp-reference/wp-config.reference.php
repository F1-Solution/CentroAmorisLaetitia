<?php
/**
 * wp-config per l'ISTANZA DI RIFERIMENTO.
 *
 * Sostituisce il wp-config.php di produzione, che contiene credenziali reali e
 * non viene mai copiato né stampato. Qui i valori arrivano dall'ambiente.
 *
 * Le costanti di "contenimento" in fondo servono a garantire che questa istanza
 * non invii email, non si aggiorni, non esegua job pianificati e non chiami
 * servizi esterni (approvazione D2b, punto 3).
 */

define( 'DB_NAME',     getenv( 'WPREF_DB_NAME' ) );
define( 'DB_USER',     getenv( 'WPREF_DB_USER' ) );
define( 'DB_PASSWORD', getenv( 'WPREF_DB_PASSWORD' ) );
define( 'DB_HOST',     getenv( 'WPREF_DB_HOST' ) );
define( 'DB_CHARSET',  'utf8' );   // come in produzione
define( 'DB_COLLATE',  '' );

$table_prefix = 'wp_';

// Chiavi rigenerate: quelle di produzione non vengono mai lette né copiate.
// Questa istanza non serve ad autenticarsi, solo a renderizzare pagine pubbliche.
define( 'AUTH_KEY',         'reference-instance-not-a-production-secret-01' );
define( 'SECURE_AUTH_KEY',  'reference-instance-not-a-production-secret-02' );
define( 'LOGGED_IN_KEY',    'reference-instance-not-a-production-secret-03' );
define( 'NONCE_KEY',        'reference-instance-not-a-production-secret-04' );
define( 'AUTH_SALT',        'reference-instance-not-a-production-secret-05' );
define( 'SECURE_AUTH_SALT', 'reference-instance-not-a-production-secret-06' );
define( 'LOGGED_IN_SALT',   'reference-instance-not-a-production-secret-07' );
define( 'NONCE_SALT',       'reference-instance-not-a-production-secret-08' );

$wpref_url = getenv( 'WPREF_SITE_URL' ) ?: 'http://localhost:8080';
define( 'WP_HOME',    $wpref_url );
define( 'WP_SITEURL', $wpref_url );

// --- Contenimento -----------------------------------------------------------
define( 'DISABLE_WP_CRON',                true );  // nessun job pianificato
define( 'AUTOMATIC_UPDATER_DISABLED',     true );  // nessun aggiornamento automatico
define( 'WP_AUTO_UPDATE_CORE',            false );
define( 'DISALLOW_FILE_MODS',             true );  // nessuna installazione o modifica di file
define( 'WP_HTTP_BLOCK_EXTERNAL',         true );  // nessuna chiamata HTTP in uscita
define( 'WP_ACCESSIBLE_HOSTS',            '' );    // nessun host in whitelist
define( 'WPMS_ON',                        false ); // WP Mail SMTP disattivato
define( 'WP_DEBUG',                       false ); // come in produzione
define( 'WP_DEBUG_DISPLAY',               false );

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', dirname( __FILE__ ) . '/' );
}

require_once ABSPATH . 'wp-settings.php';
