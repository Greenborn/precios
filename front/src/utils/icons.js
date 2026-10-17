const PI_TO_BI = {
  'pi-bars': 'bi-list',
  'pi-times': 'bi-x-lg',
  'pi-check': 'bi-check',
  'pi-search': 'bi-search',
  'pi-plus': 'bi-plus-lg',
  'pi-pencil': 'bi-pencil',
  'pi-trash': 'bi-trash',
  'pi-eye': 'bi-eye',
  'pi-eye-slash': 'bi-eye-slash',
  'pi-link': 'bi-link-45deg',
  'pi-key': 'bi-key',
  'pi-power-off': 'bi-power',
  'pi-save': 'bi-save',
  'pi-chevron-down': 'bi-chevron-down',
  'pi-chevron-up': 'bi-chevron-up',
  'pi-chevron-left': 'bi-chevron-left',
  'pi-chevron-right': 'bi-chevron-right',
  'pi-home': 'bi-house',
  'pi-id-card': 'bi-person-vcard',
  'pi-lock': 'bi-lock',
  'pi-shield': 'bi-shield',
  'pi-sitemap': 'bi-diagram-3',
  'pi-user': 'bi-person',
  'pi-users': 'bi-people',
  'pi-tag': 'bi-tag',
  'pi-tags': 'bi-tags',
  'pi-chart-line': 'bi-graph-up',
  'pi-list': 'bi-list',
  'pi-table': 'bi-table',
  'pi-address-book': 'bi-journal-bookmark'
}

export function piToBi(name) {
  let n = name || ''
  if (n.startsWith('pi ')) n = n.replace('pi ', '')
  if (n.startsWith('pi-')) {
    return PI_TO_BI[n] || 'bi-circle-fill'
  }
  return n
}
