const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * expo-notifications agrega automáticamente el entitlement "aps-environment"
 * (push remoto) aunque solo usemos notificaciones LOCALES. Con firma automática
 * y un equipo sin la capability de Push Notifications habilitada, eso rompe el
 * build ("Provisioning Profile does not support the Push Notifications
 * capability"). Este plugin quita el entitlement después de que los demás
 * plugins corrieron — debe ir al final del array "plugins" en app.json.
 */
module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
