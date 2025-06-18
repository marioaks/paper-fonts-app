import './index.css'

type Props = {
  currentTab: 'all-fonts' | 'favorites'
  onTabChange: (tab: 'all-fonts' | 'favorites') => void
}

export const NavigationTabs = ({ currentTab, onTabChange }: Props) => {
  return (
    <div className="sticky-navigation-tabs">
      <div className="navigation-tabs">
        <a
          target="_self"
          className={`tab ${currentTab === 'all-fonts' ? 'active' : ''}`}
          onClick={() => onTabChange('all-fonts')}
        >
          <h3>All Fonts</h3>
        </a>
        <a
          target="_self"
          className={`tab  ${currentTab === 'favorites' ? 'active' : ''}`}
          onClick={() => onTabChange('favorites')}
        >
          <h3>Favorites</h3>
        </a>
      </div>
    </div>
  )
}
