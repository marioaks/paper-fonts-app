import { Toggle, ToggleGroup } from '@base-ui-components/react'
import { useState } from 'react'
import styles from './index.module.css'

const zoomMap = {
  small: 0.75,
  medium: 1,
  large: 1.25,
}

export const FontSizeToggleGroup = () => {
  const [value, setValue] = useState('medium')
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(values) => {
        const value = values[0] as keyof typeof zoomMap

        // Not the best way to do this!!
        // Ideally we should be virtualizing the lists allowing us to rerender normally rather tha manipulating the DOM
        const fontFamilyContent = document.querySelectorAll('.drag-and-drop-list') as unknown as HTMLElement[]
        if (fontFamilyContent) {
          const zoom = zoomMap[value] || 1
          fontFamilyContent.forEach((content) => {
            content.style.setProperty('zoom', zoom.toString())
          })
        }
        setValue(value)
      }}
      className={styles.Panel}
    >
      <Toggle aria-label="Small" value="small" className={styles.Button}>
        <h5>A</h5>
      </Toggle>
      <Toggle aria-label="Medium" value="medium" className={styles.Button}>
        <h4>A</h4>
      </Toggle>
      <Toggle aria-label="Large" value="large" className={styles.Button}>
        <h3>A</h3>
      </Toggle>
    </ToggleGroup>
  )
}
