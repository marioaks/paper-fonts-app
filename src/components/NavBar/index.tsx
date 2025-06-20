import { Tabs } from '@base-ui-components/react'
import styles from './index.module.css'

type NavigationMenuProps = {
  options: Array<{
    value: Tabs.Tab.Value
    tab: Omit<Tabs.Tab.Props, 'value'> & { icon: React.ReactNode }
    panel: Omit<Tabs.Panel.Props, 'value'>
  }>
  extra?: React.ReactNode
} & Tabs.Root.Props

export default function NavBar({ options, extra, ...props }: NavigationMenuProps) {
  return (
    <Tabs.Root {...props}>
      <Tabs.List className={styles.List}>
        {options.map(option => (
          <Tabs.Tab key={option.value} value={option.value} className={styles.Trigger}>
            <div className={styles.Icon}>
              {option.tab.icon}
            </div>
            {option.tab.children}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className={styles.Indicator} />
        <div className={styles.Extra}>
          {extra}
        </div>
      </Tabs.List>
      {options.map((o) => {
        return <Tabs.Panel key={o.value} className={styles.Panel} value={o.value} {...o.panel} />
      })}


    </Tabs.Root>
  )
}
