import { AllFonts } from './AllFonts'
import FontFileIcon from './assets/icons/FontFileIcon'
import HeartIcon from './assets/icons/HeartIcon'
import { FontSizeToggleGroup } from './components/FontSizeToggleGroup'
import NavBar from './components/NavBar'
import { Favorites } from './Favorites'
import { useFontFavorites } from './hooks/useFavorites'
import { useLoadLocalFonts } from './hooks/useLoadLocalFonts'

function Content() {
  // Destructure the result of useLoadLocalFonts hook
  const [{ loading, error, value: data, permissionStatus, hasBrowserSupport }, fetchFonts] = useLoadLocalFonts()

  // Check if the browser supports the Local Font Access API
  if (!hasBrowserSupport) {
    return <p>Local Font Access API not supported in this browser. Try switching to the latest version of Chrome.</p>
  }

  // Check if permission to access local fonts is denied
  if (permissionStatus === 'denied') {
    return <p>Local Font Access API permission denied. Please allow access to local fonts in your browser settings.</p>
  }

  // If there is an error, show a button to request fonts again
  if (error) {
    return (
      <div>
        <p>
          Something went wrong:
          {error.message}
        </p>
        <button onClick={fetchFonts}>Try again</button>
      </div>
    )
  }

  // If no data is available, show a button to request fonts
  if (!data) {
    return <button onClick={fetchFonts}>Request Fonts</button>
  }

  // Show loading message while fonts are being fetched
  if (loading) {
    return <p>Loading...</p>
  }

  return <Fonts data={data} />
}

function Fonts({ data }: { data: FontFamiliesDictionary }) {
  const [favorites, toggleFavorite] = useFontFavorites()

  return (
    <NavBar
      defaultValue="all-fonts"
      options={[
        { value: 'all-fonts',
          tab: {
            children: 'All fonts',
            icon: <FontFileIcon height={16} />,
          },
          panel: {
            children: <AllFonts fontFamilies={data} favorites={favorites} toggleFavorite={toggleFavorite} />,
            keepMounted: true,
          },
        },
        {
          value: 'favorites',
          tab: {
            children: 'Favorites',
            icon: <HeartIcon height={16} />,
          },
          panel: {
            children: <Favorites fontFamilies={data} favorites={favorites} toggleFavorite={toggleFavorite} />,
            keepMounted: true,
          },
        },
      ]}
      extra={(
        <FontSizeToggleGroup />
      )}
    />
  )
}

function App() {
  return (
    <div>
      <h1 style={{ color: 'var(--color-gray-600)' }}>
        Your Local Fonts
      </h1>
      <h4 style={{ marginBottom: '2rem', color: 'var(--color-primary)' }}>Presented by Paper</h4>
      <Content />
    </div>
  )
}

export default App
