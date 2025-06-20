import FontFileIcon from './assets/icons/FontFileIcon'
import HeartIcon from './assets/icons/HeartIcon'
import { FontSizeToggleGroup } from './components/FontSizeToggleGroup'
import { AllFonts } from './components/Lists/AllFonts'
import { Favorites } from './components/Lists/Favorites'
import NavBar from './components/NavBar'
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
        <button onClick={fetchFonts} className="fetch-fonts-button">Try again</button>
      </div>
    )
  }


  // If no data is available, show a button to request fonts
  if (!data || permissionStatus === 'prompt') {
    return <button onClick={fetchFonts} className="fetch-fonts-button">Request Fonts</button>
  }

  // Show loading message while fonts are being fetched
  if (loading) {
    return <p>Loading...</p>
  }

  return <Fonts data={data} />
}

function Fonts({ data }: { data: FontFamiliesDictionary }) {
  const [favorites, updateFavorites] = useFontFavorites()

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
            children: <AllFonts fontFamilies={data} favorites={favorites} updateFavorites={updateFavorites} />,
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
            children: <Favorites fontFamilies={data} favorites={favorites} updateFavorites={updateFavorites} />,
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
      <h1 className="page-title">
        Your Local Fonts
      </h1>
      <h4 className="page-subtitle">Presented by Paper</h4>
      <Content />
    </div>
  )
}

export default App
