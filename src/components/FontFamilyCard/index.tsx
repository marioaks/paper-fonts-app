import { memo, useEffect, useMemo, useState } from 'react'
import DragIcon from '../../assets/icons/DragIcon'
import HeartIcon from '../../assets/icons/HeartIcon'
import styles from './index.module.css'
type Props = {
  name: string
  fontStyles?: FontFamily['styles']
  isFavorited?: boolean
  onFavoriteClick?(): void
}

export const FontFamilyCard = memo(({ name, fontStyles, isFavorited, onFavoriteClick, ...props }: Props) => {
  const [localIsFavorited, setLocalIsFavorited] = useState(isFavorited ?? false)

  // Update local state when prop changes
  useEffect(() => {
    setLocalIsFavorited(isFavorited ?? false)
  }, [isFavorited])

  // Debounced favorite click handler
  const debouncedOnFavoriteClick = useMemo(
    () => {
      let timeoutId: ReturnType<typeof setTimeout>
      return () => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          onFavoriteClick?.()
        }, 1000)
      }
    },
    [onFavoriteClick],
  )

  const handleFavoriteClick = () => {
    setLocalIsFavorited(!localIsFavorited)
    debouncedOnFavoriteClick()
  }

  const isTransitioningToFavorited = localIsFavorited && !isFavorited
  const isTransitioningToUnfavorited = !localIsFavorited && isFavorited

  return (
    <div {...props} className={`${styles.fontFamilyCardContainer} ${isTransitioningToFavorited ? 'favoriting-transition' : ''} ${isTransitioningToUnfavorited ? 'unfavoriting-transition' : ''}`}>
      <div
        className={styles.fontFamilyCard}
        aria-selected={localIsFavorited}
        onDoubleClick={handleFavoriteClick}
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '.5rem', flex: 1, overflow: 'hidden' }}>

          <h1 style={{ fontFamily: name }}>
            {name}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {fontStyles?.map(font => (
              <p key={font.postscriptName} style={{ fontFamily: font.postscriptName, whiteSpace: 'nowrap' }}>
                {font.style}
                {font !== fontStyles[fontStyles.length - 1] && (
                  <>
                    {' '}
                    /
                  </>
                )}
              </p>
            ))}
          </div>
        </div>

        <button
          onClick={handleFavoriteClick}
          className={styles.favoriteButton}
          aria-label={localIsFavorited ? 'Remove from favorites' : 'Add to favorites'}
          style={{
            color: localIsFavorited ? 'var(--color-primary)' : 'var(--color-gray-500)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            opacity: localIsFavorited ? 1 : 0.3,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: '0.5rem',
            borderRadius: '50%',
            transform: localIsFavorited ? 'scale(1.1)' : 'scale(1)',

          }}
        >
          <HeartIcon height={20} fill={localIsFavorited ? 'var(--color-primary)' : 'none'} />
        </button>
        <DragIcon height={20} color="var(--color-gray-300)" />
      </div>
    </div>

  )
})
