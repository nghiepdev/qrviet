import {ADDITIONAL_DATA_NAMES, EMV_TAG_NAMES, type TlvField} from '#/lib/emv'
import {useT} from '#/i18n'

const NESTED_NAMES: Record<string, Record<string, string>> = {
  '38': {'00': 'GUID', '01': 'Beneficiary organization', '02': 'Service code'},
  '38.01': {'00': 'Acquirer ID (BIN)', '01': 'Merchant ID (account / card)'},
  '62': ADDITIONAL_DATA_NAMES,
}

function nameFor(path: string, id: string): string {
  if (!path)
    return (
      EMV_TAG_NAMES[id] ??
      (Number(id) >= 26 && Number(id) <= 51
        ? 'Merchant Account Information'
        : Number(id) >= 80
          ? 'Unreserved template'
          : '')
    )
  const map = NESTED_NAMES[path] ?? (path.startsWith('62') ? ADDITIONAL_DATA_NAMES : undefined)
  return (
    map?.[id] ??
    (path.length === 2 && Number(path) >= 26 && Number(path) <= 51
      ? id === '00'
        ? 'GUID'
        : ''
      : '')
  )
}

function Rows({fields, path, depth}: {fields: TlvField[]; path: string; depth: number}) {
  return (
    <>
      {fields.map((f, i) => {
        const fullPath = path ? `${path}.${f.id}` : f.id
        return (
          <FragmentRow
            key={`${fullPath}-${i}`}
            field={f}
            path={path}
            fullPath={fullPath}
            depth={depth}
          />
        )
      })}
    </>
  )
}

function FragmentRow({
  field,
  path,
  fullPath,
  depth,
}: {
  field: TlvField
  path: string
  fullPath: string
  depth: number
}) {
  return (
    <>
      <tr className="border-b border-border last:border-b-0 align-top">
        <td
          className="py-1.5 pr-3 qv-mono text-xs whitespace-nowrap"
          style={{paddingLeft: depth * 14}}
        >
          {depth > 0 && <span className="text-secondary">└ </span>}
          {field.id}
          <span className="text-secondary"> · {String(field.length).padStart(2, '0')}</span>
        </td>
        <td className="py-1.5 pr-3 text-xs text-secondary">{nameFor(path, field.id)}</td>
        <td className="py-1.5 qv-mono text-xs break-all">{field.children ? '' : field.value}</td>
      </tr>
      {field.children && <Rows fields={field.children} path={fullPath} depth={depth + 1} />}
    </>
  )
}

/** Field-by-field view of an EMV payload. */
export function TlvTable({fields}: {fields: TlvField[]}) {
  const t = useT()
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left">
        <thead className="bg-muted">
          <tr className="text-xs text-secondary">
            <th className="py-1.5 px-2 font-semibold">{t('tools.tag')}</th>
            <th className="py-1.5 pr-3 font-semibold">{t('tools.name')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('tools.value')}</th>
          </tr>
        </thead>
        <tbody className="[&_td:first-child]:pl-2">
          <Rows fields={fields} path="" depth={0} />
        </tbody>
      </table>
    </div>
  )
}
