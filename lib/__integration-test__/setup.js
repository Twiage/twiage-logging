// twiage-config reads TWIAGE_CONFIG_DIR when it is first required, so point it at
// the integration config (memory transport, request headers, static meta) first.
process.env.TWIAGE_CONFIG_DIR = 'lib/__integration-test__/config';
