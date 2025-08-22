/**
 * Módulo simple de caché en memoria para mejorar el rendimiento de consultas frecuentes
 */

// Almacén de caché
const cache = new Map();

// Tiempo de expiración predeterminado en milisegundos (5 minutos)
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Obtiene un valor de la caché
 * @param {string} key - Clave para buscar en la caché
 * @returns {any|null} - El valor almacenado o null si no existe o expiró
 */
const get = (key) => {
  if (!cache.has(key)) return null;
  
  const cachedItem = cache.get(key);
  const now = Date.now();
  
  // Verificar si el ítem ha expirado
  if (now > cachedItem.expiry) {
    cache.delete(key);
    return null;
  }
  
  return cachedItem.value;
};

/**
 * Almacena un valor en la caché
 * @param {string} key - Clave para almacenar el valor
 * @param {any} value - Valor a almacenar
 * @param {number} [ttl=DEFAULT_TTL] - Tiempo de vida en milisegundos
 */
const set = (key, value, ttl = DEFAULT_TTL) => {
  const expiry = Date.now() + ttl;
  cache.set(key, { value, expiry });
};

/**
 * Elimina un valor de la caché
 * @param {string} key - Clave a eliminar
 */
const del = (key) => {
  cache.delete(key);
};

/**
 * Elimina todos los valores de la caché
 */
const clear = () => {
  cache.clear();
};

/**
 * Elimina las claves que coincidan con un patrón
 * @param {RegExp} pattern - Patrón para comparar con las claves
 */
const invalidatePattern = (pattern) => {
  for (const key of cache.keys()) {
    if (pattern.test(key)) {
      cache.delete(key);
    }
  }
};

/**
 * Función de ayuda para obtener un valor de la caché o ejecutar una función si no existe
 * @param {string} key - Clave para buscar en la caché
 * @param {Function} fn - Función a ejecutar si el valor no está en caché
 * @param {number} [ttl=DEFAULT_TTL] - Tiempo de vida en milisegundos
 * @returns {Promise<any>} - El valor de la caché o el resultado de la función
 */
const getOrSet = async (key, fn, ttl = DEFAULT_TTL) => {
  const cachedValue = get(key);
  if (cachedValue !== null) {
    return cachedValue;
  }
  
  const value = await fn();
  set(key, value, ttl);
  return value;
};

module.exports = {
  get,
  set,
  del,
  clear,
  invalidatePattern,
  getOrSet
};
