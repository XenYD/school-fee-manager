interface FeeFlowLogoProps {
  /** px size of the icon square */
  size?: number
  /** 'sidebar' = white "Fee", 'auth' = themed "Fee" */
  variant?: 'sidebar' | 'auth'
}

export function FeeFlowIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Dark navy rounded square background */}
      <rect width="40" height="40" rx="10" fill="#0F2D52" />

      {/* Document lines */}
      <rect x="8"  y="11" width="17" height="3"   rx="1.5" fill="#4A90D9" />
      <rect x="8"  y="17" width="14" height="3"   rx="1.5" fill="#4A90D9" opacity="0.85" />
      <rect x="8"  y="23" width="11" height="3"   rx="1.5" fill="#4A90D9" opacity="0.7" />

      {/* Blue circle badge – bottom right */}
      <circle cx="30" cy="30" r="9" fill="#4A90D9" />
      {/* Checkmark */}
      <path
        d="M26 30.2L28.8 33L34 27"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function FeeFlowLogo({ size = 36, variant = 'sidebar' }: FeeFlowLogoProps) {
  const feeColor   = variant === 'sidebar' ? '#FFFFFF' : 'var(--c-text-1)'
  const flowColor  = '#4A90D9'
  const tagColor   = variant === 'sidebar' ? 'rgba(255,255,255,0.45)' : 'var(--c-text-4)'
  const fontSize   = size >= 48 ? '1.5rem' : size >= 36 ? '0.95rem' : '0.85rem'
  const tagSize    = size >= 48 ? '0.65rem' : '0.6rem'

  return (
    <div className="flex items-center gap-3">
      <FeeFlowIcon size={size} />
      <div>
        <div
          style={{
            fontSize,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.18em',
          }}
        >
          <span style={{ color: feeColor }}>Fee</span>
          <span style={{ color: flowColor }}>Flow</span>
        </div>
        <div
          style={{
            fontSize: tagSize,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tagColor,
            marginTop: '1px',
          }}
        >
          School Fee Management
        </div>
      </div>
    </div>
  )
}
