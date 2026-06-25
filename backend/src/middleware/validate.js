const { z } = require("zod");

const schemas = {
  login: z.object({
    email: z.string().email("Email inválido").max(255),
    password: z.string().min(1, "Contraseña requerida").max(255),
  }),

  crearEstudiante: z.object({
    rut: z.string().min(1, "RUT es obligatorio").max(20),
    nombre: z.string().min(1, "Nombre es obligatorio").max(100),
    apellido: z.string().min(1, "Apellido es obligatorio").max(100),
    sexo: z.string().max(10).optional().default(""),
    curso_id: z.number().int().positive("curso_id debe ser un número positivo"),
  }),

  actualizarEstudiante: z.object({
    rut: z.string().min(1, "RUT es obligatorio").max(20).optional(),
    nombre: z.string().min(1, "Nombre es obligatorio").max(100).optional(),
    apellido: z.string().min(1, "Apellido es obligatorio").max(100).optional(),
    sexo: z.string().max(10).optional(),
    curso_id: z.number().int().positive().optional(),
  }),

  crearCurso: z.object({
    nombre: z.string().min(1, "Nombre del curso es obligatorio").max(50),
  }),

  actualizarCurso: z.object({
    nombre: z.string().min(1, "Nombre del curso es obligatorio").max(50),
  }),

  marcarAsistencia: z.object({
    estudiante_id: z.number().int().positive(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD"),
    hora_ingreso: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora debe ser HH:MM o HH:MM:SS"),
  }),

  justificarAtraso: z.object({
    justificado: z.boolean(),
    justificacion_descripcion: z.string().max(500).nullable().optional(),
  }),

  editarHora: z.object({
    hora_ingreso: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora debe ser HH:MM o HH:MM:SS"),
  }),

  crearSalidaAnticipada: z.object({
    estudiante_id: z.number().int().positive(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD"),
    hora_salida: z.string().regex(/^\d{2}:\d{2}$/, "Hora debe ser HH:MM"),
    motivo: z.string().min(3, "Motivo debe tener al menos 3 caracteres").max(255),
    es_medico: z.boolean().optional().default(true),
    observaciones: z.string().max(500).nullable().optional(),
  }),

  crearUsuario: z.object({
    nombre: z.string().min(1, "Nombre es obligatorio").max(100),
    email: z.string().email("Email inválido").max(255),
    password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres").max(255),
    rol: z.enum(["admin", "director", "inspector", "profesor"]),
    activo: z.any().optional(),
    permisos: z.array(
      z.object({
        clave: z.string(),
        readOnly: z.boolean(),
      })
    ).optional(),
  }),

  bulkUpdateCurso: z.object({
    estudiante_ids: z.array(z.number().int().positive()).min(1, "Debe incluir al menos un estudiante"),
    curso_id: z.number().int().positive("curso_id debe ser un número positivo"),
  }),

  crearAtrasoClase: z.object({
    estudiante_id: z.number().int().positive("estudiante_id es requerido"),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD").optional(),
    hora_llegada: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora debe ser HH:MM"),
    clase_destino: z.string().min(1, "Clase destino es requerida").max(200),
  }),

  actualizarAtrasoClase: z.object({
    hora_llegada: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora debe ser HH:MM").optional(),
    clase_destino: z.string().min(1).max(200).optional(),
  }),

  crearMateriaClase: z.object({
    nombre: z.string().min(1, "Nombre es obligatorio").max(120),
    descripcion: z.string().max(500).nullable().optional(),
    activa: z.boolean().optional().default(true),
  }),

  actualizarMateriaClase: z.object({
    nombre: z.string().min(1, "Nombre es obligatorio").max(120).optional(),
    descripcion: z.string().max(500).nullable().optional(),
    activa: z.boolean().optional(),
  }),

  crearAsignacionClase: z.object({
    curso_id: z.number().int().positive("curso_id debe ser un número positivo"),
    materia_id: z.number().int().positive("materia_id debe ser un número positivo"),
    profesor_id: z.number().int().positive().optional().nullable(),
    activa: z.boolean().optional().default(true),
  }),

  actualizarAsignacionClase: z.object({
    curso_id: z.number().int().positive().optional(),
    materia_id: z.number().int().positive().optional(),
    profesor_id: z.number().int().positive().optional().nullable(),
    activa: z.boolean().optional(),
  }),

  registrarAsistenciaClase: z.object({
    estudiante_id: z.number().int().positive("estudiante_id es requerido"),
    curso_id: z.number().int().positive("curso_id es requerido"),
    materia_id: z.number().int().positive("materia_id es requerido"),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD"),
    estado: z.enum(["presente", "ausente", "justificado"]),
    justificacion: z.string().max(500).nullable().optional(),
  }),

  idParam: z.object({
    id: z.string().regex(/^\d+$/, "ID debe ser numérico"),
  }),

  idParamCurso: z.object({
    cursoId: z.string().regex(/^\d+$/, "Curso ID debe ser numérico"),
  }),

  idParamEstudiante: z.object({
    estudianteId: z.string().regex(/^\d+$/, "Estudiante ID debe ser numérico"),
  }),

  fechaQuery: z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD").optional(),
  }),
};

function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();

    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errores = result.error.issues.map((i) => ({
        campo: i.path.join("."),
        mensaje: i.message,
        valorRecibido: i.path.length ? req.body[i.path[0]] : undefined,
      }));
      console.error(`[validate] Schema '${schemaName}' falló:`, {
        body: req.body,
        errores,
      });
      return res.status(400).json({ error: "Datos inválidos", detalles: errores });
    }

    req.body = result.data;
    if (schemaName === 'crearUsuario') {
      console.log('[validate] crearUsuario OK:', req.body);
    }
    next();
  };
}

module.exports = { validate, schemas };
