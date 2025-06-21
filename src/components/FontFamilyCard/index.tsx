import { memo, useEffect, useState } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import type { useFontFavorites } from '../../hooks/useFavorites'
import DragIcon from '../../icons/DragIcon'
import HeartIcon from '../../icons/HeartIcon'
import styles from './index.module.css'
type Props = FontFamily & {
  isFavorite?: boolean
  updateFavorites: ReturnType<typeof useFontFavorites>[1]
  updateFavoritesDelay?: number
}

export const FontFamilyCard = memo(({ id, fullName, fontStyles, isFavorite, updateFavorites, updateFavoritesDelay = 0, ...props }: Props) => {
  const [localIsFavorite, setLocalIsFavorite] = useState(isFavorite ?? false)

  // Update local state when prop changes
  useEffect(() => {
    setLocalIsFavorite(isFavorite ?? false)
  }, [isFavorite])

  const debouncedOnFavoriteClick = useDebounce(() => {
    if (localIsFavorite) updateFavorites({ type: 'UNFAVORITE', payload: id })
    else updateFavorites({ type: 'FAVORITE', payload: id })
  }, updateFavoritesDelay)

  // The debounce delay allows us to animate an element in and out
  const handleFavoriteClick = () => {
    setLocalIsFavorite(!localIsFavorite)
    debouncedOnFavoriteClick()
  }

  const isTransitioningToFavorite = localIsFavorite && !isFavorite
  const isTransitioningToUnfavorite = !localIsFavorite && isFavorite

  return (
    <div
      {...props}
      className={`${styles.fontFamilyCardContainer} 
        ${isTransitioningToFavorite ? ' favorite-transition ' : ''} 
        ${isTransitioningToUnfavorite ? ' unfavorite-transition ' : ''}`}
    >
      <div
        className={styles.fontFamilyCard}
        aria-selected={localIsFavorite}
        onDoubleClick={handleFavoriteClick}
      >
        <div className={styles.fontFamilyCardTextContent}>
          <h1 className={styles.fontFamilyCardTitle} style={{ fontFamily: fullName }}>
            {fullName}
          </h1>
          <p className={styles.fontFamilyCardStylesContainer}>
            {fontStyles?.map(font => (
              <span key={font.postscriptName} className={styles.fontFamilyCardStylesText} style={{ fontFamily: font.postscriptName }}>
                {font.style}
                {font !== fontStyles[fontStyles.length - 1] && (
                  <span className={styles.fontFamilyCardStylesTextSeparator}>
                    {' '}
                    /
                    {' '}
                  </span>
                )}
              </span>
            ))}
          </p>
        </div>

        <div className={styles.fontFamilyCardActions}>
          <button
            onClick={handleFavoriteClick}
            className={styles.favoriteButton}
            aria-label={localIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <HeartIcon height={36} fill={localIsFavorite ? 'currentColor' : 'none'} />
          </button>
          <DragIcon height={28} color="var(--color-gray-300)" />
        </div>
      </div>
    </div>

  )
})
