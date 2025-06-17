import { AllFonts } from './AllFonts'
import { useLoadLocalFonts } from './hooks/useLoadLocalFonts'

function App() {
  // Destructure the result of useLoadLocalFonts hook
  const [{ loading, error, value: data, permissionStatus, hasBrowserSupport }, fetchFonts] = useLoadLocalFonts()

  // Check if the browser supports the Local Font Access API
  if (!hasBrowserSupport) {
    return <p>Local Font Access API not supported in this browser. Try switching to the latest version of Chrome.</p>
  }

  // Check if permission to access local fonts is denied
  if (permissionStatus === 'denied') {
    return <p>Local Font Access API permission denied. Please allow access to local fonts.</p>
  }

  // If there is an error, show a button to request fonts again
  if (error) {
    return <button onClick={fetchFonts}>Request Fonts</button>
  }

  // If no data is available, show a button to request fonts
  if (!data) {
    return <button onClick={fetchFonts}>Request Fonts</button>
  }

  // Show loading message while fonts are being fetched
  if (loading) {
    return <p>Loading...</p>
  }

  // Render the loaded fonts data
  return (
    <div>
      <AllFonts fontFamilies={data} />
    </div>
  )
}

export default App
