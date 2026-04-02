import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import styles from './index.module.less'

const TONE_CLASS_MAP = {
  muted: styles.hintMuted,
  success: styles.hintSuccess,
  danger: styles.hintDanger,
}

const VerifyCaptchaBox = ({
  state,
  disabled,
  label,
  hint,
  hintTone,
  providerName,
  providerSub,
  onToggle,
}) => {
  const checked = state === 'success'
  const loading = state === 'loading'
  const handleToggle = useCallback(() => {
    if (disabled || loading) return
    onToggle(!checked)
  }, [checked, disabled, loading, onToggle])

  const handleKeyDown = useCallback(
    (event) => {
      if (disabled || loading) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onToggle(!checked)
      }
    },
    [checked, disabled, loading, onToggle]
  )

  const stateClass = state === 'unavailable'
    ? styles.stateUnavailable
    : state === 'error'
      ? styles.stateError
      : loading
        ? styles.stateLoading
        : checked
          ? styles.stateChecked
          : styles.stateIdle
  const hintToneClass = TONE_CLASS_MAP[hintTone] || styles.hintMuted

  return (
    <div
      className={`${styles.root} ${stateClass} ${disabled ? styles.isDisabled : ''}`}
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-busy={loading || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.mainRow}>
        <span className={styles.checkboxShell} aria-hidden="true">
          <span className={styles.checkboxFrame}>
            {loading ? (
              <span className={styles.spinner} />
            ) : checked ? (
              <span className={styles.checkmark} />
            ) : state === 'error' || state === 'unavailable' ? (
              <span className={styles.errmark} />
            ) : null}
          </span>
        </span>

        <span className={styles.label}>{label}</span>

        <span className={styles.provider}>
          <span className={styles.providerLogo} />
          <span className={styles.providerText}>
            <span className={styles.providerName}>{providerName}</span>
            <span className={styles.providerSub}>{providerSub}</span>
          </span>
        </span>
      </div>

      <div className={styles.footerRow}>
        <span className={`${styles.hint} ${hintToneClass}`}>{hint}</span>
        <span className={styles.terms}>隐私 • 条款</span>
      </div>
    </div>
  )
}

VerifyCaptchaBox.propTypes = {
  state: PropTypes.oneOf(['idle', 'loading', 'success', 'error', 'unavailable']),
  disabled: PropTypes.bool,
  label: PropTypes.string,
  hint: PropTypes.string,
  hintTone: PropTypes.oneOf(['muted', 'success', 'danger']),
  providerName: PropTypes.string,
  providerSub: PropTypes.string,
  onToggle: PropTypes.func,
}

VerifyCaptchaBox.defaultProps = {
  state: 'idle',
  disabled: false,
  label: '验证本次登录',
  hint: '',
  hintTone: 'muted',
  providerName: 'Veloxis',
  providerSub: 'Access Guard',
  onToggle: () => {},
}

export default VerifyCaptchaBox
