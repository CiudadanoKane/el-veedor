import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS, ESTADO_ACTIVO } from '../lib/constants'
import {
  whereFromFilters, buildWhere, soloContratosValidos, haceDias,
} from '../lib/soql'
import { adaptList } from '../adapters/secop2Adapter'

const DS = DATASETS.CONTRATOS

// ALERTA: Fechas inconsistentes — fecha de fin anterior a la fecha de inicio.
// Lógicamente imposible; señala descuido en el registro público (o amerita revisión).
const CONDICIONES_FECHAS = [
  soloContratosValidos(),
  'fecha_de_inicio_del_contrato IS NOT NULL',
  'fecha_de_fin_del_contrato IS NOT NULL',
  'fecha_de_fin_del_contrato < fecha_de_inicio_del_contrato',
]

// ALERTA: contratos registrados en $0 que SÍ tienen presupuesto comprometido.
// Muchos $0 son legítimos (comodatos, convenios de "aunar esfuerzos", acuerdos
// marco). Pero si la entidad reservó presupuesto vía CDP y aun así dejó el valor
// del contrato en cero, hay una contradicción objetiva: sí hay recursos públicos
// involucrados y el monto no quedó registrado.
// La cota superior del CDP descarta valores basura (hay registros con cifras
// imposibles que distorsionarían el total).
const CDP_MAX = 1e12

const CONDICIONES_SIN_VALOR = [
  soloContratosValidos(),
  'valor_del_contrato = 0',
  'saldo_cdp > 0',
  `saldo_cdp < ${CDP_MAX}`,
]

export function useContratosSinValor(filters = {}) {
  const conteo = useQuery({
    queryKey: ['alerta', 'sinvalor', 'conteo', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_SIN_VALOR))
      // Solo el conteo: sumar los CDP inflaría la cifra, porque un mismo
      // certificado presupuestal suele amparar varios contratos.
      return socrataQuery(DS, `SELECT count(id_contrato) as n ${where} LIMIT 1`)
    },
    select: (rows) => ({ total: parseInt(rows[0]?.n ?? 0, 10) }),
  })

  const lista = useQuery({
    queryKey: ['alerta', 'sinvalor', 'lista', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_SIN_VALOR))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY saldo_cdp DESC LIMIT 100`,
      )
    },
    select: adaptList,
  })

  return { conteo, lista }
}

// ALERTA: contratos sin contratista identificado.
// SECOP agrupa bajo "No Definido" los registros donde no quedó el NIT o la
// cédula de quien recibió el dinero. No es un error de digitación menor: en
// esos contratos es literalmente imposible saber a quién le pagó el Estado.
const CONDICIONES_SIN_CONTRATISTA = [
  soloContratosValidos(),
  `documento_proveedor = 'No Definido'`,
]

export function useSinContratista(filters = {}) {
  const conteo = useQuery({
    queryKey: ['alerta', 'sincontratista', 'conteo', filters],
    queryFn: () => {
      const where = buildWhere(
        whereFromFilters(filters, [
          ...CONDICIONES_SIN_CONTRATISTA,
          // Cota para que un valor mal digitado no distorsione el total
          'valor_del_contrato < 1000000000000',
        ]),
      )
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as n, sum(valor_del_contrato) as valor ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.n ?? 0, 10),
      valor: parseFloat(rows[0]?.valor ?? 0),
    }),
  })

  const lista = useQuery({
    queryKey: ['alerta', 'sincontratista', 'lista', filters],
    queryFn: () => {
      const where = buildWhere(
        whereFromFilters(filters, [
          ...CONDICIONES_SIN_CONTRATISTA,
          'valor_del_contrato < 1000000000000',
        ]),
      )
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT 100`,
      )
    },
    select: adaptList,
  })

  return { conteo, lista }
}

// ALERTA: obra paralizada.
// Un contrato de obra vencido hace más de seis meses, que además reporta
// dinero sin ejecutar. La combinación es la señal más preocupante: la obra
// no terminó, el plazo se venció hace rato y quedaron recursos sin gastar.
const CONDICIONES_OBRA_PARALIZADA = [
  `estado_contrato = '${ESTADO_ACTIVO}'`,
  `tipo_de_contrato = 'Obra'`,
  `fecha_de_fin_del_contrato >= '2000-01-01T00:00:00'`,
  `fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato`,
  `fecha_de_fin_del_contrato < '${haceDias(180)}'`,
  `valor_pendiente_de_ejecucion > 0`,
  // Cota para que un valor mal digitado no distorsione el total
  `valor_pendiente_de_ejecucion < 1000000000000`,
]

export function useObraParalizada(filters = {}) {
  const conteo = useQuery({
    queryKey: ['alerta', 'obra', 'conteo', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_OBRA_PARALIZADA))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as n, sum(valor_pendiente_de_ejecucion) as pendiente
         ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.n ?? 0, 10),
      pendiente: parseFloat(rows[0]?.pendiente ?? 0),
    }),
  })

  const lista = useQuery({
    queryKey: ['alerta', 'obra', 'lista', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_OBRA_PARALIZADA))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where}
         ORDER BY valor_pendiente_de_ejecucion DESC LIMIT 100`,
      )
    },
    select: adaptList,
  })

  return { conteo, lista }
}

// ALERTA: adición de tiempo excesiva.
//
// El umbral se despeja algebraicamente para poder filtrar en el servidor:
//   pct = días / plazo_original,  con plazo_original = (fin − inicio) − días
//   pct > 0,5  ⟺  días × 3   > (fin − inicio)
//   pct > 1    ⟺  días × 2   > (fin − inicio)
//   pct > 2    ⟺  días × 1,5 > (fin − inicio)
export const NIVELES_ADICION = {
  media: { label: 'Más del 50%', factor: 3 },
  alta: { label: 'Más del 100%', factor: 2 },
  critica: { label: 'Más del 200%', factor: 1.5 },
}

function condicionesAdicionExcesiva(nivel) {
  const { factor } = NIVELES_ADICION[nivel] || NIVELES_ADICION.alta
  return [
    soloContratosValidos(),
    'dias_adicionados > 0',
    'dias_adicionados <= 3650',
    'fecha_de_fin_del_contrato > fecha_de_inicio_del_contrato',
    `dias_adicionados * ${factor} > date_diff_d(fecha_de_fin_del_contrato, fecha_de_inicio_del_contrato)`,
  ]
}

export function useAdicionTiempoExcesiva(filters = {}, nivel = 'alta') {
  const conteo = useQuery({
    queryKey: ['alerta', 'adiciontiempo', 'conteo', filters, nivel],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, condicionesAdicionExcesiva(nivel)))
      return socrataQuery(DS, `SELECT count(id_contrato) as n ${where} LIMIT 1`)
    },
    select: (rows) => ({ total: parseInt(rows[0]?.n ?? 0, 10) }),
  })

  const lista = useQuery({
    queryKey: ['alerta', 'adiciontiempo', 'lista', filters, nivel],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, condicionesAdicionExcesiva(nivel)))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY dias_adicionados DESC LIMIT 100`,
      )
    },
    select: (rows) =>
      adaptList(rows).map((c) => {
        // El plazo original y el % se calculan en cliente para mostrarlos
        let plazoOriginal = null
        let pctAdicion = null
        if (c.startDate && c.endDate) {
          const dur = Math.round(
            (new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 86_400_000,
          )
          const original = dur - (c.daysAdded || 0)
          if (original > 0) {
            plazoOriginal = original
            pctAdicion = Math.round(((c.daysAdded || 0) / original) * 100)
          }
        }
        return { ...c, plazoOriginal, pctAdicion }
      }),
  })

  return { conteo, lista }
}

export function useFechasInconsistentes(filters = {}) {
  const conteo = useQuery({
    queryKey: ['alerta', 'fechas', 'conteo', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_FECHAS))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as n, sum(valor_del_contrato) as valor ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.n ?? 0, 10),
      valor: parseFloat(rows[0]?.valor ?? 0),
    }),
  })

  const lista = useQuery({
    queryKey: ['alerta', 'fechas', 'lista', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_FECHAS))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT 100`,
      )
    },
    select: adaptList,
  })

  return { conteo, lista }
}
