// Ikony 1:1 z Twojej aplikacji (folder icon/ -> public/icons/)
export const UNIT_ICON = {
  gen: '/icons/system-glosowania.jpg',
  eco: '/icons/komisja-ekologii.jpg',
  trans: '/icons/komisja-transportu.jpg',
  edu: '/icons/komisja-edukacji.jpg',
  stat: '/icons/komisja-statutowa.jpg',
  promo: '/icons/dzial-promocji.jpg',
}

export const UNIT_COLOR = {
  ogolne: '#F2C14E',
  ekologia: '#8BD15A',
  transport: '#5B8DEF',
  edukacja: '#3CC9C0',
  statutowa: '#A78BFA',
  promocja: '#F06BA0',
}

export function iconFor(unit) {
  if (!unit) return UNIT_ICON.gen
  if (UNIT_ICON[unit.icon]) return UNIT_ICON[unit.icon]
  return UNIT_ICON.gen
}

export function colorFor(unit) {
  if (!unit) return '#F2C14E'
  if (unit.color) return unit.color
  return UNIT_COLOR[unit.id] || '#5B8DEF'
}

export default function UnitIcon({ unit, size = 56 }) {
  return (
    <img
      src={iconFor(unit)}
      alt={unit?.name || 'DSM'}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 14 }}
    />
  )
}
