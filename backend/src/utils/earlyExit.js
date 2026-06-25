/**
 * Utilidades para gestión de salidas anticipadas
 * Valida y procesa registros de salidas autorizadas de estudiantes
 */

/**
 * Valida que una hora de salida anticipada sea válida
 * @param {string} horaSalida - Formato HH:MM:SS o HH:MM
 * @returns {boolean} true si es válida
 */
function validarHoraSalida(horaSalida) {
  if (!horaSalida || typeof horaSalida !== "string") {
    return false;
  }

  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  return regex.test(horaSalida);
}

/**
 * Valida que una fecha sea válida y no sea en el futuro
 * @param {string} fecha - Formato YYYY-MM-DD
 * @returns {boolean} true si es válida
 */
function validarFecha(fecha) {
  if (!fecha || typeof fecha !== "string") {
    return false;
  }

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(fecha)) {
    return false;
  }

  const [y, m, d] = fecha.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;

  const fechaObj = new Date(y, m - 1, d);
  if (
    fechaObj.getFullYear() !== y ||
    fechaObj.getMonth() !== m - 1 ||
    fechaObj.getDate() !== d
  ) {
    return false;
  }

  // Comparar usando fechas UTC para consistencia con formatos ISO
  const ahora = new Date();
  const hoyUTC = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  const fechaUTC = Date.UTC(y, m - 1, d);

  return fechaUTC <= hoyUTC;
}

/**
 * Valida que un motivo sea válido
 * @param {string} motivo - Descripción del motivo
 * @returns {boolean} true si es válido
 */
function validarMotivo(motivo) {
  if (!motivo || typeof motivo !== "string") {
    return false;
  }

  const motivoLimpio = motivo.trim();
  return motivoLimpio.length >= 3 && motivoLimpio.length <= 255;
}

/**
 * Valida que es_medico sea booleano
 * @param {any} esMedico - Booleano indicando si es por motivos médicos
 * @returns {boolean} true si es válido
 */
function validarEsMedico(esMedico) {
  return typeof esMedico === "boolean" || esMedico === 0 || esMedico === 1;
}

/**
 * Normaliza la hora a formato HH:MM:SS
 * @param {string} hora - Formato HH:MM o HH:MM:SS
 * @returns {string} Hora en formato HH:MM:SS
 */
function normalizarHora(hora) {
  if (!hora) return null;

  const partes = hora.split(":");
  if (partes.length === 2) {
    return `${partes[0]}:${partes[1]}:00`;
  }
  return hora;
}

/**
 * Valida completamente un registro de salida anticipada
 * @param {Object} datos - Objeto con los datos a validar
 * @returns {Object} { valido: boolean, errores: string[] }
 */
function validarSalidaAnticipada(datos) {
  const errores = [];

  if (
    !datos.estudiante_id ||
    typeof datos.estudiante_id !== "number" ||
    datos.estudiante_id <= 0
  ) {
    errores.push("estudiante_id inválido o no proporcionado");
  }

  if (!validarFecha(datos.fecha)) {
    errores.push("fecha inválida o en el futuro (formato: YYYY-MM-DD)");
  }

  if (!validarHoraSalida(datos.hora_salida)) {
    errores.push("hora_salida inválida (formato: HH:MM:SS o HH:MM)");
  }

  if (!validarMotivo(datos.motivo)) {
    errores.push("motivo inválido (mínimo 3 caracteres, máximo 255)");
  }

  if (datos.es_medico !== undefined && !validarEsMedico(datos.es_medico)) {
    errores.push("es_medico debe ser booleano (true/false) o 0/1");
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}

/**
 * Normaliza los datos de entrada para una salida anticipada
 * @param {Object} datos - Datos crudos del request
 * @returns {Object} Datos normalizados
 */
function normalizarDatos(datos) {
  return {
    estudiante_id: parseInt(datos.estudiante_id),
    fecha: datos.fecha,
    hora_salida: normalizarHora(datos.hora_salida),
    motivo: datos.motivo ? datos.motivo.trim() : "",
    es_medico: datos.es_medico === true || datos.es_medico === 1 ? 1 : 0,
    observaciones: datos.observaciones ? datos.observaciones.trim() : null,
  };
}

/**
 * Comprueba si una hora es razonable para una salida (no demasiado temprana)
 * @param {string} horaSalida - Formato HH:MM:SS
 * @param {string} horaMinima - Formato HH:MM:SS (defecto: '08:00:00')
 * @returns {boolean} true si la hora es válida para una salida
 */
function esHoraSalidaValida(horaSalida, horaMinima = "08:00:00") {
  return horaSalida >= horaMinima;
}

module.exports = {
  validarHoraSalida,
  validarFecha,
  validarMotivo,
  validarEsMedico,
  normalizarHora,
  validarSalidaAnticipada,
  normalizarDatos,
  esHoraSalidaValida,
};
