import { computed } from 'vue'
let seq = 0
/** Props comunes de campo (label/help/error/required) + id estable. */
export const fieldProps = {
  label: { type: String, default: '' },
  help: { type: String, default: '' },
  error: { type: [String, Boolean], default: '' },
  required: { type: Boolean, default: false }
}
export function useFieldId(props) {
  const auto = 'gb-f-' + (++seq)
  const fid = computed(() => props.id || auto)
  const describedBy = computed(() => props.error ? fid.value + '-error' : (props.help ? fid.value + '-help' : null))
  return { fid, describedBy }
}
