interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  fullPage?: boolean
  text?: string
}

export default function LoadingSpinner({ size = 'md', fullPage = false, text }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-[3px]',
  }

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizes[size]} rounded-full animate-spin`}
        style={{ borderColor: 'var(--c-border)', borderTopColor: 'var(--c-accent)' }}
      />
      {text && (
        <p className="text-sm" style={{ color: 'var(--c-text-3)' }}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullPage) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{ backgroundColor: 'transparent', backdropFilter: 'blur(4px)' }}
      >
        {spinner}
      </div>
    )
  }

  return spinner
}
