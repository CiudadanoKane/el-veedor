import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql'
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
